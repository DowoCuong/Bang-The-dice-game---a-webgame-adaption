import {
  activateSkill,
  beginResolution,
  chooseAbility,
  chooseTarget,
  resolveChoices,
  rollDice,
  skipKitArrow,
  skipSkill,
  toggleHeld,
  type GameState,
} from "./game.ts";

export type RoomStatus = "waiting" | "playing";
export type RoomPlayer = { id: string; name: string; token: string; joinedAt: number };
export type RoomState = {
  code: string;
  status: RoomStatus;
  hostPlayerId: string;
  players: RoomPlayer[];
  revision: number;
  game: GameState | null;
};

export type RoomSnapshot = {
  code: string;
  status: RoomStatus;
  hostPlayerId: string;
  players: { id: string; name: string }[];
  revision: number;
  game: GameState | null;
  me: { id: string; name: string; isHost: boolean };
};

export type RoomAction =
  | { type: "roll" | "resolve" | "activate-skill" | "skip-skill" | "skip-kit" | "settle" }
  | { type: "hold"; index: number }
  | { type: "target"; targetId: string }
  | { type: "ability"; count: number };

export type RoomClientMessage =
  | { type: "start" }
  | { type: "leave" }
  | { type: "action"; action: RoomAction; revision: number };

export type RoomServerMessage =
  | { type: "snapshot"; snapshot: RoomSnapshot }
  | { type: "error"; message: string; fatal?: boolean }
  | { type: "left" };

export class RoomError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export function cleanPlayerName(value: unknown) {
  const name = typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ") : "";
  if (![...name].length || [...name].length > 20 || /[\p{C}]/u.test(name)) {
    throw new RoomError("Tên phải có từ 1 đến 20 ký tự.");
  }
  return name;
}

export function roomActorId(game: GameState) {
  return game.decision?.playerId ?? game.players[game.turn]?.id;
}

export function publicGameFor(game: GameState, playerId: string) {
  const visible = structuredClone(game);
  for (const player of visible.players) {
    if (player.id !== playerId && !player.revealed && visible.phase !== "over") player.role = "Renegade";
  }
  return visible;
}

export function roomSnapshot(state: RoomState, playerId: string): RoomSnapshot {
  const me = state.players.find((player) => player.id === playerId);
  if (!me) throw new RoomError("Vé vào phòng đã hết hiệu lực.");
  return {
    code: state.code,
    status: state.status,
    hostPlayerId: state.hostPlayerId,
    players: state.players.map(({ id, name }) => ({ id, name })),
    revision: state.revision,
    game: state.game ? publicGameFor(state.game, me.id) : null,
    me: { id: me.id, name: me.name, isHost: me.id === state.hostPlayerId },
  };
}

export function applyRoomAction(game: GameState, action: RoomAction) {
  let next: GameState;
  switch (action.type) {
    case "roll": next = rollDice(game); break;
    case "hold": {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index > 4) {
        throw new RoomError("Xúc xắc không hợp lệ.");
      }
      next = toggleHeld(game, action.index);
      break;
    }
    case "resolve": next = beginResolution(game); break;
    case "target": {
      if (!/^p[0-7]$/.test(action.targetId)) throw new RoomError("Mục tiêu không hợp lệ.");
      next = chooseTarget(game, action.targetId, true);
      break;
    }
    case "activate-skill": next = activateSkill(game); break;
    case "skip-skill": next = skipSkill(game); break;
    case "skip-kit": next = skipKitArrow(game); break;
    case "ability": {
      if (!Number.isInteger(action.count) || action.count < 0) {
        throw new RoomError("Lựa chọn kỹ năng không hợp lệ.");
      }
      next = chooseAbility(game, action.count);
      break;
    }
    case "settle": next = resolveChoices(game); break;
    default: throw new RoomError("Hành động không hợp lệ.");
  }
  if (next === game) throw new RoomError("Hành động không hợp lệ ở thời điểm này.");
  return next;
}
