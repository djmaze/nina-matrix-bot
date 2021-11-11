import AdminRoom from "./AdminRoom"

export default class AdminLogger {
  adminRoom?: AdminRoom

  constructor(adminRoom?: AdminRoom) {
    this.adminRoom = adminRoom
  }

  async info(message: string) : Promise<void> {
    console.info(message)

    try {
      if (this.adminRoom)
        await this.adminRoom.logInfo(message)
    } catch {
      console.error("Couldn't log to admin room")
    }
  }

  async error(message: string) : Promise<void> {
    console.error(message)

    try {
      if (this.adminRoom)
        await this.adminRoom.logError(message)
    } 
    catch {
      console.error("Couldn't log to admin room")
    }
  }

  async debug(message: string) : Promise<void> {
    console.debug(message)

    try {
      if (this.adminRoom)
        await this.adminRoom.logDebug(message)
    }
    catch {
      console.error("Couldn't log to admin room")
    }
  }
}