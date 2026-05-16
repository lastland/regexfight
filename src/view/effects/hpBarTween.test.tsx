import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HP_BAR_TWEEN_MS, HpBarTween } from './hpBarTween';

describe('HpBarTween', () => {
  it('renders the inner fill at the correct width for current/max', () => {
    render(<HpBarTween current={10} max={20} side="player" />);
    const fill = screen.getByTestId('hpbar-fill-player');
    expect(fill.style.width).toBe('50%');
  });

  it('clamps overflow values', () => {
    render(<HpBarTween current={30} max={20} side="enemy" />);
    const fill = screen.getByTestId('hpbar-fill-enemy');
    expect(fill.style.width).toBe('100%');
  });

  it('clamps negative current to 0', () => {
    render(<HpBarTween current={-5} max={20} side="player" />);
    const fill = screen.getByTestId('hpbar-fill-player');
    expect(fill.style.width).toBe('0%');
  });

  it('shows numeric `current / max` text', () => {
    render(<HpBarTween current={3} max={4} side="enemy" />);
    expect(screen.getByText('3 / 4')).toBeTruthy();
  });

  it('uses the fixed 250ms tween — does NOT scale with speed', () => {
    // The constant itself is the contract; the component reads from it.
    expect(HP_BAR_TWEEN_MS).toBe(250);
    render(<HpBarTween current={10} max={20} side="player" />);
    const fill = screen.getByTestId('hpbar-fill-player');
    expect(fill.style.transition).toContain('250ms');
  });
});
