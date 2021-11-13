import { MatrixClient, MessageEvent, TextualMessageEventContent } from "matrix-bot-sdk"
import Room from "./Room"
import commandsFor, { AdminCommands } from "./admin_commands"
import RoomManager from "./RoomManager"

export default class AdminRoom implements Room {
  client: MatrixClient
  commands: AdminCommands
  roomId: string
  alreadyEntered = false

  constructor(client: MatrixClient, roomId: string, roomManager: RoomManager) {
    this.client = client
    this.roomId = roomId
    this.commands = commandsFor(this, roomManager)
  }

  async join() : Promise<void> {
    await this.client.joinRoom(this.roomId)
  }

  async listen() : Promise<void> {
    const userId = await this.client.getUserId()

    this.client.on("room.event", async (roomId, event) => {
      if (roomId !== this.roomId) return

      if (event.type === "m.room.member" && event.content.membership === "join" && event.sender === userId) {
        console.debug("admin room just entered, sending welcome message", roomId)
        await this.showHelp()
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unused-vars
  async stateChanged(type: string, content: unknown) : Promise<void> {}

  async roomCreated() : Promise<void> {
    await this.showHelp()
  }

  async entered() : Promise<void> {
    console.debug("admin room just entered, sending welcome message", this.roomId)
    this.alreadyEntered = true
    await this.showHelp()
  }

  async command(body: string, event: MessageEvent<TextualMessageEventContent>) : Promise<void> {
    const argIndex = body.indexOf(" ")
    const arg = body.slice(argIndex + 1)

    if (body.startsWith("!hilfe")) {
      await this.commands.help.exec()
    } else if (body.startsWith("!text")) {
      await this.commands.text.exec(arg, event)
    } else if (body.startsWith("!notice")) {
      await this.commands.notice.exec(arg, event)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async left() : Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  async memberLeft() : Promise<void> {}

  async showHelp() : Promise<void> {
    await this.commands.help.exec()
  }

  async logError(message: string) : Promise<void> {
    await this.client.sendHtmlText(this.roomId, `⚠️ ${message}`)
  }

  async logInfo(message: string) : Promise<void> {
    await this.client.sendText(this.roomId, `🏁 ${message}`)
  }

  async logDebug(message: string) : Promise<void> {
    await this.client.sendNotice(this.roomId, message)
  }
}