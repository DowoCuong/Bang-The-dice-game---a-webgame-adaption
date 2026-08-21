import {
  activateSkill,
  beginResolution,
  chooseAbility,
  chooseTarget,
  newMultiplayerGame,
  resolveChoices,
  rollDice,
  skipKitArrow,
  skipSkill,
  toggleHeld,
  type GameState,
} from "../app/game.ts";
import { roomsTableSql, roomsUpdatedAtIndexSql } from "../db/schema.ts";

type D1Statement = {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  run(): Promise<{ meta: { changes?: number } }>;
};
export type RoomEnv = {
  DB: {
    prepare(sql: string): D1Statement;
    batch(statements: D1Statement[]): Promise<unknown[]>;
  };
};
type RoomStatus = "waiting" | "playing";
type RoomPlayer = { id: string; name: string; token: string; joinedAt: number };
type RoomRow = {
  code: string;
  status: RoomStatus;
  host_player_id: string;
  players_json: string;
  game_json: string | null;
  revision: number;
  created_at: number;
  updated_at: number;
};

class RoomError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let schemaReady: Promise<void> | undefined;

function ensureSchema(env: RoomEnv) {
  schemaReady ??= env.DB.batch([
    env.DB.prepare(roomsTableSql),
    env.DB.prepare(roomsUpdatedAtIndexSql),
    env.DB.prepare("PRAGMA optimize"),
  ]).then(() => undefined).catch((error: unknown) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function bodyOf(request: Request) {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new RoomError(400, "Dữ liệu gửi lên không hợp lệ.");
  }
}

export function cleanPlayerName(value: unknown) {
  const name = typeof value === "string" ? value.normalize("NFKC").trim().replace(/\s+/g, " ") : "";
  if (![...name].length || [...name].length > 20 || /[\p{C}]/u.test(name)) {
    throw new RoomError(400, "Tên phải có từ 1 đến 20 ký tự.");
  }
  return name;
}

function cleanRoomCode(value: string) {
  const code = value.toUpperCase().replace(/\s/g, "");
  if (!/^[A-HJ-NP-Z2-9]{6}$/.test(code)) throw new RoomError(400, "Mã phòng không hợp lệ.");
  return code;
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return [...bytes].map((byte) => alphabet[byte % alphabet.length]).join("");
}

function playerToken(request: Request) {
  const header = request.headers.get("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new RoomError(401, "Thiếu vé vào phòng.");
  return token;
}

async function roomByCode(env: RoomEnv, code: string) {
  const room = await env.DB.prepare("SELECT * FROM rooms WHERE code = ?").bind(code).first<RoomRow>();
  if (!room) throw new RoomError(404, "Không tìm thấy phòng.");
  return room;
}

function roomPlayers(room: RoomRow) {
  return JSON.parse(room.players_json) as RoomPlayer[];
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

function snapshot(room: RoomRow, token: string) {
  const players = roomPlayers(room);
  const me = players.find((player) => player.token === token);
  if (!me) throw new RoomError(401, "Vé vào phòng đã hết hiệu lực.");
  const game = room.game_json ? JSON.parse(room.game_json) as GameState : null;
  return {
    code: room.code,
    status: room.status,
    hostPlayerId: room.host_player_id,
    players: players.map(({ id, name }) => ({ id, name })),
    revision: room.revision,
    game: game ? publicGameFor(game, me.id) : null,
    me: { id: me.id, name: me.name, isHost: me.id === room.host_player_id },
  };
}

async function createRoom(request: Request, env: RoomEnv) {
  const name = cleanPlayerName((await bodyOf(request)).name);
  const now = Date.now();
  await env.DB.prepare("DELETE FROM rooms WHERE updated_at < ?").bind(now - 86_400_000).run();
  const player: RoomPlayer = { id: "p0", name, token: crypto.randomUUID(), joinedAt: now };
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = randomCode();
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO rooms
      (code, status, host_player_id, players_json, game_json, revision, created_at, updated_at)
      VALUES (?, 'waiting', ?, ?, NULL, 0, ?, ?)
    `).bind(code, player.id, JSON.stringify([player]), now, now).run();
    if (result.meta.changes) {
      const room = await roomByCode(env, code);
      return json({ ...snapshot(room, player.token), token: player.token }, 201);
    }
  }
  throw new RoomError(503, "Chưa tạo được mã phòng. Hãy thử lại.");
}

async function joinRoom(request: Request, env: RoomEnv, code: string) {
  const name = cleanPlayerName((await bodyOf(request)).name);
  const room = await roomByCode(env, code);
  const players = roomPlayers(room);
  if (room.status !== "waiting") throw new RoomError(409, "Ván này đã bắt đầu.");
  if (players.length >= 8) throw new RoomError(409, "Phòng đã đủ 8 người.");
  if (players.some((player) => player.name.localeCompare(name, "vi", { sensitivity: "base" }) === 0)) {
    throw new RoomError(409, "Tên này đã có trong phòng.");
  }
  const player: RoomPlayer = { id: `p${players.length}`, name, token: crypto.randomUUID(), joinedAt: Date.now() };
  players.push(player);
  const result = await env.DB.prepare(`
    UPDATE rooms SET players_json = ?, revision = revision + 1, updated_at = ?
    WHERE code = ? AND revision = ?
  `).bind(JSON.stringify(players), Date.now(), code, room.revision).run();
  if (!result.meta.changes) throw new RoomError(409, "Phòng vừa thay đổi. Hãy vào lại.");
  const updated = await roomByCode(env, code);
  return json({ ...snapshot(updated, player.token), token: player.token }, 201);
}

async function startRoom(request: Request, env: RoomEnv, code: string) {
  const token = playerToken(request);
  const room = await roomByCode(env, code);
  const players = roomPlayers(room);
  const me = players.find((player) => player.token === token);
  if (!me || me.id !== room.host_player_id) throw new RoomError(403, "Chỉ chủ phòng được bắt đầu.");
  const oldGame = room.game_json ? JSON.parse(room.game_json) as GameState : null;
  if (room.status === "playing" && oldGame?.phase !== "over") throw new RoomError(409, "Ván đang diễn ra.");
  if (players.length < 3) throw new RoomError(409, "Cần ít nhất 3 người để bắt đầu.");
  const game = newMultiplayerGame(players.map((player) => player.name));
  const result = await env.DB.prepare(`
    UPDATE rooms SET status = 'playing', game_json = ?, revision = revision + 1, updated_at = ?
    WHERE code = ? AND revision = ?
  `).bind(JSON.stringify(game), Date.now(), code, room.revision).run();
  if (!result.meta.changes) throw new RoomError(409, "Phòng vừa thay đổi. Hãy thử lại.");
  return json(snapshot(await roomByCode(env, code), token));
}

async function actInRoom(request: Request, env: RoomEnv, code: string) {
  const token = playerToken(request);
  const body = await bodyOf(request);
  const room = await roomByCode(env, code);
  if (!Number.isInteger(body.revision) || body.revision !== room.revision) throw new RoomError(409, "Trạng thái ván đã thay đổi.");
  const players = roomPlayers(room);
  const me = players.find((player) => player.token === token);
  if (!me) throw new RoomError(401, "Vé vào phòng đã hết hiệu lực.");
  if (room.status !== "playing" || !room.game_json) throw new RoomError(409, "Ván chưa bắt đầu.");
  const game = JSON.parse(room.game_json) as GameState;
  if (roomActorId(game) !== me.id) throw new RoomError(403, "Chưa tới lượt quyết định của bạn.");

  let next: GameState;
  switch (body.type) {
    case "roll": next = rollDice(game); break;
    case "hold": {
      if (!Number.isInteger(body.index) || Number(body.index) < 0 || Number(body.index) > 4) throw new RoomError(400, "Xúc xắc không hợp lệ.");
      next = toggleHeld(game, Number(body.index));
      break;
    }
    case "resolve": next = beginResolution(game); break;
    case "target": {
      if (typeof body.targetId !== "string" || !/^p[0-7]$/.test(body.targetId)) throw new RoomError(400, "Mục tiêu không hợp lệ.");
      next = chooseTarget(game, body.targetId, true);
      break;
    }
    case "activate-skill": next = activateSkill(game); break;
    case "skip-skill": next = skipSkill(game); break;
    case "skip-kit": next = skipKitArrow(game); break;
    case "ability": {
      if (!Number.isInteger(body.count) || Number(body.count) < 0) throw new RoomError(400, "Lựa chọn kỹ năng không hợp lệ.");
      next = chooseAbility(game, Number(body.count));
      break;
    }
    case "settle": next = resolveChoices(game); break;
    default: throw new RoomError(400, "Hành động không hợp lệ.");
  }
  if (next === game) throw new RoomError(409, "Hành động không hợp lệ ở thời điểm này.");
  const result = await env.DB.prepare(`
    UPDATE rooms SET game_json = ?, revision = revision + 1, updated_at = ?
    WHERE code = ? AND revision = ?
  `).bind(JSON.stringify(next), Date.now(), code, room.revision).run();
  if (!result.meta.changes) throw new RoomError(409, "Một hành động khác đã được ghi trước.");
  return json(snapshot(await roomByCode(env, code), token));
}

async function leaveRoom(request: Request, env: RoomEnv, code: string) {
  const token = playerToken(request);
  const room = await roomByCode(env, code);
  if (room.status !== "waiting") throw new RoomError(409, "Không thể rời danh sách sau khi ván đã bắt đầu.");
  const players = roomPlayers(room);
  const me = players.find((player) => player.token === token);
  if (!me) throw new RoomError(401, "Vé vào phòng đã hết hiệu lực.");
  const oldHost = players.find((player) => player.id === room.host_player_id);
  const remaining = players.filter((player) => player.id !== me.id);
  if (!remaining.length) {
    await env.DB.prepare("DELETE FROM rooms WHERE code = ? AND revision = ?").bind(code, room.revision).run();
    return json({ left: true });
  }
  const normalized = remaining.map((player, index) => ({ ...player, id: `p${index}` }));
  const hostId = normalized.find((player) => player.token === oldHost?.token)?.id ?? normalized[0].id;
  const result = await env.DB.prepare(`
    UPDATE rooms SET host_player_id = ?, players_json = ?, revision = revision + 1, updated_at = ?
    WHERE code = ? AND revision = ?
  `).bind(hostId, JSON.stringify(normalized), Date.now(), code, room.revision).run();
  if (!result.meta.changes) throw new RoomError(409, "Phòng vừa thay đổi.");
  return json({ left: true });
}

export async function handleRoomsRequest(request: Request, env: RoomEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/rooms")) return null;
  try {
    await ensureSchema(env);
    const match = url.pathname.match(/^\/api\/rooms(?:\/([A-HJ-NP-Z2-9]{6})(?:\/(join|start|action|leave))?)?$/i);
    if (!match) throw new RoomError(404, "Đường dẫn phòng không tồn tại.");
    const code = match[1] ? cleanRoomCode(match[1]) : "";
    const command = match[2];
    if (request.method === "POST" && !code) return createRoom(request, env);
    if (request.method === "GET" && code && !command) return json(snapshot(await roomByCode(env, code), playerToken(request)));
    if (request.method === "POST" && command === "join") return joinRoom(request, env, code);
    if (request.method === "POST" && command === "start") return startRoom(request, env, code);
    if (request.method === "POST" && command === "action") return actInRoom(request, env, code);
    if (request.method === "POST" && command === "leave") return leaveRoom(request, env, code);
    throw new RoomError(405, "Phương thức không được hỗ trợ.");
  } catch (error) {
    if (error instanceof RoomError) return json({ error: error.message }, error.status);
    console.error(error);
    return json({ error: "Máy chủ phòng đang bận. Hãy thử lại." }, 500);
  }
}
