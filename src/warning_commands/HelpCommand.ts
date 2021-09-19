import WarningCommand from "./WarningCommand"

export default class HelpCommand extends WarningCommand {
  async exec() : Promise<void> {
    let text = `<p>Hallo, ich bin MINA!</p>
      
<p>Ich darf mich kurz vorstellen: Ich bin ein Bot, der dich über Warnmeldungen an deinem angegebenen Ort informiert.</p>

<p>Du bekommst eine Nachricht, sobald etwas Wichtiges passiert: seien es Stromausfälle, Unwetter oder andere Katastrophen.</p>

<p>Du willst starten? <strong>Als Erstes musst du mir bitte Moderatoren-Berechtigungen für diesen Raum geben.</strong> Ansonsten kann ich meine Einstellungen nicht speichern.</p>

<p>Dann suche dir den passenden Code für deinen Ort und abonniere dann die Warnmeldungen. Dafür gibst du Folgendes ein:</p>

<p><code>!suche Münster</code></p>

<p>Jetzt bekommst du eine Liste von Codes angezeigt. Daraus suchst du dir den richtigen raus und gibst ihn im Folgenden an:</p>

<p><code>!abonniere DER-PASSENDE-CODE</code></p>

<p>Ab diesem Zeitpunkt wirst du in diesem Chat über neue Warnmeldungen informiert (maximal alle 10 Minuten).</p>

<p>Diesen Hilfetext kannst du jederzeit erneut aufrufen über den folgenden Befehl:</p>

<p><code>!hilfe</code></p>

<p>Dann bleibt mir jetzt nichts anderes zu tun, als dir <i>Hals und Beinbruch</i> zu wünschen! Auf dass ich dich niemals warnen muss...</p>
  `

    if (this.room.settings.FEEDBACK_ROOM)
      text += `<p>Fragen? Anmerkungen? Fehlermeldungen? Tritt gerne unserem öffentlichen Feedback-Raum unter ${this.room.settings.FEEDBACK_ROOM} bei!</p>`

    await this.room.client.sendHtmlText(this.room.roomId, text)
  }
}