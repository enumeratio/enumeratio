// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { type Permutation } from "../../../collections/src/families/kernels.ts";

/** The number whose Gray code has words `lo`, `hi`: bit i is the parity of the code's bits from i up. */
export function ungrayWords(lo: number, hi: number): [number, number] {
  let h = hi ^ (hi >>> 1);
  h ^= h >>> 2;
  h ^= h >>> 4;
  h ^= h >>> 8;
  h ^= h >>> 16;
  let l = lo ^ (lo >>> 1);
  l ^= l >>> 2;
  l ^= l >>> 4;
  l ^= l >>> 8;
  l ^= l >>> 16;
  // Every bit of the low word also sees the parity of the whole high word.
  return [h & 1 ? ~l : l, h];
}

/** The binary-reflected Gray code of the number with words `lo`, `hi`, as words. */
export const grayWords = (lo: number, hi: number): [number, number] => [
  lo ^ ((lo >>> 1) | (hi << 31)),
  hi ^ (hi >>> 1),
];

/** base^exp by repeated multiplication: exact while the result is a safe integer (`**` is not
 *  promised exact). Stops once past 2^53, where callers decline anyway. */
export function ipow(base: number, exp: number): number {
  if (base === 0 || base === 1) return exp === 0 ? 1 : base;
  let r = 1;
  for (let i = 0; i < exp && Math.abs(r) <= Number.MAX_SAFE_INTEGER; i++) r *= base;
  return r;
}

/** Lehmer code L[i] = #{ j > i : perm[j] < perm[i] }, all n positions (the last is always 0). */
export function LehmerCode(perm: Permutation): number[] {
  const avail = perm.map((_, i) => i + 1);
  return perm.map((x) => {
    const idx = avail.indexOf(x);
    avail.splice(idx, 1);
    return idx;
  });
}

/** Inversions (Coxeter length) = sum of the Lehmer code. SQL twin: perm_inversions(p permutation). */
export function Inversions(perm: Permutation): number {
  return LehmerCode(perm).reduce((a, b) => a + b, 0);
}
