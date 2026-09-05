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
