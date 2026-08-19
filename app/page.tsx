"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  activateSkill,
  beginResolution,
  canActivateSkill,
  canRoll,
  characters,
  chooseAbility,
  chooseTarget,
  currentPrompt,
  faceInfo,
  maxRolls,
  newGame,
  playBotTurn,
  rollDice,
  selectableTargetIds,
  skipKitArrow,
  toggleHeld,
  type GameEffect,
  type GameState,
  type Role,
} from "./game";

type ActiveEffect = GameEffect & { uiDelay: number };
type TransitionStage = "waiting" | "round" | "player" | "winner" | null;
type HealthPulse = { kind: "damage" | "heal"; amount: number; sequence: number };

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
  const [rolling, setRolling] = useState(false);
  const [botRolling, setBotRolling] = useState(false);
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);
  const [healthPulses, setHealthPulses] = useState<Record<string, HealthPulse>>({});
  const [transitionStage, setTransitionStage] = useState<TransitionStage>("waiting");
  const [readyTurn, setReadyTurn] = useState(0);
  const [introSerial, setIntroSerial] = useState(0);
  const rollTimer = useRef<number | null>(null);
  const turnTimer = useRef<number | null>(null);
  const effectTimers = useRef<number[]>([]);
  const lastEffectId = useRef(0);
  const lastEffectTurn = useRef(0);
  const lastIntroRound = useRef(0);
  const lastWinner = useRef<string | null>(null);
  const effectQueueEnd = useRef(0);
  const skillQueueEnd = useRef(0);
  const previousHp = useRef<Record<string, number>>({});
  const healthPulseSequence = useRef(0);
  const turnReady = readyTurn === game.turnNumber && transitionStage === null;
  const selectable = useMemo(() => new Set(turnReady ? selectableTargetIds(game) : []), [game, turnReady]);
  const skillEffects = useMemo(() => activeEffects.filter((effect) => effect.kind === "skill"), [activeEffects]);
  const impactGroups = useMemo(() => {
    const groups = new Map<string, ActiveEffect[]>();
    for (const effect of activeEffects) {
      if (!effect.targetId || effect.amount === undefined) continue;
      groups.set(effect.targetId, [...(groups.get(effect.targetId) ?? []), effect]);
    }
    return [...groups.values()];
  }, [activeEffects]);
  const current = game.players[game.turn];
  const human = game.players.find((player) => player.human)!;
  const shownResult = !turnReady && game.lastTurnResult && (
    game.lastTurnResult.turnNumber === game.turnNumber - 1
    || (game.phase === "over" && game.lastTurnResult.turnNumber === game.turnNumber)
  ) ? game.lastTurnResult : null;
  const displayedDice = shownResult?.dice ?? game.dice;
  const resultPlayer = shownResult ? game.players.find((player) => player.id === shownResult.playerId) : null;
  const diceMoving = rolling || botRolling;

  useEffect(() => {
    const nextHp: Record<string, number> = {};
    const changes: Record<string, HealthPulse> = {};
    for (const player of game.players) {
      nextHp[player.id] = player.hp;
      const previous = previousHp.current[player.id];
      if (previous === undefined || previous === player.hp) continue;
      changes[player.id] = {
        kind: player.hp < previous ? "damage" : "heal",
        amount: Math.abs(player.hp - previous),
        sequence: ++healthPulseSequence.current,
      };
    }
    previousHp.current = nextHp;
    if (!Object.keys(changes).length) return;
    const timer = window.setTimeout(() => {
      setHealthPulses((currentPulses) => ({ ...currentPulses, ...changes }));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [game.players]);

  const rollWithAnimation = useCallback(() => {
    if (rolling || !turnReady || !canRoll(game)) return;
    setRolling(true);
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 820;
    rollTimer.current = window.setTimeout(() => {
      setGame((state) => rollDice(state));
      setRolling(false);
      rollTimer.current = null;
    }, duration);
  }, [game, rolling, turnReady]);

  useEffect(() => () => {
    if (rollTimer.current !== null) window.clearTimeout(rollTimer.current);
    if (turnTimer.current !== null) window.clearTimeout(turnTimer.current);
    effectTimers.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (game.effectSeq < lastEffectId.current) {
      lastEffectId.current = 0;
      effectQueueEnd.current = 0;
      skillQueueEnd.current = 0;
      setActiveEffects([]);
    }
    const incoming = game.effects.filter((effect) => effect.id > lastEffectId.current);
    const turnChanged = game.turnNumber !== lastEffectTurn.current;
    const winnerChanged = !!game.winner && game.winner !== lastWinner.current;
    lastEffectTurn.current = game.turnNumber;
    lastWinner.current = game.winner;
    const now = Date.now();
    let uiDelay = 0;
    const staged = incoming.map((effect, index): ActiveEffect => {
      const previous = incoming[index - 1];
      const sameGatlingVolley = effect.kind === "gatling" && previous?.kind === "gatling" && effect.sourceId === previous.sourceId;
      const sameTargetBurst = !!effect.targetId && effect.targetId === previous?.targetId;
      if (index > 0 && !sameGatlingVolley && !sameTargetBurst) uiDelay = Math.min(uiDelay + 140, 420);
      if (effect.kind !== "skill") return { ...effect, uiDelay };
      const startsAt = Math.max(now + uiDelay, skillQueueEnd.current);
      skillQueueEnd.current = startsAt + 3100;
      return { ...effect, uiDelay: startsAt - now };
    });
    if (incoming.length) {
      lastEffectId.current = incoming.at(-1)!.id;
      setActiveEffects((currentEffects) => [...currentEffects, ...staged]);
    }
    staged.forEach((effect) => {
      effectQueueEnd.current = Math.max(effectQueueEnd.current, now + 3700 + effect.uiDelay);
      const timer = window.setTimeout(() => {
        setActiveEffects((currentEffects) => currentEffects.filter((item) => item.id !== effect.id));
        effectTimers.current = effectTimers.current.filter((activeTimer) => activeTimer !== timer);
      }, 3700 + effect.uiDelay);
      effectTimers.current.push(timer);
    });

    if (!turnChanged && !winnerChanged) return;
    const startsRound = turnChanged && game.round !== lastIntroRound.current;
    if (turnChanged) lastIntroRound.current = game.round;
    if (turnTimer.current !== null) window.clearTimeout(turnTimer.current);

    const showPlayerTurn = () => {
      setTransitionStage("player");
      turnTimer.current = window.setTimeout(() => {
        setTransitionStage(null);
        setReadyTurn(game.turnNumber);
        turnTimer.current = null;
      }, 2000);
    };
    const showNextNotice = () => {
      if (game.winner) {
        setTransitionStage("winner");
        turnTimer.current = window.setTimeout(() => {
          setTransitionStage(null);
          turnTimer.current = null;
        }, 3000);
      } else if (startsRound) {
        setTransitionStage("round");
        turnTimer.current = window.setTimeout(showPlayerTurn, 2000);
      } else {
        showPlayerTurn();
      }
    };

    const firstTurn = game.turnNumber === 1 && !game.lastTurnResult && !game.winner;
    const wait = firstTurn ? 0 : Math.max(2000, effectQueueEnd.current - now + 100);
    if (wait > 0) {
      setTransitionStage("waiting");
      turnTimer.current = window.setTimeout(showNextNotice, wait);
    } else {
      showNextNotice();
    }
  }, [game.effects, game.effectSeq, game.turnNumber, game.winner, introSerial]);

  useEffect(() => {
    if (game.phase !== "bot" || !turnReady) return;
    setBotRolling(true);
    const timer = window.setTimeout(() => {
      setGame((state) => playBotTurn(state));
      setBotRolling(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [game.phase, game.turn, turnReady]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.code !== "Space" || setupOpen || rulesOpen || logOpen || rolling || !turnReady || !canRoll(game)) return;
      event.preventDefault();
      rollWithAnimation();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [game, setupOpen, rulesOpen, logOpen, rolling, turnReady, rollWithAnimation]);

  const startGame = () => {
    if (rollTimer.current !== null) window.clearTimeout(rollTimer.current);
    if (turnTimer.current !== null) window.clearTimeout(turnTimer.current);
    rollTimer.current = null;
    turnTimer.current = null;
    setRolling(false);
    setBotRolling(false);
    setTransitionStage("waiting");
    setReadyTurn(0);
    effectTimers.current.forEach((timer) => window.clearTimeout(timer));
    effectTimers.current = [];
    lastEffectId.current = 0;
    lastEffectTurn.current = 0;
    lastIntroRound.current = 0;
    lastWinner.current = null;
    effectQueueEnd.current = 0;
    skillQueueEnd.current = 0;
    previousHp.current = {};
    setHealthPulses({});
    setActiveEffects([]);
    setGame(newGame(nextCount));
    setIntroSerial((serial) => serial + 1);
    setSetupOpen(false);
    setLogOpen(false);
  };

  const effectPosition = (playerId?: string): [number, number] => {
    if (!playerId) return [50, 50];
    const playerIndex = game.players.findIndex((player) => player.id === playerId);
    return seatLayout[game.playerCount][playerIndex] ?? [50, 50];
  };

  const effectImpact = (effect: GameEffect) => {
    if (effect.label && effect.kind === "arrow") return effect.label;
    if ((effect.amount ?? 0) < 0) return `${effect.amount} HP`;
    if ((effect.amount ?? 0) > 0) return effect.kind === "arrow" ? `+${effect.amount} MŨI TÊN` : `+${effect.amount} HP`;
    if (effect.kind === "beer") return "ĐẦY MÁU";
    if (effect.kind === "gatling") return "MIỄN NHIỄM";
    return "KHÔNG MẤT MÁU";
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
            const healthPulse = healthPulses[player.id];
            return (
              <button
                type="button"
                className={`seat ${player.human ? "human-player" : ""} ${player.role === "Sheriff" ? "sheriff-player" : ""} ${index === game.turn ? "active" : ""} ${targetable ? "targetable" : ""} ${!player.alive ? "dead" : ""}`}
                style={{
                  "--x": `${x}%`,
                  "--y": `${y}%`,
                } as CSSProperties}
                key={player.id}
                onClick={() => targetable && setGame((state) => chooseTarget(state, player.id))}
                disabled={!targetable}
                aria-label={`${player.name}, ${player.character.name}, ${player.hp} máu, ${player.arrows} mũi tên${targetable ? ", chọn làm mục tiêu" : ""}`}
              >
                <span className="character-card">
                  <span
                    className={`role-photo ${showRole ? roleClass(player.role) : "hidden-role"}`}
                    aria-label={showRole ? `Vai trò: ${roleLabel[player.role]}` : "Vai trò đang được giữ kín"}
                  >
                    {!showRole && <b aria-hidden="true">?</b>}
                  </span>
                  {player.role === "Sheriff" && (
                    <span className="sheriff-badge" aria-label="Cảnh sát trưởng" title="Cảnh sát trưởng">★</span>
                  )}
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
                  <span
                    className={healthPulse ? `bullet-stack hp-${healthPulse.kind}` : "bullet-stack"}
                    aria-label={`${player.hp} trên ${player.maxHp} máu`}
                    key={`${player.id}-hp-${healthPulse?.sequence ?? 0}`}
                  >
                    {Array.from({ length: player.hp }, (_, i) => (
                      <i
                        className={healthPulse?.kind === "heal" && i >= player.hp - healthPulse.amount ? "bullet-token new-bullet" : "bullet-token"}
                        aria-hidden="true"
                        key={i}
                      />
                    ))}
                  </span>
                  <span className={`arrow-stack ${player.arrows ? "" : "empty"}`}>
                    {player.arrows ? Array.from({ length: player.arrows }, (_, i) => <i key={i}>➹</i>) : <i>➹ 0</i>}
                  </span>
                </span>
                {!player.alive && <span className="eliminated">ĐÃ BỊ LOẠI</span>}
              </button>
            );
          })}

          <div className="effect-layer" aria-live="assertive" aria-atomic="false">
            {activeEffects.filter((effect) => effect.kind !== "skill" && effect.targetId).map((effect) => {
              const [sourceX, sourceY] = effectPosition(effect.sourceId);
              const [targetX, targetY] = effectPosition(effect.targetId);
              const effectStyle = {
                "--source-x": `${sourceX}%`,
                "--source-y": `${sourceY}%`,
                "--target-x": `${targetX}%`,
                "--target-y": `${targetY}%`,
                "--effect-delay": `${effect.uiDelay}ms`,
              } as CSSProperties;
              return (
                <span className={`effect-event effect-${effect.kind}`} style={effectStyle} key={effect.id}>
                  <span className="effect-projectile" aria-hidden="true">
                    {effect.kind === "shot" ? <img src="/effects/bull1.png" alt="" /> : effect.kind === "beer" ? "♨" : effect.kind === "gatling" ? "✹" : effect.kind === "arrow" ? "➹" : "▰"}
                  </span>
                </span>
              );
            })}
            {impactGroups.map((effects) => {
              const first = effects[0];
              const [targetX, targetY] = effectPosition(first.targetId);
              return (
                <span
                  className="effect-impact-row"
                  style={{
                    "--target-x": `${targetX}%`,
                    "--target-y": `${targetY}%`,
                  } as CSSProperties}
                  key={first.targetId}
                >
                  {effects.map((effect) => (
                    <span
                      className={`effect-impact effect-impact-${effect.kind}`}
                      style={{ "--effect-delay": `${effect.uiDelay}ms` } as CSSProperties}
                      key={effect.id}
                    >
                      {effectImpact(effect)}
                    </span>
                  ))}
                </span>
              );
            })}
          </div>

          <div className="turn-panel">
            <div className="supply"><span>CHỒNG MŨI TÊN</span><b>➹ {game.arrowSupply}/9</b></div>
            {resultPlayer && <div className="dice-result-owner">KẾT QUẢ • {resultPlayer.name.toUpperCase()}</div>}
            <div className={diceMoving ? "dice-tray rolling" : "dice-tray"} aria-label="Năm xúc xắc" aria-busy={diceMoving}>
              {displayedDice.map((face, index) => {
                const held = !shownResult && game.held[index];
                const dieRolling = diceMoving && (!held || face === null);
                return (
                  <button
                    className={`die ${face ?? "blank"} ${held ? "held" : ""} ${dieRolling ? "rolling" : face ? "revealed" : ""}`}
                    style={{ "--die-index": index } as CSSProperties}
                    key={index}
                    onClick={() => setGame((state) => toggleHeld(state, index))}
                    disabled={rolling || !turnReady || game.phase !== "roll" || game.rolls === 0}
                    aria-label={`Xúc xắc ${index + 1}: ${face ? faceInfo[face].label : "chưa tung"}${held ? ", đang giữ" : ""}`}
                  >
                    <span>{face ? faceInfo[face].symbol : "?"}</span>
                    {held && <small>GIỮ</small>}
                  </button>
                );
              })}
            </div>

            <div className="turn-actions">
              {game.phase === "roll" && (
                <>
                  <button className="roll-button" onClick={rollWithAnimation} disabled={rolling || !turnReady || !canRoll(game)}>
                    {rolling ? "ĐANG TUNG…" : game.rolls ? "TUNG LẠI" : "TUNG XÚC XẮC"} <kbd>SPACE</kbd>
                  </button>
                  {game.rolls > 0 && <button className="resolve-button" onClick={() => setGame((state) => beginResolution(state))} disabled={rolling}>CHỐT KẾT QUẢ</button>}
                </>
              )}
              {game.phase === "shot" && canActivateSkill(game) && (
                <button className="skill-button" onClick={() => setGame((state) => activateSkill(state))}>
                  NHÂN ĐÔI PHÁT BẮN NÀY
                </button>
              )}
              {(game.phase === "shot" || game.phase === "beer" || game.phase === "kit" || game.phase === "sid") && <div className="target-callout">⌖ {currentPrompt(game)}</div>}
              {game.phase === "kit" && <button className="resolve-button" onClick={() => setGame((state) => skipKitArrow(state))}>BỎ QUA GATLING NÀY</button>}
              {game.phase === "ability" && game.decision && (
                <div className="ability-choice">
                  <strong>{currentPrompt(game)}</strong>
                  <div>
                    {Array.from({ length: game.decision.max + 1 }, (_, count) => (
                      <button key={count} onClick={() => setGame((state) => chooseAbility(state, count))}>
                        {count === 0 ? "KHÔNG DÙNG" : game.decision!.kind === "bart" ? `ĐỔI ${count} HP → ${count} MŨI TÊN` : `BỎ ${count} MŨI TÊN`}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {game.phase === "bot" && turnReady && <div className="bot-thinking"><i /><i /><i /> {current.name} đang tung…</div>}
              {game.phase === "over" && <button className="roll-button" onClick={() => setSetupOpen(true)}>CHƠI VÁN MỚI</button>}
            </div>
            {game.phase === "roll" && <p aria-live="polite">{rolling ? "Xúc xắc đang lăn…" : `Lần tung ${game.rolls}/${maxRolls(game)} · Bấm xúc xắc để giữ`}</p>}
          </div>

          {transitionStage === "player" && (
            <div className="player-turn-toast" role="status" aria-live="assertive">
              <small>TỚI LƯỢT</small>
              <strong>{current.name.toUpperCase()}</strong>
              <span>{current.character.name.toUpperCase()}</span>
            </div>
          )}
        </section>
      </div>

      <div className="skill-layer" aria-live="assertive" aria-atomic="true">
        {skillEffects.map((effect) => (
          <span
            className="skill-toast"
            style={{
              "--effect-delay": `${effect.uiDelay}ms`,
              "--toast-offset": "0px",
            } as CSSProperties}
            key={effect.id}
          >
            <small>KỸ NĂNG KÍCH HOẠT</small><strong>{effect.label}</strong>
          </span>
        ))}
      </div>

      {!turnReady && transitionStage !== "round" && transitionStage !== "winner" && <div className="transition-lock" aria-hidden="true" />}

      {transitionStage === "round" && (
        <div className="turn-intro round-start" role="status" aria-live="assertive">
          <span>VÒNG {game.round}</span>
          <small>BẮT ĐẦU VÒNG MỚI</small>
        </div>
      )}

      {transitionStage === "winner" && (
        <div className="winner-intro" role="status" aria-live="assertive">
          <small>TRẬN ĐẤU KẾT THÚC</small>
          <strong>PHE CHIẾN THẮNG</strong>
          <span>{game.winner}</span>
        </div>
      )}

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
