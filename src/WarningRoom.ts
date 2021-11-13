import { MatrixClient, MessageEvent, TextualMessageEventContent } from "matrix-bot-sdk"
import commandsFor, { WarningCommands } from "./warning_commands"
import NinaWarnings from "./NinaWarnings"
import Room from "./Room"
import Settings from "./Settings"
import { LastSent, LastSentEvent, Location, MINAWarnItem, RoomLocation, SubscribeCallback } from "./types"
import AdminLogger from "./AdminLogger"
import checkWarningUpdated from "./checkWarningUpdated"

export default class WarningRoom implements Room {
  client: MatrixClient
  roomId: string
  settings: Settings
  warnings: NinaWarnings
  roomLocation?: RoomLocation
  commands: WarningCommands
  logger: AdminLogger
  alreadyEntered = false
  lastSent?: LastSent

  constructor(client: MatrixClient, roomId: string, warnings: NinaWarnings, settings: Settings, logger: AdminLogger) {
    this.client = client
    this.roomId = roomId
    this.settings = settings
    this.warnings = warnings
    this.commands = commandsFor(this)
    this.logger = logger
  }

  async setup() : Promise<boolean> {
    if (await this.joinedMembers() < 2) {
      console.debug(`Leaving room ${this.roomId} since there are fewer than 2 members`)
      await this.client.leaveRoom(this.roomId)
    } else {
      const [location, lastSent] = await this.fetchRoomState()
      this.lastSent = lastSent

      if (location) {
        await this.subscribe(location, true)
        return true
      }
    }
    return false
  }

  async stateChanged(type: string, content: LastSentEvent) : Promise<void> {
    switch(type) {
    case this.settings.LAST_SENT_TYPE:
      console.debug(`Got new last sent state in room ${this.roomId}:`, content)
      this.lastSent  = this.mapLastSentEvent(content)
      break
    default:
      console.debug(`Unknown state event type ${type}`, content)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async roomCreated() : Promise<void> {}

  async entered() : Promise<void> {
    console.debug("room just entered, sending welcome message", this.roomId)
    this.alreadyEntered = true
    await this.commands.help.exec()
  }

  async left() : Promise<void> {
    console.debug("left the room, unsubscribing", this.roomId)
    if (this.roomLocation)
      this.unsubscribe()
  }

  async memberLeft() : Promise<void> {
    if (await this.joinedMembers() < 2) {
      console.debug(`I am the last one left in room ${this.roomId}, leaving.`)
      await this.client.leaveRoom(this.roomId)
    }
  }

  async command(body: string, event: MessageEvent<TextualMessageEventContent>) : Promise<void> {
    if (body.startsWith("!hilfe")) {
      await this.commands.help.exec()
    } else if (body.startsWith("!suche")) {
      const location = body.split(" ")[1]
      await this.commands.search.exec(location, event)
    } else if (body.startsWith("!abonniere")) {
      const locationCode = body.split(" ")[1]
      await this.commands.subscribe.exec(locationCode, event)
    } else if (body.startsWith("!deabonniere")) {
      await this.commands.unsubscribe.exec(event)
    } else {
      await this.commands.invalidCommand.exec(event)
    }
  }

  async subscribe(location: Location, initialSubscribe: boolean) : Promise<void> {
    const callback: SubscribeCallback = async (item) => {
      switch (checkWarningUpdated(item, this.lastSent)) {
      case "new":
      case "changed":
        await this.sendWarnings([item])
        break
      case "extended":
        console.debug("Sending same warning with different dates", item, this.lastSent)
        await this.sendUpdate(item, this.lastSent!)
        break
      case "unchanged":
        console.debug(`Warning ${item.id} unchanged, skipping notification`)
        break
      }
      await this.saveLastSent({
        date: item.sent,
        id: item.id,
        onset: item.onset,
        expires: item.expires,
        hash: item.hash
      })
    }

    this.roomLocation = {
      id: this.roomId,
      location: {
        name: location.name,
        code: location.code
      }
    }

    this.warnings.subscribe(this.roomLocation.location.code, callback, true, initialSubscribe)
  }

  unsubscribe() : void {
    if (this.roomLocation) {
      this.warnings.unsubscribe(this.roomLocation.location.code, this.roomLocation.callback!)
      this.roomLocation = undefined  
    } else {
      console.error("Tried to unsubscribe in non-subscribed room " + this.roomId)
    }
  }

  get isSubscribed() : boolean {
    return !!this.roomLocation
  }

  get locationName() : string | undefined {
    return this.roomLocation?.location.name
  }

  private async sendWarnings(items: MINAWarnItem[]) : Promise<void> {
    if (!this.roomLocation) {
      this.logger.error(`Room location in room ${this.roomId} not defined`)
      return
    }

    for(const item of items) {
      const date = localizedDateAndTime(item.sent)
      const data = [date, item.msgType, item.urgency, item.severity, item.certainty, item.provider]
        .join(" | ")

      let html = `
        <p><b>${item.event ? "[" + item.event + "]" : ""} ${item.headline}</b></p>
        <p><i>${data}</i></p>
      `

      if (item.effective || item.onset || item.expires) {
        const items: Array<[string, Date]> = []

        if (item.effective && item.effective !== item.onset)
          items.push(["Wirksam ab", item.effective])
        if (item.onset)
          items.push(["Gültig von", item.onset])
        if (item.expires)
          items.push(["Gültig bis", item.expires])

        const item_html = items
          .map(([text, date]) => "<i>" + [text, localizedDateAndTime(date)].join(": ") + "</i>")
          .join("<br>")

        html += "<p>" + item_html + "</p>"
      }

      html += `<p><i>${item.areaDesc}</i></p>`

      if (item.description)
        html += `<p>${item.description}</p>`
      if (item.instruction)
        html += `<p>${item.instruction}</p>`
      if (item.web)
        html += `<p><a href="${item.web}">${item.web}</a></p>`
      await this.client.sendHtmlText(this.roomLocation.id, html)
    }

    if (items.length > 0) {
      console.debug(`Warned about ${items.length} items for location ${this.roomLocation.location.name} in room ${this.roomLocation.id}`)
    }
  }

  private async sendUpdate(item: MINAWarnItem, lastSent: LastSent) {
    if (!this.roomLocation) {
      this.logger.error(`Room location in room ${this.roomId} not defined`)
      return
    }

    if (item.expires) {
      const until = localizedDateAndTime(item.expires)
      const text = `Die Warnung <em>${item.headline}</em> wurde bis <em>${until}</em> verlängert.`
      await this.client.sendHtmlNotice(this.roomLocation.id, text)
    } else {
      this.logger.error(`Don't know what to update with ${item} ${lastSent}`)
    }
  }

  private async saveLastSent(lastSent: LastSent) : Promise<void> {
    this.lastSent = lastSent
    await this.client.sendStateEvent(this.roomId, this.settings.LAST_SENT_TYPE, "", { value: lastSent })
  }

  private async fetchRoomState() : Promise<[Location, LastSent?] | []> {
    let location: Location | undefined

    try {
      location = await this.client.getRoomStateEvent(this.roomId, this.settings.LOCATION_EVENT_TYPE, "")
    } catch (e: any) {
      if (!e.body || e.body.errcode !== "M_NOT_FOUND")
        throw e
    }

    if (location && location.name) {
      let lastSentEvent: LastSentEvent | undefined
      let lastSent: LastSent | undefined

      try {
        lastSentEvent = await this.client.getRoomStateEvent(this.roomId, this.settings.LAST_SENT_TYPE, "")
      } catch (e: any) {
        if (!e.body || e.body.errcode !== "M_NOT_FOUND")
          throw e
      }
      if (lastSentEvent && lastSentEvent.value) {
        lastSent = this.mapLastSentEvent(lastSentEvent) 
      }

      return [location, lastSent]
    }
    
    return []
  }

  private async joinedMembers() : Promise<number> {
    const memberEvents = await this.client.getRoomMembers(this.roomId)
    return memberEvents
      .filter((event) => event.content.membership === "join")
      .length
  }

  private mapLastSentEvent(event: LastSentEvent) : LastSent {
    const {value} = event
    if (typeof value === "string") {
      return {
        date: new Date(value),
        id: undefined,
        onset: undefined,
        expires: undefined,
        hash: undefined
      }
    } else {
      return {
        ...value,
        date: new Date(value.date),
        expires: value.expires ? new Date(value.expires) : undefined,
        onset: value.onset ? new Date(value.onset) : undefined,
      }
    }
  }
}

function localizedDateAndTime(date: Date) : string {
  return [date.toLocaleDateString("de-DE"), date.toLocaleTimeString("de-DE"), "Uhr"].join(" ")
}
