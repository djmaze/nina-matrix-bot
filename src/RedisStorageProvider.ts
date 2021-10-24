import { IFilterInfo, IStorageProvider } from "matrix-bot-sdk"
import { createClient } from "redis"
import { RedisClientType } from "redis/dist/lib/client"
import EventEmitter from "events"

const FILTER_KEY = "#filter"
const SYNC_TOKEN_KEY = "#syncToken"

export default class RedisStorageProvider extends EventEmitter implements IStorageProvider {
  private connected = false
  private client: RedisClientType
  private syncToken?: string
  private filter?: IFilterInfo

  constructor(redisUrl: string) {
    super()

    this.client = createClient({
      url: redisUrl,
    })

    this.client.on("connect", () => {
      console.debug("Connected to Redis")
      this.connected = true
      this.emit("connected")
      this.resave()
    })
    this.client.on("reconnecting", () => {
      this.connected = false
    })
    this.client.on("error", (err) => console.error("Redis Client Error", err))
    this.client.connect()
  }

  async setSyncToken(token: string | null): Promise<void> {
    if (!token) return

    if (this.syncToken != token) {
      this.syncToken = token
      await this.set(SYNC_TOKEN_KEY, token)
    }
  }

  async getSyncToken(): Promise<string | null> {
    return await this.get(SYNC_TOKEN_KEY)
  }

  async setFilter(filter: IFilterInfo): Promise<void> {
    this.filter = filter
    this.set(FILTER_KEY, JSON.stringify(filter))
  }

  async getFilter(): Promise<IFilterInfo> {
    const filterJson = await this.get(FILTER_KEY)
    if (filterJson)
      return JSON.parse(filterJson)
    else
      return {
        id: 0,
        filter: null
      }
  }

  async storeValue(key: string, value: string): Promise<void> {
    await this.set(key, value)
  }

  async readValue(key: string): Promise<string | null | undefined> {
    return await this.get(key)
  }

  private async resave() {
    await this.waitForConnection()

    console.debug("Re-saving Redis data")
    if (this.syncToken)
      await this.set(SYNC_TOKEN_KEY, this.syncToken)
    if (this.filter)
      await this.set(FILTER_KEY, JSON.stringify(this.filter))
  }

  private async set(key: string, value: string) {
    await this.waitForConnection()

    await this.client.set(key, value)
  }

  private async get(key: string) : Promise<string | null> {
    await this.waitForConnection()

    return await this.client.get(key)
  }

  private async waitForConnection() : Promise<void> {
    return new Promise((resolve) => {
      if (this.connected) {
        resolve()
      } else {
        console.debug("Waiting for redis connection")
        this.on("connected", resolve.bind(this))
      }
    })
  }
}