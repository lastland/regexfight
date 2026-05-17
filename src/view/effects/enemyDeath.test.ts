import { describe, expect, it } from 'vitest';
import {
  ENEMY_DEATH_DURATION_MS,
  drawEnemyDeathSilhouette,
  enemyDeathFrame,
} from './enemyDeath';

describe('enemyDeathFrame', () => {
  it('is fully visible (no silhouette) before the start time', () => {
    const f = enemyDeathFrame(100, 50, 1);
    expect(f.spriteAlpha).toBe(1);
    expect(f.silhouetteAlpha).toBe(0);
    expect(f.alive).toBe(true);
  });

  it('is dead (zero sprite, zero silhouette) past the duration', () => {
    const f = enemyDeathFrame(0, ENEMY_DEATH_DURATION_MS + 1, 1);
    expect(f.spriteAlpha).toBe(0);
    expect(f.silhouetteAlpha).toBe(0);
    expect(f.alive).toBe(false);
  });

  it('ramps silhouette in during the flash-in phase (sprite stays full)', () => {
    // Pick a time inside flash-in (t = 0.1, between 0 and 0.2).
    const t = 0.1;
    const f = enemyDeathFrame(0, ENEMY_DEATH_DURATION_MS * t, 1);
    expect(f.spriteAlpha).toBe(1);
    expect(f.silhouetteAlpha).toBeGreaterThan(0);
    expect(f.silhouetteAlpha).toBeLessThan(1);
    expect(f.alive).toBe(true);
  });

  it('holds full silhouette at the peak', () => {
    // t = 0.3 — between 0.2 (flash-in end) and 0.4 (peak end).
    const f = enemyDeathFrame(0, ENEMY_DEATH_DURATION_MS * 0.3, 1);
    expect(f.spriteAlpha).toBe(1);
    expect(f.silhouetteAlpha).toBe(1);
  });

  it('fades sprite and silhouette together after the peak', () => {
    // t = 0.7 — well into the fade-out.
    const f = enemyDeathFrame(0, ENEMY_DEATH_DURATION_MS * 0.7, 1);
    expect(f.spriteAlpha).toBeGreaterThan(0);
    expect(f.spriteAlpha).toBeLessThan(1);
    expect(f.silhouetteAlpha).toBe(f.spriteAlpha);
  });

  it('duration scales with speed', () => {
    // At 5×, the animation finishes at ENEMY_DEATH_DURATION_MS / 5.
    const dur5x = ENEMY_DEATH_DURATION_MS / 5;
    const aliveMid = enemyDeathFrame(0, dur5x - 10, 5);
    const deadPast = enemyDeathFrame(0, dur5x + 10, 5);
    expect(aliveMid.alive).toBe(true);
    expect(deadPast.alive).toBe(false);
  });
});

describe('drawEnemyDeathSilhouette', () => {
  it('does nothing when silhouetteAlpha is 0', () => {
    let fillCalls = 0;
    const stub = {
      globalAlpha: 1,
      fillStyle: '',
      fillRect: () => { fillCalls++; },
    } as unknown as CanvasRenderingContext2D;
    drawEnemyDeathSilhouette(stub, { x: 0, y: 0, w: 10, h: 10 }, {
      spriteAlpha: 1,
      silhouetteAlpha: 0,
      alive: true,
    });
    expect(fillCalls).toBe(0);
  });

  it('fills the rect when silhouetteAlpha > 0', () => {
    let fillCalls = 0;
    const stub = {
      globalAlpha: 1,
      fillStyle: '',
      fillRect: () => { fillCalls++; },
    } as unknown as CanvasRenderingContext2D;
    drawEnemyDeathSilhouette(stub, { x: 0, y: 0, w: 10, h: 10 }, {
      spriteAlpha: 1,
      silhouetteAlpha: 0.5,
      alive: true,
    });
    expect(fillCalls).toBe(1);
  });
});
