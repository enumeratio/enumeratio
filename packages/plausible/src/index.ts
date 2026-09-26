// Seeded, size-aware generation for Plausible (design/plausible.md §3.1), after Lean 4's
// Plausible: a `Gen` reads a random stream and a size. Every stream is seeded and printed, so
// any run replays; `streamFor` keys a stream per family (or per template), so what one key
// draws never depends on which keys ran before it.

/** A uniform draw in [0, 1). */
export type Rng = () => number;

/** A generator: reads a seeded stream and the current size, as Plausible's `Gen`. */
export type Gen<T> = (rng: Rng, size: number) => T;

/** mulberry32 — tiny, deterministic, and good enough to find bugs. */
export function random(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** FNV-1a, 32-bit. */
export function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A stream of its own per key, from `seed/key`. */
export const streamFor = (seed: number | string, key: string): Rng => random(hash(`${seed}/${key}`));

/** A uniform-enough bigint in [0, n): 32-bit chunks with 32 spare bits, reduced mod n. */
export function randomBelow(rng: Rng, n: bigint): bigint {
  if (n <= 1n) return 0n;
  if (n <= BigInt(Number.MAX_SAFE_INTEGER)) return BigInt(Math.floor(rng() * Number(n)));
  let r = 0n;
  for (let bits = 0n; 1n << bits < n << 32n; bits += 32n) r = (r << 32n) | BigInt(Math.floor(rng() * 2 ** 32));
  return r % n;
}

/** An integer in [lo, hi], or one of the ends with probability `edge` — degenerate values are
 *  where bugs live. */
export function between(rng: Rng, lo: number, hi: number, edge = 0.25): number {
  if (hi <= lo) return lo;
  const roll = rng();
  if (roll < edge / 2) return lo;
  if (roll < edge) return hi;
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/** Plausible's size ramp: the size for point `i` of `points`, growing linearly to `maxSize`. */
export const sizeAt = (i: number, points: number, maxSize: number): number =>
  points <= 1 ? maxSize : Math.round((i * maxSize) / (points - 1));
