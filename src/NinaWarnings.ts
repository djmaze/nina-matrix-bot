import AdminLogger from "./AdminLogger"

import WarnLists, { HashedWarnItem, WarnItem } from "./WarnLists"

export type NinaMsgType = "Update"

const ninaProviders = {"MOWAS": "", "KATWARN": "", "DWD": "", "LHP": "", "BIWAPP": ""}

export type NinaProvider = keyof typeof ninaProviders

export type NinaSeverity = "Minor" | "Unknown"

export type NinaUrgency = "Immediate" | "Unknown"

export type NinaCertainty = "Observed"

export type NinaStatus = "Actual"

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

type SubscribeCallback = (item: MINAWarnItem) => void

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
  }

  async start() : Promise<void> {
    await this.updateSubscriptions()
    setInterval(this.updateSubscriptions.bind(this), this.interval)
  }

  async subscribe(ags: string, callback: SubscribeCallback, lastSent?: LastSent, warnNow = false, initialSubscribe = false) : Promise<void> {
    const subscription = { callback, lastSent }

    ags = this.cleanAgs(ags)

    if (this.locations[ags]) {
      this.locations[ags].subscriptions.push(subscription)
    } else {
      this.locations[ags] = {
        items: [],
        subscriptions: [subscription]
      }
    }

    if (warnNow) this.warnNow(ags, subscription)

    if (!initialSubscribe) this.logSubscriptions()
  }

  warnNow(ags: string, subscription: CallbackSubscription) : void {
    this.warnLists.itemsForGeocode(ags).forEach(item => this.warn(subscription, item))
  }

  unsubscribe(ags: string, callback: SubscribeCallback) : void {
    ags = this.cleanAgs(ags)

    if (this.locations[ags]) {
      const callbackList = this.locations[ags].subscriptions
      const index = callbackList.findIndex(cb => cb.callback === callback)
      callbackList.splice(index, 1)

      if (!callbackList.length)
        delete this.locations[ags]
    }

    this.logSubscriptions()
  }

  logSubscriptions() : void {
    const subscriptions = Object.entries(this.locations).map(([ags, location]) => {
      return [ags, location.subscriptions.map(s => s.lastSent)]
    })
    console.debug("Subscriptions", subscriptions)
    this.logger.debug(`Number of subscriptions: ${subscriptions.length}`)
  }

  private async updateSubscriptions() {
    await this.warnLists.update(((item) => {
      this.subscriptionsForItem(item).forEach(subscription => {
        this.warn(subscription, item)
      })
    }))
  }

  private warn(subscription: CallbackSubscription, item: HashedWarnItem) {
    const subscriptionLastSent = subscription.lastSent
    const sentDate = new Date(item.sent)

    if (!subscriptionLastSent || ((sentDate > subscriptionLastSent.date) && (item.identifier !== subscriptionLastSent.id || item.hash !== subscriptionLastSent.hash))) {
      subscription.callback(this.mapWarnItem(item))
      subscription.lastSent = { date: sentDate, id: item.identifier, hash: item.hash }
    }
  }

  private subscriptionsForItem(item: WarnItem) : CallbackSubscription[] {
    const geocodes = item.info.flatMap(info => info.area.flatMap(area => area.geocode.flatMap(geocode => geocode)))
    return geocodes.flatMap(geocode => {
      if(this.locations[geocode.value]) return this.locations[geocode.value].subscriptions
      return []
    })
  }

  private mapWarnItem(item: HashedWarnItem) : MINAWarnItem {
    const info = item.info[0]

    return {
      id: item.identifier,
      hash: item.hash,
      event: info.event,
      headline: info.headline,
      description: info.description,
      instruction: info.instruction,
      msgType: item.msgType,
      provider: item.provider,
      urgency: info.urgency,
      severity: info.severity,
      certainty: info.certainty,
      web: info.web,
      areaDesc: this.areaDesc(info.area),
      sent: new Date(item.sent),
      effective: info.effective ? new Date(info.effective) : undefined,
      onset: info.onset ? new Date(info.onset) : undefined,
      expires: info.expires ? new Date(info.expires) : undefined
    }
  }

  private areaDesc(areas: NinaArea[]) : string {
    return areas.map((area) => area.areaDesc).join(", ")
  }

  private cleanAgs(ags: string) : string {
    return ags.slice(0, -7) + "0000000"
  }
}
