import { AutojoinRoomsMixin, AutojoinUpgradedRoomsMixin, MatrixClient, MatrixEvent, RichReply, SimpleFsStorageProvider } from 'matrix-bot-sdk'
import AGSSearch from "./ags"
import NinaWarnings, { WarnItem } from "./nina_api"
import WarnLists from './warn_lists';

const homeserverUrl = process.env.HOMESERVER_URL // make sure to update this with your url
const accessToken = process.env.ACCESS_TOKEN
const INTERVAL = parseInt(process.env.INTERVAL_MINUTES || "10") * 60 * 1000

const LOCATION_EVENT_TYPE = "de.nina-bot.location"
const LAST_SENT_TYPE = "de.nina-bot.last-sent"

const storage = new SimpleFsStorageProvider("bot.json")
const client = new MatrixClient(homeserverUrl!, accessToken!, storage)
AutojoinRoomsMixin.setupOnClient(client)

type Location = {
  name: string
  code: string
}

type LastSentEvent = {
  value: string
}

type RoomLocation = {
  id: string
  location: Location
  timer?: NodeJS.Timer
}

const rooms: RoomLocation[] = []
const agsSearch = new AGSSearch()
const warnLists = new WarnLists()

client.start().then(() => console.log("Client started!"))

client.getJoinedRooms().then(async (matrixRooms) => {
  console.debug("joined rooms", matrixRooms)

  await setupRooms(matrixRooms)
})

client.on("room.event", async (roomId, event) => {
  if (event.type === "m.room.create") {
    console.debug("room just created, sending welcome message", roomId)
    await showHelp(roomId)
  } else if (event.content.membership === "leave") {
    console.debug("room leave event", roomId, event)

    if (await joinedMembers(roomId) < 2) {
      console.debug(`I am the last one left in room ${roomId}, leaving.`)
      await client.leaveRoom(roomId)
    }
  }
})

client.on("room.message", async (roomId, event) => {
  if (!event["content"]) return
  if (event["content"]["msgtype"] !== "m.text") return

  const sender = event["sender"]
  const body = event["content"]["body"].trim()

  if (body.startsWith('!')) {
    console.log(`${roomId}: ${sender} says '${body}'`)

    if (body.startsWith('!hilfe')) {
      await showHelp(roomId)
    } else if (body.startsWith('!suche')) {
      const location = body.split(" ")[1]
      await search(roomId, location)
    } else if (body.startsWith('!abonniere')) {
      const locationCode = body.split(" ")[1]
      await subscribe(roomId, locationCode)
    } else if (body.startsWith('!deabonniere')) {
      await unsubscribe(roomId)
    } else {
      await invalidCommand(roomId)
    }
  }
})

async function setupRooms(matrixRooms: string[]) {
  await warnLists.update()

  setInterval(async () => {
    await warnLists.update()
  }, INTERVAL - 10 * 1000)

  matrixRooms.forEach(async (roomId) => {
    if (await joinedMembers(roomId) < 2) {
      console.debug(`Leaving room ${roomId} since there are fewer than 2 members`)
      await client.leaveRoom(roomId)
    } else {
      const [location, lastSent] = await getStateForRoom(roomId)

      if (location)
        setupRoom({
          id: roomId,
          location: {
            name: location.name,
            code: location.code
          }
        }, lastSent)
    }
  })
}

async function getStateForRoom(roomId: string) : Promise<[Location, Date?] | []> {
  let location: Location | undefined

  try {
    location = await client.getRoomStateEvent(roomId, LOCATION_EVENT_TYPE, "")
  } catch (e) {
      if (e.body.errcode !== "M_NOT_FOUND")
        throw e
  }

  if (location && location.name) {
    let lastSentEvent: LastSentEvent | undefined

    try {
      lastSentEvent = await client.getRoomStateEvent(roomId, LAST_SENT_TYPE, "")
    } catch (e) {
      if (e.body.errcode !== "M_NOT_FOUND")
        throw e
    }
    const lastSent = (lastSentEvent && lastSentEvent.value) ? new Date(lastSentEvent.value) : undefined

    return [location, lastSent]
  }
  
  return []
}

async function setupRoom(roomLocation: RoomLocation, since?: Date) {
  rooms.push(roomLocation)
  console.log("added room location:", roomLocation)
  let previousLastSent = since
  let lastSent: Date | undefined

  const warnings = new NinaWarnings(roomLocation.location.code, warnLists)

  const loadAndSave = async () => {
    lastSent = await loadWarnings(roomLocation, warnings, previousLastSent)
    if (lastSent && (!previousLastSent || lastSent > previousLastSent)) {
      await saveLastSent(roomLocation.id, lastSent)
      previousLastSent = lastSent
    }
  }

  await loadAndSave()

  roomLocation.timer = setInterval(async () => {
    await loadAndSave()
  }, INTERVAL)
}

async function loadWarnings(roomLocation: RoomLocation, warnings: NinaWarnings, since?: Date) : Promise<Date | undefined> {
  const [items, lastSent] = await warnings.get(since)
  items.forEach((item) => {
    const data = [item.sent.toLocaleDateString('de-DE'), item.msgType, item.urgency, item.severity, item.certainty, item.provider]
      .filter((item) => item)
      .join(" | ")

    let html = `
      <p><i>${data}</i></p>
      <p><b>${item.event ? "[" + item.event + "]" : ""} ${item.headline}</b></p>
      <p><i>${item.areaDesc}</i></p>
    `
    if (item.description)
      html += `<p>${item.description}</p>`
    if (item.instruction)
      html += `<p>${item.instruction}</p>`
    if (item.web)
      html += `<p><a href="${item.web}">${item.web}</a></p>`
    client.sendHtmlText(roomLocation.id, html)
  })

  if (items.length > 0) {
    console.debug(`Warned about ${items.length} items for location ${roomLocation.location.name} in room ${roomLocation.id}`)
  }

  return lastSent
}

async function saveLastSent(roomId: string, lastSent: Date) {
  await client.sendStateEvent(roomId, LAST_SENT_TYPE, "", { value: lastSent })
}

async function joinedMembers(roomId: string) : Promise<number> {
    const memberEvents = await client.getRoomMembers(roomId)
    return memberEvents
      .filter((event) => event.content.membership === "join")
      .length
}

async function showHelp(roomId: string) {
  const text = `<p>Hallo, ich bin Nina!</p>
    
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
  await client.sendHtmlText(roomId, text)
}

async function search(roomId: string, location: string) {
  await agsSearch.update()
  const possibleLocations = agsSearch.search(location)
  let replyBody: string
  if (possibleLocations.length === 1) {
    replyBody = `<p>Der Code für <i>${possibleLocations[0].name}</i> lautet: <code>${possibleLocations[0].code}</code></p>`
    replyBody += `<p>Jetzt abonnieren mit <code>!abonniere ${possibleLocations[0].code}</code></p>`
  } else if (possibleLocations.length > 1) {
    replyBody = `<p>Mögliche Locations:</p><ul>`
    possibleLocations.forEach(({code, name}) => {
      replyBody += `<li>${code} ${name}</li>`
    })
    replyBody += "</ul>"
    replyBody += `<p>Jetzt abonnieren mit <code>!abonniere DER-PASSENDE-CODE</code></p>`
  } else {
    replyBody = "<strong>Kein Code für diese Location gefunden!</strong>"
  }
  const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
  reply["msgtype"] = "m.text";
  client.sendMessage(roomId, reply);
}

async function subscribe(roomId: string, locationCode: string) {
  await warnLists.update()
  await agsSearch.update()

  const location = agsSearch.get(locationCode)
  if (!location) {
    const replyBody = "Die angegebene Location ist leider ungültig!"
    const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
    reply["msgtype"] = "m.text";
    client.sendMessage(roomId, reply);
    return 
  }

  try {
    const eventId = await client.sendStateEvent(roomId, LOCATION_EVENT_TYPE, "", {code: locationCode, name: location.name})
  } catch {
    const replyBody = `Bitte gib mir Moderatoren-Berechtigungen, damit ich meine Einstellungen im Raum speichern kann!`
    const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
    reply["msgtype"] = "m.text";
    client.sendMessage(roomId, reply);
    return
  }
  console.log(`subscribed ${roomId} to ${locationCode}`)
  
  const replyBody = `Danke, du wirst jetzt für die Location <i>${location.name}</i> gewarnt`
  const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
  reply["msgtype"] = "m.notice";
  client.sendMessage(roomId, reply);

  setupRoom({
    id: roomId,
    location: {
      name: location.name,
      code: locationCode
    }
  })
}

async function unsubscribe(roomId: string) {
  const room = rooms.find((r) => r.id === roomId)
  if (room) {
    if (room.timer) clearInterval(room.timer)
    client.sendStateEvent(roomId, LOCATION_EVENT_TYPE, "", {})
    client.sendStateEvent(roomId, LAST_SENT_TYPE, "", {})
    rooms.splice(rooms.indexOf(room), 1)

    const replyBody = `Okay, ab sofort erhältst du keine Warnungen mehr für <i>${room.location.name}</i>.`
    const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
    reply["msgtype"] = "m.notice";
    client.sendMessage(roomId, reply);

    console.log(`unsubscribed ${roomId} from ${room.location.name}`)
  }
}

async function invalidCommand(roomId: string) {
  const replyBody = "Den angebenen Befehl kenne ich nicht! Probier mal: <code>!hilfe</code>"
  const reply = RichReply.createFor(roomId, event, replyBody, replyBody);
  reply["msgtype"] = "m.text";
  client.sendMessage(roomId, reply);
}