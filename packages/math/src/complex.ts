// Gaussian-integer (ℤ[i]) arithmetic. No standalone arithmetic primitives exist in
// ~/Playground/ideas/numbers/src/complex.ts (its exports are collection windows, not bare add/mul); these mirror
// packages/data/sqlsrc/gaussian_integers.sql's gaussian_* functions directly — the pure ring arithmetic on the
// `gaussian_integer` composite type (re, im).

export interface GaussianInteger {
  re: number;
  im: number;
}

/** SQL twin: gaussian_add(a,b gaussian_integer) — gaussian_integers.sql. */
export function gaussian_add(a: GaussianInteger, b: GaussianInteger): GaussianInteger {
  return { re: a.re + b.re, im: a.im + b.im };
}

/** SQL twin: gaussian_neg(a gaussian_integer) — gaussian_integers.sql. */
export function gaussian_neg(a: GaussianInteger): GaussianInteger {
  return { re: -a.re, im: -a.im };
}

/** SQL twin: gaussian_sub(a,b gaussian_integer) — gaussian_integers.sql (defined as a + (-b) there too). */
export function gaussian_sub(a: GaussianInteger, b: GaussianInteger): GaussianInteger {
  return gaussian_add(a, gaussian_neg(b));
}

/** SQL twin: gaussian_mul(a,b gaussian_integer) — gaussian_integers.sql. (a+bi)(c+di) = (ac-bd) + (ad+bc)i. */
export function gaussian_mul(a: GaussianInteger, b: GaussianInteger): GaussianInteger {
  return { re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re };
}

/** SQL twin: gaussian_norm(g gaussian_integer) — gaussian_integers.sql. N(a+bi) = a²+b² (the Euclidean gauge). */
export function gaussian_norm(g: GaussianInteger): number {
  return g.re * g.re + g.im * g.im;
}
