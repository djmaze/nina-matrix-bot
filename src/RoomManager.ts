import { MatrixClient, MessageEvent, TextualMessageEventContent } from "matrix-bot-sdk"
import AdminLogger from "./AdminLogger"
import AdminRoom from "./AdminRoom"
import NinaWarnings from "./NinaWarnings"
import Room from "./Room"
import Settings from "./Settings"
import WarningRoom from "./WarningRoom"
import WarnLists from "./WarnLists"

export default class RoomManager {
  client: MatrixClient
  settings: Settings
  logger: AdminLogger
  rooms: Record<string, WarningRoom> = {}
  adminRoom?: AdminRoom
  warnings: NinaWarnings

  constructor(client: MatrixClient, settings: Settings, logger: AdminLogger) {
    this.client = client
    this.settings = settings
    this.logger = logger

    const warnLists = new WarnLists()
    this.warnings = new NinaWarnings(warnLists, settings.INTERVAL, logger)

    if (this.settings.ADMIN_ROOM_ID) {
      this.adminRoom = new AdminRoom(this.client, this.settings.ADMIN_ROOM_ID, this)
      this.logger.adminRoom = this.adminRoom
    }
  }

  async setupRooms() : Promise<void> {
    const matrixRooms = await this.client.getJoinedRooms()
    console.debug("got joined rooms", matrixRooms)

    await this.setupAdminRoom(matrixRooms)

    this.logger.info("Started")

    await this.setupWarningRooms(matrixRooms)

    await this.warnings.start()

    this.logger.info("All rooms set up")

    await this.setupEventHandlers()
  }

  eachRoom(cb: (roomId: string, room: WarningRoom) => void) : void {
    Object.entries(this.rooms).forEach(([roomId, room]) => {
      cb(roomId, room)
    })
  }

  private async setupAdminRoom(matrixRooms: string[]) {
    if (this.adminRoom) {
      console.debug(`Listening in admin room ${this.settings.ADMIN_ROOM_ID}`)
      this.adminRoom.listen()

      if (!matrixRooms.includes(this.adminRoom.roomId)) {
        console.debug(`Joining admin room ${this.settings.ADMIN_ROOM_ID}`)
        await this.adminRoom.join()
      }
    }
  }

  private async setupWarningRooms(matrixRooms: string[]) : Promise<void> {
    await Promise.all(matrixRooms.map(async (roomId) => {
      const room = new WarningRoom(this.client, roomId, this.warnings, this.settings, this.logger)
      if(await room.setup()) {
        this.rooms[room.roomId] = room
        console.log("added room location:", room.roomLocation)
      }
    }))

    this.warnings.logSubscriptions()
  }

  private async setupEventHandlers() {
    const userId = await this.client.getUserId()

    this.client.on("room.event", async (roomId, event) => {
      const room = this.getRoomById(roomId)

      if (event.type === "m.room.create") {
        console.debug("room create event", roomId, event)
        await room.roomCreated()
      } else if (event.type === "m.room.member" && event.content.membership === "join" && event.sender === userId) {
        if (!room.alreadyEntered) {
          console.debug("joined room", roomId)
          await room.entered()
        }
      }
    })

    this.client.on("room.leave", async (roomId, event) => {
      console.debug("room leave event", roomId, event)

      const room = this.getRoomById(roomId)

      if (event.state_key === userId) {
        await room.left()
        console.debug("Removing room from list", roomId)
        delete this.rooms[roomId]
      } else {
        await room.memberLeft()
      }
    })

    this.client.on("room.message", async (roomId, ev: MessageEvent<any>) => {
      const event = new MessageEvent<TextualMessageEventContent>(ev)
      if (event.isRedacted) return
      if (!event.textBody) return
      if (event.messageType !== "m.text") return

      const sender = event.sender
      const body = event.textBody.trim()

      if (body.startsWith("!")) {
        console.log(`${roomId}: ${sender} says '${body}'`)

        const room = this.getRoomById(roomId)
        await room.command(body, event)
      }
    })
  }

  private getRoomById(roomId: string) : Room {
    let room: Room

    room = this.rooms[roomId]
    if (!room && roomId === this.settings.ADMIN_ROOM_ID && this.adminRoom) room = this.adminRoom
    if (!room) {
      room = new WarningRoom(this.client, roomId, this.warnings, this.settings, this.logger)
      this.rooms[roomId] = room as WarningRoom
    }

    return room
  }
}
