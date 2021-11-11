# MINA

MINA ist ein Matrix-Bot, mit dem man Warnmeldungen aus der NINA-API des Bundes abonnieren kann. Ein Matrix-Raum wird dabei einem Ort zugeordnet, so dass man ausschließlich Warnmeldungen für den jeweiligen Ort erhält.

## Status

Beta. Nach ersten Tests scheint der Bot grundlegend zu funktionieren.

## Bot benutzen

Wenn man die Matrix-ID eines bereits existierenden MINA-Bots kennt, kann man diesen einfach einladen und ihm dann Kommandos geben.

:warning: Aktuell benötigt der Bot einen **unverschlüsselten** Matrix-Raum und **Moderationsrechte** in diesem Raum. Es ist daher empfehlenswert, für die Nutzung einen _separaten_ Raum einzurichten.

Man kann in einem Raum nur Warnmeldungen für _einen einzelnen Ort_ erhalten. Wenn man für mehrere Orte gewarnt werden möchte, muss man daher mehrere Räume erstellen.

Und so gehts:

1. Bot in einen **unverschlüsselten** Raum einladen
1. Moderatorenrechte an den Bot vergeben
1. Mit `!suche <Ort>` die ID für einen Ort suchen
1. Mit `!abonniere <ID>` die Warnmeldungen für den gewählten Ort abonnieren

Der Bot prüft alle 10 Minuten, ob es neue Warnmeldungen für den jeweiligen Ort gibt, und postet diese dann in den Raum.

## Bot installieren

Man kann den Bot entweder manuell installieren oder per Docker nutzen. In beiden Fällen muss vorher ein Matrix-Account für den Bot eingerichtet werden.

### Matrix-Account einrichten

1. Matrix-User für den Bot anlegen
2. _Access token_ holen (z.B. mit Riot als Bot einloggen und dann _Alle Einstellungen_ => _Hilfe und Über_ => _Zugriffstoken_ einsehen und rauskopieren. Danach **nicht!** aus Riot ausloggen, sondern nur das Fenster schließen!)

### Manuell installieren

Voraussetzungen:

1. NodeJS 14
1. [direnv](https://direnv.net/)

Bot installieren und einrichten:

1. Repo auschecken
1. `npm run build`
1. `cp .env.example .env`
1. `HOMESERVER_URL` und `ACCESS_TOKEN` in der Datei _.env_ hinterlegen

Bot starten:

1. `npm start`

### Per Docker installieren

Es gibt ein fertiges Docker-Image unter _decentralize/nina-matrix-bot_. Alternativ kann man es in diesem Repository selbst bauen.

Man kann den Container beispielsweise wie folgt starten:

```bash
docker run \
  -e HOMESERVER_URL=https://... \
  -e ACCESS_TOKEN=... \
  -e INTERVAL_MINUTES=10 \
  decentralize/nina-matrix-bot
```

## Details zur Funktionsweise

- Die Zuordnung des gewählten Raums zum jeweiligen Chat-Raum wird als _Room state_ im jeweiligen Matrix-Raum gespeichert. (Auch die zuletzt gepostete Warnung wird dort hinterlegt). Aus diesem Grund benötigt der Bot Moderatorenrechte. (Dies kann möglicherweise in Zukunft anders gelöst werden.)
- Die Häufigkeit der Abfrage der Warnmeldungen wird über die Env-Variable `INTERVAL_MINUTES` festgelegt.
- Über die Variable `FEEDBACK_ROOM` kann man einen Matrix-Raum angeben, der vom Hilfe-Befehl als Support-Channel angezeigt bzw. verlinkt wird.
- Man kann einen (unverschlüsselten) Admin-Raum anlegen und den Bot dahin einladen. Die ID des Raums muss man dann in der Variable `ADMIN_ROOM_ID` hinterlegen. In diesem Raum postet der Bot dann automatisch verschiedene Statusmeldungen.
- Der Sync-Status mit dem Matrix-Server wird standardmäßig in der lokalen Datei _bot.json_ gespeichert. Wenn eine Persistenz auf Dateisystem-Ebene nicht möglich ist, kann stattdessen ein Redis-Server benutzt werden. Dafür muss die Env-Variable `REDIS_URL` gesetzt werden (z.B. auf `redis://localhost`). Siehe auch das Beispiel in der _docker-compose.yml_. (Der Redis-Server selbst muss nicht zwingend für Persistenz konfiguriert werden. Wenn er neugestartet wird, schreibt der Bot bei der nächsten Verbindung sofort wieder alle Werte neu in Redis rein.)
- Optional kann der Bot regelmäßig ein Lebenssignal senden, um darüber zu informieren, dass er noch läuft. Dafür braucht man eine Monitoring-Software, die per Webhook dieses Ping-Signal entgegen nimmt. Empfehlenswert ist z.B. [Healthchecks](https://healthchecks.io/).

  In dem jeweiligen Monitoring-System legt man einen neuen Check an, kopiert dann die Ziel-URL und setzt dann bei MINA die Env-Variablen `HEALTHCHECK_URL` (Ziel-URL für den Ping) und `HEALTHCHECK_PING_INTERVAL_IN_SECONDS` (Ping-Interval in Sekunden) entsprechend.

## Lizenz

Damit diese Software nicht ähnlich unter Verschluss gerät wie die Warn-Schnittstellen des Bundes, wird der Code unter der AGPLv3 veröffentlicht.

## Haftungsausschluss

Die Entwickler übernehmen keine Garantie dafür, dass der Bot fehlerfrei funktioniert und alle Warnungen zuverlässig zugestellt werden. Die Software befindet sich in der Entwicklung und es fehlen unter anderem noch Diagnose-Möglichkeiten, die bei Fehlfunktionen des Bots Alarm schlagen.

Es ist daher zu empfehlen, zusätzlich weitere Quellen für Warnmeldungen zu verwenden. Wie z.B. [FediNINA](https://meta.prepedia.org/wiki/FediNINA) im Fediverse.

## Beteiligung

Pull-Requests sind willkommen! Allerdings bitte darauf achten, die ESLint-Richtlinien einzuhalten.

## Danksagung

Ein großer Dank gebührt den Menschen hinter [bund.dev](https://bund.dev), die sich die Mühe gemacht haben, bisher undokumentierte Schnittstellen von Behörden und Institutionen mit öffentlichen Daten für die Allgemeinheit nutzbar zu machen.
