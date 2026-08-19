export type Role = "Sheriff" | "Deputy" | "Outlaw" | "Renegade";
export type Face = "arrow" | "dynamite" | "bull1" | "bull2" | "beer" | "gatling";
export type Phase = "roll" | "bot" | "sid" | "shot" | "beer" | "kit" | "ability" | "over";
type DamageCause = "shoot" | "gatling" | "indian" | "dynamite";
type DamageResume = "shots" | "gatling" | "dynamite";

export type Character = {
  id: string;
  name: string;
  life: number;
  ability: string;
};

export type Player = {
  id: string;
  name: string;
  role: Role;
  character: Character;
  hp: number;
  maxHp: number;
  arrows: number;
  alive: boolean;
  human: boolean;
  revealed: boolean;
};

type Pending = {
  shots: ("bull1" | "bull2")[];
  shotTargets: string[];
  beers: number;
  beerTargets: string[];
  gatlings: number;
  slabDoubleIndex: number | null;
  shotsResolved: boolean;
  beersResolved: boolean;
  kitRemaining: number;
};

export type AbilityDecision = {
  kind: "bart" | "pedro";
  playerId: string;
  max: number;
  damages: [string, number][];
  cause: DamageCause;
  sourceId?: string;
  resume: DamageResume;
};

export type GameEffectKind = "shot" | "beer" | "arrow" | "gatling" | "damage" | "skill";

export type GameEffect = {
  id: number;
  kind: GameEffectKind;
  sourceId?: string;
  targetId?: string;
  amount?: number;
  label?: string;
};

export type GameState = {
  players: Player[];
  playerCount: number;
  turn: number;
  round: number;
  phase: Phase;
  dice: (Face | null)[];
  held: boolean[];
  rolls: number;
  arrowSupply: number;
  pending: Pending | null;
  decision: AbilityDecision | null;
  effects: GameEffect[];
  effectSeq: number;
  log: string[];
  winner: string | null;
};

export const characters: Character[] = [
  { id: "bart", name: "Bart Cassidy", life: 8, ability: "Lấy 1 Mũi tên thay vì mất máu, trừ Người da đỏ và Thuốc nổ." },
  { id: "black-jack", name: "Black Jack", life: 8, ability: "Có thể tung lại Thuốc nổ nếu chưa có 3 Thuốc nổ." },
  { id: "janet", name: "Calamity Janet", life: 8, ability: "Có thể dùng Tầm 1 như Tầm 2 và ngược lại." },
  { id: "el-gringo", name: "El Gringo", life: 7, ability: "Người làm bạn mất máu phải lấy 1 Mũi tên, trừ Người da đỏ và Thuốc nổ." },
  { id: "jesse", name: "Jesse Jones", life: 9, ability: "Khi còn tối đa 4 máu, Bia dùng cho bản thân hồi 2 máu." },
  { id: "jourdonnais", name: "Jourdonnais", life: 7, ability: "Không bao giờ mất quá 1 máu bởi Người da đỏ." },
  { id: "kit", name: "Kit Carlson", life: 7, ability: "Mỗi Gatling cho phép bỏ 1 Mũi tên của bất kỳ người chơi nào." },
  { id: "lucky", name: "Lucky Duke", life: 8, ability: "Được tung xúc xắc tối đa 4 lần trong lượt." },
  { id: "paul", name: "Paul Regret", life: 9, ability: "Không mất máu bởi Gatling." },
  { id: "pedro", name: "Pedro Ramirez", life: 8, ability: "Mỗi khi mất máu, có thể bỏ 1 Mũi tên của mình." },
  { id: "rose", name: "Rose Doolan", life: 9, ability: "Tầm 1 và Tầm 2 bắn xa hơn 1 vị trí." },
  { id: "sid", name: "Sid Ketchum", life: 8, ability: "Đầu lượt, hồi 1 máu cho bất kỳ người chơi nào, kể cả bạn." },
  { id: "slab", name: "Slab the Killer", life: 8, ability: "Một lần mỗi lượt, dùng 1 Bia để một Tầm 1/2 gây 2 sát thương." },
  { id: "suzy", name: "Suzy Lafayette", life: 8, ability: "Cuối lượt không có Tầm 1/2: hồi 2 máu." },
  { id: "vulture", name: "Vulture Sam", life: 9, ability: "Mỗi người chơi khác bị loại: hồi 2 máu." },
  { id: "willy", name: "Willy the Kid", life: 8, ability: "Chỉ cần 2 Gatling để kích hoạt súng máy." },
];

export const faceInfo: Record<Face, { symbol: string; label: string }> = {
  arrow: { symbol: "➹", label: "Mũi tên" },
  dynamite: { symbol: "▰", label: "Thuốc nổ" },
  bull1: { symbol: "❶", label: "Tầm 1" },
  bull2: { symbol: "❷", label: "Tầm 2" },
  beer: { symbol: "♨", label: "Bia" },
  gatling: { symbol: "✹", label: "Gatling" },
};

const faces = Object.keys(faceInfo) as Face[];
const roleSets: Record<number, Role[]> = {
  3: ["Deputy", "Outlaw", "Renegade"],
  4: ["Sheriff", "Renegade", "Outlaw", "Outlaw"],
  5: ["Sheriff", "Renegade", "Outlaw", "Outlaw", "Deputy"],
  6: ["Sheriff", "Renegade", "Outlaw", "Outlaw", "Outlaw", "Deputy"],
  7: ["Sheriff", "Renegade", "Outlaw", "Outlaw", "Outlaw", "Deputy", "Deputy"],
  8: ["Sheriff", "Renegade", "Renegade", "Outlaw", "Outlaw", "Outlaw", "Deputy", "Deputy"],
};

function shuffle<T>(items: T[], rng = Math.random) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clone(game: GameState): GameState {
  return structuredClone(game);
}

function note(game: GameState, message: string) {
  game.log = [message, ...game.log].slice(0, 50);
}

function emitEffect(game: GameState, effect: Omit<GameEffect, "id">) {
  game.effectSeq += 1;
  game.effects = [...game.effects, { id: game.effectSeq, ...effect }].slice(-40);
}

function emitSkill(game: GameState, sourceId: string, label: string, targetId?: string, amount?: number) {
  emitEffect(game, { kind: "skill", sourceId, targetId, amount, label });
}

export function newGame(playerCount = 5, rng = Math.random): GameState {
  const count = Math.max(3, Math.min(8, playerCount));
  const roles = shuffle(roleSets[count], rng);
  const cast = shuffle(characters, rng).slice(0, count);
  const players = roles.map((role, index): Player => {
    const maxHp = cast[index].life + (role === "Sheriff" ? 2 : 0);
    return {
      id: `p${index}`,
      name: index === 0 ? "Bạn" : `Bot ${index}`,
      role,
      character: cast[index],
      hp: maxHp,
      maxHp,
      arrows: 0,
      alive: true,
      human: index === 0,
      revealed: count === 3 || role === "Sheriff",
    };
  });
  const firstRole: Role = count === 3 ? "Deputy" : "Sheriff";
  const turn = players.findIndex((player) => player.role === firstRole);
  const game: GameState = {
    players,
    playerCount: count,
    turn,
    round: 1,
    phase: players[turn].human ? "roll" : "bot",
    dice: Array(5).fill(null),
    held: Array(5).fill(false),
    rolls: 0,
    arrowSupply: 9,
    pending: null,
    decision: null,
    effects: [],
    effectSeq: 0,
    log: [`${players[turn].name} bắt đầu ván với vai ${firstRole}.`],
    winner: null,
  };
  applyStartAbility(game);
  return game;
}

export function maxRolls(game: GameState) {
  return game.players[game.turn].character.id === "lucky" ? 4 : 3;
}

export function alivePlayers(game: GameState) {
  return game.players.filter((player) => player.alive);
}

function aliveOrder(game: GameState) {
  return game.players.map((player, index) => ({ player, index })).filter(({ player }) => player.alive);
}

export function tableDistance(game: GameState, from: number, to: number) {
  const order = aliveOrder(game).map(({ index }) => index);
  const a = order.indexOf(from);
  const b = order.indexOf(to);
  if (a < 0 || b < 0) return Infinity;
  const direct = Math.abs(a - b);
  return Math.min(direct, order.length - direct);
}

export function eligibleTargetIds(game: GameState, face: "bull1" | "bull2") {
  const shooter = game.players[game.turn];
  const living = alivePlayers(game);
  const shortGame = living.length <= 3;
  return game.players.flatMap((player, index) => {
    if (!player.alive || index === game.turn) return [];
    const distance = tableDistance(game, game.turn, index);
    let allowed: number[] = face === "bull1" ? [1] : [shortGame ? 1 : 2];
    if (shooter.character.id === "janet") allowed = shortGame ? [1] : [1, 2];
    if (shooter.character.id === "rose") allowed = face === "bull1" ? [1, 2] : shortGame ? [1] : [2, 3];
    return allowed.includes(distance) ? [player.id] : [];
  });
}

function heal(game: GameState, id: string, amount: number, reason: string, effect?: Omit<GameEffect, "id" | "amount">) {
  const player = game.players.find((candidate) => candidate.id === id);
  if (!player?.alive) return;
  const gained = Math.min(amount, player.maxHp - player.hp);
  if (effect) emitEffect(game, { ...effect, amount: gained });
  if (gained > 0) {
    player.hp += gained;
    note(game, `${player.name} hồi ${gained} máu (${reason}).`);
  }
}

function checkWinner(game: GameState, eliminated: Player[] = [], killerId?: string) {
  if (game.winner) return;
  const living = alivePlayers(game);
  if (game.playerCount === 3) {
    if (killerId) {
      const killer = game.players.find((player) => player.id === killerId);
      const targets: Record<Role, Role> = { Deputy: "Renegade", Renegade: "Outlaw", Outlaw: "Deputy", Sheriff: "Outlaw" };
      if (killer && eliminated.some((player) => player.role === targets[killer.role])) {
        game.winner = `${killer.name} (${killer.role}) thắng!`;
      }
    }
    if (!game.winner && living.length <= 1) game.winner = living[0] ? `${living[0].name} sống sót và thắng!` : "Không ai sống sót.";
  } else {
    const sheriffAlive = living.some((player) => player.role === "Sheriff");
    if (!sheriffAlive) {
      game.winner = living.length === 1 && living[0].role === "Renegade"
        ? `${living[0].name} — Renegade thắng!`
        : "Phe Outlaw thắng!";
    } else if (!living.some((player) => player.role === "Outlaw" || player.role === "Renegade")) {
      game.winner = "Sheriff và các Deputy thắng!";
    }
  }
  if (game.winner) {
    game.phase = "over";
    note(game, game.winner);
  }
}

function finishDeaths(game: GameState, killerId?: string) {
  const eliminated = game.players.filter((player) => player.alive && player.hp <= 0);
  if (!eliminated.length) return;
  for (const player of eliminated) {
    player.alive = false;
    player.revealed = true;
    game.arrowSupply += player.arrows;
    player.arrows = 0;
    note(game, `${player.name} bị loại — lộ vai ${player.role}.`);
  }
  const deaths = eliminated.length;
  for (const player of game.players) {
    if (player.alive && player.character.id === "vulture") {
      heal(game, player.id, deaths * 2, "Vulture Sam", {
        kind: "skill",
        sourceId: player.id,
        targetId: player.id,
        label: "VULTURE SAM • HỒI MÁU KHI CÓ NGƯỜI BỊ LOẠI",
      });
    }
  }
  checkWinner(game, eliminated, killerId);
}

function takeArrow(game: GameState, playerId: string) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player?.alive || game.arrowSupply <= 0) return;
  player.arrows += 1;
  game.arrowSupply -= 1;
  emitEffect(game, { kind: "arrow", targetId: player.id, amount: 1 });
  note(game, `${player.name} lấy 1 mũi tên.`);
  if (game.arrowSupply === 0) indianAttack(game);
}

function damageGroup(
  game: GameState,
  damages: Map<string, number>,
  cause: DamageCause,
  sourceId?: string,
  resume?: DamageResume,
  choice?: { kind: "bart" | "pedro"; count: number },
) {
  const humanDamage = [...damages].find(([id, requested]) => requested > 0 && game.players.find((player) => player.id === id)?.human);
  if (resume && humanDamage && !choice) {
    const [playerId, requested] = humanDamage;
    const player = game.players.find((candidate) => candidate.id === playerId)!;
    const bartMax = (cause === "shoot" || cause === "gatling") && player.character.id === "bart"
      ? Math.min(requested, Math.max(0, game.arrowSupply - 1))
      : 0;
    const pedroMax = player.character.id === "pedro" ? Math.min(requested, player.hp, player.arrows) : 0;
    const kind = bartMax > 0 ? "bart" : pedroMax > 0 ? "pedro" : null;
    if (kind) {
      game.decision = {
        kind,
        playerId,
        max: kind === "bart" ? bartMax : pedroMax,
        damages: [...damages],
        cause,
        sourceId,
        resume,
      };
      game.phase = "ability";
      return null;
    }
  }

  const lost = new Map<string, number>();
  for (const [id, requested] of damages) {
    const player = game.players.find((candidate) => candidate.id === id);
    if (!player?.alive || requested <= 0) continue;
    if (cause === "gatling" && player.character.id === "paul") {
      emitEffect(game, { kind: "gatling", sourceId, targetId: player.id, amount: 0 });
      emitSkill(game, player.id, "PAUL REGRET • MIỄN NHIỄM GATLING", player.id);
      note(game, `${player.name} miễn nhiễm Gatling.`);
      continue;
    }
    let amount = cause === "indian" && player.character.id === "jourdonnais" ? Math.min(1, requested) : requested;
    if (cause === "indian" && player.character.id === "jourdonnais" && requested > 1) {
      emitSkill(game, player.id, "JOURDONNAIS • CHỈ MẤT TỐI ĐA 1 MÁU", player.id);
    }
    let replaced = 0;
    if ((cause === "shoot" || cause === "gatling") && player.character.id === "bart") {
      const replaceLimit = player.human ? (choice?.kind === "bart" ? choice.count : 0) : amount;
      while (amount > 0 && game.arrowSupply > 1 && replaced < replaceLimit) {
        player.arrows += 1;
        game.arrowSupply -= 1;
        amount -= 1;
        replaced += 1;
      }
      if (replaced) {
        emitSkill(game, player.id, "BART CASSIDY • ĐỔI SÁT THƯƠNG LẤY MŨI TÊN", player.id);
        for (let i = 0; i < replaced; i++) emitEffect(game, { kind: "arrow", targetId: player.id, amount: 1 });
        note(game, `${player.name} đổi ${replaced} sát thương lấy mũi tên.`);
      }
    }
    const actual = Math.min(player.hp, amount);
    player.hp -= actual;
    lost.set(id, actual);
    if (cause !== "shoot") {
      emitEffect(game, {
        kind: cause === "gatling" ? "gatling" : cause === "indian" ? "arrow" : "damage",
        sourceId,
        targetId: player.id,
        amount: actual ? -actual : 0,
      });
    }
    if (actual) note(game, `${player.name} mất ${actual} máu (${cause}).`);
    if (actual && player.character.id === "pedro") {
      const discardLimit = player.human ? (choice?.kind === "pedro" ? choice.count : 0) : actual;
      const removed = Math.min(actual, player.arrows, discardLimit);
      player.arrows -= removed;
      game.arrowSupply += removed;
      if (removed) {
        emitSkill(game, player.id, "PEDRO RAMIREZ • BỎ MŨI TÊN SAU KHI MẤT MÁU", player.id);
        note(game, `${player.name} bỏ ${removed} mũi tên nhờ kỹ năng.`);
      }
    }
  }
  if ((cause === "shoot" || cause === "gatling") && sourceId) {
    for (const [id, amount] of lost) {
      const target = game.players.find((player) => player.id === id);
      if (amount > 0 && target?.character.id === "el-gringo") {
        emitSkill(game, target.id, "EL GRINGO • KẺ TẤN CÔNG PHẢI LẤY MŨI TÊN", sourceId);
        takeArrow(game, sourceId);
      }
    }
  }
  finishDeaths(game, sourceId);
  return lost;
}

function indianAttack(game: GameState) {
  const damages = new Map(game.players.filter((player) => player.alive && player.arrows > 0).map((player) => [player.id, player.arrows]));
  for (const player of game.players) player.arrows = 0;
  game.arrowSupply = 9;
  note(game, "Thổ dân tấn công! Mọi mũi tên được trả về chồng.");
  damageGroup(game, damages, "indian");
}

function applyStartAbility(game: GameState) {
  const player = game.players[game.turn];
  if (player.character.id !== "sid" || !player.alive) return;
  if (player.human) {
    game.phase = "sid";
    note(game, "Sid Ketchum chọn một người chơi để hồi 1 máu.");
    return;
  }
  const ally = [...game.players]
    .filter((candidate) => candidate.alive && candidate.hp < candidate.maxHp)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? player;
  heal(game, ally.id, 1, "Sid Ketchum đầu lượt", {
    kind: "skill",
    sourceId: player.id,
    targetId: ally.id,
    label: "SID KETCHUM • HỒI 1 MÁU ĐẦU LƯỢT",
  });
}

function rollFace(rng = Math.random): Face {
  return faces[Math.floor(rng() * faces.length)];
}

function canRerollDynamite(game: GameState) {
  const player = game.players[game.turn];
  const dynamites = game.dice.filter((face) => face === "dynamite").length;
  return player.character.id === "black-jack" && dynamites < 3;
}

export function toggleHeld(game: GameState, index: number) {
  if (game.phase !== "roll" || game.rolls === 0 || !game.dice[index]) return game;
  if (game.dice[index] === "dynamite" && !canRerollDynamite(game)) return game;
  const next = clone(game);
  next.held[index] = !next.held[index];
  return next;
}

export function canRoll(game: GameState) {
  if ((game.phase !== "roll" && game.phase !== "bot") || game.rolls >= maxRolls(game)) return false;
  if (game.rolls === 0) return true;
  return game.dice.some((face, index) => !game.held[index] && (face !== "dynamite" || canRerollDynamite(game)));
}

export function rollDice(game: GameState, rng = Math.random) {
  if (!canRoll(game)) return game;
  const next = clone(game);
  const blackJack = next.players[next.turn].character.id === "black-jack";
  const usedBlackJack = blackJack && next.rolls > 0 && next.dice.some((face, index) => face === "dynamite" && !next.held[index]);
  const usedLucky = next.players[next.turn].character.id === "lucky" && next.rolls === 3;
  if (usedBlackJack) emitSkill(next, next.players[next.turn].id, "BLACK JACK • TUNG LẠI THUỐC NỔ");
  if (usedLucky) emitSkill(next, next.players[next.turn].id, "LUCKY DUKE • LẦN TUNG THỨ TƯ");
  const changed: number[] = [];
  for (let index = 0; index < 5; index++) {
    const current = next.dice[index];
    const rerollable = next.rolls === 0 || (!next.held[index] && (current !== "dynamite" || blackJack));
    if (!rerollable) continue;
    next.dice[index] = rollFace(rng);
    next.held[index] = next.dice[index] === "dynamite" && !blackJack;
    changed.push(index);
  }
  next.rolls += 1;
  note(next, `${next.players[next.turn].name} tung xúc xắc lần ${next.rolls}.`);
  for (const index of changed) {
    if (next.dice[index] === "arrow") takeArrow(next, next.players[next.turn].id);
    if (!next.players[next.turn].alive || next.winner) break;
  }
  if (!next.players[next.turn].alive) return finishTurn(next);
  if (next.winner) return next;
  const dynamites = next.dice.filter((face) => face === "dynamite").length;
  if (dynamites >= 3) {
    note(next, "Ba Thuốc nổ! Dừng tung và mất 1 máu.");
    const resolved = damageGroup(next, new Map([[next.players[next.turn].id, 1]]), "dynamite", undefined, "dynamite");
    if (!resolved) return next;
    if (!next.players[next.turn].alive) return finishTurn(next);
    return beginResolution(next);
  }
  return next;
}

export function beginResolution(game: GameState) {
  if ((game.phase !== "roll" && game.phase !== "bot") || game.rolls === 0) return game;
  const next = clone(game);
  const shots = next.dice.filter((face): face is "bull1" | "bull2" => face === "bull1" || face === "bull2");
  const beers = next.dice.filter((face) => face === "beer").length;
  const gatlings = next.dice.filter((face) => face === "gatling").length;
  next.pending = {
    shots,
    shotTargets: [],
    beers,
    beerTargets: [],
    gatlings,
    slabDoubleIndex: null,
    shotsResolved: false,
    beersResolved: false,
    kitRemaining: next.players[next.turn].character.id === "kit" ? gatlings : 0,
  };
  next.phase = shots.length ? "shot" : beers ? "beer" : next.phase;
  if (!shots.length && !beers) return resolvePending(next);
  return next;
}

export function canActivateSkill(game: GameState) {
  return game.phase === "shot"
    && game.players[game.turn].character.id === "slab"
    && !!game.pending
    && game.pending.beers > 0
    && game.pending.slabDoubleIndex === null
    && game.pending.shotTargets.length < game.pending.shots.length;
}

export function activateSkill(game: GameState) {
  if (!canActivateSkill(game)) return game;
  const next = clone(game);
  const player = next.players[next.turn];
  next.pending!.slabDoubleIndex = next.pending!.shotTargets.length;
  next.pending!.beers -= 1;
  emitSkill(next, player.id, "SLAB THE KILLER • ĐỔI 1 BIA ĐỂ NHÂN ĐÔI PHÁT BẮN NÀY", player.id);
  note(next, `${player.name} kích hoạt kỹ năng ${player.character.name}.`);
  return next;
}

export function currentPrompt(game: GameState) {
  if (game.phase === "shot" && game.pending) {
    const face = game.pending.shots[game.pending.shotTargets.length];
    return `Chọn mục tiêu cho ${faceInfo[face].label}`;
  }
  if (game.phase === "beer") return "Chọn người nhận Bia";
  if (game.phase === "kit" && game.pending) return `Kit Carlson: chọn mũi tên để bỏ (${game.pending.kitRemaining} lượt còn lại)`;
  if (game.phase === "sid") return "Sid Ketchum: chọn người hồi 1 máu";
  if (game.phase === "ability" && game.decision) {
    return game.decision.kind === "bart"
      ? `Bart Cassidy: đổi tối đa ${game.decision.max} sát thương lấy mũi tên`
      : `Pedro Ramirez: có thể bỏ tối đa ${game.decision.max} mũi tên`;
  }
  if (game.phase === "bot") return `${game.players[game.turn].name} đang tính toán…`;
  if (game.phase === "over") return game.winner ?? "Ván chơi kết thúc";
  return game.rolls ? "Giữ xúc xắc hoặc tung lại" : "Tung cả 5 xúc xắc";
}

export function selectableTargetIds(game: GameState) {
  if (game.phase === "shot" && game.pending) {
    const face = game.pending.shots[game.pending.shotTargets.length];
    return eligibleTargetIds(game, face);
  }
  if (game.phase === "beer") return alivePlayers(game).map((player) => player.id);
  if (game.phase === "sid") return alivePlayers(game).map((player) => player.id);
  if (game.phase === "kit") return game.players.filter((player) => player.alive && player.arrows > 0).map((player) => player.id);
  return [];
}

export function chooseTarget(game: GameState, targetId: string) {
  if (!selectableTargetIds(game).includes(targetId)) return game;
  const next = clone(game);
  if (next.phase === "sid") {
    const sid = next.players[next.turn];
    heal(next, targetId, 1, "Sid Ketchum đầu lượt", {
      kind: "skill",
      sourceId: sid.id,
      targetId,
      label: "SID KETCHUM • HỒI 1 MÁU ĐẦU LƯỢT",
    });
    next.phase = sid.human ? "roll" : "bot";
    return next;
  }
  if (!next.pending) return game;
  if (next.phase === "kit") {
    const target = next.players.find((player) => player.id === targetId)!;
    const kit = next.players[next.turn];
    target.arrows -= 1;
    next.arrowSupply += 1;
    next.pending.kitRemaining -= 1;
    emitSkill(next, kit.id, "KIT CARLSON • BỎ 1 MŨI TÊN", target.id);
    emitEffect(next, { kind: "arrow", sourceId: kit.id, targetId: target.id, amount: -1, label: "BỎ 1 MŨI TÊN" });
    note(next, `Kit Carlson bỏ 1 mũi tên của ${target.name}.`);
    if (next.pending.kitRemaining > 0 && selectableTargetIds(next).length) return next;
    next.pending.kitRemaining = 0;
    return resolveGatling(next);
  }
  if (next.phase === "shot") {
    const shooter = next.players[next.turn];
    const face = next.pending!.shots[next.pending!.shotTargets.length];
    const targetIndex = next.players.findIndex((player) => player.id === targetId);
    const distance = tableDistance(next, next.turn, targetIndex);
    const shortGame = alivePlayers(next).length <= 3;
    const janetRangeSwap = shooter.character.id === "janet" && ((face === "bull1" && distance === 2) || (face === "bull2" && !shortGame && distance === 1));
    const roseExtendedRange = shooter.character.id === "rose" && ((face === "bull1" && distance === 2) || (face === "bull2" && distance === 3));
    if (janetRangeSwap) emitSkill(next, shooter.id, "CALAMITY JANET • ĐỔI TẦM BẮN", targetId);
    if (roseExtendedRange) emitSkill(next, shooter.id, "ROSE DOOLAN • BẮN XA HƠN", targetId);
    next.pending!.shotTargets.push(targetId);
    if (next.pending!.shotTargets.length === next.pending!.shots.length) {
      return resolvePending(next);
    }
  } else if (next.phase === "beer") {
    next.pending!.beerTargets.push(targetId);
    if (next.pending!.beerTargets.length === next.pending!.beers) return resolvePending(next);
  }
  return next;
}

export function skipKitArrow(game: GameState) {
  if (game.phase !== "kit" || !game.pending || game.pending.kitRemaining <= 0) return game;
  const next = clone(game);
  next.pending!.kitRemaining -= 1;
  note(next, "Kit Carlson không dùng một biểu tượng Gatling để bỏ mũi tên.");
  if (next.pending!.kitRemaining > 0 && selectableTargetIds(next).length) return next;
  next.pending!.kitRemaining = 0;
  return resolveGatling(next);
}

function resolvePending(game: GameState, choice?: { kind: "bart" | "pedro"; count: number }) {
  if (!game.pending) return game;
  const next = clone(game);
  const shooter = next.players[next.turn];
  if (!next.pending.shotsResolved) {
    const shots = new Map<string, number>();
    next.pending.shotTargets.forEach((target, index) => {
      const damage = next.pending!.slabDoubleIndex === index ? 2 : 1;
      shots.set(target, (shots.get(target) ?? 0) + damage);
    });
    const shotDamage = damageGroup(next, shots, "shoot", shooter.id, "shots", choice);
    if (!shotDamage) return next;
    const remainingDamage = new Map(shotDamage);
    next.pending.shotTargets.forEach((targetId, index) => {
      const requested = next.pending!.slabDoubleIndex === index ? 2 : 1;
      const actual = Math.min(requested, remainingDamage.get(targetId) ?? 0);
      remainingDamage.set(targetId, (remainingDamage.get(targetId) ?? 0) - actual);
      emitEffect(next, { kind: "shot", sourceId: shooter.id, targetId, amount: actual ? -actual : 0 });
    });
    if (next.winner || !shooter.alive) return finishTurn(next);

    next.pending.shotsResolved = true;
  }

  if (!next.pending.beersResolved) {
    if (next.pending.beerTargets.length < next.pending.beers) {
      next.phase = "beer";
      return next;
    }

    const jesseBoosted = shooter.character.id === "jesse" && shooter.hp <= 4;
    for (const id of next.pending.beerTargets) {
      const amount = id === shooter.id && jesseBoosted ? 2 : 1;
      if (amount === 2) emitSkill(next, shooter.id, "JESSE JONES • MỖI BIA HỒI 2 MÁU", id);
      heal(next, id, amount, "Bia", { kind: "beer", sourceId: shooter.id, targetId: id });
    }
    next.pending.beersResolved = true;
  }

  if (shooter.character.id === "kit" && next.pending.kitRemaining > 0 && next.players.some((player) => player.alive && player.arrows > 0)) {
    next.phase = "kit";
    return next;
  }
  next.pending.kitRemaining = 0;
  return resolveGatling(next);
}

function resolveGatling(game: GameState, choice?: { kind: "bart" | "pedro"; count: number }) {
  if (!game.pending) return game;
  const next = clone(game);
  const shooter = next.players[next.turn];
  const threshold = shooter.character.id === "willy" ? 2 : 3;
  if (next.pending.gatlings >= threshold) {
    if (shooter.character.id === "willy" && next.pending.gatlings === 2) {
      emitSkill(next, shooter.id, "WILLY THE KID • GATLING CHỈ CẦN 2 BIỂU TƯỢNG", shooter.id);
    }
    note(next, `${shooter.name} kích hoạt Gatling!`);
    const targets = new Map(next.players.filter((player) => player.alive && player.id !== shooter.id).map((player) => [player.id, 1]));
    const resolved = damageGroup(next, targets, "gatling", shooter.id, "gatling", choice);
    if (!resolved) return next;
    next.arrowSupply += shooter.arrows;
    shooter.arrows = 0;
  }
  if (!next.winner && shooter.alive && shooter.character.id === "suzy" && next.pending.shots.length === 0) {
    heal(next, shooter.id, 2, "Suzy Lafayette", {
      kind: "skill",
      sourceId: shooter.id,
      targetId: shooter.id,
      label: "SUZY LAFAYETTE • KHÔNG BẮN, HỒI 2 MÁU",
    });
  }
  return finishTurn(next);
}

export function chooseAbility(game: GameState, count: number) {
  if (game.phase !== "ability" || !game.decision) return game;
  const next = clone(game);
  const decision = next.decision!;
  const choice = { kind: decision.kind, count: Math.max(0, Math.min(decision.max, count)) };
  next.decision = null;
  if (decision.resume === "shots") return resolvePending(next, choice);
  if (decision.resume === "gatling") return resolveGatling(next, choice);

  next.phase = next.players[next.turn].human ? "roll" : "bot";
  const resolved = damageGroup(next, new Map(decision.damages), decision.cause, decision.sourceId, "dynamite", choice);
  if (!resolved) return next;
  if (!next.players[next.turn].alive) return finishTurn(next);
  return beginResolution(next);
}

function finishTurn(game: GameState) {
  const next = clone(game);
  next.pending = null;
  next.decision = null;
  if (next.winner) {
    next.phase = "over";
    return next;
  }
  let turn = next.turn;
  do turn = (turn + 1) % next.players.length; while (!next.players[turn].alive);
  if (turn <= next.turn) next.round += 1;
  next.turn = turn;
  next.dice = Array(5).fill(null);
  next.held = Array(5).fill(false);
  next.rolls = 0;
  next.phase = next.players[turn].human ? "roll" : "bot";
  note(next, `Đến lượt ${next.players[turn].name} — ${next.players[turn].character.name}.`);
  applyStartAbility(next);
  return next;
}

function rolesAreAllies(a: Role, b: Role) {
  if (a === "Renegade" || b === "Renegade") return false;
  const law = (role: Role) => role === "Sheriff" || role === "Deputy";
  return law(a) === law(b);
}

function botShotTarget(game: GameState, face: "bull1" | "bull2") {
  const shooter = game.players[game.turn];
  const candidates = eligibleTargetIds(game, face).map((id) => game.players.find((player) => player.id === id)!);
  const enemies = candidates.filter((player) => !rolesAreAllies(shooter.role, player.role));
  return [...(enemies.length ? enemies : candidates)].sort((a, b) => a.hp - b.hp)[0]?.id;
}

function botBeerTarget(game: GameState) {
  const current = game.players[game.turn];
  const allies = game.players.filter((player) => player.alive && (player.id === current.id || rolesAreAllies(current.role, player.role)) && player.hp < player.maxHp);
  return [...allies].sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]?.id ?? current.id;
}

function chooseBotHolds(game: GameState) {
  const next = clone(game);
  const player = next.players[next.turn];
  const allyNeedsBeer = next.players.some((candidate) => candidate.alive && rolesAreAllies(player.role, candidate.role) && candidate.hp < candidate.maxHp);
  next.held = next.dice.map((face) => {
    if (face === "dynamite") return !canRerollDynamite(next);
    if (face === "arrow") return false;
    if (face === "beer") return allyNeedsBeer;
    return true;
  });
  return next;
}

export function playBotTurn(game: GameState, rng = Math.random) {
  if (game.phase !== "bot" || game.players[game.turn].human) return game;
  let next = game;
  while (canRoll(next)) {
    next = rollDice(next, rng);
    if (next.winner || next.phase !== "bot") break;
    if (next.rolls >= maxRolls(next)) break;
    next = chooseBotHolds(next);
    if (!canRoll(next)) break;
  }
  if (next.phase === "bot") next = beginResolution(next);
  while (next.phase === "shot" || next.phase === "beer" || next.phase === "kit") {
    if (next.phase === "shot" && canActivateSkill(next)) next = activateSkill(next);
    const target = next.phase === "shot"
      ? botShotTarget(next, next.pending!.shots[next.pending!.shotTargets.length])
      : next.phase === "beer"
        ? botBeerTarget(next)
        : [...next.players].filter((player) => player.alive && player.arrows > 0).sort((a, b) => b.arrows - a.arrows)[0]?.id;
    if (!target) {
      if (next.phase === "kit") next = skipKitArrow(next);
      else break;
      continue;
    }
    next = chooseTarget(next, target);
  }
  return next;
}
