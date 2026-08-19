import assert from "node:assert/strict";
import test from "node:test";
import {
  activateSkill,
  beginResolution,
  canActivateSkill,
  characters,
  chooseTarget,
  eligibleTargetIds,
  newGame,
  playBotTurn,
  rollDice,
  tableDistance,
} from "../app/game.ts";

const middle = () => 0.5;

test("creates the official player and role counts", () => {
  for (let count = 3; count <= 8; count++) {
    const game = newGame(count, middle);
    assert.equal(game.players.length, count);
    assert.equal(game.players.filter((player) => player.role === "Sheriff").length, count === 3 ? 0 : 1);
    assert.equal(game.players.filter((player) => player.human).length, 1);
  }
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

test("a bot completes its turn and passes play", () => {
  const game = newGame(4, middle);
  game.turn = 1;
  game.phase = "bot";
  const next = playBotTurn(game, () => 0.75);
  assert.notEqual(next.turn, 1);
  assert.equal(next.rolls, 0);
});

test("Slab the Killer only doubles a shot after explicit activation", () => {
  const game = newGame(4, middle);
  game.turn = 0;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === "slab");
  game.rolls = 1;
  game.dice = ["beer", "bull1", "gatling", "gatling", "arrow"];

  assert.equal(canActivateSkill(game), true);
  const armed = activateSkill(game);
  assert.equal(armed.skillArmed, true);
  assert.ok(armed.effects.some((effect) => effect.kind === "skill" && effect.label.includes("SLAB")));

  const resolving = beginResolution(armed);
  assert.equal(resolving.pending.slabDouble, true);
  assert.equal(resolving.pending.beers, 0);
});

test("Kit Carlson activation removes arrows and emits a table-wide skill event", () => {
  const game = newGame(4, middle);
  game.turn = 0;
  game.phase = "roll";
  game.players[0].character = characters.find((character) => character.id === "kit");
  game.players[1].arrows = 1;
  game.arrowSupply = 8;
  game.rolls = 1;
  game.dice = ["gatling", "dynamite", "dynamite", "dynamite", "dynamite"];

  const armed = activateSkill(game);
  const resolving = beginResolution(armed);
  assert.equal(resolving.players[1].arrows, 0);
  assert.ok(resolving.effects.some((effect) => effect.kind === "skill" && effect.label.includes("KIT CARLSON")));
  assert.ok(resolving.effects.some((effect) => effect.kind === "arrow" && effect.amount === -1));
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
  const shot = chooseTarget(chooseTarget(aiming, target), target);
  const shotEffects = shot.effects.filter((effect) => effect.kind === "shot" && effect.sourceId === "p0" && effect.targetId === target);
  assert.equal(shotEffects.length, 2);
  assert.ok(shotEffects.every((effect) => effect.amount === -1));

  const beerGame = newGame(4, middle);
  beerGame.turn = 0;
  beerGame.phase = "roll";
  beerGame.players[0].hp -= 1;
  beerGame.rolls = 1;
  beerGame.dice = ["beer", "dynamite", "dynamite", "gatling", "gatling"];
  const drinking = beginResolution(beerGame);
  const beer = chooseTarget(drinking, "p0");
  assert.ok(beer.effects.some((effect) => effect.kind === "beer" && effect.sourceId === "p0" && effect.targetId === "p0" && effect.amount === 1));

  const gatlingGame = newGame(4, middle);
  gatlingGame.turn = 0;
  gatlingGame.phase = "roll";
  gatlingGame.players.forEach((player) => { player.character = characters.find((character) => character.id === "lucky"); });
  gatlingGame.rolls = 1;
  gatlingGame.dice = ["gatling", "gatling", "gatling", "dynamite", "dynamite"];
  const gatling = beginResolution(gatlingGame);
  assert.equal(gatling.effects.filter((effect) => effect.kind === "gatling").length, 3);
});
