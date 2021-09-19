import { MatrixClient } from "matrix-bot-sdk"
import Room from "./Room"

export default class AdminRoom implements Room {
  client: MatrixClient
  roomId: string

  constructor(client: MatrixClient, roomId: string) {
    this.client = client
    this.roomId = roomId
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

  async roomCreated() : Promise<void> {
    await this.showHelp()
  }

  async entered() : Promise<void> {
    console.debug("admin room just entered, sending welcome message", this.roomId)
    await this.showHelp()
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
  async command(_body: string) : Promise<void> {}

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  memberLeft() : void {}

  async showHelp() : Promise<void> {
    const text = "<p>Willkommen im Admin-Raum des MINA-Bots!"

    await this.client.sendHtmlText(this.roomId, text)
  }

  async logError(message: string) : Promise<void> {
    await this.client.sendHtmlText(this.roomId, `⚠️ ${message}`)
  }

  async logInfo(message: string) : Promise<void> {
    await this.client.sendText(this.roomId, `🏁 ${message}`)
  }
}