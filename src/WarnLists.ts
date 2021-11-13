import fetch from "node-fetch"
import hash from "object-hash"

import { NinaCertainty, NinaMsgType, NinaProvider, NinaSeverity, NinaStatus, NinaUrgency } from "./types"

const FEEDS: Record<NinaProvider, string> = {
  "MOWAS": "https://warnung.bund.de/bbk.mowas/gefahrendurchsagen.json",
  "DWD": "https://warnung.bund.de/bbk.dwd/unwetter.json",
  "KATWARN": "https://warnung.bund.de/bbk.katwarn/warnmeldungen.json",
  "LHP": "https://warnung.bund.de/bbk.lhp/hochwassermeldungen.json",
  "BIWAPP": "https://warnung.bund.de/bbk.biwapp/warnmeldungen.json"
}

export type WarnItem = {
  identifier: string
  sent: string
  status: NinaStatus
  msgType: NinaMsgType
  info: {
    event: string
    urgency: NinaUrgency
    severity: NinaSeverity
    certainty: NinaCertainty
    effective?: string
    onset?: string
    expires?: string
    headline: string
    description: string
    instruction: string
    web?: string
    parameter: any
    area: {
      areaDesc: string
      polygon: any[]
      geocode: {
        valueName: string
        value: string
      }[]
    }[]
  }[]
}

export type HashedWarnItem = WarnItem & {
  provider: NinaProvider
  hash: string
}

type OnUpdateCallback = (item: HashedWarnItem, provider: NinaProvider) => void

export default class WarnLists {
  feeds: Record<NinaProvider, HashedWarnItem[]> = {
    "MOWAS": [],
    "DWD": [],
    "KATWARN": [],
    "LHP": [],
    "BIWAPP": []
  }
  loaded = false

  async get(onUpdate: OnUpdateCallback) : Promise<void> {
    if (!this.loaded)
      await this.update(onUpdate)
  }

  async update(onUpdate: OnUpdateCallback) : Promise<void> {
    console.debug("Updating warn lists")

    const counts = { added: 0, updated: 0, removed: 0 }

    await Promise.all(Object.entries(FEEDS).map(async ([provider, url]) => {
      const response = await fetch(url)
      const newFeed = await response.json() as WarnItem[]
      const oldFeed = this.feeds[provider as NinaProvider] 

      newFeed.forEach(newItem => {
        const hashedNewItem = this.mapItem(newItem, provider as NinaProvider)
        const oldItem = oldFeed.find(oldItem => oldItem.identifier === newItem.identifier)
        if (oldItem) {
          if (oldItem.hash !== hashedNewItem.hash) {
            oldFeed.splice(oldFeed.indexOf(oldItem), 1, hashedNewItem)
            onUpdate(hashedNewItem, provider as NinaProvider)
            counts.updated += 1
          }
        } else {
          oldFeed.push(hashedNewItem)
          onUpdate(hashedNewItem, provider as NinaProvider)
          counts.added += 1
        }
      })

      oldFeed.forEach((oldItem, index) => {
        if (newFeed.findIndex(newItem => newItem.identifier === oldItem.identifier) == -1) {
          oldFeed.splice(index, 1)
          counts.removed += 1
        }
      })
    }))

    this.loaded = true

    console.debug(`added: ${counts.added}, updated: ${counts.updated}, removed: ${counts.removed}`)
  }

  itemsForGeocode(geoCode: string) : HashedWarnItem[] {
    return Object.values(this.feeds).flatMap(items => {
      return items.filter(item => item.info.find(info => info.area.find(area => area.geocode.find(geocode => geocode.value === geoCode))))
    })
  }

  private mapItem(item: WarnItem, provider: NinaProvider): HashedWarnItem {
    return { ...item, provider: provider as NinaProvider, hash: this.hashWarnItem(item) }
  }

  private hashWarnItem(item: WarnItem) : string {
    return hash(item, {
      excludeKeys: (key: string) : boolean => {
        return ["identifier", "sent", "effective", "expires"].includes(key)
      }
    })
  }
}