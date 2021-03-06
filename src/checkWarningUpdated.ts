import { LastSent, MINAWarnItem } from "./types"

type WarningStatus = "new" | "changed" | "extended" | "unchanged" 

export default function checkWarningUpdated(item: MINAWarnItem, lastSent: LastSent | undefined) : WarningStatus {
  if(lastSent && lastSent.id === item.id) {
    if (lastSent.hash === item.hash) {
      if (item.expires?.getTime() !== lastSent.expires?.getTime()) {
        return "extended"
      }
      return "unchanged"
    }
    return "changed"
  }
  return "new"
}