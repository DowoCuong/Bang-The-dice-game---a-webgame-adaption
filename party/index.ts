/// <reference types="@cloudflare/workers-types" />

import {
  Server,
  routePartykitRequest,
  type Connection,
  type ConnectionContext,
  type WSMessage,
} from "partyserver";
import { newMultiplayerGame } from "../app/game.ts";
import {
  applyRoomAction,
  cleanPlayerName,
  roomActorId,
  roomSnapshot,
  RoomError,
  type RoomClientMessage,
  type RoomServerMessage,
  type RoomState,
} from "../app/room.ts";

type ConnectionState = { playerId: string; token: string };
const STATE_KEY = "state";
const ROOM_IDLE_MS = 5 * 60 * 1000;

function send(connection: Connection, message: RoomServerMessage) {
  connection.send(JSON.stringify(message));
}

function validToken(token: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
}

type Env = Cloudflare.Env & { Main: DurableObjectNamespace<GameRoom> };

export class GameRoom extends Server<Env> {
  static options = { hibernate: true };
  state: RoomState | null = null;

  async onStart() {
    this.state = await this.ctx.storage.get<RoomState>(STATE_KEY) ?? null;
  }

  async onConnect(connection: Connection<ConnectionState>, context: ConnectionContext) {
    try {
      const query = new URL(context.request.url).searchParams;
      const intent = query.get("intent");
      const token = query.get("token") ?? "";
      if (!/^[A-HJ-NP-Z2-9]{6}$/i.test(this.name)) throw new RoomError("Mã phòng không hợp lệ.");
      if (!validToken(token)) throw new RoomError("Vé vào phòng không hợp lệ.");

      let player = this.state?.players.find((candidate) => candidate.token === token);
      if (player) {
        connection.setState({ playerId: player.id, token });
        await this.scheduleExpiry();
        this.sendSnapshot(connection);
        return;
      }

      if (!this.state) {
        if (intent !== "create") throw new RoomError("Không tìm thấy phòng.");
        const name = cleanPlayerName(query.get("name"));
        player = { id: "p0", name, token, joinedAt: Date.now() };
        this.state = {
          code: this.name.toUpperCase(),
          status: "waiting",
          hostPlayerId: player.id,
          players: [player],
          revision: 0,
          game: null,
        };
      } else {
        if (intent !== "join") throw new RoomError("Vé vào phòng đã hết hiệu lực.");
        if (this.state.status !== "waiting") throw new RoomError("Ván này đã bắt đầu.");
        if (this.state.players.length >= 8) throw new RoomError("Phòng đã đủ 8 người.");
        const name = cleanPlayerName(query.get("name"));
        if (this.state.players.some((candidate) => candidate.name.localeCompare(name, "vi", { sensitivity: "base" }) === 0)) {
          throw new RoomError("Tên này đã có trong phòng.");
        }
        player = { id: `p${this.state.players.length}`, name, token, joinedAt: Date.now() };
        this.state.players.push(player);
        this.state.revision += 1;
      }

      connection.setState({ playerId: player.id, token });
      await this.persist();
      this.sendSnapshots();
    } catch (error) {
      this.fail(connection, error, true);
    }
  }

  async onAlarm() {
    this.state = null;
    await this.ctx.storage.delete(STATE_KEY);
    for (const connection of this.getConnections()) {
      send(connection, { type: "error", message: "Phòng đã hết hạn sau 5 phút không hoạt động.", fatal: true });
      connection.close(1000, "Room expired");
    }
  }

  async onMessage(sender: Connection<ConnectionState>, message: WSMessage) {
    try {
      const command = JSON.parse(typeof message === "string" ? message : new TextDecoder().decode(message)) as RoomClientMessage;
      if (!this.state || !sender.state) throw new RoomError("Vé vào phòng đã hết hiệu lực.");
      const me = this.state.players.find((player) => player.token === sender.state!.token);
      if (!me) throw new RoomError("Vé vào phòng đã hết hiệu lực.");

      if (command.type === "start") {
        if (me.id !== this.state.hostPlayerId) throw new RoomError("Chỉ chủ phòng được bắt đầu.");
        if (this.state.status === "playing" && this.state.game?.phase !== "over") throw new RoomError("Ván đang diễn ra.");
        if (this.state.players.length < 3) throw new RoomError("Cần ít nhất 3 người để bắt đầu.");
        this.state.status = "playing";
        this.state.game = newMultiplayerGame(this.state.players.map((player) => player.name));
        this.state.revision += 1;
      } else if (command.type === "leave") {
        await this.leave(sender, me.token);
        return;
      } else if (command.type === "action") {
        if (!Number.isInteger(command.revision) || command.revision !== this.state.revision) {
          throw new RoomError("Trạng thái ván đã thay đổi.");
        }
        if (this.state.status !== "playing" || !this.state.game) throw new RoomError("Ván chưa bắt đầu.");
        if (roomActorId(this.state.game) !== me.id) throw new RoomError("Chưa tới lượt quyết định của bạn.");
        this.state.game = applyRoomAction(this.state.game, command.action);
        this.state.revision += 1;
      } else {
        throw new RoomError("Hành động không hợp lệ.");
      }

      await this.persist();
      this.sendSnapshots();
    } catch (error) {
      this.fail(sender, error);
    }
  }

  private async leave(sender: Connection<ConnectionState>, token: string) {
    if (!this.state) throw new RoomError("Không tìm thấy phòng.");
    if (this.state.status !== "waiting") throw new RoomError("Không thể rời danh sách sau khi ván đã bắt đầu.");
    const oldHost = this.state.players.find((player) => player.id === this.state!.hostPlayerId);
    const remaining = this.state.players.filter((player) => player.token !== token);
    send(sender, { type: "left" });
    sender.setState(null);

    if (!remaining.length) {
      this.state = null;
      await Promise.all([
        this.ctx.storage.delete(STATE_KEY),
        this.ctx.storage.deleteAlarm(),
      ]);
      return;
    }

    this.state.players = remaining.map((player, index) => ({ ...player, id: `p${index}` }));
    this.state.hostPlayerId = this.state.players.find((player) => player.token === oldHost?.token)?.id ?? this.state.players[0].id;
    this.state.revision += 1;
    for (const connection of this.getConnections<ConnectionState>()) {
      if (!connection.state) continue;
      const player = this.state.players.find((candidate) => candidate.token === connection.state!.token);
      connection.setState(player ? { playerId: player.id, token: player.token } : null);
    }
    await this.persist();
    this.sendSnapshots();
  }

  private async persist() {
    if (!this.state) return;
    await Promise.all([
      this.ctx.storage.put(STATE_KEY, this.state),
      this.scheduleExpiry(),
    ]);
  }

  private async scheduleExpiry() {
    await this.ctx.storage.setAlarm(Date.now() + ROOM_IDLE_MS);
  }

  private sendSnapshot(connection: Connection<ConnectionState>) {
    if (!this.state || !connection.state) return;
    send(connection, { type: "snapshot", snapshot: roomSnapshot(this.state, connection.state.playerId) });
  }

  private sendSnapshots() {
    for (const connection of this.getConnections<ConnectionState>()) this.sendSnapshot(connection);
  }

  private fail(connection: Connection, error: unknown, fatal = false) {
    const message = error instanceof RoomError ? error.message : "Máy chủ phòng đang bận. Hãy thử lại.";
    if (!(error instanceof RoomError)) console.error(error);
    send(connection, { type: "error", message, fatal });
  }
}

export default {
  async fetch(request: Request, env: Env) {
    return await routePartykitRequest(request, env) ?? new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
