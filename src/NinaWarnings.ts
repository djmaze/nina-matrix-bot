import AdminLogger from "./AdminLogger"
import { SubscribeCallback, LastSent, MINAWarnItem } from "./types"

import WarnLists, { HashedWarnItem, WarnItem } from "./WarnLists"

export const NINA_PROVIDERS = {"MOWAS": "", "KATWARN": "", "DWD": "", "LHP": "", "BIWAPP": ""}

type NinaArea = {
  areaDesc: string
}

type CallbackSubscription = { callback: SubscribeCallback }

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

  async subscribe(ags: string, callback: SubscribeCallback, warnNow = false, initialSubscribe = false) : Promise<void> {
    const subscription = { callback }

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
    this.logger.debug(`Number of subscriptions: ${Object.keys(this.locations).length}`)
  }

  private async updateSubscriptions() {
    await this.warnLists.update(((item) => {
      this.subscriptionsForItem(item).forEach(subscription => {
        this.warn(subscription, item)
      })
    }))
  }

  private warn(subscription: CallbackSubscription, item: HashedWarnItem) {
    const minaWarnItem = this.mapWarnItem(item)
    subscription.callback(minaWarnItem)
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
