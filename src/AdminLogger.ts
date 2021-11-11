import AdminRoom from "./AdminRoom"

export default class AdminLogger {
  adminRoom?: AdminRoom

  constructor(adminRoom?: AdminRoom) {
    this.adminRoom = adminRoom
  }

  async info(message: string) : Promise<void> {
    try {
      if (this.adminRoom)
        await this.adminRoom.logInfo(message)
    } 
    finally {
      console.info(message)
    }
  }

  async error(message: string) : Promise<void> {
    try {
      if (this.adminRoom)
        await this.adminRoom.logError(message)
    } 
    finally {
      console.error(message)
    }
  }

  async debug(message: string) : Promise<void> {
    try {
      if (this.adminRoom)
        await this.adminRoom.logDebug(message)
    }
    finally {
      console.debug(message)
    }
  }
}