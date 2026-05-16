/**
 * EncounterCanvas — the single Canvas 2D surface on the Encounter Screen.
 *
 * Architecturally, this component owns its own animation loop and is not
 * re-rendered on every animation frame. The parent component passes the
 * accumulating `events` array via props; we diff against the previously-seen
 * count inside a `useEffect` and ingest new SpellResolved events as flying
 * sprites into our internal animation list. The list mutates inside the
 * ref-held state, never triggering React re-renders.
 *
 * v1 visuals are deliberately minimal — coloured rectangles labelled with
 * the spell text, flying left-to-right and fading after resolution. The
 * `/frontend-design` pass will refine.
 */

import { useEffect, useRef } from 'react';
import type { EncounterEvent, Kind } from '../combat/types';

export type EncounterCanvasProps = {
  events: readonly EncounterEvent[];
};

type FlyingSpell = {
  text: string;
  kind: Kind;
  // 0..1: progress across the canvas, then fade.
  spawnTime: number;
  laneY: number;
};

const COLOR_BY_KIND: Record<Kind, string> = {
  Real: '#7cf07c',
  Decoy: '#f07c7c',
};

const TRAVEL_MS = 1400;
const FADE_MS = 400;
const TOTAL_MS = TRAVEL_MS + FADE_MS;

export function EncounterCanvas(props: EncounterCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const flyingRef = useRef<FlyingSpell[]>([]);
  const consumedEventCountRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  // Ingest new events into the local animation list. This effect re-runs
  // when the events array reference changes, but the canvas's animation
  // loop keeps running irrespective of React renders.
  useEffect(() => {
    const events = props.events;
    const start = consumedEventCountRef.current;
    for (let i = start; i < events.length; i++) {
      const e = events[i];
      if (e && e.tag === 'SpellResolved') {
        flyingRef.current.push({
          text: e.spell.text,
          kind: e.spell.kind,
          spawnTime: performance.now(),
          laneY: 0.2 + Math.random() * 0.6,
        });
      }
    }
    consumedEventCountRef.current = events.length;
  }, [props.events]);

  // Animation loop + canvas sizing. Mounts once, cleans up on unmount.
  useEffect(() => {
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
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = (): void => {
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      // Background.
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, w, h);
      // Subtle grid for pixel feel.
      ctx.strokeStyle = '#161616';
      ctx.lineWidth = 1;
      const step = 16;
      for (let x = 0; x < w; x += step) {
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += step) {
        ctx.beginPath();
        ctx.moveTo(0, y + 0.5);
        ctx.lineTo(w, y + 0.5);
        ctx.stroke();
      }

      const now = performance.now();
      const survivors: FlyingSpell[] = [];
      for (const f of flyingRef.current) {
        const age = now - f.spawnTime;
        if (age > TOTAL_MS) continue;
        survivors.push(f);

        const travelT = Math.min(1, age / TRAVEL_MS);
        const fadeT =
          age <= TRAVEL_MS ? 1 : 1 - (age - TRAVEL_MS) / FADE_MS;
        const x = 20 + travelT * (w - 120);
        const y = f.laneY * h;

        ctx.globalAlpha = Math.max(0, fadeT);
        ctx.fillStyle = COLOR_BY_KIND[f.kind];
        ctx.fillRect(x, y - 12, 90, 24);
        ctx.fillStyle = '#0a0a0a';
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.text.slice(0, 10), x + 6, y);
        ctx.globalAlpha = 1;
      }
      flyingRef.current = survivors;

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener('resize', resize);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Encounter canvas"
      className="block h-64 w-full rounded border border-zinc-700 bg-zinc-950"
      style={{ imageRendering: 'pixelated' }}
    />
  );
}
