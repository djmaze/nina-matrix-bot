import fetch from "node-fetch"

import { NinaCertainty, NinaMsgType, NinaSeverity, NinaStatus, NinaUrgency } from "./nina_api"

type MowasItem = {
  identifier: string
  status: "Actual"
  msgType: NinaMsgType
  info: {
    event: string
    urgency: NinaUrgency
    severity: NinaSeverity
    certainty: NinaCertainty
    headline: string
    description: string
    instruction: string
    web: string
    parameter: any
    area: {
      areaDesc: string
    }[]
  }[]
}

// type KatwarnItem = {
//   id: string
//   version: number
//   startData: string
//   severity: NinaSeverity
//   type: NinaMsgType
//   i18nTitle: {
//     de: string
//   }
// }

type DwdItem = {
  identifier: string
  status: NinaStatus
  msgType: NinaMsgType
  info: {
    event: string
    urgency: NinaUrgency
    severity: NinaSeverity
    certainty: NinaCertainty
    effective: string
    onset: string
    expires: string
    headline: string
    description: string
    instruction: string
    web: string
    parameter: any
    area: {
      areaDesc: string
    }[]
  }[]
}

export default class WarnLists {
  mowasItems: MowasItem[] = []
  // katwarnItems: KatwarnItem[] = []
  dwdItems: DwdItem[] = []

  async get() : Promise<void> {
    if (!this.mowasItems)
      await this.update()
  }

  async update() : Promise<void> {
    this.mowasItems = await this.getMowasItems()
    // this.katwarnItems = await this.getKatwarnItems()
    this.dwdItems = await this.getDwdItems()
  }

  private async getMowasItems() : Promise<MowasItem[]> {
    const response = await fetch("https://warnung.bund.de/bbk.mowas/gefahrendurchsagen.json")

    return await response.json()
  }

  // private async getKatwarnItems() : Promise<KatwarnItem[]> {
  //   const response = await fetch("https://warnung.bund.de/api31/katwarn/mapData.json")

  //   return await response.json()
  // }

  private async getDwdItems() : Promise<DwdItem[]> {
    const response = await fetch("https://warnung.bund.de/bbk.dwd/unwetter.json")

    return await response.json()
  }

}