import { AutojoinRoomsMixin, MatrixClient, SimpleFsStorageProvider } from "matrix-bot-sdk"
import AdminLogger from "./AdminLogger"
import Settings from "./Settings"
import RoomManager from "./RoomManager"

const settings = new Settings(process.env)
const storage = new SimpleFsStorageProvider("bot.json")
const client = new MatrixClient(settings.homeserverUrl, settings.accessToken, storage)
AutojoinRoomsMixin.setupOnClient(client)
const logger = new AdminLogger()
const roomManager = new RoomManager(client, settings, logger)

client.start().then(async () => {
  console.log("Client started!")
  await roomManager.setupRooms()
})