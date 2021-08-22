import fetch from "node-fetch"

import WarnLists from "./warn_lists"

const DAYS_SINCE = 365

export type NinaMsgType = "Update"

type NinaProvider = "MOWAS" | "KATWARN" | "DWD"

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

type NinaResponse = NinaResponseItem[]

type NinaArea = {
  areaDesc: string
}

type KatwarnItem = {
  identifier: string
  sent: string
  status: NinaStatus
  info: {
    event: string
    urgency: NinaUrgency
    severity: NinaSeverity
    certainty: NinaCertainty
    effective: string
    senderName: string
    headline: string
    description: string
    instruction: string
    parameter: any
    area: NinaArea[]
  }[]
}

export type WarnItem = {
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
}

export default class NinaWarnings {
  ags: string
  warnLists: WarnLists

  constructor(ags: string, warnLists: WarnLists) {
    this.ags = ags.slice(0, -7) + "0000000"
    this.warnLists = warnLists
  }

  async get(since?: Date) : Promise<[WarnItem[], Date?]> {
    const response = await fetch(
      `https://warnung.bund.de/api31/dashboard/${this.ags}.json`,
      {
        headers: {
          "Accept": "application/json"
        }
      }
    )
    return await this.parseResponse(await response.json(), since)
  }

  private async parseResponse(response: NinaResponse, since?: Date) : Promise<[WarnItem[], Date?]> {
    let lastSent: Date | undefined

    console.debug("nina response:", response)

    const items = response
      .filter((item) => item.payload.version >= 2)
      .filter((item) => {
        const sent = new Date(item.sent)
        return (!since || sent > since) && this.daysSince(sent) < DAYS_SINCE
      })

    if (items.length)
      lastSent = new Date(items[items.length - 1].sent)

    const warnItems = await Promise.all(items.map(async (item) => {
      const provider = item.payload.data.provider
      switch (provider) {
        case "MOWAS":
          return this.mapMowasData(item)
        case "KATWARN":
          return await this.mapKatwarnData(item)
        case "DWD":
          return this.mapDwdData(item)
        default:
          throw Error(`Unhandled provider ${provider}`)
      } 
    }))
    warnItems.sort((a, b) => a.sent.getTime() - b.sent.getTime())

    return [warnItems, lastSent]
  }

  private daysSince(date: Date) {
    const now = new Date().getTime()

    return (now - date.getTime()) / (1000 * 60 * 60 * 24)
  }

  private mapMowasData(item: NinaResponseItem) : WarnItem {
    const data = item.payload.data
    const mowasId = item.id.substr(4)
    const mowasItem = this.warnLists.mowasItems.find((ds) => ds.identifier === mowasId)
    console.debug("data", data)
    console.debug("mowasItem", mowasItem)

    if (mowasItem) {
      const info = mowasItem.info[0]
      console.debug("mowasItem area", Object.keys(info.area[0]))
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
        sent: new Date(item.sent)
      }
    } else throw Error(`Mowas-Item for ${item.id} not found`)
  }

  private async mapKatwarnData(item: NinaResponseItem) : Promise<WarnItem> {
    const data = item.payload.data
    const katwarnItem = await this.getKatwarnItem(item.id)
    console.debug("data", data)
    if (katwarnItem) {
      const info = katwarnItem.info[0]
      console.debug("katwarnitem", katwarnItem)
      return {
        headline: data.headline,
        description: info.description,
        instruction: info.instruction,
        event: info.event,
        // senderName: info.senderName,
        urgency: info.urgency,
        severity: info.severity,
        certainty: info.certainty,
        msgType: data.msgType,
        provider: data.provider,
        areaDesc: this.areaDesc(info.area),
        sent: new Date(item.sent)
      }
    } else throw Error(`Katwarn-Item for ${item.id} not found`)
  }

  private async getKatwarnItem(fullId: string) : Promise<KatwarnItem> {
    const id = fullId.substr(4)
    const response = await fetch(
      `https://warnung.bund.de/bbk.katwarn/${id}.json`,
      {
        headers: {
          "Accept": "application/json"
        }
      }
    )
    return await response.json()
  }

  private mapDwdData(item: NinaResponseItem) : WarnItem {
    const data = item.payload.data
    const dwdId = item.id.substr(4)
    const dwdItem = this.warnLists.dwdItems.find((item) => item.identifier === dwdId)
    console.debug("data", data)
    console.debug("dwdItem", dwdItem)

    if (dwdItem) {
      const info = dwdItem.info[0]
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
          sent: new Date(item.sent)
      }
    } else throw Error(`Dwd-Item for ${item.id} not found`)
  }

  private areaDesc(areas: any[]) : string {
    return areas.map((area) => area.areaDesc).join(", ")
  }
}