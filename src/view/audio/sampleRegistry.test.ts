import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  __resetSampleRegistryForTests,
  getSample,
  loadAllSamples,
} from './sampleRegistry';

type FakeBuffer = { duration: number; name: string };

class FakeCtx {
  public decodeCalls = 0;
  decodeAudioData(buf: ArrayBuffer): Promise<AudioBuffer> {
    this.decodeCalls += 1;
    const fake: FakeBuffer = { duration: 0.1, name: `decoded-${buf.byteLength}` };
    return Promise.resolve(fake as unknown as AudioBuffer);
  }
}

beforeEach(() => {
  __resetSampleRegistryForTests();
  // 8 distinct sizes so each decoded buffer is uniquely identifiable.
  let n = 0;
  const fetchMock = vi.fn(() => {
    n += 1;
    return Promise.resolve({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(n * 100)),
    } as Response);
  });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  __resetSampleRegistryForTests();
  vi.unstubAllGlobals();
});

describe('loadAllSamples', () => {
  it('loads and decodes all 8 samples', async () => {
    const ctx = new FakeCtx();
    await loadAllSamples(ctx as unknown as BaseAudioContext);
    expect(ctx.decodeCalls).toBe(8);
    // Spot-check that the buffers are accessible by name.
    expect(getSample('cast')).not.toBeNull();
    expect(getSample('victory')).not.toBeNull();
    expect(getSample('defeat')).not.toBeNull();
  });

  it('is idempotent — repeated calls reuse the same Promise', async () => {
    const ctx = new FakeCtx();
    const a = loadAllSamples(ctx as unknown as BaseAudioContext);
    const b = loadAllSamples(ctx as unknown as BaseAudioContext);
    expect(a).toBe(b);
    await a;
    expect(ctx.decodeCalls).toBe(8);
  });
});

describe('getSample', () => {
  it('returns null before load completes', () => {
    expect(getSample('cast')).toBeNull();
  });
});
