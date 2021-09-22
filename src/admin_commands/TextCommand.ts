import { MessageEvent, RichReply, TextualMessageEventContent } from "matrix-bot-sdk"
import AdminCommand from "./AdminCommand"

export default class TextCommand extends AdminCommand {
  async exec(text: string, event: MessageEvent<TextualMessageEventContent>) : Promise<void> {
    this.roomManager.eachRoom((roomId, room) => {
      room.client.sendHtmlText(roomId, text)
    })

    const replyBody = "Die Nachricht wurde an alle Räume gesendet."
    const reply = RichReply.createFor(this.room.roomId, event, replyBody, replyBody)
    reply["msgtype"] = "m.text"
    this.room.client.sendMessage(this.room.roomId, reply)
  }
}