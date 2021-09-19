import { MessageEvent, TextualMessageEventContent, RichReply } from "matrix-bot-sdk"
import AGSSearch from "../AGSSearch"
import WarningCommand from "./WarningCommand"

export default class SubscribeCommand extends WarningCommand {
  async exec(locationCode: string, event: MessageEvent<TextualMessageEventContent>) : Promise<void> {
    if (this.room.isSubscribed)
      this.room.unsubscribe()

    const agsSearch = new AGSSearch()
    await agsSearch.update()

    const location = agsSearch.get(locationCode)
    if (!location) {
      const replyBody = "Die angegebene Location ist leider ungültig!"
      const reply = RichReply.createFor(this.room.roomId, event, replyBody, replyBody)
      reply["msgtype"] = "m.text"
      this.room.client.sendMessage(this.room.roomId, reply)
      return 
    }

    try {
      await this.room.client.sendStateEvent(this.room.roomId, this.room.settings.LOCATION_EVENT_TYPE, "", {code: locationCode, name: location.name})
    } catch {
      const replyBody = "Bitte gib mir Moderatoren-Berechtigungen, damit ich meine Einstellungen im Raum speichern kann!"
      const reply = RichReply.createFor(this.room.roomId, event, replyBody, replyBody)
      reply["msgtype"] = "m.text"
      this.room.client.sendMessage(this.room.roomId, reply)
      return
    }
    console.log(`subscribed ${this.room.roomId} to ${locationCode}`)
    
    const replyBody = `Danke, du wirst jetzt für die Location <i>${location.name}</i> gewarnt`
    const reply = RichReply.createFor(this.room.roomId, event, replyBody, replyBody)
    reply["msgtype"] = "m.notice"
    this.room.client.sendMessage(this.room.roomId, reply)

    await this.room.subscribe({
      name: location.name,
      code: locationCode
    }, undefined)
  }
}