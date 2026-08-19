"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  beginResolution,
  canRoll,
  characters,
  chooseTarget,
  currentPrompt,
  faceInfo,
  maxRolls,
  newGame,
  playBotTurn,
  rollDice,
  selectableTargetIds,
  toggleHeld,
  type GameState,
  type Role,
} from "./game";

const roleLabel: Record<Role, string> = {
  Sheriff: "CẢNH SÁT TRƯỞNG",
  Deputy: "CẢNH SÁT PHÓ",
  Outlaw: "TỘI PHẠM",
  Renegade: "PHẢN BỘI",
};

const roleGoal: Record<Role, string> = {
  Sheriff: "Loại toàn bộ Tội phạm và Phản bội.",
  Deputy: "Bảo vệ Cảnh sát trưởng và dẹp phe xấu.",
  Outlaw: "Loại Cảnh sát trưởng.",
  Renegade: "Trở thành người sống sót cuối cùng.",
};

const seatLayout: Record<number, Array<[number, number]>> = {
  3: [[50, 13], [75, 77], [25, 77]],
  4: [[50, 13], [83, 50], [50, 87], [17, 50]],
  5: [[50, 13], [83, 38], [71, 82], [29, 82], [17, 38]],
  6: [[50, 13], [83, 30], [83, 70], [50, 87], [17, 70], [17, 30]],
  7: [[50, 11], [78, 23], [85, 55], [70, 84], [30, 84], [15, 55], [22, 23]],
  8: [[35, 11], [65, 11], [84, 30], [84, 70], [65, 89], [35, 89], [16, 70], [16, 30]],
};

function roleClass(role: Role) {
  return role.toLowerCase();
}

function initialGame() {
  let seed = 20260819;
  return newGame(5, () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296));
}

export default function Home() {
  const [game, setGame] = useState<GameState>(initialGame);
  const [setupOpen, setSetupOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [nextCount, setNextCount] = useState(5);
  const selectable = useMemo(() => new Set(selectableTargetIds(game)), [game]);
  const current = game.players[game.turn];
  const human = game.players.find((player) => player.human)!;

  useEffect(() => {
    if (game.phase !== "bot") return;
    const timer = window.setTimeout(() => setGame((state) => playBotTurn(state)), 650);
    return () => window.clearTimeout(timer);
  }, [game.phase, game.turn]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || setupOpen || rulesOpen || logOpen || !canRoll(game)) return;
      event.preventDefault();
      setGame((state) => rollDice(state));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, setupOpen, rulesOpen, logOpen]);

  const startGame = () => {
    setGame(newGame(nextCount));
    setSetupOpen(false);
    setLogOpen(false);
  };

  return (
    <main className="game-shell">
      <header className="topbar">
        <button className="brand" onClick={() => setSetupOpen(true)} aria-label="Mở thiết lập ván mới">
          <span>BANG!</span><small>THE DICE GAME · WEB EDITION</small>
        </button>
        <div className="round">
          <b>VÒNG {game.round}</b>
          <span>{currentPrompt(game)}</span>
        </div>
        <div className="top-actions">
          <button className="text-button" onClick={() => setSetupOpen(true)}>VÁN MỚI</button>
          <button className="icon-button" onClick={() => setRulesOpen(true)} aria-label="Mở luật chơi">?</button>
        </div>
      </header>

      <div className="identity-strip">
        <span>VAI CỦA BẠN</span>
        <strong className={roleClass(human.role)}>{roleLabel[human.role]}</strong>
        <em>{game.playerCount === 3 ? "Luật 3 người: mọi vai trò đều công khai." : roleGoal[human.role]}</em>
      </div>

      <div className="table-scroll">
        <section
          className={`table players-${game.playerCount}`}
          aria-label={`Bàn chơi ${game.playerCount} người`}
        >
          {game.players.map((player, index) => {
            const [x, y] = seatLayout[game.playerCount][index];
            const showRole = player.human || player.revealed || game.phase === "over";
            const targetable = selectable.has(player.id);
            return (
              <button
                type="button"
                className={`seat ${index === game.turn ? "active" : ""} ${targetable ? "targetable" : ""} ${!player.alive ? "dead" : ""}`}
                style={{
                  "--x": `${x}%`,
                  "--y": `${y}%`,
                } as CSSProperties}
                key={player.id}
                onClick={() => targetable && setGame((state) => chooseTarget(state, player.id))}
                disabled={!targetable}
                aria-label={`${player.name}, ${player.character.name}, ${player.hp} máu, ${player.arrows} mũi tên${targetable ? ", chọn làm mục tiêu" : ""}`}
              >
                <span className={`role-card ${showRole ? roleClass(player.role) : "hidden-role"}`}>
                  <small>VAI TRÒ</small>
                  <strong>{showRole ? roleLabel[player.role] : "?"}</strong>
                </span>
                <span className="character-card">
                  <span className="portrait-window">
                    <img
                      className="character-strip"
                      src={`/characters/${player.character.id}.webp`}
                      alt=""
                      width="1664"
                      height="436"
                      draggable="false"
                    />
                  </span>
                  <span className="character-copy">
                    <strong>{player.character.name.toUpperCase()} ({player.character.life})</strong>
                    <span>{player.character.ability}</span>
                  </span>
                </span>
                <span className="tokens">
                  <span className="seat-owner">{player.human ? "BẠN" : player.name.toUpperCase()}</span>
                  <span className="bullet-stack" aria-label={`${player.hp} trên ${player.maxHp} máu`}>
                    {Array.from({ length: player.hp }, (_, i) => <i className="bullet-token" aria-hidden="true" key={i} />)}
                  </span>
                  <span className={`arrow-stack ${player.arrows ? "" : "empty"}`}>
                    {player.arrows ? Array.from({ length: player.arrows }, (_, i) => <i key={i}>➹</i>) : <i>➹ 0</i>}
                  </span>
                </span>
                {!player.alive && <span className="eliminated">ĐÃ BỊ LOẠI</span>}
              </button>
            );
          })}

          <div className="turn-panel">
            <div className="supply"><span>CHỒNG MŨI TÊN</span><b>➹ {game.arrowSupply}/9</b></div>
            <div className="dice-tray" aria-label="Năm xúc xắc">
              {game.dice.map((face, index) => (
                <button
                  className={`die ${face ?? "blank"} ${game.held[index] ? "held" : ""}`}
                  key={index}
                  onClick={() => setGame((state) => toggleHeld(state, index))}
                  disabled={game.phase !== "roll" || game.rolls === 0}
                  aria-label={`Xúc xắc ${index + 1}: ${face ? faceInfo[face].label : "chưa tung"}${game.held[index] ? ", đang giữ" : ""}`}
                >
                  <span>{face ? faceInfo[face].symbol : "?"}</span>
                  {game.held[index] && <small>GIỮ</small>}
                </button>
              ))}
            </div>

            <div className="turn-actions">
              {game.phase === "roll" && (
                <>
                  <button className="roll-button" onClick={() => setGame((state) => rollDice(state))} disabled={!canRoll(game)}>
                    {game.rolls ? "TUNG LẠI" : "TUNG XÚC XẮC"} <kbd>SPACE</kbd>
                  </button>
                  {game.rolls > 0 && <button className="resolve-button" onClick={() => setGame((state) => beginResolution(state))}>CHỐT KẾT QUẢ</button>}
                </>
              )}
              {(game.phase === "shot" || game.phase === "beer") && <div className="target-callout">⌖ {currentPrompt(game)}</div>}
              {game.phase === "bot" && <div className="bot-thinking"><i /><i /><i /> {current.name} đang tung…</div>}
              {game.phase === "over" && <button className="roll-button" onClick={() => setSetupOpen(true)}>CHƠI VÁN MỚI</button>}
            </div>
            {game.phase === "roll" && <p>Lần tung {game.rolls}/{maxRolls(game)} · Bấm xúc xắc để giữ</p>}
          </div>
        </section>
      </div>

      <footer className="controlbar">
        <button className="status-chip" onClick={() => setLogOpen(true)}><span>●</span> {game.players.filter((p) => p.alive).length} TAY SÚNG CÒN LẠI</button>
        <div className="legend">
          {Object.entries(faceInfo).map(([face, info]) => <span key={face}><i className={face}>{info.symbol}</i>{info.label}</span>)}
        </div>
        <button className="secondary" onClick={() => setLogOpen(true)}>NHẬT KÝ</button>
      </footer>

      {setupOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="setup-title">
          <section className="paper-modal setup-modal">
            <button className="close" onClick={() => setSetupOpen(false)} aria-label="Đóng">×</button>
            <p className="eyebrow">CHUẨN BỊ BÀN</p>
            <h1 id="setup-title">VÁN MỚI</h1>
            <p>Bạn đấu với bot. Vai trò và nhân vật được xáo ngẫu nhiên; Sheriff hoặc Deputy (ván 3 người) đi trước.</p>
            <fieldset>
              <legend>SỐ NGƯỜI CHƠI</legend>
              <div className="count-picker">
                {[3, 4, 5, 6, 7, 8].map((count) => (
                  <button className={nextCount === count ? "selected" : ""} key={count} onClick={() => setNextCount(count)}>{count}</button>
                ))}
              </div>
            </fieldset>
            <div className="role-mix">
              {nextCount === 3 ? "1 Deputy · 1 Outlaw · 1 Renegade" : nextCount === 4 ? "1 Sheriff · 2 Outlaw · 1 Renegade" : `${nextCount} vai trò đúng theo luật gốc`}
            </div>
            <button className="modal-primary" onClick={startGame}>CHIA BÀI & BẮT ĐẦU</button>
          </section>
        </div>
      )}

      {rulesOpen && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="rules-title">
          <section className="paper-modal rules-modal">
            <button className="close" onClick={() => setRulesOpen(false)} aria-label="Đóng">×</button>
            <p className="eyebrow">SỔ TAY MIỀN TÂY</p>
            <h1 id="rules-title">LUẬT NHANH</h1>
            <div className="rule-grid">
              <article><b>1. TUNG</b><p>Tung 5 xúc xắc, giữ hoặc tung lại tối đa 2 lần. Lucky Duke được thêm 1 lần.</p></article>
              <article><b>2. MŨI TÊN</b><p>Lấy ngay khi tung. Người lấy mũi tên thứ 9 kích hoạt đợt tấn công rồi trả toàn bộ mũi tên.</p></article>
              <article><b>3. THUỐC NỔ</b><p>Không được tung lại. Có 3 biểu tượng: dừng tung và mất 1 máu.</p></article>
              <article><b>4. GIẢI QUYẾT</b><p>Chọn mục tiêu Tầm 1/2, hồi máu bằng Bia; đủ 3 Gatling gây 1 sát thương cho mọi người khác.</p></article>
            </div>
            <h2>16 NHÂN VẬT</h2>
            <div className="character-list">
              {characters.map((character) => <p key={character.id}><b>{character.name} · {character.life}♥</b><span>{character.ability}</span></p>)}
            </div>
          </section>
        </div>
      )}

      {logOpen && (
        <aside className="log-drawer" aria-label="Nhật ký ván chơi">
          <div><p className="eyebrow">DIỄN BIẾN</p><button className="close" onClick={() => setLogOpen(false)} aria-label="Đóng">×</button></div>
          <ol>{game.log.map((entry, index) => <li key={`${entry}-${index}`}>{entry}</li>)}</ol>
        </aside>
      )}
    </main>
  );
}
