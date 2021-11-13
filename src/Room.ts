import { MatrixClient, MessageEvent, TextualMessageEventContent } from "matrix-bot-sdk"

export default abstract class Room {
  abstract roomId: string
  abstract client: MatrixClient
  abstract alreadyEntered: boolean

  abstract stateChanged(type: string, content: unknown) : Promise<void>
  abstract roomCreated() : Promise<void>
  abstract entered() : Promise<void>
  abstract left() : Promise<void>
  abstract memberLeft() : Promise<void>
  abstract command(body: string, event: MessageEvent<TextualMessageEventContent>) : Promise<void>
}