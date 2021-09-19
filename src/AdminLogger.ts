import AdminRoom from "./AdminRoom"

export default class AdminLogger {
  adminRoom?: AdminRoom

  constructor(adminRoom?: AdminRoom) {
    this.adminRoom = adminRoom
  }

  info(message: string) : void {
    if (this.adminRoom)
      this.adminRoom.logInfo(message)
    console.info(message)
  }

  error(message: string) : void {
    if (this.adminRoom)
      this.adminRoom.logError(message)
    console.error(message)
  }

  debug(message: string) : void {
    if (this.adminRoom)
      this.adminRoom.logDebug(message)
    console.debug(message)
  }
}