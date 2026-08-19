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

test("renders the playable western table", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>BANG! Dice — Web Game<\/title>/i);
  assert.match(html, /CHỒNG MŨI TÊN/);
  assert.match(html, /class="dice-tray(?: rolling)?"/);
  assert.match(html, /src="\/dice\/dynamite-tnt\.png"/);
  assert.match(html, /class="character-strip" src="\/characters\//);
  assert.match(html, /class="character-copy"/);
  assert.match(html, /class="bullet-stack"/);
  assert.match(html, /class="role-photo sheriff"/);
  assert.match(html, /class="sheriff-badge"/);
  assert.doesNotMatch(html, /class="role-card/);
  assert.match(html, /class="game-shell top-collapsed bottom-collapsed"/);
  assert.match(html, /class="panel-toggle top-panel-toggle"/);
  assert.match(html, /class="panel-toggle bottom-panel-toggle"/);
  assert.doesNotMatch(html, /class="felt-lines"/);
  assert.match(html, /VÁN MỚI/);
  assert.match(html, /VAI CỦA BẠN/);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|react-loading-skeleton/);
});
