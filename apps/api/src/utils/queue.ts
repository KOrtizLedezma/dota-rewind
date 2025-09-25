import { GAME_MODE, LOBBY } from "../clients/opendota";

export type QueueKey = "all" | "turbo" | "ranked" | "normal";

export function queueToFilters(queue: QueueKey): {
  gameMode?: number;
  lobbyType?: number;
} {
  switch (queue) {
    case "turbo":
      return { gameMode: GAME_MODE.TURBO };
    case "ranked":
      return { lobbyType: LOBBY.RANKED };
    case "normal":
      return { lobbyType: LOBBY.NORMAL };
    default:
      return {};
  }
}
