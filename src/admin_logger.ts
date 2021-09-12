import AdminRoom from "./admin_room"

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
}