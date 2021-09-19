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
  value: string | { date: string, id: string | undefined, hash: string | undefined }
}