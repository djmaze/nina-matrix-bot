import WarningRoom from "../WarningRoom"
import HelpCommand from "./HelpCommand"
import InvalidCommandCommand from "./InvalidCommandCommand"
import SearchCommand from "./SearchCommand"
import SubscribeCommand from "./SubscribeCommand"
import UnsubscribeCommand from "./UnsubscribeCommand"

export type WarningCommands = {
  help: HelpCommand,
  invalidCommand: InvalidCommandCommand
  search: SearchCommand
  subscribe: SubscribeCommand
  unsubscribe: UnsubscribeCommand
}

export default function commandsFor(room: WarningRoom) : WarningCommands {
  return {
    help: new HelpCommand(room),
    invalidCommand: new InvalidCommandCommand(room),
    search: new SearchCommand(room),
    subscribe: new SubscribeCommand(room),
    unsubscribe: new UnsubscribeCommand(room)
  }
}