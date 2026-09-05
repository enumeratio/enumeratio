// Catalan-family counting sequences. Ported from ~/Playground/ideas/numbers/src/catalan.ts.

/** SQL twin: catalan_number(r int) — catalan_numbers.sql. C(k) = C(k-1)·2(2k−1)/(k+1). */
export function catalan_number(k: number): number {
  let c = 1;
  for (let i = 0; i < k; i++) c = (c * 2 * (2 * i + 1)) / (i + 2);
  return Math.round(c);
}

// Little Schröder (super-Catalan) numbers s(m): 1,1,3,11,45,197,… (OEIS A001003), via the recurrence
// (m+1)·s(m) = 3(2m−1)·s(m−1) − (m−2)·s(m−2).
/** SQL twin: little_schroder_number(n term_index) — little_schroder_numbers.sql. */
export function little_schroder_number(m: number): number {
  if (m <= 1) return 1;
  let a = 1;
  let b = 1; // s(0), s(1)
  for (let i = 2; i <= m; i++) {
    const s = (3 * (2 * i - 1) * b - (i - 2) * a) / (i + 1);
    a = b;
    b = s;
  }
  return b;
}
