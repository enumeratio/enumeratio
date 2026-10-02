import { GAUSS_LEGENDRE_20 } from "./gauss-legendre.ts";

/**
 * Quadrature for conditionally-convergent oscillatory semi-infinite integrals,
 * `∫ₐ^∞ f(x) dx` where `f` changes sign infinitely often (`∫₀^∞ sin x/x = π/2`).
 *
 * Longman's method: integrate `f` over each lobe (between consecutive zeros) with adaptive
 * Simpson, giving an alternating series `∑ Iₖ`, and accelerate its partial sums with
 * Wynn's ε-algorithm.
 *
 * When `f(a)` isn't finite (`sin x/x` at 0 is 0/0, `sin x/x^1.5` has a pole), the first
 * lobe is integrated by `endpointLobe`, which never evaluates `f(a)` and counts its own
 * error. Starting Simpson at `a + 1e-8` instead drops that sliver: `∫₀^∞ sin x/x` comes out
 * `π/2 − 1.0e-8`, forty times outside its own error bar.
 *
 * Returns `{ estimate, error }`; `null` when the integrand is not oscillatory, the budget
 * runs out, or the lobes fail to shrink at the end; `"irregular"` when they stall or grow
 * (`∫₀^∞ sin t·t^(3/4)` diverges, abandoned early) or shrink but not steadily, so the alternating
 * series the acceleration assumes isn't there
 * (`sin t·cos 3t/t`, whose lobes beat: the estimate settles 6e-6 off, its spread 7e-10).
 */
export function integrateSemiInfiniteOscillatory(
  f: (x: number) => number,
  a: number,
  check: () => void = () => {},
): { estimate: number; error: number } | null | "irregular" {
  const MAX_LOBES = 2000;

  // The scan for the first zero starts just past a singular `a`.
  const singular = !Number.isFinite(f(a));
  const start = singular ? a + Math.max(1e-8, Math.abs(a) * 1e-8) : a;
  if (!Number.isFinite(f(start))) return null;
  let firstError = 0;
  const withFirst = (r: { estimate: number; error: number }) => ({ estimate: r.estimate, error: r.error + firstError });

  const lobes: number[] = [];
  let cur = start;
  let prevWidth: number | undefined;

  for (let k = 0; k < MAX_LOBES; k++) {
    check();
    const z = nextSignChange(f, cur, prevWidth, check);
    if (z === null) {
      if (lobes.length < 3) return null;
      break;
    }
    if (k === 0 && singular) {
      const first = endpointLobe(f, a, z, check);
      if (first === null) return null;
      firstError = first.error;
      lobes.push(first.estimate);
    } else lobes.push(adaptiveSimpson(f, cur, z, 1e-12, check));
    prevWidth = z - cur;
    cur = z;

    // Give up on a divergent integral (`∫₀^∞ sin t·t^(3/4)`) once the lobes stop shrinking,
    // before its ever-larger lobes eat the budget. Declined like the beating ones.
    if (lobes.length >= 3 * WINDOW && lobes.length % WINDOW === 0 && !lobesShrinking(lobes)) return "irregular";

    // Only accept convergence once the lobes shrink, steadily: the ε-algorithm happily
    // sums a divergent alternating series (∫₀^∞ sin x → "1").
    if (lobes.length >= 6 && lobes.length % 2 === 0 && lobesDecaying(lobes) && lobesSteady(lobes)) {
      const conv = acceleratedEstimate(lobes);
      if (conv && conv.error < 1e-9 * (1 + Math.abs(conv.estimate))) return withFirst(conv);
    }
  }

  if (lobes.length < 6) return null;
  if (!lobesSteady(lobes)) return "irregular";
  if (!lobesDecaying(lobes)) return null;
  const final = acceleratedEstimate(lobes);
  if (!final || !Number.isFinite(final.estimate)) return null;
  if (final.error > 1e-4 * (1 + Math.abs(final.estimate))) return null;
  return withFirst(final);
}

/** Lobes per window of the divergence check. */
const WINDOW = 8;

/** Did the mean lobe magnitude fall, over either of the last two windows? A convergent
 * series' lobes shrink on average even when they beat; a divergent one's grow or stall. */
function lobesShrinking(lobes: readonly number[]): boolean {
  const mean = (end: number): number =>
    lobes.slice(end - WINDOW, end).reduce((sum, x) => sum + Math.abs(x), 0) / WINDOW;
  const [older, middle, latest] = [mean(lobes.length - 2 * WINDOW), mean(lobes.length - WINDOW), mean(lobes.length)];
  return !(middle > 0) || middle > latest || older > middle;
}

/** Lobes the steadiness test looks back over. */
const STEADY_LOBES = 8;

/** Do the last `STEADY_LOBES` lobes alternate in sign and shrink one after another? */
function lobesSteady(lobes: readonly number[]): boolean {
  const tail = lobes.slice(-STEADY_LOBES);
  for (let i = 1; i < tail.length; i++)
    if (Math.sign(tail[i]!) === Math.sign(tail[i - 1]!) || Math.abs(tail[i]!) > Math.abs(tail[i - 1]!)) return false;
  return true;
}

/** Relative tolerance per panel, and the bisection depth, of `endpointLobe`. */
const ENDPOINT_TOL = 1e-13;
const ENDPOINT_DEPTH = 50;

/**
 * `∫ₐᶻ f` for `f` singular at `a`, after `t = a + (z − a)s⁸`: `(t − a)^(−p)` becomes
 * `s^(7 − 8p)`, bounded for p ≤ 7/8 (`sin t/√t`, `cos t/t^0.8`) and milder past it
 * (`sin t/t^1.9`, like `t^(−0.9)`, becomes `s^(−0.2)`).
 * Adaptive 20-point Gauss–Legendre, whose nodes are interior, bisecting a panel where it
 * and its two halves disagree, so the panels crowd toward `a`; the error is the sum of the
 * disagreements, including those of the panels still unsettled at the depth cap.
 */
function endpointLobe(
  f: (x: number) => number,
  a: number,
  z: number,
  check: () => void,
): { estimate: number; error: number } | null {
  const w = z - a;
  const g = (s: number): number => {
    const s2 = s * s;
    const s4 = s2 * s2;
    // Within an ulp of a nonzero `a` the node rounds to `a` itself; what lies there is
    // below the ulp's own share of the integral.
    const t = a + w * s4 * s4;
    return t === a ? 0 : f(t) * 8 * w * s4 * s2 * s;
  };
  const rule = (lo: number, hi: number): number => {
    const [mid, half] = [(lo + hi) / 2, (hi - lo) / 2];
    let sum = 0;
    for (let i = 0; i < GAUSS_LEGENDRE_20.x.length; i++)
      sum += GAUSS_LEGENDRE_20.w[i]! * g(mid + half * GAUSS_LEGENDRE_20.x[i]!);
    return sum * half;
  };
  const whole = rule(0, 1);
  const bound = ENDPOINT_TOL * Math.max(Number.MIN_VALUE, Math.abs(whole));
  const panel = (lo: number, hi: number, value: number, depth: number): { estimate: number; error: number } | null => {
    if ((depth & 0x7) === 0) check();
    const mid = (lo + hi) / 2;
    const [left, right] = [rule(lo, mid), rule(mid, hi)];
    if (!Number.isFinite(left + right)) return null;
    const gap = Math.abs(left + right - value);
    if (gap <= bound || depth >= ENDPOINT_DEPTH) return { estimate: left + right, error: gap };
    const l = panel(lo, mid, left, depth + 1);
    const r = l && panel(mid, hi, right, depth + 1);
    return l && r && { estimate: l.estimate + r.estimate, error: l.error + r.error };
  };
  return Number.isFinite(whole) ? panel(0, 1, whole, 0) : null;
}

/** The next point past `x` where `f` changes sign, scanning in steps of a fraction of the
 * previous lobe's width (`hint`); `null` if none within budget. */
function nextSignChange(
  f: (x: number) => number,
  x: number,
  hint: number | undefined,
  check: () => void,
): number | null {
  let h = hint !== undefined ? hint / 16 : Math.max(1e-3, Math.abs(x) * 1e-3, 0.01);
  const maxScan = hint !== undefined ? hint * 6 : Infinity;
  let px = x;
  let pf = f(px);
  // After the first lobe `x` is a zero, where `f(x)`'s sign is noise: the first stepped
  // sample sets the lobe's sign.
  let refSign = 0;
  let scanned = 0;
  const MAX_STEPS = 200_000;
  for (let i = 0; i < MAX_STEPS; i++) {
    if ((i & 0x3ff) === 0) check();
    const nx = px + h;
    const nf = f(nx);
    if (!Number.isFinite(nf)) return null;
    const ns = Math.sign(nf);
    if (refSign === 0) refSign = ns;
    else if (ns !== 0 && ns !== refSign) return bisectZero(f, px, pf, nx);
    px = nx;
    pf = nf;
    scanned += h;
    if (scanned > maxScan) return null;
    if (hint === undefined) h *= 1.25;
  }
  return null;
}

/** Bisect a sign-change bracket [xa, xb] to a zero. */
function bisectZero(f: (x: number) => number, xa: number, fa: number, xb: number): number {
  for (let i = 0; i < 80; i++) {
    if (xb - xa <= 1e-14 * (1 + Math.abs(xa))) break;
    const xm = 0.5 * (xa + xb);
    const fm = f(xm);
    if (fm === 0 || !Number.isFinite(fm)) return xm;
    if (Math.sign(fm) === Math.sign(fa)) {
      xa = xm;
      fa = fm;
    } else xb = xm;
  }
  return 0.5 * (xa + xb);
}

function adaptiveSimpson(f: (x: number) => number, a: number, b: number, tol: number, check: () => void): number {
  const [fa, fb, fm] = [f(a), f(b), f(0.5 * (a + b))];
  const whole = ((b - a) / 6) * (fa + 4 * fm + fb);
  return simpson(f, a, b, fa, fm, fb, whole, tol, 24, check);
}

function simpson(
  f: (x: number) => number,
  a: number,
  b: number,
  fa: number,
  fm: number,
  fb: number,
  whole: number,
  tol: number,
  depth: number,
  check: () => void,
): number {
  const m = 0.5 * (a + b);
  const [flm, frm] = [f(0.5 * (a + m)), f(0.5 * (m + b))];
  const left = ((m - a) / 6) * (fa + 4 * flm + fm);
  const right = ((b - m) / 6) * (fm + 4 * frm + fb);
  const delta = left + right - whole;
  if (depth <= 0 || Math.abs(delta) <= 15 * tol) return left + right + delta / 15;
  if ((depth & 0x7) === 0) check();
  return (
    simpson(f, a, m, fa, flm, fm, left, tol / 2, depth - 1, check) +
    simpson(f, m, b, fm, frm, fb, right, tol / 2, depth - 1, check)
  );
}

/** Earlier accelerated estimates the error is measured against. */
const SPREAD = 4;

/** Partial sums of the lobe integrals, accelerated; the error is the widest spread from the
 * estimates over the last `SPREAD` shorter prefixes. The last two alone agree to 1e-9 on
 * `sin(t/2)cos(3t/2)/t`, whose beating lobes leave the estimate 2e-5 off. */
function acceleratedEstimate(lobes: readonly number[]): { estimate: number; error: number } | null {
  const s: number[] = [];
  let acc = 0;
  for (const v of lobes) s.push((acc += v));
  const est = epsilonAlgorithm(s);
  if (est === null) return null;
  let error = 0;
  for (let k = 1; k <= SPREAD && s.length - k >= 3; k++) {
    const earlier = epsilonAlgorithm(s.slice(0, -k));
    error = Math.max(error, earlier === null ? Infinity : Math.abs(est - earlier));
  }
  if (error === 0) error = Math.abs(s[s.length - 1]! - s[s.length - 2]!);
  return { estimate: est, error };
}

/** Wynn's ε-algorithm: the highest even-order extrapolated limit of the partial sums. */
function epsilonAlgorithm(s: readonly number[]): number | null {
  const n = s.length;
  if (n < 3) return n > 0 ? s[n - 1]! : null;
  let prev: number[] = new Array(n).fill(0);
  let curr: number[] = s.slice();
  let best = curr[n - 1]!;
  for (let col = 1; col < n; col++) {
    const next: number[] = new Array(n - col);
    for (let i = 0; i < n - col; i++) {
      const denom = curr[i + 1]! - curr[i]!;
      next[i] = prev[i + 1]! + (denom === 0 ? 1e30 : 1 / denom);
    }
    if (col % 2 === 0 && next.length > 0) {
      const cand = next[next.length - 1]!;
      if (Number.isFinite(cand)) best = cand;
    }
    prev = curr;
    curr = next;
    if (curr.length === 0) break;
  }
  return Number.isFinite(best) ? best : null;
}

/** Are the recent lobe magnitudes trending down? */
function lobesDecaying(lobes: readonly number[]): boolean {
  const n = lobes.length;
  if (n < 6) return false;
  const tail = lobes.slice(Math.max(0, n - 10)).map(Math.abs);
  const avg = (a: readonly number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  return avg(tail.slice(tail.length >> 1)) < 0.95 * avg(tail.slice(0, tail.length >> 1));
}
