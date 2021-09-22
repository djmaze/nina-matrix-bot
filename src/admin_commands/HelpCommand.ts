import AdminCommand from "./AdminCommand"

export default class HelpCommand extends AdminCommand {
  async exec() : Promise<void> {
    const text = `<p>Willkommen im Admin-Raum des MINA-Bots!</p>
<ul>
<li><code>!notice &lt;text&gt;</code> Text ohne Notification an alle Räume senden (HTML erlaubt)</li>
<li><code>!text &lt;text&gt;</code> Text mit Notification an alle Räume senden (HTML erlaubt)</li>
</ul>`
    await this.room.client.sendHtmlText(this.room.roomId, text)
  }
}