// Minimal complex arithmetic for the numeric special-function kernels. Just what
// Euler–Maclaurin needs: the field ops plus a principal-branch power. A real,
// positive base with a real exponent takes the plain Math.pow fast path so real
// inputs stay free of imaginary rounding noise.

export interface Cx {
  re: number;
  im: number;
}

export const cx = (re: number, im = 0): Cx => ({ re, im });

export const add = (x: Cx, y: Cx): Cx => ({ re: x.re + y.re, im: x.im + y.im });
export const sub = (x: Cx, y: Cx): Cx => ({ re: x.re - y.re, im: x.im - y.im });

export const mul = (x: Cx, y: Cx): Cx => ({
  re: x.re * y.re - x.im * y.im,
  im: x.re * y.im + x.im * y.re,
});

export const div = (x: Cx, y: Cx): Cx => {
  const d = y.re * y.re + y.im * y.im;
  return { re: (x.re * y.re + x.im * y.im) / d, im: (x.im * y.re - x.re * y.im) / d };
};

export const scale = (x: Cx, k: number): Cx => ({ re: x.re * k, im: x.im * k });

export const abs = (x: Cx): number => Math.hypot(x.re, x.im);

export const isReal = (x: Cx, eps = 0): boolean => Math.abs(x.im) <= eps;

/** Principal-branch complex logarithm: ln|z| + i·arg z, branch cut on (-∞, 0]. */
// #113: LogGamma(10^300) — `Math.hypot`, not `sqrt(re² + im²)` by hand, since squaring
// either component first overflows a double (and 1e300² does, long before ln|z| itself,
// ~690, needs to) whenever |z| is bigger than about 1e154.
export const clog = (z: Cx): Cx => ({
  re: Math.log(Math.hypot(z.re, z.im)),
  im: Math.atan2(z.im, z.re),
});

/** Complex exponential. */
export const cexp = (z: Cx): Cx => {
  const r = Math.exp(z.re);
  return { re: r * Math.cos(z.im), im: r * Math.sin(z.im) };
};

/**
 * Principal-branch power z^w. Positive real base with real exponent uses
 * Math.pow directly; everything else goes through exp(w·log z).
 */
export const cpow = (z: Cx, w: Cx): Cx => {
  if (z.im === 0 && z.re > 0 && w.im === 0) return { re: Math.pow(z.re, w.re), im: 0 };
  return cexp(mul(w, clog(z)));
};

// #loggamma reflection: two-stage reduction, not `((x % 2) + 2) % 2` or a plain
// `x - 2·⌊x/2⌋`. The naive `%2` form adds 2 before reducing back down, and for x within
// a ulp of an even integer that round-trip corrupts the low bits it's trying to preserve
// (e.g. x = 1e-6 came back as 1.0000000001397…e-6, a relative error of ~1e-10). Reducing
// straight to [0, 2) has the same problem one integer over: x just below an odd integer
// (e.g. x = 1 − 1e-6) lands at r ≈ 1, and Math.sin/cos(π·r) then loses precision the same
// way, because it's evaluating near π·(an integer or half-integer) rather than near 0.
//
// Fixed in two steps. First, `x − 2·round(x/2)` lands in [−1, 1] exactly (Sterbenz's lemma:
// `2·round(x/2)` is always within a factor of 2 of x). Second, sin/cos each fold that further
// so the actual `Math.sin`/`Math.cos` call only ever sees an argument of magnitude ≤ π/4 —
// as close to 0, where these are best conditioned, as the identities allow — via the
// reflection identities (sin(π−x) = sin(x), cos(π−x) = −cos(x), cos(π/2−x) = sin(x)), each
// applied to a value close enough to its source for the subtraction to stay exact.

function reduceMod2(x: number): number {
  return x - 2 * Math.round(x / 2); // [-1, 1], exact
}

/** cos(πx), exact (0 or ±1) at multiples of ½ — where Math.cos(Math.PI·x) is off by ~1e−16. */
export function cosPi(x: number): number {
  const r = reduceMod2(x);
  if (r === 0.5 || r === -0.5) return 0;
  if (r === 0) return 1;
  if (r === 1 || r === -1) return -1;
  const a = Math.abs(r);
  if (a <= 0.25) return Math.cos(Math.PI * a);
  if (a <= 0.75) return Math.sin(Math.PI * (0.5 - a));
  return -Math.cos(Math.PI * (1 - a));
}

/** sin(πx), exact (0 or ±1) at multiples of ½. */
export function sinPi(x: number): number {
  const r = reduceMod2(x);
  if (r === 0 || r === 1 || r === -1) return 0;
  if (r === 0.5) return 1;
  if (r === -0.5) return -1;
  const rr = r > 0.5 ? 1 - r : r < -0.5 ? -1 - r : r; // |rr| <= 0.5, exact
  return Math.sin(Math.PI * rr);
}

/** cos(x+iy) = cos x·cosh y − i·sin x·sinh y. */
export const ccos = (z: Cx): Cx => ({
  re: Math.cos(z.re) * Math.cosh(z.im),
  im: -Math.sin(z.re) * Math.sinh(z.im),
});

/** sin(x+iy) = sin x·cosh y + i·cos x·sinh y. */
export const csin = (z: Cx): Cx => ({
  re: Math.sin(z.re) * Math.cosh(z.im),
  im: Math.cos(z.re) * Math.sinh(z.im),
});

/** cosh(x+iy) = cosh x·cos y + i·sinh x·sin y. */
export const ccosh = (z: Cx): Cx => ({
  re: Math.cosh(z.re) * Math.cos(z.im),
  im: Math.sinh(z.re) * Math.sin(z.im),
});

/** sinh(x+iy) = sinh x·cos y + i·cosh x·sin y. */
export const csinh = (z: Cx): Cx => ({
  re: Math.sinh(z.re) * Math.cos(z.im),
  im: Math.cosh(z.re) * Math.sin(z.im),
});

export const ctanh = (z: Cx): Cx => div(csinh(z), ccosh(z));

/** 1/cosh(z), shared by JacobiCN/JacobiDN's m = 1 exact case (jacobi-elliptic.ts). */
export const csech = (z: Cx): Cx => div(cx(1), ccosh(z));

/**
 * Principal-branch square root, `cpow(z, ½)` — cut on the negative reals. `z = 0` is
 * special-cased: `cpow`'s `0 · (−∞)` inside `w·log(z)` would otherwise come back with a
 * NaN imaginary part (`0 * -Infinity` in IEEE 754), even though `sqrt(0) = 0` plainly.
 * Shared by carlson.ts and jacobi-elliptic.ts rather than each keeping its own copy.
 */
export const csqrt = (z: Cx): Cx => (z.re === 0 && z.im === 0 ? z : cpow(z, cx(0.5)));

/**
 * Principal-branch complex arcsine: asin(z) = −i·ln(iz + √(1−z²)) (Abramowitz & Stegun
 * 4.4.37, principal branches throughout). Used by jacobi-elliptic.ts's descending
 * Landen/AGM recursion (Abramowitz & Stegun 16.4), where `z` is a complex sine that stays
 * well inside the unit disc for every case that recursion is verified on, so the branch
 * cuts of `csqrt`/`clog` are never actually approached there.
 */
export const casin = (z: Cx): Cx => {
  const iz = cx(-z.im, z.re); // i·z
  const root = csqrt(sub(cx(1), mul(z, z)));
  return mul(cx(0, -1), clog(add(iz, root)));
};
