import { MatrixClient, MessageEvent, TextualMessageEventContent } from "matrix-bot-sdk"

export default abstract class Room {
  abstract roomId: string
  abstract client: MatrixClient

  abstract roomCreated() : void
  abstract memberLeft() : void
  abstract command(body: string, event: MessageEvent<TextualMessageEventContent>) : Promise<void>
}