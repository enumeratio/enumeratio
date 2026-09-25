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

/** cos(πx), exact (0 or ±1) at multiples of ½ — where Math.cos(Math.PI·x) is off by ~1e−16. */
export function cosPi(x: number): number {
  const r = ((x % 2) + 2) % 2; // [0, 2)
  if (r === 0) return 1;
  if (r === 0.5 || r === 1.5) return 0;
  if (r === 1) return -1;
  return Math.cos(Math.PI * r);
}

/** sin(πx), exact (0 or ±1) at multiples of ½. */
export function sinPi(x: number): number {
  const r = ((x % 2) + 2) % 2;
  if (r === 0 || r === 1) return 0;
  if (r === 0.5) return 1;
  if (r === 1.5) return -1;
  return Math.sin(Math.PI * r);
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
