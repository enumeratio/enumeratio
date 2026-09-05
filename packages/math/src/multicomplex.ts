// Multicomplex ring ℂn(ℤ/Mℤ) arithmetic. Mirrors packages/data/sqlsrc/multicomplex_numbers.sql's mc_* functions,
// which are themselves a direct SQL port of ~/Playground/ideas/numbers/src/multicomplex.ts (see that file's own
// header for the math: 2ⁿ basis units j_m indexed by bitmasks, multiplication = XOR-convolution with a
// Thue–Morse overlap sign j_a·j_b = (−1)^popcount(a∧b)·j_(a⊻b)).

export interface Multicomplex {
  coeffs: number[]; // LSB-first: coeffs[0] = the scalar a0, coeffs[k] = the coefficient of j_k
  modulus: number;
}

const mod = (x: number, m: number): number => ((x % m) + m) % m;

/** Popcount of a non-negative bitmask (matches SQL mc_popcount's 0..30-bit scan). */
export function mc_popcount(x: number): number {
  let c = 0;
  for (let b = 0; b <= 30; b++) if ((x >> b) & 1) c++;
  return c;
}

/** SQL twin: mc_add(a,b multicomplex) — multicomplex_numbers.sql. Requires matching modulus + dimension. */
export function mc_add(a: Multicomplex, b: Multicomplex): Multicomplex {
  if (a.modulus !== b.modulus || a.coeffs.length !== b.coeffs.length) {
    throw new Error("mc_add: operands must share modulus and dimension");
  }
  return { coeffs: a.coeffs.map((c, i) => mod(c + b.coeffs[i], a.modulus)), modulus: a.modulus };
}

/** SQL twin: mc_neg(a multicomplex) — multicomplex_numbers.sql. */
export function mc_neg(a: Multicomplex): Multicomplex {
  return { coeffs: a.coeffs.map((c) => mod(-c, a.modulus)), modulus: a.modulus };
}

/** SQL twin: mc_sub(a,b multicomplex) — multicomplex_numbers.sql (defined as a + (-b) there too). */
export function mc_sub(a: Multicomplex, b: Multicomplex): Multicomplex {
  return mc_add(a, mc_neg(b));
}

/**
 * SQL twin: mc_mul(a,b multicomplex) — multicomplex_numbers.sql. XOR-convolution with Thue–Morse overlap signs:
 * out[i⊻j] += (−1)^popcount(i∧j) · a[i] · b[j]  (mod M).
 */
export function mc_mul(a: Multicomplex, b: Multicomplex): Multicomplex {
  if (a.modulus !== b.modulus || a.coeffs.length !== b.coeffs.length) {
    throw new Error("mc_mul: operands must share modulus and dimension");
  }
  const n = a.coeffs.length;
  const out = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const k = i ^ j;
      const sign = mc_popcount(i & j) % 2 === 0 ? 1 : -1;
      out[k] += sign * a.coeffs[i] * b.coeffs[j];
    }
  }
  return { coeffs: out.map((c) => mod(c, a.modulus)), modulus: a.modulus };
}

/** SQL twin: mc_conj(a multicomplex) — multicomplex_numbers.sql. Flips every unit (odious-indexed coeffs negate). */
export function mc_conj(a: Multicomplex): Multicomplex {
  return {
    coeffs: a.coeffs.map((c, i) => (mc_popcount(i) % 2 === 0 ? c : mod(-c, a.modulus))),
    modulus: a.modulus,
  };
}
