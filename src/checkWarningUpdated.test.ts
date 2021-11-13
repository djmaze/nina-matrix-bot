import checkWarningUpdated from "./checkWarningUpdated"
import { LastSent, MINAWarnItem } from "./types"

let data: MINAWarnItem
let lastSent: LastSent

beforeEach(() => {
  data = {
    id: "DE-BY-CO-W141-20210929-000",
    hash: "af076d6deef3318ac882b4ff3fc540982b03bf34",
    event: "Gefahrenmitteilung",
    headline: "Geruchsbelästigung und Verunreinigung durch wassergefährdeten Stoffen - Fluss Rodach",
    description: "Auf Grund einer Gewässerverunreinigung an der Rodach am Montagabend im Bereich Erlabrück, kommt es zu Beeinträchtigungen der Gewässerqualität stromabwärts in der Rodach sowie im Bereich des Mains nach Zufluss der Rodach.<br/>Die Schadstoffwelle konnte heute mindestens bis an die Mündung des Mains festgestellt werden .<br/>Das uns leider noch unbekannte Stoffgemisch, riecht stark, verbreitet sich über das abfließende Flusswasser, setzt sich aber auch auf der Gewässersohle ab. Aufgrund der unbekannten Zusammensetzung kann nicht ausgeschlossen werden, dass es sich um einen gesundheitsgefährdenden oder krebserregenden Stoff handelt.<br/>Daher empfehlen wir bis zum Vorliegen neuerer Erkenntnisse folgendes für den gesamten Bereich der Rodach von Erlabrük bis zur Mainmündung sowie für den Main im Landkreis Lichtenfels inklusive angeschlossener Seen, Fischteiche, ect.:<br/>- Verzehrverbot für Fische<br/>- Kontakt zum Gewässer meiden (Menschen und Tiere)<br/>- Keine Nutzung von Gartenbrunnen in der Nähe der betroffenen Gewässer<br/>Quelle der Meldung:<br/>Wasserwirtschaftsamt Kronach",
    instruction: "Informieren Sie sich in den Medien, zum Beispiel im Lokalradio.<br/>Teichbesitzer werden gebeten die Teiche zu kontrollieren und diese umgehend gegen eine Frischwasserzufuhr aus der Rodach abzuschotten. Vermeiden Sie bitte den Uferbereich entlang der \"Rodach\"!<br/>Daher empfehlen wir bis zum Vorliegen neuerer Erkenntnisse folgendes für den gesamten Bereich der Rodach von Erlabrük bis zur Mainmündung sowie für den Main im Landkreis Lichtenfels inklusive angeschlossener Seen, Fischteiche, ect.:<br/>- Verzehrverbot für Fische<br/>- Kontakt zum Gewässer meiden (Menschen und Tiere)<br/>- Keine Nutzung von Gartenbrunnen in der Nähe der betroffenen Gewässer",
    msgType: "Update",
    provider: "MOWAS",
    urgency: "Immediate",
    severity: "Severe",
    certainty: "Observed",
    web: undefined,
    areaDesc: "Landkreis/Stadt: Landkreis Lichtenfels\n" +
      "Gemeinde/Stadt: Stadt Kronach, Gemeinde Küps, Gemeinde Nordhalben, Gemeinde Steinwiesen, Gemeinde Marktrodach, Stadt Wallenfels, Gemeinde Weißenbrunn",
    sent: new Date(),
    effective: new Date(),
    onset: new Date("2021-09-29T16:43:31.000Z"),
    expires: new Date("2021-09-29T16:51:31.000Z"),
  }

  lastSent = {
    id: data.id,
    hash: "af076d6deef3318ac882b4ff3fc540982b03bf34",
    date: data.sent,
    onset: data.onset,
    expires: data.expires,
  }
})

test("warning is unchanged", () => {
  expect(checkWarningUpdated(data, lastSent)).toBe("unchanged")
})

test("warning is extended", () => {
  data.expires = new Date("2021-09-29T16:55:31.000Z")
  expect(checkWarningUpdated(data, lastSent)).toBe("extended")
})

test("warning is changed", () => {
  data.description = "Foo bar"
  data.hash = "totally changed"
  expect(checkWarningUpdated(data, lastSent)).toBe("changed")
})

test("warning is new", () => {
  data.id = "foobario"
  expect(checkWarningUpdated(data, lastSent)).toBe("new")
})