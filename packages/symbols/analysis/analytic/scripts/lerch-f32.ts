// An f32 emulation of the shader's `lerchPhi` / `lerchPhiReal` (src/shader.ts), for measuring
// LERCH_REAL_TOL (scripts/lerch-real-tol.ts) and pinning it in tests. The shader is the source
// of truth and the CPU kernel is f64, so this ports the shader line by line with `Math.fround`
// after every operation. Transcendentals are `fround` of the f64 result (correctly rounded) plus,
// optionally, a deterministic jitter of a few ulps, since GPUs do not round them correctly.

export type C = [number, number];
const f = Math.fround;

const buf = new Float32Array(1);
const bits = new Uint32Array(buf.buffer);

/** A deterministic jitter of up to ±`ulps` ulps on a transcendental's result. */
export function makeJitter(ulps: number, seed = 1): (v: number) => number {
  if (ulps === 0) return (v) => v;
  let t = seed >>> 0;
  return (v) => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    const k = Math.floor((((r ^ (r >>> 14)) >>> 0) / 4294967296) * (2 * ulps + 1)) - ulps;
    if (k === 0 || !Number.isFinite(v) || v === 0) return v;
    buf[0] = v;
    bits[0] = (bits[0]! + k) >>> 0; // sign-magnitude: k ulps of magnitude
    return buf[0]!;
  };
}

/** `lerchPhi` of the shader, in f32. */
export function lerchPhiF32(z: C, s: C, a: C, jitter: (v: number) => number = (v) => v): C {
  const tr = (g: (x: number) => number) => (x: number) => jitter(f(g(x)));
  const exp = tr(Math.exp);
  const cos = tr(Math.cos);
  const sin = tr(Math.sin);
  const log = tr(Math.log);
  const atan2 = (y: number, x: number) => jitter(f(Math.atan2(y, x)));
  const cmul = (p: C, q: C): C => [f(f(p[0] * q[0]) - f(p[1] * q[1])), f(f(p[0] * q[1]) + f(p[1] * q[0]))];
  const cexp = (w: C): C => {
    const e = exp(w[0]);
    return [f(e * cos(w[1])), f(e * sin(w[1]))];
  };
  const dot = (w: C) => f(f(w[0] * w[0]) + f(w[1] * w[1]));
  const clog = (w: C): C => [f(0.5 * log(dot(w))), atan2(w[1], w[0])];
  const cpow = (w: C, e: C): C => cexp(cmul(e, clog(w)));

  const negS: C = [-s[0], -s[1]];
  let sum: C = [0, 0];
  let zp: C = [1, 0];
  for (let n = 0; n < 4096; n++) {
    const base: C = [f(a[0] + f(n)), a[1]];
    if (!(base[0] === 0 && base[1] === 0)) {
      const t = cmul(zp, cpow(base, negS));
      sum = [f(sum[0] + t[0]), f(sum[1] + t[1])];
    }
    zp = cmul(zp, z);
    if (dot(zp) < f(1e-30)) break;
  }
  return sum;
}

/** `lerchPhiReal` of the shader, in f32: NaN where |Im| > tol * |Re|. */
export function lerchPhiRealF32(z: number, s: number, a: number, tol: number, jitter?: (v: number) => number): number {
  const w = lerchPhiF32([f(z), 0], [f(s), 0], [f(a), 0], jitter);
  return Math.abs(w[1]) > f(tol) * Math.abs(w[0]) ? NaN : w[0];
}
