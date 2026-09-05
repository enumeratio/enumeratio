// Canonical TEXT for each composite carrier — the TS twins of the SQL `notation(<carrier>)` overloads.
//
// These are not decoration. An engine is certified by comparing its output to pg's AS A STRING, so a TS engine
// that computes the right Gaussian integer but spells it `3+-1i` where pg says `3-i` is, for certification
// purposes, wrong. Porting the notation is what lets a TS engine answer for a composite result at all
// (#289); without it ts-engine declines every one of them rather than inventing a spelling.
//
// SQL overloads `notation()` on the carrier type; TypeScript cannot, so each twin is named for its carrier.
// Every one of these mirrors a specific SQL function, cited on the export, and selfcert-engine diffs them.

import type { GaussianInteger } from "./complex.js";
import type { Multicomplex } from "./multicomplex.js";

/** SQL twin: notation(g gaussian_integer) — gaussian_integers.sql. `2+3i`, `3-i`, `-i`, `5`, `0`.
 *  The ±1 cases drop the coefficient, which is why this is a port and not an interpolation. */
export function notation_gaussian_integer(g: GaussianInteger): string {
  if (g.im === 0) return String(g.re);
  if (g.re === 0) return g.im === 1 ? "i" : g.im === -1 ? "-i" : `${g.im}i`;
  const tail = g.im === 1 ? "+i" : g.im === -1 ? "-i" : g.im > 0 ? `+${g.im}i` : `${g.im}i`;
  return `${g.re}${tail}`;
}

/** SQL twin: notation(z multicomplex) — multicomplex_numbers.sql. `2 + 3j1`, `-5 + 16j1 - 19j2`, `0`.
 *  Coefficients print as their BALANCED representative mod M (c > M/2 becomes c − M), zero terms are dropped,
 *  a magnitude of 1 drops the digit, and the sign is folded into the joining ` + ` / ` - `. */
export function notation_multicomplex(z: Multicomplex): string {
  const cs = z.coeffs;
  if (!cs || cs.length === 0) return "0";
  const m = z.modulus;
  let out = "";
  let first = true;
  for (let i = 1; i <= cs.length; i++) {
    const c = ((cs[i - 1] % m) + m) % m;
    if (c === 0) continue;
    const bal = c > Math.floor(m / 2) ? c - m : c;   // SQL's `m / 2` is integer division
    const mag = Math.abs(bal);
    const unit = i === 1 ? "" : `j${i - 1}`;         // index = i−1; j0 is the bare scalar
    const body = i === 1 ? String(mag) : mag === 1 ? unit : `${mag}${unit}`;
    if (first) { out = bal < 0 ? `-${body}` : body; first = false; }
    else out += (bal < 0 ? " - " : " + ") + body;
  }
  return first ? "0" : out;
}

/** SQL twin: one_line(p permutation) / notation(p permutation) — permutations.sql. Digits run together up to
 *  n = 9 (`2413`), space-separated beyond it, where two-digit entries would otherwise be unreadable. */
export function notation_permutation(image: number[]): string {
  return (image?.length ?? 0) <= 9 ? (image ?? []).join("") : image.join(" ");
}

/** SQL twin: notation(c composition) — integer_compositions.sql. `3+1+2`. */
export function notation_composition(parts: number[]): string {
  return (parts ?? []).join("+");
}

/** SQL twin: lehmer_code(v permutation_inversion) / notation(...) — lehmer_codes.sql. The stored code drops the
 *  always-zero final entry; the SERIALIZATION puts it back, so `21` prints as `210`. */
export function notation_permutation_inversion(code: number[]): string {
  return [...(code ?? []), 0].join("");
}
