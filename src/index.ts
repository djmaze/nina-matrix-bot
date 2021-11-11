import { AutojoinRoomsMixin, IStorageProvider, MatrixClient, SimpleFsStorageProvider } from "matrix-bot-sdk"
import AdminLogger from "./AdminLogger"
import Settings from "./Settings"
import RoomManager from "./RoomManager"
import RedisStorageProvider from "./RedisStorageProvider"
import HealthPing from "./health_ping"

let storage: IStorageProvider

const settings = new Settings(process.env)

if (settings.redisUrl)
  storage = new RedisStorageProvider(settings.redisUrl)
else
  storage = new SimpleFsStorageProvider("bot.json")

const client = new MatrixClient(settings.homeserverUrl, settings.accessToken, storage)
AutojoinRoomsMixin.setupOnClient(client)
const logger = new AdminLogger()
const roomManager = new RoomManager(client, settings, logger)

client.start().then(async () => {
  console.log("Client started!")
  await roomManager.setupRooms()

  new HealthPing(settings)
})