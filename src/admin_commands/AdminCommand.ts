import AdminRoom from "../AdminRoom"
import RoomManager from "../RoomManager"

export default abstract class AdminCommand {
  room: AdminRoom
  roomManager: RoomManager

  constructor(room: AdminRoom, roomManager: RoomManager) {
    this.room = room
    this.roomManager = roomManager
  }

  abstract exec(...args: unknown[]) : void
}
