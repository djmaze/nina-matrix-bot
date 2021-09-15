import { AutojoinRoomsMixin, MatrixClient, MessageEvent, RichReply, SimpleFsStorageProvider, TextualMessageEventContent } from "matrix-bot-sdk"
import AdminLogger from "./admin_logger"
import AdminRoom from "./admin_room"
import AGSSearch from "./ags"
import NinaWarnings, { LastSent, MINAWarnItem } from "./nina_api"
import WarnLists from "./warn_lists"

const homeserverUrl = process.env.HOMESERVER_URL // make sure to update this with your url
const accessToken = process.env.ACCESS_TOKEN
const INTERVAL = parseInt(process.env.INTERVAL_MINUTES || "10") * 60 * 1000
const FEEDBACK_ROOM = process.env.FEEDBACK_ROOM
const ADMIN_ROOM_ID = process.env.ADMIN_ROOM_ID

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
  value: string | { date: string, id: string | undefined, hash: string | undefined }
}

type RoomLocation = {
  id: string
  location: Location
  callback?: () => void
}

const rooms: RoomLocation[] = []
const agsSearch = new AGSSearch()
const warnLists = new WarnLists()
const logger = new AdminLogger()
const warnings = new NinaWarnings(warnLists, INTERVAL, logger)

client.start().then(() => console.log("Client started!"))

client.getJoinedRooms().then(async (matrixRooms) => {
  console.debug("got joined rooms", matrixRooms)

  if (ADMIN_ROOM_ID) {
    const adminRoom = new AdminRoom(client, ADMIN_ROOM_ID)
    logger.adminRoom = adminRoom

    console.debug(`Listening in admin room ${ADMIN_ROOM_ID}`)
    adminRoom.listen()

    if (!matrixRooms.includes(ADMIN_ROOM_ID)) {
      console.debug(`Joining admin room ${ADMIN_ROOM_ID}`)
      await adminRoom.join()
    }
  }

  logger.info("Started")

  await setupRooms(matrixRooms)
  await warnings.start()
  logger.info("Set up all rooms")
})

client.on("room.event", async (roomId, event) => {
  if (roomId === ADMIN_ROOM_ID) return

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

client.on("room.message", async (roomId, ev: MessageEvent<any>) => {
  if (roomId === ADMIN_ROOM_ID) return

  const event = new MessageEvent<TextualMessageEventContent>(ev)
  if (event.isRedacted) return
  if (!event.textBody) return
  if (event.messageType !== "m.text") return

  const sender = event.sender
  const body = event.textBody.trim()

  if (body.startsWith("!")) {
    console.log(`${roomId}: ${sender} says '${body}'`)

    if (body.startsWith("!hilfe")) {
      await showHelp(roomId)
    } else if (body.startsWith("!suche")) {
      const location = body.split(" ")[1]
      await search(roomId, event, location)
    } else if (body.startsWith("!abonniere")) {
      const locationCode = body.split(" ")[1]
      await subscribe(roomId, event, locationCode)
    } else if (body.startsWith("!deabonniere")) {
      await unsubscribe(roomId, event)
    } else {
      await invalidCommand(roomId, event)
    }
  }
})

async function setupRooms(matrixRooms: string[]) {
  await Promise.all(matrixRooms.map(async (roomId) => {
    if (await joinedMembers(roomId) < 2) {
      console.debug(`Leaving room ${roomId} since there are fewer than 2 members`)
      await client.leaveRoom(roomId)
    } else {
      const [location, lastSent] = await getStateForRoom(roomId)

      if (location)
        await setupRoom({
          id: roomId,
          location: {
            name: location.name,
            code: location.code
          }
        }, lastSent)
    }
  }))

  warnings.logSubscriptions()
}

async function getStateForRoom(roomId: string) : Promise<[Location, LastSent?] | []> {
  let location: Location | undefined

  try {
    location = await client.getRoomStateEvent(roomId, LOCATION_EVENT_TYPE, "")
  } catch (e) {
    if (!e.body || e.body.errcode !== "M_NOT_FOUND")
      throw e
  }

  if (location && location.name) {
    let lastSentEvent: LastSentEvent | undefined
    let lastSent: LastSent | undefined

    try {
      lastSentEvent = await client.getRoomStateEvent(roomId, LAST_SENT_TYPE, "")
    } catch (e) {
      if (!e.body || e.body.errcode !== "M_NOT_FOUND")
        throw e
    }
    if (lastSentEvent && lastSentEvent.value) {
      if (typeof lastSentEvent.value === "string") {
        lastSent = { date: new Date(lastSentEvent.value), id: undefined, hash: undefined }
      } else if (typeof(lastSentEvent.value) === "object") {
        lastSent = { ...lastSentEvent.value, date: new Date(lastSentEvent.value.date) }
      }
    }

    return [location, lastSent]
  }
  
  return []
}

async function setupRoom(roomLocation: RoomLocation, lastSent?: LastSent) {
  rooms.push(roomLocation)
  console.log("added room location:", roomLocation)

  const callback = async (item: MINAWarnItem) => {
    await sendWarnings(roomLocation, [item])
    await saveLastSent(roomLocation.id, { date: item.sent, id: item.id, hash: item.hash })
  }
  warnings.subscribe(roomLocation.location.code, callback, lastSent, true)
}

async function sendWarnings(roomLocation: RoomLocation, items: MINAWarnItem[]) : Promise<void> {
  for(const item of items) {
    const date = localizedDateAndTime(item.sent)
    const data = [date, item.msgType, item.urgency, item.severity, item.certainty, item.provider]
      .join(" | ")

    let html = `
      <p><b>${item.event ? "[" + item.event + "]" : ""} ${item.headline}</b></p>
      <p><i>${data}</i></p>
    `

    if (item.effective || item.onset || item.expires) {
      const items: Array<[string, Date]> = []

      if (item.effective && item.effective !== item.onset)
        items.push(["Wirksam ab", item.effective])
      if (item.onset)
        items.push(["Gültig von", item.onset])
      if (item.expires)
        items.push(["Gültig bis", item.expires])

      const item_html = items
        .map(([text, date]) => "<i>" + [text, localizedDateAndTime(date)].join(": ") + "</i>")
        .join("<br>")

      html += "<p>" + item_html + "</p>"
    }

    html += `<p><i>${item.areaDesc}</i></p>`

    if (item.description)
      html += `<p>${item.description}</p>`
    if (item.instruction)
      html += `<p>${item.instruction}</p>`
    if (item.web)
      html += `<p><a href="${item.web}">${item.web}</a></p>`
    await client.sendHtmlText(roomLocation.id, html)
  }

  if (items.length > 0) {
    console.debug(`Warned about ${items.length} items for location ${roomLocation.location.name} in room ${roomLocation.id}`)
  }
}

async function saveLastSent(roomId: string, lastSent: LastSent) {
  await client.sendStateEvent(roomId, LAST_SENT_TYPE, "", { value: lastSent })
}

async function joinedMembers(roomId: string) : Promise<number> {
  const memberEvents = await client.getRoomMembers(roomId)
  return memberEvents
    .filter((event) => event.content.membership === "join")
    .length
}

async function showHelp(roomId: string) {
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

  if (FEEDBACK_ROOM)
    text += `<p>Fragen? Anmerkungen? Fehlermeldungen? Tritt gerne unserem öffentlichen Feedback-Raum unter ${FEEDBACK_ROOM} bei!</p>`

  await client.sendHtmlText(roomId, text)
}

async function search(roomId: string, event: MessageEvent<TextualMessageEventContent>, location: string) {
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
  const reply = RichReply.createFor(roomId, event, replyBody, replyBody)
  reply["msgtype"] = "m.text"
  client.sendMessage(roomId, reply)
}

async function subscribe(roomId: string, event: MessageEvent<TextualMessageEventContent>, locationCode: string) {
  const room = rooms.find((r) => r.id === roomId)
  if (room)
    warnings.unsubscribe(room.location.code, room.callback!)

  await agsSearch.update()

  const location = agsSearch.get(locationCode)
  if (!location) {
    const replyBody = "Die angegebene Location ist leider ungültig!"
    const reply = RichReply.createFor(roomId, event, replyBody, replyBody)
    reply["msgtype"] = "m.text"
    client.sendMessage(roomId, reply)
    return 
  }

  try {
    await client.sendStateEvent(roomId, LOCATION_EVENT_TYPE, "", {code: locationCode, name: location.name})
  } catch {
    const replyBody = "Bitte gib mir Moderatoren-Berechtigungen, damit ich meine Einstellungen im Raum speichern kann!"
    const reply = RichReply.createFor(roomId, event, replyBody, replyBody)
    reply["msgtype"] = "m.text"
    client.sendMessage(roomId, reply)
    return
  }
  console.log(`subscribed ${roomId} to ${locationCode}`)
  
  const replyBody = `Danke, du wirst jetzt für die Location <i>${location.name}</i> gewarnt`
  const reply = RichReply.createFor(roomId, event, replyBody, replyBody)
  reply["msgtype"] = "m.notice"
  client.sendMessage(roomId, reply)

  await setupRoom({
    id: roomId,
    location: {
      name: location.name,
      code: locationCode
    }
  })
}

async function unsubscribe(roomId: string, event: MessageEvent<TextualMessageEventContent>) {
  const room = rooms.find((r) => r.id === roomId)
  if (room) {
    warnings.unsubscribe(room.location.code, room.callback!)

    client.sendStateEvent(roomId, LOCATION_EVENT_TYPE, "", {})
    client.sendStateEvent(roomId, LAST_SENT_TYPE, "", {})

    rooms.splice(rooms.indexOf(room), 1)

    const replyBody = `Okay, ab sofort erhältst du keine Warnungen mehr für <i>${room.location.name}</i>.`
    const reply = RichReply.createFor(roomId, event, replyBody, replyBody)
    reply["msgtype"] = "m.notice"
    client.sendMessage(roomId, reply)

    console.log(`unsubscribed ${roomId} from ${room.location.name}`)
  }
}

async function invalidCommand(roomId: string, event: MessageEvent<TextualMessageEventContent>) {
  const replyBody = "Den angebenen Befehl kenne ich nicht! Probier mal: <code>!hilfe</code>"
  const reply = RichReply.createFor(roomId, event, replyBody, replyBody)
  reply["msgtype"] = "m.text"
  client.sendMessage(roomId, reply)
}

function localizedDateAndTime(date: Date) : string {
  return [date.toLocaleDateString("de-DE"), date.toLocaleTimeString("de-DE"), "Uhr"].join(" ")
}