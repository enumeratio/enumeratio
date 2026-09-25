import { abs, add, cexp, clog, cpow, cx, type Cx, div, mul, scale, sub } from "./complex.ts";

// Φ(z, s, a) past |z| = 1, where the series stops converging, by the Hermite-type integral
// representation valid for Re(a) > 0 (the one mpmath documents):
//
//   Φ(z, s, a) = 1/(2aˢ) + ∫₀^∞ zᵗ (a+t)^(−s) dt
//                − 2 ∫₀^∞ sin(t·log z − s·arctan(t/a)) / ((a²+t²)^(s/2) (e^{2πt} − 1)) dt.
//
// The first integral is closed: z^(−a) (−log z)^(s−1) Γ(1−s, −a·log z), and it is the upper
// incomplete gamma's continuation that carries Φ past the unit circle. The second converges
// for every z off the cut, since |sin(t·log z)| grows at most like e^{πt} against e^{2πt}.
// Other a are brought to Re(a) ≥ 1 by the recurrence Φ(z, s, a) = a^(−s) + z·Φ(z, s, a+1),
// dropping a (a+k) = 0 term as the series does.

/** 20-point Gauss–Legendre nodes and weights on [−1, 1], by Newton on P₂₀. */
const GAUSS: { x: number[]; w: number[] } = (() => {
  const n = 20;
  const x: number[] = [];
  const w: number[] = [];
  for (let i = 1; i <= n; i++) {
    let t = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5));
    let dp = 0;
    for (let iter = 0; iter < 100; iter++) {
      let p0 = 1;
      let p1 = t;
      for (let k = 2; k <= n; k++) {
        const p2 = ((2 * k - 1) * t * p1 - (k - 1) * p0) / k;
        p0 = p1;
        p1 = p2;
      }
      dp = (n * (t * p1 - p0)) / (t * t - 1);
      const step = p1 / dp;
      t -= step;
      if (Math.abs(step) < 1e-16) break;
    }
    x.push(t);
    w.push(2 / ((1 - t * t) * dp * dp));
  }
  return { x, w };
})();

const csin = (z: Cx): Cx => cx(Math.sin(z.re) * Math.cosh(z.im), Math.cos(z.re) * Math.sinh(z.im));
/** arctan(z) = (i/2)·(log(1 − iz) − log(1 + iz)). */
const catan = (z: Cx): Cx => {
  const iz = cx(-z.im, z.re);
  const d = sub(clog(sub(cx(1), iz)), clog(add(cx(1), iz)));
  return cx(-d.im / 2, d.re / 2);
};

/** Where the Hermite integrand is below double precision: its decay is at worst e^{−πt}. */
const T_MAX = 40;
const PANELS = 80;

/** −2 ∫₀^∞ sin(tL − s·arctan(t/a)) / ((a²+t²)^(s/2) (e^{2πt} − 1)) dt, L = log z. */
function hermiteTail(L: Cx, s: Cx, a: Cx): Cx {
  const halfS = scale(s, 0.5);
  const a2 = mul(a, a);
  let sum = cx(0);
  const h = T_MAX / PANELS;
  for (let p = 0; p < PANELS; p++) {
    for (let i = 0; i < GAUSS.x.length; i++) {
      const t = h * (p + 0.5 + 0.5 * (GAUSS.x[i] as number));
      const phase = sub(scale(L, t), mul(s, catan(div(cx(t), a))));
      const denom = scale(cpow(add(a2, cx(t * t)), halfS), Math.expm1(2 * Math.PI * t));
      sum = add(sum, scale(div(csin(phase), denom), 0.5 * h * (GAUSS.w[i] as number)));
    }
  }
  return scale(sum, -2);
}

/**
 * Φ(z, s, a) for |z| > 1 (and anywhere the representation holds), given the upper incomplete
 * gamma Γ(σ, x) for complex σ, x — compute-engine's, which matches Wolfram. Undefined when
 * that declines or the result isn't finite.
 */
export function lerchContinued(z: Cx, s: Cx, a: Cx, upperGamma: (sigma: Cx, x: Cx) => Cx | undefined): Cx | undefined {
  // Shift a to Re(a) ≥ 1: Φ(a) = Σ_{k<m} zᵏ (a+k)^(−s) + zᵐ Φ(a+m).
  let head = cx(0);
  let zk = cx(1);
  let b = a;
  const negS = scale(s, -1);
  while (b.re < 1) {
    if (!(b.re === 0 && b.im === 0)) head = add(head, mul(zk, cpow(b, negS)));
    zk = mul(zk, z);
    b = add(b, cx(1));
  }
  const L = clog(z);
  // On the cut (real z > 1) Φ takes the side below it, z − i0, as mpmath and Wolfram do:
  // −log z must sit on the upper lip (+0i), where compute-engine's Γ(σ, x) has its x < 0.
  // Negating a real log would give −0i and put the power on the other side of its cut.
  const negL = z.im === 0 && z.re > 1 ? cx(-L.re, 0) : scale(L, -1);
  const x = mul(negL, b);
  // compute-engine's Γ(σ, x) loses digits near the negative real axis once |x| passes ~20
  // (Γ(−9, −23.03) misses its imaginary part π/9! entirely); don't build on it there.
  if (x.re < -15 && Math.abs(x.im) < 0.25 * -x.re) return undefined;
  const gamma = upperGamma(sub(cx(1), s), x);
  if (gamma === undefined) return undefined;
  const closed = mul(mul(cexp(mul(negL, b)), cpow(negL, sub(s, cx(1)))), gamma);
  const terms = [div(cx(0.5), cpow(b, s)), closed, hermiteTail(L, s, b)];
  const phi = terms.reduce(add, cx(0));
  const out = add(head, mul(zk, phi));
  // The terms can cancel far below double precision (Φ(10, 10, 10) ≈ 4e−11 from terms of
  // order 1): when the digits lost exceed what we can vouch for, say nothing.
  const size = Math.max(abs(head), abs(zk) * Math.max(...terms.map(abs)));
  const lost = (1e-15 * size) / abs(out);
  if (!Number.isFinite(out.re) || !Number.isFinite(out.im) || !(lost < 1e-10)) return undefined;
  return out;
}
