import AdminRoom from "../AdminRoom"
import RoomManager from "../RoomManager"
import HelpCommand from "./HelpCommand"
import NoticeCommand from "./NoticeCommand"
import TextCommand from "./TextCommand"

export type AdminCommands = {
  help: HelpCommand,
  text: TextCommand,
  notice: NoticeCommand
}

export default function commandsFor(room: AdminRoom, roomManager: RoomManager) : AdminCommands {
  return {
    help: new HelpCommand(room, roomManager),
    text: new TextCommand(room, roomManager),
    notice: new NoticeCommand(room, roomManager)
  }
}