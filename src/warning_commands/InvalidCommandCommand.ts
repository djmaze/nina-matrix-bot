import { MessageEvent, TextualMessageEventContent, RichReply } from "matrix-bot-sdk"
import WarningCommand from "./WarningCommand"

export default class InvalidCommandCommand extends WarningCommand {
  async exec(event: MessageEvent<TextualMessageEventContent>) : Promise<void> {
    const replyBody = "Den angebenen Befehl kenne ich nicht! Probier mal: <code>!hilfe</code>"
    const reply = RichReply.createFor(this.room.roomId, event, replyBody, replyBody)
    reply["msgtype"] = "m.text"
    this.room.client.sendMessage(this.room.roomId, reply)
  }
}
