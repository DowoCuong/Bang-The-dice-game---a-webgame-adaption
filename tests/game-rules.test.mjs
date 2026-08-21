import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  activateSkill,
  beginResolution,
  canActivateSkill,
  characters,
  chooseAbility,
  chooseTarget,
  eligibleTargetIds,
  newGame,
  newMultiplayerGame,
  playBotTurn,
  resolveChoices,
  rollDice,
  selectableTargetIds,
  skipKitArrow,
  skipSkill,
  tableDistance,
} from "../app/game.ts";
import { applyRoomAction, publicGameFor, roomActorId } from "../app/room.ts";

const middle = () => 0.5;

test("rejects unknown multiplayer actions without corrupting room state", () => {
  const game = newMultiplayerGame(["An", "Bình", "Chi"]);
  assert.throws(() => applyRoomAction(game, { type: "unknown" }), /Hành động không hợp lệ/);
});

test("hibernates rooms and expires them after five idle minutes", () => {
  const server = readFileSync(new URL("../party/index.ts", import.meta.url), "utf8");
  assert.match(server, /static options = \{ hibernate: true \}/);
  assert.match(server, /const ROOM_IDLE_MS = 5 \* 60 \* 1000/);
  assert.match(server, /setAlarm\(Date\.now\(\) \+ ROOM_IDLE_MS\)/);
  assert.match(server, /async onAlarm\(\)[\s\S]*storage\.delete\(STATE_KEY\)/);
});

test("creates the official player and role counts", () => {
  for (let count = 3; count <= 8; count++) {
    const game = newGame(count, middle);
    assert.equal(game.players.length, count);
    assert.equal(game.players.filter((player) => player.role === "Sheriff").length, count === 3 ? 0 : 1);
    assert.equal(game.players.filter((player) => player.human).length, 1);
  }
});

test("creates a human-only multiplayer game with player names", () => {
  const names = ["An", "Bình", "Chi", "Dũng"];
  const game = newMultiplayerGame(names, middle);
  assert.deepEqual(game.players.map((player) => player.name), names);
  assert.equal(game.players.every((player) => player.human), true);
  assert.notEqual(game.phase, "bot");
});

test("keeps hidden roles private and assigns decisions to their owner", () => {
  const game = newMultiplayerGame(["An", "Bình", "Chi", "Dũng"], middle);
  game.players[1].role = "Outlaw";
  game.players[1].revealed = false;
  const publicGame = publicGameFor(game, "p0");
  assert.equal(publicGame.players[1].role, "Renegade");
  assert.equal(game.players[1].role, "Outlaw");

  game.decision = {
    kind: "pedro",
    playerId: "p2",
    max: 1,
    damages: [["p2", 1]],
    cause: "gatling",
    resume: "gatling",
    choices: [],
  };
  assert.equal(roomActorId(game), "p2");
});

test("asks each multiplayer defender before resolving a shared hit", () => {
  const game = newMultiplayerGame(["An", "Bình", "Chi", "Dũng"], middle);
  game.turn = 0;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === "lucky");
  game.players[1].character = characters.find((character) => character.id === "bart");
  game.players[2].character = characters.find((character) => character.id === "pedro");
  game.players[2].arrows = 2;
  game.arrowSupply = 7;
  game.rolls = 1;
  game.dice = ["gatling", "gatling", "gatling", "dynamite", "dynamite"];

  const bartChoice = beginResolution(game);
  assert.equal(bartChoice.decision.playerId, "p1");
  const pedroChoice = chooseAbility(bartChoice, 0);
  assert.equal(pedroChoice.decision.playerId, "p2");
  const resolved = chooseAbility(pedroChoice, 1);
  assert.equal(resolved.players[1].hp, game.players[1].hp - 1);
  assert.equal(resolved.players[2].arrows, 1);
});

test("resolves arrows immediately after a roll", () => {
  const game = newGame(5, middle);
  game.turn = 0;
  game.phase = "roll";
  const rolled = rollDice(game, () => 0);
  assert.equal(rolled.players[0].arrows, 5);
  assert.equal(rolled.arrowSupply, 4);
});

test("distance ignores eliminated players and range targets are legal", () => {
  const game = newGame(5, middle);
  game.turn = 0;
  game.phase = "roll";
  assert.equal(tableDistance(game, 0, 1), 1);
  game.players[1].alive = false;
  assert.equal(tableDistance(game, 0, 2), 1);
  assert.ok(eligibleTargetIds(game, "bull1").includes(game.players[2].id));
});

test("a new round begins only when play returns to the previous round starter", () => {
  let game = newGame(5, middle);
  game.roundStarterId = "p2";
  game.turn = 4;
  game.phase = "roll";
  game.rolls = 1;
  game.dice = ["dynamite", "dynamite", "arrow", "arrow", "arrow"];

  game = beginResolution(game);
  assert.equal(game.turn, 0);
  assert.equal(game.round, 1);
  while (game.turn !== 2) {
    game.phase = "roll";
    game.rolls = 1;
    game.dice = ["dynamite", "dynamite", "arrow", "arrow", "arrow"];
    game = beginResolution(game);
  }
  assert.equal(game.round, 2);
});

test("a bot completes its turn and passes play", () => {
  const game = newGame(4, middle);
  game.turn = 1;
  game.phase = "bot";
  const choices = playBotTurn(game, () => 0.75);
  assert.equal(choices.phase, "resolving");
  const next = resolveChoices(choices);
  assert.notEqual(next.turn, 1);
  assert.equal(next.rolls, 0);
  assert.equal(next.lastTurnResult.playerId, "p1");
  assert.equal(next.lastTurnResult.dice.length, 5);
});

test("Slab the Killer chooses exactly which shot to double", () => {
  const game = newGame(5, middle);
  game.turn = 0;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === "slab");
  game.rolls = 1;
  game.dice = ["bull1", "bull2", "beer", "dynamite", "dynamite"];

  const firstShot = beginResolution(game);
  assert.equal(canActivateSkill(firstShot), true);
  const firstTarget = eligibleTargetIds(firstShot, "bull1")[0];
  const secondShot = chooseTarget(firstShot, firstTarget);
  const armed = activateSkill(secondShot);
  assert.equal(armed.pending.slabDoubleIndex, 1);
  assert.equal(armed.pending.beers, 0);

  const secondTarget = eligibleTargetIds(armed, "bull2")[0];
  const resolved = chooseTarget(armed, secondTarget);
  const shotEffects = resolved.effects.filter((effect) => effect.kind === "shot");
  assert.equal(shotEffects.find((effect) => effect.targetId === firstTarget).amount, -1);
  assert.equal(shotEffects.find((effect) => effect.targetId === secondTarget).amount, -2);
});

test("Slab the Killer may explicitly decline a shot and decide again on the next one", () => {
  const game = newGame(5, middle);
  game.turn = 0;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === "slab");
  game.rolls = 1;
  game.dice = ["bull1", "bull2", "beer", "dynamite", "dynamite"];

  const firstShot = beginResolution(game);
  const skipped = skipSkill(firstShot);
  assert.equal(canActivateSkill(skipped), false);
  const secondShot = chooseTarget(skipped, eligibleTargetIds(skipped, "bull1")[0]);
  assert.equal(canActivateSkill(secondShot), true);
});

test("Kit Carlson chooses or skips each Gatling arrow removal", () => {
  const game = newGame(4, middle);
  game.turn = 0;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === "kit");
  game.players[1].arrows = 1;
  game.players[2].arrows = 1;
  game.arrowSupply = 7;
  game.rolls = 1;
  game.dice = ["gatling", "gatling", "dynamite", "dynamite", "dynamite"];

  const choosing = beginResolution(game);
  assert.equal(choosing.phase, "kit");
  assert.equal(choosing.pending.kitRemaining, 2);
  const usedOne = chooseTarget(choosing, "p1");
  assert.equal(usedOne.players[1].arrows, 0);
  assert.equal(usedOne.players[2].arrows, 1);
  assert.equal(usedOne.pending.kitRemaining, 1);
  const skippedOne = skipKitArrow(usedOne);
  assert.equal(skippedOne.players[2].arrows, 1);
  assert.ok(skippedOne.effects.some((effect) => effect.kind === "skill" && effect.label.includes("KIT CARLSON")));
});

test("bot-owned Kit Carlson decisions never wait for the human player", () => {
  const game = newGame(4, middle);
  game.turn = 1;
  game.phase = "bot";
  game.players[1].character = characters.find((character) => character.id === "kit");
  game.players[0].arrows = 2;
  game.arrowSupply = 7;
  game.rolls = 1;
  game.dice = ["gatling", "gatling", "dynamite", "dynamite", "dynamite"];

  const kitChoice = beginResolution(game);
  assert.equal(kitChoice.phase, "kit");
  const completed = playBotTurn(kitChoice, middle);
  assert.notEqual(completed.phase, "kit");
  assert.equal(completed.players[0].arrows, 2);
  assert.ok(completed.log.some((entry) => entry.includes("không dùng")));
});

test("a bot may decline Slab the Killer instead of forcing activation", () => {
  const game = newGame(5, middle);
  game.turn = 1;
  game.phase = "bot";
  game.players[1].character = characters.find((character) => character.id === "slab");
  game.players[1].hp -= 1;
  game.players[0].hp = game.players[0].maxHp;
  game.rolls = 1;
  game.dice = ["bull1", "beer", "dynamite", "dynamite", "dynamite"];

  const choosing = beginResolution(game);
  const completed = playBotTurn(choosing, middle);
  assert.equal(completed.pending.slabDoubleIndex, null);
  assert.equal(completed.pending.beers, 1);
  assert.ok(completed.log.some((entry) => entry.includes("không kích hoạt")));
});

function incomingShot(characterId, arrows = 0) {
  const game = newGame(4, middle);
  game.turn = 1;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === characterId);
  game.players[0].arrows = arrows;
  game.arrowSupply = 9 - arrows;
  game.players[1].character = characters.find((character) => character.id === "lucky");
  game.rolls = 1;
  game.dice = ["bull1", "dynamite", "dynamite", "gatling", "gatling"];
  return chooseTarget(beginResolution(game), "p0");
}

test("Bart Cassidy and Pedro Ramirez keep their optional choices", () => {
  const bartChoice = incomingShot("bart");
  assert.equal(bartChoice.phase, "ability");
  assert.equal(bartChoice.decision.kind, "bart");
  const bartUsesArrow = chooseAbility(bartChoice, 1);
  assert.equal(bartUsesArrow.players[0].arrows, 1);
  assert.equal(bartUsesArrow.players[0].hp, bartUsesArrow.players[0].maxHp);

  const bartDeclines = chooseAbility(incomingShot("bart"), 0);
  assert.equal(bartDeclines.players[0].arrows, 0);
  assert.equal(bartDeclines.players[0].hp, bartDeclines.players[0].maxHp - 1);

  const pedroChoice = incomingShot("pedro", 2);
  assert.equal(pedroChoice.phase, "ability");
  assert.equal(pedroChoice.decision.kind, "pedro");
  const pedroUsesSkill = chooseAbility(pedroChoice, 1);
  assert.equal(pedroUsesSkill.players[0].hp, pedroUsesSkill.players[0].maxHp - 1);
  assert.equal(pedroUsesSkill.players[0].arrows, 1);
});

test("Pedro Ramirez may discard an arrow after Dynamite before the turn continues", () => {
  const game = newGame(4, middle);
  game.turn = 0;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === "pedro");
  game.players[0].arrows = 1;
  game.arrowSupply = 8;
  const decision = rollDice(game, () => 0.2);
  assert.equal(decision.phase, "ability");
  assert.equal(decision.decision.kind, "pedro");
  const resolved = chooseAbility(decision, 1);
  assert.equal(resolved.players[0].hp, resolved.players[0].maxHp - 1);
  assert.equal(resolved.players[0].arrows, 0);
  assert.notEqual(resolved.turn, 0);
});

test("Sid Ketchum chooses the healed player at the start of the turn", () => {
  const game = newGame(4, middle);
  game.turn = 3;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === "sid");
  game.players[0].hp -= 1;
  game.rolls = 1;
  game.dice = ["dynamite", "dynamite", null, null, null];
  const sidChoice = beginResolution(game);
  assert.equal(sidChoice.turn, 0);
  assert.equal(sidChoice.phase, "sid");
  const healed = chooseTarget(sidChoice, "p0");
  assert.equal(healed.players[0].hp, healed.players[0].maxHp);
  assert.equal(healed.phase, "roll");
});

test("Jesse Jones evaluates all self-targeted beers from the same starting HP", () => {
  const game = newGame(4, middle);
  game.turn = 0;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === "jesse");
  game.players[0].hp = 4;
  game.rolls = 1;
  game.dice = ["beer", "beer", "dynamite", "dynamite", "gatling"];
  const firstBeer = chooseTarget(beginResolution(game), "p0");
  const resolved = chooseTarget(firstBeer, "p0");
  assert.equal(resolved.players[0].hp, 8);
  assert.equal(resolved.effects.filter((effect) => effect.kind === "beer" && effect.amount === 2).length, 2);
});

test("Bull's Eyes resolve before Beer targets are chosen", () => {
  const game = newGame(4, middle);
  game.turn = 0;
  game.phase = "roll";
  game.players[0].role = "Sheriff";
  game.players[1].role = "Deputy";
  game.players[2].role = "Outlaw";
  game.players[3].role = "Renegade";
  game.players[1].hp = 1;
  game.rolls = 1;
  game.dice = ["bull1", "beer", "dynamite", "dynamite", "gatling"];
  const afterShot = chooseTarget(beginResolution(game), "p1");
  assert.equal(afterShot.players[1].alive, false);
  assert.equal(afterShot.phase, "beer");
  assert.equal(selectableTargetIds(afterShot).includes("p1"), false);
});

test("shots, beer and Gatling emit source-to-target animation events", () => {
  const shotGame = newGame(4, middle);
  shotGame.turn = 0;
  shotGame.phase = "roll";
  shotGame.players[0].character = characters.find((character) => character.id === "lucky");
  shotGame.rolls = 1;
  shotGame.dice = ["bull1", "bull1", "dynamite", "gatling", "gatling"];
  const aiming = beginResolution(shotGame);
  const target = eligibleTargetIds(aiming, "bull1")[0];
  const firstAim = chooseTarget(aiming, target);
  assert.ok(firstAim.effects.some((effect) => effect.kind === "target" && effect.sourceId === "p0" && effect.targetId === target && effect.label === "bull1"));
  const lockedShots = chooseTarget(firstAim, target, true);
  assert.equal(lockedShots.phase, "resolving");
  assert.equal(lockedShots.players.find((player) => player.id === target).hp, aiming.players.find((player) => player.id === target).hp);
  const shot = resolveChoices(lockedShots);
  const shotEffects = shot.effects.filter((effect) => effect.kind === "shot" && effect.sourceId === "p0" && effect.targetId === target);
  assert.equal(shotEffects.length, 2);
  assert.ok(shotEffects.every((effect) => effect.amount === -1));
  assert.deepEqual(shotEffects.map((effect) => effect.targetEffectId), lockedShots.pending.shotTargetEffectIds);

  const beerGame = newGame(4, middle);
  beerGame.turn = 0;
  beerGame.phase = "roll";
  beerGame.players[0].hp -= 1;
  beerGame.rolls = 1;
  beerGame.dice = ["beer", "dynamite", "dynamite", "gatling", "gatling"];
  const drinking = beginResolution(beerGame);
  const lockedBeer = chooseTarget(drinking, "p0", true);
  assert.equal(lockedBeer.phase, "resolving");
  assert.equal(lockedBeer.players[0].hp, drinking.players[0].hp);
  const beer = resolveChoices(lockedBeer);
  assert.ok(beer.effects.some((effect) => effect.kind === "target" && effect.sourceId === "p0" && effect.targetId === "p0" && effect.label === "beer"));
  assert.ok(beer.effects.some((effect) => effect.kind === "beer" && effect.sourceId === "p0" && effect.targetId === "p0" && effect.amount === 1 && effect.targetEffectId === lockedBeer.pending.beerTargetEffectIds[0]));

  const gatlingGame = newGame(4, middle);
  gatlingGame.turn = 0;
  gatlingGame.phase = "roll";
  gatlingGame.players.forEach((player) => { player.character = characters.find((character) => character.id === "lucky"); });
  gatlingGame.rolls = 1;
  gatlingGame.dice = ["gatling", "gatling", "gatling", "dynamite", "dynamite"];
  const gatling = beginResolution(gatlingGame);
  assert.equal(gatling.effects.filter((effect) => effect.kind === "gatling").length, 3);
});

test("table notifications remain visible for about three seconds", () => {
  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /if \(effect\.kind === "target"\) return/);
  assert.match(page, /actionQueueEnd\.current = actionStartsAt \+ 900/);
  assert.match(page, /item\.id !== effect\.targetEffectId/);
  assert.match(page, /performAction\(\{ type: "settle" \}, \(state\) => resolveChoices\(state\)\)/);
  assert.match(styles, /\.target-cue\.target-beer \{ color: #43e879; \}/);
  assert.match(styles, /\.target-cue\.target-gatling \{ color: #42bfff; \}/);
  assert.match(styles, /\.target-cue-beam \{ opacity: \.34; \}/);
  assert.match(page, /const selfBeer = effect\.label === "beer" && effect\.sourceId === effect\.targetId/);
  assert.match(page, /!!effect\.sourceId && !selfBeer/);
  assert.match(styles, /animation: effect-impact 3s/);
  assert.match(styles, /animation: skill-announcement 3s/);
  assert.match(page, /skillQueueEnd\.current = startsAt \+ 3100/);
});

test("round and player-turn announcements are separated and last two seconds", () => {
  const game = newGame(4, middle);
  game.turn = 0;
  game.phase = "roll";
  game.rolls = 1;
  game.dice = ["dynamite", "dynamite", "arrow", "arrow", "arrow"];
  const next = beginResolution(game);
  assert.equal(next.turnNumber, 2);
  assert.equal(next.lastTurnResult.playerId, "p0");
  assert.deepEqual(next.lastTurnResult.dice, game.dice);

  const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
  const styles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(page, /VÒNG \{game\.round\}/);
  assert.match(page, /<small>TỚI LƯỢT<\/small>/);
  assert.match(page, /<strong>\{current\.name\.toUpperCase\(\)\}<\/strong>/);
  assert.doesNotMatch(page, /LƯỢT \{game\.turnNumber\}/);
  assert.match(styles, /animation: turn-intro 2s/);
  assert.match(styles, /animation: player-turn-notice 2s/);
  assert.match(styles, /animation: winner-announcement 3s/);
  assert.match(page, /effectQueueEnd\.current - now \+ 100/);
  assert.match(page, /KẾT QUẢ • \{resultPlayer\.name\.toUpperCase\(\)\}/);
  assert.match(page, /isLocalPlayer \? "human-player"/);
  assert.match(styles, /\.seat\.human-player::after/);
  assert.match(styles, /\.effect-impact-row[\s\S]*display: flex/);
  assert.match(styles, /\.role-photo\.outlaw \{ background-position: 100% 0; \}/);
  assert.match(styles, /\.role-photo\.renegade \{ background-position: 0 100%; \}/);
  assert.match(styles, /width: 76px;\s+height: 108px;/);
  assert.match(styles, /\.transition-lock \{[^}]*pointer-events: none/);
});
