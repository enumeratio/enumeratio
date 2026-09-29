// BinaryBracelets/KBracelets split out of collections/src/families/binary-word-families.ts (which
// mixed every area) per https://github.com/enumeratio/enumeratio/wiki/Speculative-Combinatorics-Layering-and-Plausible
// §4 step 5. Judgment call: these two are the only families in that file carrying a `declared`
// (Plausible) carrier -- "BinaryWord" and "Word", both words-area carriers -- while TriStrings,
// PrimitiveBinaryStrings, TernaryGrayCodes and StirlingPermutations have none at all (even though
// a "TernaryGrayCode" carrier exists) and so stay in collections per step 5 rule 4. `normRank`,
// `arraysEqual`, `compareArrays`, `rotateLeft`, `divisorsOf`, `ints` are small local helpers
// duplicated from the source file (mirrors the permutations pilot's `ints`); `reversed` and
// `eulerPhi` are used ONLY by the bracelet families and moved outright (removed from
// collections' copy).
import type { Declared, NumberKernel } from "../../../collections/src/families/types.ts";

const normRank = (r: number, total: number): number => (total > 0 ? ((Math.trunc(r) % total) + total) % total : 0);

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}
function compareArrays(a: number[], b: number[]): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}
function rotateLeft(w: number[], s: number): number[] {
  const n = w.length;
  if (n === 0) return w.slice();
  return Array.from({ length: n }, (_, i) => w[(i + s) % n]);
}
function reversed(w: number[]): number[] {
  const r = w.slice();
  r.reverse();
  return r;
}

// ─── number theory (mirrors words.ts's private copy — needed here for KBracelets/Burnside). ───────
function divisorsOf(n: number): number[] {
  const out: number[] = [];
  for (let d = 1; d * d <= n; d++) {
    if (n % d === 0) {
      out.push(d);
      if (d !== n / d) out.push(n / d);
    }
  }
  out.sort((a, b) => a - b);
  return out;
}
function eulerPhi(n: number): number {
  let result = n;
  let m = n;
  for (let p = 2; p * p <= m; p++) {
    if (m % p === 0) {
      while (m % p === 0) m /= p;
      result -= result / p;
    }
  }
  if (m > 1) result -= result / m;
  return Math.round(result);
}

// ─── Bracelets(n, k): words over a k-letter alphabet up to rotation AND reflection (dihedral
// group D_n), represented by the lex-least word in the whole orbit (rotations ∪ reflected
// rotations). Count via Burnside's lemma over D_n (standard bracelet-counting formula — see e.g.
// OEIS A000029 for k=2): necklace part is the same rotation sum as KNecklaces; the reflection
// part counts words fixed by each of the n reflections, which splits on parity of n (odd: every
// axis passes through one vertex and the opposite edge-midpoint, k^ceil(n/2) fixed words each;
// even: n/2 axes through two vertices, k^(n/2+1) fixed each, and n/2 axes through two edges,
// k^(n/2) fixed each). Enumerate-then-index for unrank/rank — cheap for the small n this family
// is tested at, and there's no simpler closed-form unranking of a dihedral orbit. ──────────────────
function braceletCount(n: number, k: number): number {
  if (k <= 0) return 0;
  if (n === 0) return 1;
  if (n < 0) return 0;
  let rotationSum = 0;
  for (const d of divisorsOf(n)) rotationSum += eulerPhi(d) * Math.pow(k, n / d);
  let reflectionSum: number;
  if (n % 2 === 1) {
    reflectionSum = n * Math.pow(k, Math.ceil(n / 2));
  } else {
    reflectionSum = (n / 2) * Math.pow(k, n / 2 + 1) + (n / 2) * Math.pow(k, n / 2);
  }
  return Math.round((rotationSum + reflectionSum) / (2 * n));
}
function canonicalBracelet(w: number[]): number[] {
  const n = w.length;
  if (n === 0) return w.slice();
  const rev = reversed(w);
  let best = w;
  for (let s = 0; s < n; s++) {
    const rot = rotateLeft(w, s);
    if (compareArrays(rot, best) < 0) best = rot;
    const rrot = rotateLeft(rev, s);
    if (compareArrays(rrot, best) < 0) best = rrot;
  }
  return best;
}
// odometer over all k^n words, ascending lexicographically.
function* allWords(n: number, k: number): Generator<number[]> {
  if (n === 0) {
    yield [];
    return;
  }
  const w = Array.from<number>({ length: n }).fill(0);
  while (true) {
    yield w.slice();
    let i = n - 1;
    while (i >= 0 && w[i] === k - 1) {
      w[i] = 0;
      i--;
    }
    if (i < 0) return;
    w[i]++;
  }
}
const braceletRepsCache = new Map<string, number[][]>();
function braceletReps(n: number, k: number): number[][] {
  const key = `${n},${k}`;
  const cached = braceletRepsCache.get(key);
  if (cached) return cached;
  const seen = new Set<string>();
  const reps: number[][] = [];
  for (const w of allWords(n, k)) {
    const rep = canonicalBracelet(w);
    const rk = rep.join(",");
    if (!seen.has(rk)) {
      seen.add(rk);
      reps.push(rep);
    }
  }
  reps.sort(compareArrays);
  braceletRepsCache.set(key, reps);
  return reps;
}
function braceletUnrank(n: number, k: number, r: number): number[] {
  const reps = braceletReps(n, k);
  return reps[normRank(r, reps.length)].slice();
}
function braceletRank(w: number[], n: number, k: number): number {
  const rep = canonicalBracelet(w);
  return braceletReps(n, k).findIndex((x) => arraysEqual(x, rep));
}
function braceletValid(w: unknown, n: number, k: number): boolean {
  if (!Array.isArray(w) || w.length !== n) return false;
  for (const v of w) if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= k) return false;
  if (n === 0) return true;
  return arraysEqual(canonicalBracelet(w), w);
}

const ints = (
  head: string,
  paramCount: 1 | 2,
  count: (p: number[]) => number,
  unrank: (p: number[], r: number) => number[],
  valid: (e: number[], p: number[]) => boolean,
  rank: (e: number[], p: number[]) => number,
): NumberKernel => ({
  head,
  paramCount,
  kind: "ints",
  count,
  unrank,
  valid: (e, p) => valid(e as number[], p),
  rank: (e, p) => rank(e as number[], p),
});

/** Words up to rotation (or reflection): unrank and rank enumerate all base^size words. */
const wordClass = (carrier: string, base?: number): Declared => ({
  carrier,
  params:
    base === undefined
      ? [
          { name: "size", role: "axis", min: 0 },
          { name: "base", role: "param", min: 1 },
        ]
      : [{ name: "n", role: "axis", min: 0 }],
  cost: { count: "closed", unrank: "enumerative", rank: "enumerative", valid: "polynomial" },
  work: ([n, k]) => BigInt(base ?? (k as number)) ** BigInt(n as number),
});

export const entries: NumberKernel[] = [
  // BinaryBracelets(n): binary words up to rotation and reflection — Bracelets(n, 2), A000029.
  {
    ...ints(
      "BinaryBracelets",
      1,
      ([n]) => braceletCount(n, 2),
      ([n], r) => braceletUnrank(n, 2, r),
      (a, [n]) => braceletValid(a, n, 2),
      (a, [n]) => braceletRank(a, n, 2),
    ),
    declared: wordClass("BinaryWord", 2),
  },
  // KBracelets(size, base): base-letter words up to rotation and reflection.
  {
    ...ints(
      "KBracelets",
      2,
      ([n, k]) => braceletCount(n, k),
      ([n, k], r) => braceletUnrank(n, k, r),
      (a, [n, k]) => braceletValid(a, n, k),
      (a, [n, k]) => braceletRank(a, n, k),
    ),
    declared: wordClass("Word"),
  },
];
