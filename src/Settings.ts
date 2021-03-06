export default class Settings {
  homeserverUrl: string
  redisUrl?: string
  accessToken: string
  INTERVAL: number
  FEEDBACK_ROOM?: string
  ADMIN_ROOM_ID?: string
  HEALTHCHECK_URL?: string
  HEALTHCHECK_PING_INTERVAL_IN_SECONDS?: number

  LOCATION_EVENT_TYPE = "de.nina-bot.location"
  LAST_SENT_TYPE = "de.nina-bot.last-sent"

  constructor(env: NodeJS.ProcessEnv) {
    function get(name: string, mandatory = false) {
      if (mandatory && !env[name]) throw(`Need ${name}`)
      return env[name]
    }

    this.homeserverUrl = get("HOMESERVER_URL", true)!
    this.redisUrl = get("REDIS_URL", false)
    this.accessToken = get("ACCESS_TOKEN", true)!
    this.INTERVAL = parseInt(get("INTERVAL_MINUTES") || "10") * 60 * 1000
    this.FEEDBACK_ROOM = get("FEEDBACK_ROOM")
    this.ADMIN_ROOM_ID = get("ADMIN_ROOM_ID")
    this.HEALTHCHECK_URL = get("HEALTHCHECK_URL")
    if (this.HEALTHCHECK_URL) {
      this.HEALTHCHECK_PING_INTERVAL_IN_SECONDS = parseInt(get("HEALTHCHECK_PING_INTERVAL_IN_SECONDS", true)!)
    }
  }
}