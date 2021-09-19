import { MatrixClient, MessageEvent, TextualMessageEventContent } from "matrix-bot-sdk"

export default abstract class Room {
  abstract roomId: string
  abstract client: MatrixClient
  abstract alreadyEntered: boolean

  abstract roomCreated() : void
  abstract entered() : void
  abstract left() : void
  abstract memberLeft() : void
  abstract command(body: string, event: MessageEvent<TextualMessageEventContent>) : Promise<void>
}