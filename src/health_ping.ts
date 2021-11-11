import fetch from "node-fetch"
import Settings from "./Settings"

export default class HealthPing {
  settings: Settings

  constructor(settings: Settings) {
    this.settings = settings

    if (this.settings.HEALTHCHECK_URL) {
      this.ping()
      setInterval(this.ping.bind(this), settings.HEALTHCHECK_PING_INTERVAL_IN_SECONDS! * 1000)
    }
  }

  async ping() : Promise<void> {
    const res = await fetch(this.settings.HEALTHCHECK_URL!)
    if (res.ok)
      console.debug("Health ping successful")
    else
      console.error("Health ping failed:", await res.text())
  }
}