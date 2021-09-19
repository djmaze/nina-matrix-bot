import { MessageEvent, TextualMessageEventContent, RichReply } from "matrix-bot-sdk"
import WarningCommand from "./WarningCommand"

export default class UnsubscribeCommand extends WarningCommand {
  async exec(event: MessageEvent<TextualMessageEventContent>) : Promise<void> {
    if (this.room && this.room.isSubscribed) {
      const locationName = this.room.locationName
      this.room.unsubscribe()

      this.room.client.sendStateEvent(this.room.roomId, this.room.settings.LOCATION_EVENT_TYPE, "", {})
      this.room.client.sendStateEvent(this.room.roomId, this.room.settings.LAST_SENT_TYPE, "", {})

      const replyBody = `Okay, ab sofort erhältst du keine Warnungen mehr für <i>${locationName}</i>.`
      const reply = RichReply.createFor(this.room.roomId, event, replyBody, replyBody)
      reply["msgtype"] = "m.notice"
      this.room.client.sendMessage(this.room.roomId, reply)

      console.log(`unsubscribed ${this.room.roomId} from ${locationName}`)
    } else {
      const replyBody = "Du hast derzeit keine Warnungen in diesem Raum abonniert."
      const reply = RichReply.createFor(this.room.roomId, event, replyBody, replyBody)
      reply["msgtype"] = "m.notice"
      this.room.client.sendMessage(this.room.roomId, reply)
    }
  }
}