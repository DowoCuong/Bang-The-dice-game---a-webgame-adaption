export type Role = "Sheriff" | "Deputy" | "Outlaw" | "Renegade";
export type Face = "arrow" | "dynamite" | "bull1" | "bull2" | "beer" | "gatling";
export type Phase = "roll" | "bot" | "shot" | "beer" | "over";

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
  slabDouble: boolean;
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

function heal(game: GameState, id: string, amount: number, reason: string) {
  const player = game.players.find((candidate) => candidate.id === id);
  if (!player?.alive) return;
  const gained = Math.min(amount, player.maxHp - player.hp);
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
    if (player.alive && player.character.id === "vulture") heal(game, player.id, deaths * 2, "Vulture Sam");
  }
  checkWinner(game, eliminated, killerId);
}

function takeArrow(game: GameState, playerId: string) {
  const player = game.players.find((candidate) => candidate.id === playerId);
  if (!player?.alive || game.arrowSupply <= 0) return;
  player.arrows += 1;
  game.arrowSupply -= 1;
  note(game, `${player.name} lấy 1 mũi tên.`);
  if (game.arrowSupply === 0) indianAttack(game);
}

function damageGroup(game: GameState, damages: Map<string, number>, cause: "shoot" | "gatling" | "indian" | "dynamite", sourceId?: string) {
  const lost = new Map<string, number>();
  for (const [id, requested] of damages) {
    const player = game.players.find((candidate) => candidate.id === id);
    if (!player?.alive || requested <= 0) continue;
    if (cause === "gatling" && player.character.id === "paul") {
      note(game, `${player.name} miễn nhiễm Gatling.`);
      continue;
    }
    let amount = cause === "indian" && player.character.id === "jourdonnais" ? Math.min(1, requested) : requested;
    let replaced = 0;
    if ((cause === "shoot" || cause === "gatling") && player.character.id === "bart") {
      while (amount > 0 && game.arrowSupply > 1) {
        player.arrows += 1;
        game.arrowSupply -= 1;
        amount -= 1;
        replaced += 1;
      }
      if (replaced) note(game, `${player.name} đổi ${replaced} sát thương lấy mũi tên.`);
    }
    const actual = Math.min(player.hp, amount);
    player.hp -= actual;
    lost.set(id, actual);
    if (actual) note(game, `${player.name} mất ${actual} máu (${cause}).`);
    if (actual && player.character.id === "pedro") {
      const removed = Math.min(actual, player.arrows);
      player.arrows -= removed;
      game.arrowSupply += removed;
      if (removed) note(game, `${player.name} bỏ ${removed} mũi tên nhờ kỹ năng.`);
    }
  }
  if ((cause === "shoot" || cause === "gatling") && sourceId) {
    for (const [id, amount] of lost) {
      const target = game.players.find((player) => player.id === id);
      if (amount > 0 && target?.character.id === "el-gringo") takeArrow(game, sourceId);
    }
  }
  finishDeaths(game, sourceId);
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
  const ally = [...game.players]
    .filter((candidate) => candidate.alive && candidate.hp < candidate.maxHp)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? player;
  heal(game, ally.id, 1, "Sid Ketchum đầu lượt");
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
  const dynamites = next.dice.filter((face) => face === "dynamite").length;
  if (dynamites >= 3) {
    note(next, "Ba Thuốc nổ! Dừng tung và mất 1 máu.");
    damageGroup(next, new Map([[next.players[next.turn].id, 1]]), "dynamite");
    if (!next.players[next.turn].alive) return finishTurn(next);
    return beginResolution(next);
  }
  return next;
}

export function beginResolution(game: GameState) {
  if ((game.phase !== "roll" && game.phase !== "bot") || game.rolls === 0) return game;
  const next = clone(game);
  const shots = next.dice.filter((face): face is "bull1" | "bull2" => face === "bull1" || face === "bull2");
  let beers = next.dice.filter((face) => face === "beer").length;
  const slabDouble = next.players[next.turn].character.id === "slab" && beers > 0 && shots.length > 0;
  if (slabDouble) beers -= 1;
  next.pending = {
    shots,
    shotTargets: [],
    beers,
    beerTargets: [],
    gatlings: next.dice.filter((face) => face === "gatling").length,
    slabDouble,
  };
  next.phase = shots.length ? "shot" : beers ? "beer" : next.phase;
  if (!shots.length && !beers) return resolvePending(next);
  return next;
}

export function currentPrompt(game: GameState) {
  if (game.phase === "shot" && game.pending) {
    const face = game.pending.shots[game.pending.shotTargets.length];
    return `Chọn mục tiêu cho ${faceInfo[face].label}`;
  }
  if (game.phase === "beer") return "Chọn người nhận Bia";
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
  return [];
}

export function chooseTarget(game: GameState, targetId: string) {
  if (!game.pending || !selectableTargetIds(game).includes(targetId)) return game;
  const next = clone(game);
  if (next.phase === "shot") {
    next.pending!.shotTargets.push(targetId);
    if (next.pending!.shotTargets.length === next.pending!.shots.length) {
      next.phase = next.pending!.beers ? "beer" : next.phase;
      if (!next.pending!.beers) return resolvePending(next);
    }
  } else if (next.phase === "beer") {
    next.pending!.beerTargets.push(targetId);
    if (next.pending!.beerTargets.length === next.pending!.beers) return resolvePending(next);
  }
  return next;
}

function discardKitArrows(game: GameState, count: number) {
  for (let i = 0; i < count; i++) {
    const target = [...game.players].filter((player) => player.alive && player.arrows > 0).sort((a, b) => b.arrows - a.arrows)[0];
    if (!target) return;
    target.arrows -= 1;
    game.arrowSupply += 1;
    note(game, `Kit Carlson bỏ 1 mũi tên của ${target.name}.`);
  }
}

function resolvePending(game: GameState) {
  if (!game.pending) return game;
  const next = clone(game);
  const shooter = next.players[next.turn];
  const shots = new Map<string, number>();
  next.pending!.shotTargets.forEach((target, index) => {
    const damage = next.pending!.slabDouble && index === 0 ? 2 : 1;
    shots.set(target, (shots.get(target) ?? 0) + damage);
  });
  if (next.pending.slabDouble) note(next, "Slab the Killer đổi 1 Bia để tăng phát bắn lên 2 sát thương.");
  damageGroup(next, shots, "shoot", shooter.id);
  if (next.winner || !shooter.alive) return finishTurn(next);

  for (const id of next.pending.beerTargets) {
    const target = next.players.find((player) => player.id === id);
    const amount = target?.id === shooter.id && shooter.character.id === "jesse" && shooter.hp <= 4 ? 2 : 1;
    heal(next, id, amount, "Bia");
  }

  const threshold = shooter.character.id === "willy" ? 2 : 3;
  if (shooter.character.id === "kit") discardKitArrows(next, next.pending.gatlings);
  if (next.pending.gatlings >= threshold) {
    note(next, `${shooter.name} kích hoạt Gatling!`);
    const targets = new Map(next.players.filter((player) => player.alive && player.id !== shooter.id).map((player) => [player.id, 1]));
    damageGroup(next, targets, "gatling", shooter.id);
    next.arrowSupply += shooter.arrows;
    shooter.arrows = 0;
  }
  if (!next.winner && shooter.alive && shooter.character.id === "suzy" && next.pending.shots.length === 0) {
    heal(next, shooter.id, 2, "Suzy Lafayette");
  }
  return finishTurn(next);
}

function finishTurn(game: GameState) {
  const next = clone(game);
  next.pending = null;
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
  while (next.phase === "shot" || next.phase === "beer") {
    const target = next.phase === "shot"
      ? botShotTarget(next, next.pending!.shots[next.pending!.shotTargets.length])
      : botBeerTarget(next);
    if (!target) break;
    next = chooseTarget(next, target);
  }
  return next;
}
