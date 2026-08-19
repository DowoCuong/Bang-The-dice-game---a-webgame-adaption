import assert from "node:assert/strict";
import test from "node:test";
import { eligibleTargetIds, newGame, playBotTurn, rollDice, tableDistance } from "../app/game.ts";

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
