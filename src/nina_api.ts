import fetch from "node-fetch"
import hash from "object-hash"
import AdminLogger from "./admin_logger"

import WarnLists, { WarnItem } from "./warn_lists"

const DAYS_SINCE = 365

export type NinaMsgType = "Update"

const ninaProviders = {"MOWAS": "", "KATWARN": "", "DWD": "", "LHP": "", "BIWAPP": ""}

export type NinaProvider = keyof typeof ninaProviders

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
  id: string
  hash: string
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

type SubscribeCallback = (items: MINAWarnItem[], lastSent?: LastSent) => void

export type LastSent = { date: Date, id: string | undefined, hash: string | undefined }

type CallbackSubscription = { callback: SubscribeCallback, lastSent: LastSent | undefined }

type Location = { items: MINAWarnItem[], subscriptions: CallbackSubscription[] }

export default class NinaWarnings {
  warnLists: WarnLists
  interval: number
  locations: Record<string, Location> = {}
  logger: AdminLogger

  constructor(warnLists: WarnLists, interval: number, logger: AdminLogger) {
    this.warnLists = warnLists
    this.interval = interval
    this.logger = logger

    this.start()
  }

  start() : void {
    this.updateLocations()
    setInterval(this.updateLocations.bind(this), this.interval)
  }

  async subscribe(ags: string, callback: SubscribeCallback, lastSent?: LastSent) : Promise<void> {
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
    const [items, providerLastSent] = this.parseResponse(json)

    if (items.length) {
      location.subscriptions.forEach(subscription => {
        const subscriptionLastSent = subscription.lastSent
        let updatedItems = items

        if (subscriptionLastSent) {
          updatedItems = updatedItems.filter((item) => {
            if (item.sent > subscriptionLastSent.date) {
              console.debug(`CHECK ${item.id} === ${subscriptionLastSent.id} && ${item.hash} === ${subscriptionLastSent.hash}`)
              if (item.id === subscriptionLastSent.id && item.hash === subscriptionLastSent.hash)
                return false
              return true
            }
          })
        }

        subscription.callback(updatedItems, providerLastSent)
        subscription.lastSent = providerLastSent
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

  private parseResponse(response: NinaResponse, since?: LastSent) : [MINAWarnItem[], LastSent?] {
    let lastSent: LastSent | undefined

    console.debug("nina response:", response)

    const items = response
      .filter((item) => item.payload.version >= 2)
      .map<NinaResponseItemWithDates>((item) => ({ ...item, sentDate: new Date(item.sent) }))
      .filter((item) => {
        return (!since || item.sentDate > since.date) && this.daysSince(item.sentDate) < DAYS_SINCE
      })

    const warnItems = items
      .map((item) => {
        const provider = item.payload.data.provider
        if (!Object.prototype.hasOwnProperty.call(ninaProviders, provider))
          this.logger.error(`Unknown provider ${provider}`)
        return this.mapProviderData(provider, item)
      })
      .filter((item) => item) as MINAWarnItem[]

    if (warnItems.length) {
      const lastItem = warnItems[warnItems.length - 1]
      lastSent = { date: lastItem.sent, id: lastItem.id, hash: lastItem.hash }
    }


    return [warnItems, lastSent]
  }

  private daysSince(date: Date) {
    const now = new Date().getTime()

    return (now - date.getTime()) / (1000 * 60 * 60 * 24)
  }

  private mapProviderData(provider: NinaProvider, item: NinaResponseItemWithDates) : MINAWarnItem | undefined {
    const data = item.payload.data
    const providerId = item.id.substr(4)
    const providerItem = this.warnLists.feeds[provider].find((ds) => ds.identifier === providerId)

    console.debug("data", data)
    console.debug("providerItem", providerItem)

    if (providerItem) {
      const info = providerItem.info[0]
      return {
        id: item.id,
        hash: this.hashWarnItem(providerItem),
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
    } else this.logger.error(`Provider-Item for ${provider} ${item.id} not found`)
  }

  private areaDesc(areas: NinaArea[]) : string {
    return areas.map((area) => area.areaDesc).join(", ")
  }

  private cleanAgs(ags: string) : string {
    return ags.slice(0, -7) + "0000000"
  }

  private hashWarnItem(item: WarnItem) : string {
    return hash(item, {
      excludeKeys: (key: string) : boolean => {
        return ["identifier", "sent", "effective"].includes(key)
      }
    })
  }
}
