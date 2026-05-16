/**
 * Minimal CanvasRenderingContext2D polyfill for tests.
 *
 * jsdom does not implement Canvas 2D out of the box, and we can't pull
 * in the native `canvas` npm package (no new deps). This polyfill backs
 * each HTMLCanvasElement with a Uint8ClampedArray of RGBA bytes and
 * supports just enough of the 2D API for the sprite system:
 *
 *   - fillStyle = CSS colour string (parsed for #rgb / #rrggbb only)
 *   - fillRect(x, y, w, h)
 *   - drawImage(source, dx, dy)             — same-canvas-size compatible
 *   - drawImage(source, dx, dy, dw, dh)     — no scaling support
 *   - getImageData(x, y, w, h)
 *   - imageSmoothingEnabled  (no-op)
 *   - setTransform           (no-op — sprites draw at 1:1)
 *
 * Anything else throws — better a loud "polyfill missing X" in CI than
 * silent visual drift.
 *
 * Install via:
 *   import { installCanvasPolyfill } from './test-canvas-polyfill';
 *   installCanvasPolyfill();
 *
 * Idempotent: subsequent calls are no-ops.
 */

let installed = false;

type Ctx = {
  __canvas: HTMLCanvasElement;
  __pixels: Uint8ClampedArray;
  fillStyle: string;
  imageSmoothingEnabled: boolean;
  fillRect(x: number, y: number, w: number, h: number): void;
  drawImage(
    src: HTMLCanvasElement,
    dx: number,
    dy: number,
    dw?: number,
    dh?: number,
  ): void;
  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray };
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
};

const ctxByCanvas = new WeakMap<HTMLCanvasElement, Ctx>();

function parseColor(css: string): [number, number, number, number] {
  if (css === 'transparent') return [0, 0, 0, 0];
  if (css.startsWith('#')) {
    if (css.length === 4) {
      const c1 = css[1] ?? '0';
      const c2 = css[2] ?? '0';
      const c3 = css[3] ?? '0';
      const r = parseInt(c1 + c1, 16);
      const g = parseInt(c2 + c2, 16);
      const b = parseInt(c3 + c3, 16);
      return [r, g, b, 255];
    }
    if (css.length === 7) {
      const r = parseInt(css.slice(1, 3), 16);
      const g = parseInt(css.slice(3, 5), 16);
      const b = parseInt(css.slice(5, 7), 16);
      return [r, g, b, 255];
    }
  }
  throw new Error(`test-canvas-polyfill: unsupported colour '${css}'`);
}

function makeCtx(canvas: HTMLCanvasElement): Ctx {
  const w = canvas.width;
  const h = canvas.height;
  const pixels = new Uint8ClampedArray(w * h * 4);
  const ctx: Ctx = {
    __canvas: canvas,
    __pixels: pixels,
    fillStyle: '#000000',
    imageSmoothingEnabled: true,
    fillRect(x, y, fw, fh): void {
      const [r, g, b, a] = parseColor(this.fillStyle);
      const cw = this.__canvas.width;
      const ch = this.__canvas.height;
      const x0 = Math.max(0, Math.floor(x));
      const y0 = Math.max(0, Math.floor(y));
      const x1 = Math.min(cw, Math.floor(x + fw));
      const y1 = Math.min(ch, Math.floor(y + fh));
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * cw + xx) * 4;
          this.__pixels[i] = r;
          this.__pixels[i + 1] = g;
          this.__pixels[i + 2] = b;
          this.__pixels[i + 3] = a;
        }
      }
    },
    drawImage(src, dx, dy, dw, dh): void {
      const srcCtx = ctxByCanvas.get(src);
      if (srcCtx === undefined) {
        throw new Error(
          'test-canvas-polyfill: drawImage source has no 2D context',
        );
      }
      const sw = src.width;
      const sh = src.height;
      const targetW = dw ?? sw;
      const targetH = dh ?? sh;
      if (targetW !== sw || targetH !== sh) {
        throw new Error(
          'test-canvas-polyfill: drawImage scaling is not supported',
        );
      }
      const dstW = this.__canvas.width;
      const dstH = this.__canvas.height;
      const dx0 = Math.floor(dx);
      const dy0 = Math.floor(dy);
      for (let yy = 0; yy < sh; yy++) {
        for (let xx = 0; xx < sw; xx++) {
          const sx = xx;
          const sy = yy;
          const tx = dx0 + xx;
          const ty = dy0 + yy;
          if (tx < 0 || ty < 0 || tx >= dstW || ty >= dstH) continue;
          const si = (sy * sw + sx) * 4;
          const ti = (ty * dstW + tx) * 4;
          const sa = srcCtx.__pixels[si + 3] ?? 0;
          if (sa === 0) continue;
          // Source-over compositing assuming opaque source pixels.
          // Sprite pixels are either fully opaque or fully transparent, so
          // we just overwrite.
          this.__pixels[ti] = srcCtx.__pixels[si] ?? 0;
          this.__pixels[ti + 1] = srcCtx.__pixels[si + 1] ?? 0;
          this.__pixels[ti + 2] = srcCtx.__pixels[si + 2] ?? 0;
          this.__pixels[ti + 3] = sa;
        }
      }
    },
    getImageData(x, y, gw, gh) {
      const cw = this.__canvas.width;
      const out = new Uint8ClampedArray(gw * gh * 4);
      for (let yy = 0; yy < gh; yy++) {
        for (let xx = 0; xx < gw; xx++) {
          const sx = x + xx;
          const sy = y + yy;
          const si = (sy * cw + sx) * 4;
          const ti = (yy * gw + xx) * 4;
          out[ti] = this.__pixels[si] ?? 0;
          out[ti + 1] = this.__pixels[si + 1] ?? 0;
          out[ti + 2] = this.__pixels[si + 2] ?? 0;
          out[ti + 3] = this.__pixels[si + 3] ?? 0;
        }
      }
      return { data: out };
    },
    setTransform(): void {
      /* no-op; sprites are drawn at 1:1 in tests */
    },
  };
  return ctx;
}

export function installCanvasPolyfill(): void {
  if (installed) return;
  installed = true;
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (kind: string) => unknown;
  };
  proto.getContext = function (this: HTMLCanvasElement, kind: string): unknown {
    if (kind !== '2d') return null;
    let ctx = ctxByCanvas.get(this);
    if (ctx === undefined) {
      ctx = makeCtx(this);
      ctxByCanvas.set(this, ctx);
    }
    return ctx;
  };
}
