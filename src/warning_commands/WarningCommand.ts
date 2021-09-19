import WarningRoom from "../WarningRoom"

export default abstract class WarningCommand {
  room: WarningRoom

  constructor(room: WarningRoom) {
    this.room = room
  }

  abstract exec(...args: unknown[]) : void
}
