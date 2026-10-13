// The nth prime, exactly, by counting rather than sieving from 2: invert a smooth estimate of
// π to land near p_n, count the primes up to the landing point exactly (prime-count.ts), then
// sieve outward from there for the remaining few. The estimate only decides where to look; the
// exact count decides what is found, so a poor estimate costs time, never correctness.
import { primeCount } from "./prime-count.ts";
import { PRIME_PI_LIMIT, primesIn } from "./sieve.ts";

/** Primes below this sit in a table, so small n (the common case) is a lookup. */
const TABLE_LIMIT = 1_000_000;
/** Numbers sieved per step of the walk outward from the landing point. */
const WINDOW = 1 << 18;

let table: number[] | undefined;

const EULER_GAMMA = 0.5772156649015329;

/** The logarithmic integral li(x) = γ + ln ln x + Σ (ln x)^k / (k·k!), for x > 1. All terms positive. */
function li(x: number): number {
  const t = Math.log(x);
  let term = 1;
  let sum = 0;
  for (let k = 1; k < 500; k++) {
    term *= t / k;
    const add = term / k;
    sum += add;
    if (k > t && add < sum * 1e-17) break;
  }
  return EULER_GAMMA + Math.log(t) + sum;
}

/** Riemann's π estimate to its first correction, li(x) − li(√x)/2, off by about √x / ln x. */
const piEstimate = (x: number): number => li(x) - li(Math.sqrt(x)) / 2;

/** x where `piEstimate(x) = n`, by Newton's method (π′ ≈ 1/ln x). */
function inversePiEstimate(n: number): number {
  const ln = Math.log(n);
  let x = n * (ln + Math.log(ln) - 1);
  for (let i = 0; i < 8; i++) {
    const step = (piEstimate(x) - n) * Math.log(x);
    x -= step;
    if (Math.abs(step) < 1) break;
  }
  return x;
}

const within = (p: number): number | undefined => (p <= PRIME_PI_LIMIT ? p : undefined);

/**
 * The nth prime (1-based): `nthPrime(1)` is 2. `undefined` for n < 1, or where p_n is past
 * `PRIME_PI_LIMIT` (the exact count that locates it would no longer be interactive).
 */
export function nthPrime(n: number): number | undefined {
  if (!Number.isSafeInteger(n) || n < 1) return undefined;
  table ??= primesIn(2, TABLE_LIMIT);
  if (n <= table.length) return table[n - 1];

  const guess = Math.round(inversePiEstimate(n));
  // Slack: the estimate is off by about √p, and the limit applies to p_n itself, checked below.
  if (guess > PRIME_PI_LIMIT * 1.01) return undefined;
  const below = primeCount(guess); // π(guess)
  if (below === undefined) return undefined;
  if (below < n) {
    for (let lo = guess + 1, need = n - below; ; lo += WINDOW) {
      const found = primesIn(lo, lo + WINDOW - 1);
      if (found.length >= need) return within(found[need - 1]);
      need -= found.length;
    }
  }
  for (let hi = guess, need = below - n + 1; ; hi -= WINDOW) {
    const found = primesIn(hi - WINDOW + 1, hi);
    if (found.length >= need) return within(found[found.length - need]);
    need -= found.length;
  }
}
