import { NINA_PROVIDERS } from "./NinaWarnings"

export type Location = {
  name: string
  code: string
}

export type RoomLocation = {
  id: string
  location: Location
  callback?: () => void
}

export type LastSentEvent = {
  value: string | {
    date: string,
    id: string | undefined,
    onset: Date | undefined,
    expires: Date | undefined,
    hash: string | undefined
  }
}

export type NinaMsgType = "Update"

export type NinaProvider = keyof typeof NINA_PROVIDERS

export type NinaSeverity = "Severe" | "Minor" | "Unknown"

export type NinaUrgency = "Immediate" | "Unknown"

export type NinaCertainty = "Observed"

export type NinaStatus = "Actual"

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

export type LastSent = { date: Date, id: string | undefined, onset: Date | undefined, expires: Date | undefined, hash: string | undefined }

export type SubscribeCallback = (item: MINAWarnItem) => void