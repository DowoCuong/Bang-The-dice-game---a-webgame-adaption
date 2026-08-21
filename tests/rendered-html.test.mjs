import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("renders the mode selection before the western table", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>BANG! Dice — Web Game<\/title>/i);
  assert.match(html, /class="welcome-screen"/);
  assert.match(html, /class="welcome-art"/);
  assert.match(html, /CHƠI VỚI BOT/);
  assert.match(html, /MULTIPLAYER/);
  assert.doesNotMatch(html, /class="game-shell/);
  assert.doesNotMatch(html, /class="dice-tray/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});
