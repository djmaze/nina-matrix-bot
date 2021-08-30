import fetch from "node-fetch"

import WarnLists from "./warn_lists"

const DAYS_SINCE = 365

export type NinaMsgType = "Update"

export type NinaProvider = "MOWAS" | "KATWARN" | "DWD" | "LHP"

export type NinaSeverity = "Minor" | "Unknown"

export type NinaUrgency = "Immediate" | "Unknown"

export type NinaCertainty = "Observed"

export type NinaStatus = "Actual"

type NinaResponseItemData = {
  headline: string
  msgType: NinaMsgType
  provider: NinaProvider
  severity: NinaSeverity
}

type NinaResponseItem = {
  id: string
  payload: {
    version: number
    data: NinaResponseItemData
  }
  sent: string
}

type NinaResponseItemWithDates = NinaResponseItem & {
  sentDate: Date
}

type NinaResponse = NinaResponseItem[]

type NinaArea = {
  areaDesc: string
}

export type MINAWarnItem = {
  headline: string
  description?: string
  instruction?: string
  provider: NinaProvider
  event?: string
  urgency?: NinaUrgency
  severity: NinaSeverity
  certainty?: NinaCertainty
  msgType: NinaMsgType
  web?: string
  areaDesc: string
  sent: Date
  effective?: Date
  onset?: Date
  expires?: Date
}

type SubscribeCallback = (items: MINAWarnItem[], lastSent?: Date) => void

type CallbackSubscription = { callback: SubscribeCallback, lastSent: Date | undefined }

type Location = { items: MINAWarnItem[], subscriptions: CallbackSubscription[] }

export default class NinaWarnings {
  warnLists: WarnLists
  interval: number
  locations: Record<string, Location> = {}

  constructor(warnLists: WarnLists, interval: number) {
    this.warnLists = warnLists
    this.interval = interval

    this.start()
  }

  start() : void {
    this.updateLocations()
    setInterval(this.updateLocations.bind(this), this.interval)
  }

  async subscribe(ags: string, callback: SubscribeCallback, lastSent?: Date) : Promise<void> {
    ags = this.cleanAgs(ags)

    if (this.locations[ags]) {
      this.locations[ags].subscriptions.push({ callback, lastSent })
    } else {
      this.locations[ags] = {
        items: [],
        subscriptions: [{ callback, lastSent }]
      }
    }

    // FIXME Really update immediately on every subscribe?
    await this.warnLists.update()
    await this.updateLocation(ags, this.locations[ags])

    this.logSubscriptions()
  }

  unsubscribe(ags: string, callback: SubscribeCallback) : void {
    ags = this.cleanAgs(ags)

    const callbackList = this.locations[ags].subscriptions
    const index = callbackList.findIndex(cb => cb.callback === callback)
    callbackList.splice(index, 1)

    if (!callbackList.length)
      delete this.locations[ags]

    this.logSubscriptions()
  }

  logSubscriptions() : void {
    console.debug("subscriptions", Object.entries(this.locations).map(([ags, location]) => {
      return [ags, location.subscriptions.map(s => s.lastSent)]
    }))
  }

  private async updateLocation(ags: string, location: Location) {
    const json = await this.get(ags)
    const [items, lastSent] = this.parseResponse(json)

    if (items.length) {
      location.subscriptions.forEach(subscription => {
        let updatedItems = items
        if (subscription.lastSent)
          updatedItems = updatedItems.filter(item => item.sent > subscription.lastSent!)

        subscription.callback(updatedItems, lastSent)
        subscription.lastSent = lastSent
      })
    }
  }

  private async updateLocations() {
    await this.warnLists.update()

    Object.keys(this.locations).forEach(async (ags) => {
      await this.updateLocation(ags, this.locations[ags])
    })
  }

  private async get(ags: string) : Promise<NinaResponse> {
    const response = await fetch(
      `https://warnung.bund.de/api31/dashboard/${ags}.json`,
      {
        headers: {
          "Accept": "application/json"
        }
      }
    )
    return await response.json()
  }

  private parseResponse(response: NinaResponse, since?: Date) : [MINAWarnItem[], Date?] {
    let lastSent: Date | undefined

    console.debug("nina response:", response)

    const items = response
      .filter((item) => item.payload.version >= 2)
      .map<NinaResponseItemWithDates>((item) => ({ ...item, sentDate: new Date(item.sent) }))
      .filter((item) => {
        const sent = new Date(item.sent)
        return (!since || sent > since) && this.daysSince(sent) < DAYS_SINCE
      })
      .sort((a, b) => a.sentDate.getTime() - b.sentDate.getTime())

    if (items.length)
      lastSent = new Date(items[items.length - 1].sent)

    const warnItems = items.map((item) => {
      const provider = item.payload.data.provider
      return this.mapProviderData(provider, item)
    })
    warnItems.sort((a, b) => a.sent.getTime() - b.sent.getTime())

    return [warnItems, lastSent]
  }

  private daysSince(date: Date) {
    const now = new Date().getTime()

    return (now - date.getTime()) / (1000 * 60 * 60 * 24)
  }

  private mapProviderData(provider: NinaProvider, item: NinaResponseItemWithDates) : MINAWarnItem {
    const data = item.payload.data
    const providerId = item.id.substr(4)
    const providerItem = this.warnLists.feeds[provider].find((ds) => ds.identifier === providerId)

    console.debug("data", data)
    console.debug("providerItem", providerItem)

    if (providerItem) {
      const info = providerItem.info[0]
      return {
        event: info.event,
        headline: data.headline,
        description: info.description,
        instruction: info.instruction,
        msgType: data.msgType,
        provider: data.provider,
        urgency: info.urgency,
        severity: data.severity,
        certainty: info.certainty,
        web: info.web,
        areaDesc: this.areaDesc(info.area),
        sent: item.sentDate,
        effective: info.effective ? new Date(info.effective) : undefined,
        onset: info.onset ? new Date(info.onset) : undefined,
        expires: info.expires ? new Date(info.expires) : undefined
      }
    } else throw Error(`Provider-Item for ${provider} ${item.id} not found`)
  }

  private areaDesc(areas: NinaArea[]) : string {
    return areas.map((area) => area.areaDesc).join(", ")
  }

  private cleanAgs(ags: string) : string {
    return ags.slice(0, -7) + "0000000"
  }
}