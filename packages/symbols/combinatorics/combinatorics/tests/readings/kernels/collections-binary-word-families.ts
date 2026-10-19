// Moved out of the runtime by BL-225: kernels only tests/readings and the agreement tests use.
import { normRank } from "../../../collections/src/families/binary-word-families.ts";

export function triValid(bits: unknown, n: number): boolean {
  if (!Array.isArray(bits) || bits.length !== n) return false;
  let run = 0;
  for (const b of bits) {
    if (b !== 0 && b !== 1) return false;
    run = b === 1 ? run + 1 : 0;
    if (run >= 3) return false;
  }
  return true;
}

// ─── TriStrings(n): binary words of length n with no 3 consecutive 1s — the tribonacci-like
// count A000073-shifted (T(n)=T(n-1)+T(n-2)+T(n-3), T(0)=1, T(1)=2, T(2)=4). comp(len, state) =
// number of valid length-`len` completions given `state` (0/1/2) trailing 1s already placed;
// unrank/rank walk positions left to right exactly like BinaryWordsByWeight's combinatorial-
// number-system walk, using comp() as the block-size function (0 sorts before 1 at each spot). ────
export const triCompCache = new Map<string, number>();

export function triComp(len: number, state: 0 | 1 | 2): number {
  if (len === 0) return 1;
  const key = `${len},${state}`;
  const cached = triCompCache.get(key);
  if (cached !== undefined) return cached;
  const withZero = triComp(len - 1, 0);
  const withOne = state < 2 ? triComp(len - 1, (state + 1) as 0 | 1 | 2) : 0;
  const total = withZero + withOne;
  triCompCache.set(key, total);
  return total;
}

export function triRank(bits: number[], n: number): number {
  let rem = 0;
  let state: 0 | 1 | 2 = 0;
  for (let i = 0; i < n; i++) {
    const remaining = n - i - 1;
    const zeroBlock = triComp(remaining, 0);
    if (bits[i] === 1) {
      rem += zeroBlock;
      state = (state + 1) as 0 | 1 | 2;
    } else {
      state = 0;
    }
  }
  return rem;
}

export function triCount(n: number): number {
  return triComp(n, 0);
}

export function triUnrank(n: number, r: number): number[] {
  const total = triCount(n);
  let rem = normRank(r, total);
  let state: 0 | 1 | 2 = 0;
  const bits: number[] = [];
  for (let i = 0; i < n; i++) {
    const remaining = n - i - 1;
    const zeroBlock = triComp(remaining, 0);
    if (rem < zeroBlock) {
      bits.push(0);
      state = 0;
    } else {
      rem -= zeroBlock;
      bits.push(1);
      state = (state + 1) as 0 | 1 | 2;
    }
  }
  return bits;
}
