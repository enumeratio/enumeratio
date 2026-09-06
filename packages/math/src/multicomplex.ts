// Multicomplex ring ℂn(ℤ/Mℤ) arithmetic. Mirrors packages/data/sqlsrc/multicomplex_numbers.sql's multicomplex_* functions,
// which are themselves a direct SQL port of ~/Playground/ideas/numbers/src/multicomplex.ts (see that file's own
// header for the math: 2ⁿ basis units j_m indexed by bitmasks, multiplication = XOR-convolution with a
// Thue–Morse overlap sign j_a·j_b = (−1)^popcount(a∧b)·j_(a⊻b)).

export interface Multicomplex {
  coeffs: number[]; // LSB-first: coeffs[0] = the scalar a0, coeffs[k] = the coefficient of j_k
  modulus: number;
}

const mod = (x: number, m: number): number => ((x % m) + m) % m;

/** Popcount of a non-negative bitmask (matches SQL multicomplex_popcount's 0..30-bit scan). */
export function multicomplex_popcount(x: number): number {
  let c = 0;
  for (let b = 0; b <= 30; b++) if ((x >> b) & 1) c++;
  return c;
}

/** SQL twin: multicomplex_add(a,b multicomplex) — multicomplex_numbers.sql. Requires matching modulus + dimension. */
export function multicomplex_add(a: Multicomplex, b: Multicomplex): Multicomplex {
  if (a.modulus !== b.modulus || a.coeffs.length !== b.coeffs.length) {
    throw new Error("multicomplex_add: operands must share modulus and dimension");
  }
  return { coeffs: a.coeffs.map((c, i) => mod(c + b.coeffs[i], a.modulus)), modulus: a.modulus };
}

/** SQL twin: multicomplex_neg(a multicomplex) — multicomplex_numbers.sql. */
export function multicomplex_neg(a: Multicomplex): Multicomplex {
  return { coeffs: a.coeffs.map((c) => mod(-c, a.modulus)), modulus: a.modulus };
}

/** SQL twin: multicomplex_sub(a,b multicomplex) — multicomplex_numbers.sql (defined as a + (-b) there too). */
export function multicomplex_sub(a: Multicomplex, b: Multicomplex): Multicomplex {
  return multicomplex_add(a, multicomplex_neg(b));
}

/**
 * SQL twin: multicomplex_mul(a,b multicomplex) — multicomplex_numbers.sql. XOR-convolution with Thue–Morse overlap signs:
 * out[i⊻j] += (−1)^popcount(i∧j) · a[i] · b[j]  (mod M).
 */
export function multicomplex_mul(a: Multicomplex, b: Multicomplex): Multicomplex {
  if (a.modulus !== b.modulus || a.coeffs.length !== b.coeffs.length) {
    throw new Error("multicomplex_mul: operands must share modulus and dimension");
  }
  const n = a.coeffs.length;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = i ^ j;
      const sign = multicomplex_popcount(i & j) % 2 === 0 ? 1 : -1;
      out[k] += sign * a.coeffs[i] * b.coeffs[j];
    }
  }
  return { coeffs: out.map((c) => mod(c, a.modulus)), modulus: a.modulus };
}

/** SQL twin: multicomplex_conj(a multicomplex) — multicomplex_numbers.sql. Flips every unit (odious-indexed coeffs negate). */
export function multicomplex_conj(a: Multicomplex): Multicomplex {
  return {
    coeffs: a.coeffs.map((c, i) => (multicomplex_popcount(i) % 2 === 0 ? c : mod(-c, a.modulus))),
    modulus: a.modulus,
  };
}

/**
 * SQL twin: multicomplex_norm(z multicomplex) — multicomplex_numbers.sql. The ALGEBRA norm: det of the
 * multiplication-by-z map on ℂn(ℤ/M) as a free rank-2ⁿ module. Computed through the tower
 * ℂn = ℂ(n−1)[i_n]/(i_n²+1): the coefficient array splits at the halfway mark into z = u + i_n·v, and
 * N(z) = N_{ℂ(n−1)}(u² + v²), bottoming out at N(a) = a in ℂ0 = ℤ/M. Not z·conj(z) — the signature is mixed
 * (j_m² = (−1)^popcount(m)), so that product keeps a j3 part for n ≥ 2. Returns null on a non-2ⁿ dimension.
 */
export function multicomplex_norm(z: Multicomplex): number | null {
  const n = z.coeffs.length;
  if (n < 1 || (n & (n - 1)) !== 0 || z.modulus < 1) return null;
  if (n === 1) return mod(z.coeffs[0], z.modulus);
  const h = n / 2;
  const u: Multicomplex = { coeffs: z.coeffs.slice(0, h), modulus: z.modulus };
  const v: Multicomplex = { coeffs: z.coeffs.slice(h), modulus: z.modulus };
  return multicomplex_norm(multicomplex_add(multicomplex_mul(u, u), multicomplex_mul(v, v)));
}

/** SQL twin: multicomplex_invmod(a, m) — extended Euclid, null when gcd(a, m) ≠ 1. */
export function multicomplex_invmod(a: number, m: number): number | null {
  if (m < 1) return null;
  let t = 0,
    nt = 1,
    r = m,
    nr = mod(a, m);
  while (nr !== 0) {
    const q = Math.floor(r / nr);
    [t, nt] = [nt, t - q * nt];
    [r, nr] = [nr, r - q * nr];
  }
  return r === 1 ? mod(t, m) : null;
}

/**
 * SQL twin: multicomplex_inverse(z multicomplex) — multicomplex_numbers.sql. null for every non-unit; z is a unit
 * iff multicomplex_norm(z) is invertible mod M (coprimality, not non-vanishing — N(1 + j1) = 2 over ℤ/6 fails).
 * Recursion: z·(u − i_n·v) = u² + v², so z⁻¹ = (u − i_n·v)·(u² + v²)⁻¹ with the inner inverse taken in ℂ(n−1).
 */
export function multicomplex_inverse(z: Multicomplex): Multicomplex | null {
  const n = z.coeffs.length;
  if (n < 1 || (n & (n - 1)) !== 0 || z.modulus < 1) return null;
  if (n === 1) {
    const a = multicomplex_invmod(z.coeffs[0], z.modulus);
    return a === null ? null : { coeffs: [a], modulus: z.modulus };
  }
  const h = n / 2;
  const u: Multicomplex = { coeffs: z.coeffs.slice(0, h), modulus: z.modulus };
  const v: Multicomplex = { coeffs: z.coeffs.slice(h), modulus: z.modulus };
  const sInv = multicomplex_inverse(multicomplex_add(multicomplex_mul(u, u), multicomplex_mul(v, v)));
  if (sInv === null) return null;
  return multicomplex_mul(
    { coeffs: [...u.coeffs, ...multicomplex_neg(v).coeffs], modulus: z.modulus },
    { coeffs: [...sInv.coeffs, ...new Array(h).fill(0)], modulus: z.modulus },
  );
}
