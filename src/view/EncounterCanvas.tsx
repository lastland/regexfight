/**
 * EncounterCanvas — the central Canvas 2D surface during combat.
 *
 * This component owns the **five-phase per-spell animation state machine**
 * (Invocation → Travel → Pre-impact → Resolution → Aftermath) and the
 * event-driven pacing contract: it requests the next event when the
 * current spell's Aftermath finishes.
 *
 * Architecturally:
 *   - The animation state lives in a `useRef`-held value, mutated each
 *     rAF tick. React does NOT re-render the canvas component on frame
 *     boundaries.
 *   - React re-renders happen when `props.events` changes; that triggers
 *     the ingest effect, which queues the new event for animation.
 *   - The actual draw loop reads from `stateRef.current` and the cached
 *     sprite canvases (see `./sprites`).
 *   - Per-outcome visual branches in Resolution; per-Outcome flash colours;
 *     Hit-only screen shake; floating damage numbers via `./effects`.
 *
 * Contracts:
 *   - `onRequestNextEvent()` is called exactly once per consumed event:
 *     at Aftermath-end for SpellResolved, immediately for PhaseAdvanced,
 *     and never after EncounterEnded.
 *   - The first event is requested on mount (no events yet → request).
 *
 * See:
 *   - src/view/docs/adr/0003-event-driven-encounter-pacing.md
 *   - src/view/docs/adr/0004-five-phase-spell-animation.md
 */

import { useEffect, useRef } from 'react';
import type { EncounterEvent, Kind, Outcome } from '../combat/types';
import type { SpeedMultiplier } from './useSpeedMultiplier';
import {
  getEnemyFigure,
  getPlayerFigure,
  getSpellProjectile,
  getWardSigil,
  loadSkinFromStorage,
  type EnemyPose,
  type PlayerPose,
  type PlayerSkin,
  type WardSigilState,
} from './sprites';
import {
  DAMAGE_NUMBER_DURATION_MS,
  drawDamageNumber,
  pickDamageColor,
  type DamageNumber,
  type DamageNumberStyle,
} from './effects/damageNumbers';
import {
  FLASH_BY_OUTCOME,
  drawFlash,
  type FlashColor,
} from './effects/flashOverlay';
import { getShakeOffset } from './effects/screenShake';

// ---------------------------------------------------------------------------
// Phase timing (ms at 1×). Scaled by SpeedMultiplier at runtime.
// ---------------------------------------------------------------------------

const PHASE_MS = {
  invocation: 500,
  travel: 400,
  preImpact: 150,
  resolution: 600,
  aftermath: 150,
} as const;

const GLYPH_MS_AT_1X = 40;

// Visual layout — pixel art is upscaled by integer factors via drawImage
// with imageSmoothingEnabled = false. The 16×24 player/enemy sprites become
// 64×96 on canvas; 12×12 projectile/sigil become 36×36 / 48×48.
const PLAYER_FIGURE_SCALE = 4;
const ENEMY_FIGURE_SCALE = 4;
const SIGIL_SCALE = 4;
const PROJECTILE_SCALE = 3;

// Reference design size — figures and projectile positions are computed in
// CSS pixels relative to the canvas's getBoundingClientRect.
type Layout = {
  w: number;
  h: number;
  groundY: number; // baseline (figure feet)
  enemyX: number;
  enemyY: number;
  playerX: number;
  playerY: number;
  sigilX: number;
  sigilY: number;
  projectileY: number; // mid-flight height
};

function computeLayout(w: number, h: number): Layout {
  const figureH = 24 * PLAYER_FIGURE_SCALE;
  const groundY = h - 24; // small margin below feet
  const top = groundY - figureH;
  const enemyX = Math.round(w * 0.12);
  const playerX = Math.round(w - w * 0.12 - 16 * PLAYER_FIGURE_SCALE);
  const sigilX = playerX - 12 * SIGIL_SCALE - 8;
  const sigilY = top + Math.round(figureH * 0.35);
  const projectileY = top + Math.round(figureH * 0.4);
  return {
    w,
    h,
    groundY,
    enemyX,
    enemyY: top,
    playerX,
    playerY: top,
    sigilX,
    sigilY,
    projectileY,
  };
}

// ---------------------------------------------------------------------------
// Animation state machine
// ---------------------------------------------------------------------------

type Phase = 'invocation' | 'travel' | 'preImpact' | 'resolution' | 'aftermath';

type SpellAnimation = {
  kind: 'spell';
  event: Extract<EncounterEvent, { tag: 'SpellResolved' }>;
  phase: Phase;
  phaseStart: number;
};

type PhaseAdvanceAnimation = {
  kind: 'phaseAdvance';
  event: Extract<EncounterEvent, { tag: 'PhaseAdvanced' }>;
  startTime: number;
};

type EndAnimation = {
  kind: 'end';
  event: Extract<EncounterEvent, { tag: 'EncounterEnded' }>;
  startTime: number;
};

type ActiveAnimation = SpellAnimation | PhaseAdvanceAnimation | EndAnimation;

type AnimState = {
  active: ActiveAnimation | null;
  lastConsumedIdx: number; // last events index whose animation has been started
  // Track whether onRequestNextEvent has been called for the current "tick"
  // so we never call it twice in a row.
  pendingRequest: boolean;
  // Visual effect state
  damageNumbers: DamageNumber[];
  damageNumberStyles: Map<number, DamageNumberStyle>;
  nextDamageId: number;
  shakeStart: number | null;
  flash: { color: FlashColor; rect: { x: number; y: number; w: number; h: number }; startTime: number } | null;
  // The previously-rendered terminal-event flag, so we can stop ticking.
  encounterEnded: boolean;
};

function initialState(): AnimState {
  return {
    active: null,
    lastConsumedIdx: -1,
    pendingRequest: false,
    damageNumbers: [],
    damageNumberStyles: new Map(),
    nextDamageId: 1,
    shakeStart: null,
    flash: null,
    encounterEnded: false,
  };
}

const PHASE_ORDER: readonly Phase[] = [
  'invocation',
  'travel',
  'preImpact',
  'resolution',
  'aftermath',
] as const;

function nextPhase(p: Phase): Phase | 'done' {
  const idx = PHASE_ORDER.indexOf(p);
  if (idx < 0 || idx === PHASE_ORDER.length - 1) return 'done';
  const next = PHASE_ORDER[idx + 1];
  return next ?? 'done';
}

function scaledPhaseDuration(phase: Phase, speed: SpeedMultiplier): number {
  return PHASE_MS[phase] / speed;
}

// Glyph-by-glyph spell text reveal. Caps at ≥2× speed to instant reveal,
// per ADR-0003 (view).
function glyphsRevealed(elapsed: number, totalChars: number, speed: SpeedMultiplier): number {
  if (speed >= 2) return totalChars;
  const revealed = Math.floor(elapsed / GLYPH_MS_AT_1X);
  return Math.max(0, Math.min(totalChars, revealed));
}

// Returns the projectile X position as a fraction t ∈ [0, 1] across the
// canvas: 0 at enemy origin, 1 at player origin. Reversed for Counterattack
// in Resolution.
function projectileT(anim: SpellAnimation, now: number, speed: SpeedMultiplier): number | null {
  const elapsed = now - anim.phaseStart;
  switch (anim.phase) {
    case 'invocation':
      // Materialising at the enemy — projectile not yet in flight.
      return null;
    case 'travel': {
      const dur = scaledPhaseDuration('travel', speed);
      return Math.min(1, elapsed / dur);
    }
    case 'preImpact':
      return 1;
    case 'resolution': {
      const dur = scaledPhaseDuration('resolution', speed);
      const r = Math.min(1, elapsed / dur);
      if (anim.event.outcome === 'Counterattack') {
        // Projectile reverses direction during Resolution.
        return 1 - r;
      }
      // Hit / Backfire / Dodge: projectile lingers near the player for the
      // first half, fades out for the second half. Caller fades via alpha.
      return 1;
    }
    case 'aftermath':
      return null;
  }
}

function playerPoseFor(anim: SpellAnimation): PlayerPose {
  switch (anim.phase) {
    case 'invocation':
    case 'travel':
    case 'preImpact':
      return 'idle';
    case 'resolution': {
      switch (anim.event.outcome) {
        case 'Counterattack':
          return 'counterattack';
        case 'Hit':
        case 'Backfire':
          return 'hit';
        case 'Dodge':
          return 'idle';
      }
    }
    case 'aftermath':
      return 'idle';
  }
}

function enemyPoseFor(anim: SpellAnimation): EnemyPose {
  switch (anim.phase) {
    case 'invocation':
      return 'casting';
    case 'travel':
    case 'preImpact':
      return 'idle';
    case 'resolution':
      return anim.event.outcome === 'Counterattack' ? 'hit' : 'idle';
    case 'aftermath':
      return 'idle';
  }
}

function sigilStateFor(anim: SpellAnimation, now: number, speed: SpeedMultiplier): WardSigilState {
  switch (anim.phase) {
    case 'invocation':
    case 'travel':
      return 'idle';
    case 'preImpact': {
      // Brief pulse — alternate active/idle by elapsed time.
      const elapsed = now - anim.phaseStart;
      const dur = scaledPhaseDuration('preImpact', speed);
      return elapsed > dur * 0.5 ? 'active' : 'idle';
    }
    case 'resolution':
      return anim.event.outcome === 'Counterattack' || anim.event.outcome === 'Backfire' ? 'active' : 'idle';
    case 'aftermath':
      return 'idle';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export type EncounterCanvasProps = {
  events: readonly EncounterEvent[];
  /**
   * Called when the current per-spell animation completes (Aftermath
   * finished). The screen forwards the call to App, which steps the sim.
   * Must NOT be called after seeing an `EncounterEnded` event.
   */
  onRequestNextEvent: () => void;
  speed: SpeedMultiplier;
  /**
   * Test-only escape hatch. When true, the canvas calls
   * `onRequestNextEvent()` on every animation frame until it sees an
   * `EncounterEnded` event. See `src/app/App.test.tsx`. Production must
   * not pass this — production pacing is driven by the animation state
   * machine in this file.
   */
  autoTick?: boolean | undefined;
};

export function EncounterCanvas(props: EncounterCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<AnimState>(initialState());
  const rafRef = useRef<number | null>(null);
  const propsRef = useRef(props);
  const skinRef = useRef<PlayerSkin>(loadSkinFromStorage(window.localStorage));
  const initialRequestFiredRef = useRef(false);

  // Keep latest props accessible inside the long-lived rAF loop without
  // re-mounting the effect.
  propsRef.current = props;

  // Reset state on encounter-instance change. We use the first event's
  // identity as a coarse proxy: if `events.length` drops to 0 we treat
  // it as a fresh encounter.
  useEffect(() => {
    if (props.events.length === 0) {
      stateRef.current = initialState();
      initialRequestFiredRef.current = false;
    }
  }, [props.events.length === 0]);

  // Test-only autoTick: synchronously request the next event on each frame
  // until EncounterEnded. Bypasses the animation state machine.
  const autoTick = props.autoTick === true;
  const events = props.events;
  const onRequestNextEvent = props.onRequestNextEvent;
  useEffect(() => {
    if (!autoTick) return;
    const last = events.length > 0 ? events[events.length - 1] : undefined;
    if (last && last.tag === 'EncounterEnded') return;
    const id = requestAnimationFrame(() => {
      onRequestNextEvent();
    });
    return () => cancelAnimationFrame(id);
  }, [autoTick, events, onRequestNextEvent]);

  // Main animation loop. Mounts once.
  useEffect(() => {
    if (autoTick) return; // production loop is suppressed under autoTick.
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = (): void => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
    };
    resize();
    window.addEventListener('resize', resize);

    const tick = (): void => {
      const now = performance.now();
      const currentProps = propsRef.current;
      const speed = currentProps.speed;
      const state = stateRef.current;
      const skin = skinRef.current;

      // 1. Bootstrap: request the first event on mount if nothing has been
      //    seen yet and we haven't already asked.
      if (
        !initialRequestFiredRef.current &&
        currentProps.events.length === 0 &&
        !state.encounterEnded
      ) {
        initialRequestFiredRef.current = true;
        currentProps.onRequestNextEvent();
      }

      // 2. Ingest any new event that arrived while we were idle.
      if (state.active === null && state.lastConsumedIdx + 1 < currentProps.events.length) {
        const idx = state.lastConsumedIdx + 1;
        const ev = currentProps.events[idx];
        if (ev) {
          if (ev.tag === 'SpellResolved') {
            state.active = {
              kind: 'spell',
              event: ev,
              phase: 'invocation',
              phaseStart: now,
            };
            // Counterattack triggers the green flash on enemy; Hit/Backfire
            // schedule it during their Resolution phase entry. We schedule
            // all flashes when the *Resolution* phase enters (below).
          } else if (ev.tag === 'PhaseAdvanced') {
            state.active = { kind: 'phaseAdvance', event: ev, startTime: now };
          } else if (ev.tag === 'EncounterEnded') {
            state.active = { kind: 'end', event: ev, startTime: now };
          }
          state.lastConsumedIdx = idx;
        }
      }

      // 3. Advance the active animation. May complete and trigger next-event.
      if (state.active) {
        advanceActive(state, now, speed, currentProps, canvas);
      }

      // 4. Render the scene.
      const rect = canvas.getBoundingClientRect();
      const layout = computeLayout(rect.width, rect.height);
      drawScene(ctx, layout, state, skin, now, speed);

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoTick]);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Encounter canvas"
      className="block h-64 w-full rounded border border-zinc-700 bg-zinc-950"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}

// ---------------------------------------------------------------------------
// State machine: advance the active animation by one frame
// ---------------------------------------------------------------------------

function advanceActive(
  state: AnimState,
  now: number,
  speed: SpeedMultiplier,
  props: EncounterCanvasProps,
  canvas: HTMLCanvasElement,
): void {
  const active = state.active;
  if (!active) return;

  if (active.kind === 'phaseAdvance') {
    // Phase-advance has no per-spell animation — consume immediately and
    // request the next event. The HP-bar white flash is rendered by the
    // EncounterScreen via flashKey (derived from event count).
    state.active = null;
    props.onRequestNextEvent();
    return;
  }

  if (active.kind === 'end') {
    // Encounter ended — hold the final frame indefinitely. App.tsx
    // schedules the post-mortem transition via its END_PAUSE_MS setTimeout.
    state.encounterEnded = true;
    // Do not call onRequestNextEvent.
    return;
  }

  // SpellAnimation
  const dur = scaledPhaseDuration(active.phase, speed);
  const elapsed = now - active.phaseStart;
  if (elapsed < dur) return;

  // Phase transition. On entry to Resolution, fire the per-Outcome flash,
  // schedule shake on Hit, schedule damage number.
  const next = nextPhase(active.phase);
  if (next === 'done') {
    // Aftermath ended. Clear the active animation, then request next event.
    state.active = null;
    props.onRequestNextEvent();
    return;
  }

  active.phase = next;
  active.phaseStart = now;

  if (next === 'resolution') {
    onResolutionEnter(active, state, now, speed, canvas);
  }
}

function onResolutionEnter(
  anim: SpellAnimation,
  state: AnimState,
  now: number,
  speed: SpeedMultiplier,
  canvas: HTMLCanvasElement,
): void {
  const outcome = anim.event.outcome;
  const rect = canvas.getBoundingClientRect();
  const layout = computeLayout(rect.width, rect.height);

  // Per-Outcome flash overlay.
  const flashColor = FLASH_BY_OUTCOME[outcome];
  const figureW = 16 * PLAYER_FIGURE_SCALE;
  const figureH = 24 * PLAYER_FIGURE_SCALE;
  const enemyRect = { x: layout.enemyX, y: layout.enemyY, w: figureW, h: figureH };
  const playerRect = { x: layout.playerX, y: layout.playerY, w: figureW, h: figureH };
  const targetRect = outcome === 'Counterattack' ? enemyRect : playerRect;
  state.flash = { color: flashColor, rect: targetRect, startTime: now };

  // Hit-only screen shake.
  if (outcome === 'Hit') {
    state.shakeStart = now;
  }

  // Damage number for Outcomes that deal damage.
  const damaged = damageInfo(outcome, anim.event);
  if (damaged) {
    const id = state.nextDamageId++;
    const num: DamageNumber = {
      id,
      value: damaged.value,
      x: damaged.side === 'player' ? layout.playerX + figureW / 2 : layout.enemyX + figureW / 2,
      y: damaged.side === 'player' ? layout.playerY + figureH * 0.2 : layout.enemyY + figureH * 0.2,
      side: damaged.side,
      spawnTime: now,
    };
    state.damageNumbers.push(num);
    state.damageNumberStyles.set(id, pickDamageColor(damaged.side, outcome as 'Counterattack' | 'Hit' | 'Backfire'));
  }

  // Suppress lint warning about unused parameter
  void speed;
}

function damageInfo(
  outcome: Outcome,
  ev: Extract<EncounterEvent, { tag: 'SpellResolved' }>,
): { side: 'player' | 'enemy'; value: number } | null {
  // We don't know the damage value from the event alone — playerHp/enemyHp
  // *after* the resolve are present, but not the deltas. Use a fixed
  // visual placeholder of "−1" tagged by the side that took damage. The
  // numerical accuracy is not gameplay-critical; the HP bar in
  // EncounterScreen shows the authoritative value.
  void ev;
  switch (outcome) {
    case 'Counterattack':
      return { side: 'enemy', value: -1 };
    case 'Hit':
    case 'Backfire':
      return { side: 'player', value: -1 };
    case 'Dodge':
      return null;
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function drawScene(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  state: AnimState,
  skin: PlayerSkin,
  now: number,
  speed: SpeedMultiplier,
): void {
  // Apply screen shake if active.
  const shake = getShakeOffset(state.shakeStart, now, speed);
  if (state.shakeStart !== null && shake === null) {
    state.shakeStart = null;
  }
  const sx = shake?.offsetX ?? 0;
  const sy = shake?.offsetY ?? 0;

  ctx.save();
  ctx.translate(sx, sy);

  // Background.
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(-Math.abs(sx) - 4, -Math.abs(sy) - 4, layout.w + 16, layout.h + 16);

  // Subtle pixel grid.
  ctx.strokeStyle = '#161616';
  ctx.lineWidth = 1;
  const step = 16;
  for (let x = 0; x < layout.w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, layout.h);
    ctx.stroke();
  }
  for (let y = 0; y < layout.h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(layout.w, y + 0.5);
    ctx.stroke();
  }

  // Figures + sigil + projectile + text — based on active animation.
  drawFigures(ctx, layout, state, skin, now, speed);
  drawProjectileAndText(ctx, layout, state, now, speed);

  // Flash overlay (above figures but below damage numbers).
  if (state.flash) {
    const alive = drawFlash(ctx, state.flash.color, state.flash.rect, state.flash.startTime, now, speed);
    if (!alive) state.flash = null;
  }

  // Damage numbers.
  state.damageNumbers = state.damageNumbers.filter((num) => {
    const style = state.damageNumberStyles.get(num.id) ?? 'red';
    const alive = drawDamageNumber(ctx, num, now, speed, style);
    if (!alive) state.damageNumberStyles.delete(num.id);
    return alive;
  });

  ctx.restore();
}

function drawFigures(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  state: AnimState,
  skin: PlayerSkin,
  now: number,
  speed: SpeedMultiplier,
): void {
  const active = state.active;

  // Defaults when idle (no active animation):
  let playerPose: PlayerPose = 'idle';
  let enemyPose: EnemyPose = 'idle';
  let sigilState: WardSigilState = 'idle';

  if (active && active.kind === 'spell') {
    playerPose = playerPoseFor(active);
    enemyPose = enemyPoseFor(active);
    sigilState = sigilStateFor(active, now, speed);
  } else if (active && active.kind === 'end') {
    // Final pose: defeated enemy if Victory, hit player if Defeat.
    if (active.event.result === 'Victory') {
      enemyPose = 'defeated';
      playerPose = 'idle';
    } else {
      playerPose = 'hit';
      enemyPose = 'idle';
    }
  }

  const enemySprite = getEnemyFigure(enemyPose);
  ctx.drawImage(
    enemySprite,
    layout.enemyX,
    layout.enemyY,
    enemySprite.width * ENEMY_FIGURE_SCALE,
    enemySprite.height * ENEMY_FIGURE_SCALE,
  );
  // Defeated → desaturate by drawing a translucent grey over the enemy.
  if (enemyPose === 'defeated') {
    ctx.fillStyle = 'rgba(20, 20, 20, 0.45)';
    ctx.fillRect(
      layout.enemyX,
      layout.enemyY,
      enemySprite.width * ENEMY_FIGURE_SCALE,
      enemySprite.height * ENEMY_FIGURE_SCALE,
    );
  }

  const playerSprite = getPlayerFigure(playerPose, skin);
  ctx.drawImage(
    playerSprite,
    layout.playerX,
    layout.playerY,
    playerSprite.width * PLAYER_FIGURE_SCALE,
    playerSprite.height * PLAYER_FIGURE_SCALE,
  );

  const sigilSprite = getWardSigil(sigilState, skin.wardSigilStyle);
  ctx.drawImage(
    sigilSprite,
    layout.sigilX,
    layout.sigilY,
    sigilSprite.width * SIGIL_SCALE,
    sigilSprite.height * SIGIL_SCALE,
  );
}

function drawProjectileAndText(
  ctx: CanvasRenderingContext2D,
  layout: Layout,
  state: AnimState,
  now: number,
  speed: SpeedMultiplier,
): void {
  const active = state.active;
  if (!active || active.kind !== 'spell') return;

  const text = active.event.spell.text;
  const kind: Kind = active.event.spell.kind;

  // Projectile position.
  const t = projectileT(active, now, speed);
  if (t !== null) {
    const figureW = 16 * PLAYER_FIGURE_SCALE;
    const startX = layout.enemyX + figureW * 0.7;
    const endX = layout.playerX + figureW * 0.1;
    const projSize = 12 * PROJECTILE_SCALE;
    const px = startX + t * (endX - startX) - projSize / 2;
    const py = layout.projectileY - projSize / 2;
    const sprite = getSpellProjectile(kind);

    // Fade out projectile during late Resolution for non-Counterattack outcomes.
    let alpha = 1;
    if (active.phase === 'resolution' && active.event.outcome !== 'Counterattack') {
      const elapsed = now - active.phaseStart;
      const dur = scaledPhaseDuration('resolution', speed);
      const r = Math.min(1, elapsed / dur);
      alpha = Math.max(0, 1 - r);
    }
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite, px, py, projSize, projSize);
    ctx.globalAlpha = 1;
  }

  // Spell text — glyph-by-glyph during invocation, riding projectile during
  // travel/pre-impact, gone in resolution/aftermath.
  if (active.phase === 'invocation' || active.phase === 'travel' || active.phase === 'preImpact') {
    const elapsed = now - active.phaseStart;
    const reveal =
      active.phase === 'invocation'
        ? glyphsRevealed(elapsed, text.length, speed)
        : text.length;
    const visible = text.slice(0, reveal);

    // Position: above enemy during invocation, above projectile during travel/preImpact.
    let tx: number;
    const ty = layout.projectileY - 20;
    if (active.phase === 'invocation') {
      tx = layout.enemyX + 16 * ENEMY_FIGURE_SCALE * 0.5;
    } else {
      const figureW = 16 * PLAYER_FIGURE_SCALE;
      const startX = layout.enemyX + figureW * 0.7;
      const endX = layout.playerX + figureW * 0.1;
      const projT = t ?? 1;
      tx = startX + projT * (endX - startX);
    }

    ctx.font = '14px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#000000';
    ctx.strokeText(visible, tx, ty);
    ctx.fillStyle = kind === 'Real' ? '#7cf07c' : '#f07c7c';
    ctx.fillText(visible, tx, ty);
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }
}

// ---------------------------------------------------------------------------
// Silence TS unused warnings on imports that exist only for typing.
// ---------------------------------------------------------------------------

void DAMAGE_NUMBER_DURATION_MS;
