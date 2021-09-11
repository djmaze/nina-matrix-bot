import fetch from "node-fetch"

import { NinaCertainty, NinaMsgType, NinaProvider, NinaSeverity, NinaStatus, NinaUrgency } from "./nina_api"

const FEEDS: Record<NinaProvider, string> = {
  "MOWAS": "https://warnung.bund.de/bbk.mowas/gefahrendurchsagen.json",
  "DWD": "https://warnung.bund.de/bbk.dwd/unwetter.json",
  "KATWARN": "https://warnung.bund.de/bbk.katwarn/warnmeldungen.json",
  "LHP": "https://warnung.bund.de/bbk.lhp/hochwassermeldungen.json",
  "BIWAPP": "https://warnung.bund.de/bbk.biwapp/warnmeldungen.json"
}

type WarnItem = {
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
    }[]
  }[]
}

export default class WarnLists {
  feeds: Record<NinaProvider, WarnItem[]> = {
    "MOWAS": [],
    "DWD": [],
    "KATWARN": [],
    "LHP": [],
    "BIWAPP": []
  }
  loaded = false

  async get() : Promise<void> {
    if (!this.loaded)
      await this.update()
  }

  async update() : Promise<void> {
    await Promise.all(Object.entries(FEEDS).map(async ([feed_type, url]) => {
      const response = await fetch(url)

      this.feeds[feed_type as NinaProvider] = await response.json()
    }))

    this.loaded = true
  }
}