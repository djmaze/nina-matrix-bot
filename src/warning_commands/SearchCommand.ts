import { MessageEvent, TextualMessageEventContent, RichReply } from "matrix-bot-sdk"
import AGSSearch from "../AGSSearch"
import WarningCommand from "./WarningCommand"

export default class SearchCommand extends WarningCommand {
  async exec(location: string, event: MessageEvent<TextualMessageEventContent>) : Promise<void> {
    const agsSearch = new AGSSearch()
    await agsSearch.update()
    const possibleLocations = agsSearch.search(location)

    let replyBody: string
    if (possibleLocations.length === 1) {
      replyBody = `<p>Der Code für <i>${possibleLocations[0].name}</i> lautet: <code>${possibleLocations[0].code}</code></p>`
      replyBody += `<p>Jetzt abonnieren mit <code>!abonniere ${possibleLocations[0].code}</code></p>`
    } else if (possibleLocations.length > 1) {
      replyBody = "<p>Mögliche Locations:</p><ul>"
      possibleLocations.forEach(({code, name}) => {
        replyBody += `<li>${code} ${name}</li>`
      })
      replyBody += "</ul>"
      replyBody += "<p>Jetzt abonnieren mit <code>!abonniere DER-PASSENDE-CODE</code></p>"
    } else {
      replyBody = "<strong>Kein Code für diese Location gefunden!</strong>"
    }
    const reply = RichReply.createFor(this.room.roomId, event, replyBody, replyBody)
    reply["msgtype"] = "m.text"
    this.room.client.sendMessage(this.room.roomId, reply)
  }
}
