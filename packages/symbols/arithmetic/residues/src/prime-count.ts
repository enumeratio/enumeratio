// π(x) past what Lucy_Hedgehog (sieve.ts, O(x^(3/4))) reaches in seconds: the combinatorial
// method of Meissel, Lehmer, Lagarias–Miller–Odlyzko and Deléglise–Rivat, O(x^(2/3)) up to
// logarithms.
//
//   π(x) = φ(x, a) + a − 1 − P₂(x, a),   a = π(y),  y = α·x^(1/3)  (so y³ ≥ x),
//
// where φ(x, a) counts n ≤ x with no prime factor among the first a primes and P₂(x, a) the
// n ≤ x that are a product of two primes both > y. Unfolding φ(x, a) = φ(x, c) − Σ_b φ(x/p_b,
// b−1) into squarefree n = p_b·m (primes added in decreasing order) leaves
//
//   φ(x, a) = Σ μ(n) φ(x/n, c)             n ≤ y squarefree, lpf(n) > p_c   (ordinary leaves)
//           − Σ μ(m) φ(x/(m p_b), b−1)     c < b ≤ a, y/p_b < m ≤ y, lpf(m) > p_b  (special leaves)
//
// and a special leaf's value v = ⌊x/(m p_b)⌋ < z = ⌊x/y⌋ falls in one of three classes:
//   - v < p_b:   φ = 1                           (trivial: counted in closed form)
//   - v < p_b²:  φ = π(v) − b + 2                (easy: one prime-count lookup)
//   - otherwise: φ(v, b−1) read off a sieve of [1, z] that has crossed out p_1..p_{b−1}
//                (hard: a running count per segment).
// P₂ needs π(x/p) for primes y < p ≤ √x, also inside [1, z]. One segmented sweep over [1, z]
// serves the hard leaves (at their stage of the sieve), then, once every prime ≤ √(segment) has
// crossed out, the easy leaves and P₂ (against the finished prime indicator).
//
// Doubles carry everything below 2^53, where ⌊n/d⌋ = Math.floor(n/d) holds exactly for integers.
// A larger x is split into a double-double and divided exactly by `makeFloorDiv`; accumulators
// flush into a BigInt before they can lose a bit.
import { primeCountUpTo } from "./sieve.ts";

/** The largest x the kernel takes: π(x) must stay below 2^53, and so must every product it forms. */
export const PRIME_COUNT_MAX = 2n ** 58n;

const TWO_53 = 2 ** 53;
/** An accumulator past this flushes to a BigInt before the next block can push it past 2^53. */
const FLUSH = 2 ** 50;
const SPLIT = 134217729; // 2^27 + 1, Veltkamp's splitter

export interface PrimeCountOptions {
  /** y = α·x^(1/3); defaults to a fit by size of x. */
  alpha?: number;
  /** Primes folded into the φ table and the pre-sieve pattern (2 … 7). */
  c?: number;
  /** log2 of the odd numbers per sieve segment. */
  segmentBits?: number;
}

function isqrtBig(n: bigint): bigint {
  let r = BigInt(Math.floor(Math.sqrt(Number(n))));
  while (r * r > n) r--;
  while ((r + 1n) * (r + 1n) <= n) r++;
  return r;
}

/** The least integer r with r³ ≥ n. */
function ceilCbrtBig(n: bigint): bigint {
  let r = BigInt(Math.ceil(Math.cbrt(Number(n))));
  while (r * r * r < n) r++;
  while (r > 1n && (r - 1n) * (r - 1n) * (r - 1n) >= n) r--;
  return r;
}

/** Every prime ≤ n, ascending: an odd-only segmented sieve. */
function primesUpTo(n: number): Uint32Array {
  if (n < 2) return new Uint32Array(0);
  const out = new Uint32Array(Math.ceil((1.26 * n) / Math.log(n)) + 16);
  let count = 0;
  out[count++] = 2;
  const root = Math.floor(Math.sqrt(n));
  // Odd base primes up to √n, by a plain sieve.
  const flags = new Uint8Array(root + 1);
  const base: number[] = [];
  for (let i = 3; i <= root; i += 2) {
    if (flags[i]) continue;
    base.push(i);
    for (let j = i * i; j <= root; j += 2 * i) flags[j] = 1;
  }
  const first = new Int32Array(base.length); // first odd multiple's index, relative to the block
  for (let t = 0; t < base.length; t++) first[t] = (base[t]! * base[t]! - 1) / 2 - 1;
  // Odd numbers 2i + 1 for i in [1, half], BLOCK of them at a time.
  const half = (n - 1) >> 1;
  const BLOCK = 1 << 17;
  const buf = new Uint8Array(BLOCK);
  for (let low = 1; low <= half; low += BLOCK) {
    const len = Math.min(BLOCK, half - low + 1);
    buf.fill(1, 0, len);
    for (let t = 0; t < base.length; t++) {
      const p = base[t]!;
      let k = first[t]!;
      for (; k < len; k += p) buf[k] = 0;
      first[t] = k - len;
    }
    for (let i = 0; i < len; i++) if (buf[i]) out[count++] = 2 * (low + i) + 1;
  }
  return out.slice(0, count);
}

/**
 * ⌊x/d⌋ for x past 2^53 and d ≥ 64: the quotient from the rounded x lands within 2 of the
 * truth, and an exact remainder (x − q·d from a Dekker product against the double-double x)
 * puts it right.
 */
function makeFloorDiv(x: bigint): (d: number) => number {
  const xd = Number(x);
  const xe = Number(x - BigInt(xd));
  return (d) => {
    if (d < 64) return Number(x / BigInt(d));
    let q = Math.floor(xd / d);
    const p = q * d;
    // Dekker's two-product: p + e = q·d exactly.
    let t = SPLIT * q;
    const qh = t - (t - q);
    const ql = q - qh;
    t = SPLIT * d;
    const dh = t - (t - d);
    const dl = d - dh;
    const e = ql * dl - (p - qh * dh - ql * dh - qh * dl);
    let r = xd - p + (xe - e);
    while (r < 0) {
      q--;
      r += d;
    }
    while (r >= d) {
      q++;
      r -= d;
    }
    return q;
  };
}

/** y = α·x^(1/3). The sieve over [1, x/y] shrinks as α grows while the leaf count grows like √α;
 *  timed at 10^12 … 10^15 the optimum is flat from 8 to 12. */
function defaultAlpha(x: number): number {
  const lg = Math.log10(x);
  return Math.min(12, Math.max(1, 0.4 * lg * lg - 6 * lg + 22));
}

/** π(n) is answered exactly up to here; past it the call stays symbolic (10^15 takes about 5 s,
 *  10^16 over half a minute, 10^17 minutes). */
export const PRIME_COUNT_LIMIT = 1e15;

/** Below this the Lucy_Hedgehog tier of `primeCountUpTo` is as fast; above it the combinatorial
 *  count is faster (about 3× at 10^11, 6× at 10^12). */
const DR_FROM = 1e11;

/** π(n) for a safe integer n ≤ `PRIME_COUNT_LIMIT`, exactly; `undefined` past the limit. */
export function primeCount(n: number): number | undefined {
  if (!Number.isSafeInteger(n) || n < 0 || n > PRIME_COUNT_LIMIT) return undefined;
  return n > DR_FROM ? primeCountDR(BigInt(n)) : primeCountUpTo(n);
}

export function primeCountDR(x: bigint, options: PrimeCountOptions = {}): number {
  if (x < 2n) return 0;
  if (x > PRIME_COUNT_MAX) throw new RangeError("primeCountDR: x past PRIME_COUNT_MAX");
  const xd = Number(x);
  const small = x < BigInt(TWO_53);
  const xn = xd; // exact when `small`
  const bigDiv = small ? undefined : makeFloorDiv(x);
  const fd = (d: number): number => (small ? Math.floor(xn / d) : bigDiv!(d));

  // ── parameters ──────────────────────────────────────────────────────────────────────────
  const R = Number(isqrtBig(x));
  const x13 = Number(ceilCbrtBig(x));
  const alpha = options.alpha ?? defaultAlpha(xd);
  let y = Math.min(R, Math.max(x13, Math.round(alpha * x13)));
  y = Math.max(y, Math.min(R, 20));
  const z = small ? Math.floor(xn / y) : Number(x / BigInt(y));

  const S = 1 << Math.min(options.segmentBits ?? 18, Math.max(10, Math.ceil(Math.log2(z / 2 + 1))));
  const rTop = Math.floor(Math.sqrt(z + 2 * S + 2)); // the last segment sieves up to here
  const pr = primesUpTo(Math.max(R, y, rTop));
  let a = 0;
  {
    // π(y) by binary search over the prime list.
    let lo = 0;
    let hi = pr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pr[mid]! <= y) lo = mid + 1;
      else hi = mid;
    }
    a = lo;
  }
  let A = 0; // π(⌊√x⌋)
  {
    let lo = 0;
    let hi = pr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pr[mid]! <= R) lo = mid + 1;
      else hi = mid;
    }
    A = lo;
  }
  const c = Math.min(options.c ?? 6, a, 7);

  // π(t) for t ≤ y, and the squarefree-part table: val[n] = lpf(n) for squarefree n, else 0.
  const piT = new Uint32Array(y + 1);
  for (let i = 0; i < a; i++) piT[pr[i]!] = 1;
  for (let t = 1; t <= y; t++) piT[t]! += piT[t - 1]!;
  const val = new Uint32Array(y + 1);
  for (let i = a - 1; i >= 0; i--) {
    const p = pr[i]!;
    for (let n = p; n <= y; n += p) val[n] = p;
  }
  const mu = new Int8Array(y + 1);
  mu[1] = 1;
  for (let n = 2; n <= y; n++) {
    const p = val[n]!;
    const m = (n / p) | 0;
    mu[n] = m % p === 0 ? 0 : -mu[m]!;
  }
  for (let n = 2; n <= y; n++) if (mu[n] === 0) val[n] = 0;

  // φ(v, c) = (v div P)·φ(P) + tab[v mod P], P the product of the first c primes.
  let P = 1;
  for (let i = 0; i < c; i++) P *= pr[i]!;
  const tab = new Int32Array(P + 1);
  for (let r = 1; r <= P; r++) {
    let ok = true;
    for (let i = 0; i < c; i++) {
      if (r % pr[i]! === 0) {
        ok = false;
        break;
      }
    }
    tab[r] = tab[r - 1]! + (ok ? 1 : 0);
  }
  const phiP = tab[P]!;
  const phiC = (v: number): number => {
    const q = Math.floor(v / P);
    return q * phiP + tab[v - q * P]!;
  };

  // ── ordinary leaves ─────────────────────────────────────────────────────────────────────
  const pc = c > 0 ? pr[c - 1]! : 1;
  let big = 0n;
  if (small) {
    let s1 = 0;
    for (let n = 1; n <= y; n++) {
      if (n > 1 && val[n]! <= pc) continue;
      s1 += mu[n]! * phiC(fd(n));
      if (s1 > FLUSH || s1 < -FLUSH) {
        big += BigInt(s1);
        s1 = 0;
      }
    }
    big += BigInt(s1);
  } else {
    const Pb = BigInt(P);
    big += (x / Pb) * BigInt(phiP) + BigInt(tab[Number(x % Pb)]!);
    for (let n = 2; n <= y; n++) {
      if (val[n]! <= pc) continue;
      // x/n can pass 2^53 for the first few n; those go through a bigint.
      if (n < 64) {
        const v = x / BigInt(n);
        big += BigInt(mu[n]!) * ((v / Pb) * BigInt(phiP) + BigInt(tab[Number(v % Pb)]!));
      } else big += BigInt(mu[n]! * phiC(fd(n)));
    }
  }

  // ── special-leaf tables ─────────────────────────────────────────────────────────────────
  const bSplit = piT[Math.floor(Math.sqrt(y))]!; // b ≤ bSplit: m may be composite (p_b ≤ √y)
  // Per b (1-based): pointers into the leaf lists. m-lists for b ≤ bSplit scan integers
  // (m descending, valid when val[m] > p_b); for b > bSplit m is a prime and the list is an
  // index range of `pr`.
  const eHi = new Float64Array(a + 2); // easy pointer: m (b ≤ bSplit) or prime index (b > bSplit)
  const eLo = new Float64Array(a + 2); // easy range floor (inclusive)
  const hHi = new Float64Array(a + 2);
  const hLo = new Float64Array(a + 2);
  let bMax = c; // last b with an easy or hard leaf
  let bHard = c; // last b with a hard leaf
  let trivial = 0;
  for (let b = c + 1; b <= a; b++) {
    const p = pr[b - 1]!;
    const x2 = fd(p * p); // ⌊x/p²⌋
    const x3 = Math.floor(x2 / p); // ⌊x/p³⌋
    if (b <= bSplit) {
      const mLo = Math.floor(y / p) + 1;
      hHi[b] = Math.min(y, x3);
      hLo[b] = mLo;
      eHi[b] = y;
      eLo[b] = Math.max(mLo, x3 + 1);
      if (hHi[b]! >= hLo[b]!) bHard = b;
      bMax = b;
    } else {
      // q prime in (p, y]: hard q ≤ x3, easy x3 < q ≤ x2, trivial q > x2.
      const hardTop = piT[Math.min(y, x3)]! - 1; // index of the last prime ≤ min(y, x3)
      hHi[b] = hardTop;
      hLo[b] = b; // pr[b] = p_{b+1} > p_b
      const easyTop = piT[Math.min(y, x2)]! - 1;
      eHi[b] = easyTop;
      eLo[b] = piT[Math.min(y, Math.max(x3, p))]!; // first prime above max(x3, p)
      if (hardTop >= b) bHard = b;
      if (easyTop >= eLo[b]! || hardTop >= b) bMax = b;
      // Trivial: primes q in (max(p, x2), y] each contribute +1.
      if (x2 < y) trivial += a - piT[Math.max(p, x2)]!;
    }
  }

  // ── sieve sweep over [1, z] ─────────────────────────────────────────────────────────────
  let Pc = 1; // pre-sieve pattern period over odd indices
  for (let i = 1; i < c; i++) Pc *= pr[i]!;
  const pat = new Uint8Array(Pc + S);
  {
    const baseTab = new Uint8Array(Pc);
    for (let i = 0; i < Pc; i++) {
      const n = 2 * i + 1;
      let ok = 1;
      for (let t = 1; t < c; t++) {
        if (n % pr[t]! === 0) {
          ok = 0;
          break;
        }
      }
      baseTab[i] = ok;
    }
    for (let i = 0; i < pat.length; i++) pat[i] = baseTab[i % Pc]!;
  }
  const BS = 6; // 64 odd numbers per counter block
  const s = new Uint8Array(S);
  const s32 = new Uint32Array(s.buffer);
  const cnt = new Int32Array(S >> BS);
  const pic = new Int32Array(S);
  // Largest sieving prime index over the whole sweep: primes ≤ √(z + 2S).
  let kTop = 0;
  {
    let lo = 0;
    let hi = pr.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (pr[mid]! <= rTop) lo = mid + 1;
      else hi = mid;
    }
    kTop = lo;
  }
  const kAll = Math.max(kTop, bHard);
  const next = new Int32Array(kAll + 1); // next cross-off index of p_b, relative to the segment
  let nextReady = 0; // plain-phase primes initialised so far
  for (let b = c + 1; b <= Math.min(bHard, kAll); b++) next[b] = (pr[b - 1]! - 1) / 2;
  nextReady = bHard;
  const phiPrev = new Float64Array(bHard + 2);
  let acc = 0;
  let oddPi = 0; // odd primes below the segment
  let p2 = A; // P₂ pointer: 1-based index of the current prime p ∈ (y, √x]

  const flush = (): void => {
    if (acc > FLUSH || acc < -FLUSH) {
      big += BigInt(acc);
      acc = 0;
    }
  };
  // Leaf counters: a one-line guard that nothing past 2^53 has been summed inexactly.
  const check = (): void => {
    if (!(Math.abs(acc) < TWO_53)) throw new RangeError("primeCountDR: accumulator overflow");
  };

  for (let I0 = 0; 2 * I0 + 1 <= z; I0 += S) {
    const lowN = 2 * I0 + 1;
    const highN = lowN + 2 * S; // v < highN belongs to this segment
    const off = I0 % Pc;
    s.set(pat.subarray(off, off + S));
    // Block counters and the running total of survivors.
    let total = 0;
    for (let blk = 0, w = 0; blk < S >> BS; blk++) {
      let sum = 0;
      for (let e = w + 16; w < e; w++) sum += Math.imul(s32[w]!, 0x01010101) >>> 24;
      cnt[blk] = sum;
      total += sum;
    }

    // Prime count of the segment's top, for how far the plain phase sieves.
    const rSeg = Math.floor(Math.sqrt(highN - 1));
    let kmax = 0;
    {
      let lo = 0;
      let hi = kTop;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (pr[mid]! <= rSeg) lo = mid + 1;
        else hi = mid;
      }
      kmax = lo;
    }

    // Hard phase: b = c+1 … bHard, leaves first (sieve holds φ(·, b−1)), then cross out p_b.
    for (let b = c + 1; b <= bHard; b++) {
      const p = pr[b - 1]!;
      if (b <= bSplit) {
        // Hard leaves, composite m allowed.
        let m = hHi[b]!;
        const mLo = hLo[b]!;
        if (m >= mLo) {
          let cb = 0;
          let run = 0;
          let sub = 0;
          const prev = phiPrev[b]!;
          while (m >= mLo) {
            if (val[m]! <= p) {
              m--;
              continue;
            }
            const v = fd(m * p);
            if (v >= highN) break;
            const tl = (v - lowN) >> 1;
            const tb = tl >> BS;
            while (cb < tb) run += cnt[cb++]!;
            let cc = run;
            let wi = (tb << BS) >> 2;
            const wEnd = tl >> 2;
            for (; wi < wEnd; wi++) cc += Math.imul(s32[wi]!, 0x01010101) >>> 24;
            for (let t = wEnd << 2; t <= tl; t++) cc += s[t]!;
            sub -= mu[m]! * (prev + cc);
            m--;
          }
          hHi[b] = m;
          acc += sub;
          flush();
        }
      } else {
        let j = hHi[b]!;
        const jLo = hLo[b]!;
        if (j >= jLo) {
          let cb = 0;
          let run = 0;
          let sub = 0;
          let k = 0;
          while (j >= jLo) {
            const v = fd(pr[j]! * p);
            if (v >= highN) break;
            const tl = (v - lowN) >> 1;
            const tb = tl >> BS;
            while (cb < tb) run += cnt[cb++]!;
            let cc = run;
            let wi = (tb << BS) >> 2;
            const wEnd = tl >> 2;
            for (; wi < wEnd; wi++) cc += Math.imul(s32[wi]!, 0x01010101) >>> 24;
            for (let t = wEnd << 2; t <= tl; t++) cc += s[t]!;
            sub += cc;
            k++;
            j--;
          }
          hHi[b] = j;
          acc += sub + k * phiPrev[b]!;
          flush();
        }
      }
      phiPrev[b]! += total;
      // Cross out p_b, keeping the counters current.
      let k = next[b]!;
      let dec = 0;
      for (; k < S; k += p) {
        const t = s[k]!;
        s[k] = 0;
        cnt[k >> BS]! -= t;
        dec += t;
      }
      next[b] = k - S;
      total -= dec;
    }

    // Plain phase: the remaining primes ≤ √(segment top).
    for (let b = Math.max(bHard, c) + 1; b <= kmax; b++) {
      const p = pr[b - 1]!;
      if (b > nextReady) {
        // First segment that needs p_b: its first odd multiple ≥ max(lowN, p).
        let k0 = Math.max(1, Math.ceil(lowN / p));
        if (k0 % 2 === 0) k0++;
        next[b] = (p * k0 - 1) / 2 - I0;
        nextReady = b;
      }
      let k = next[b]!;
      for (; k < S; k += p) s[k] = 0;
      next[b] = k - S;
    }
    // The primes that crossed themselves out are primes; 1 is not.
    const kCross = Math.max(kmax, bHard, c);
    if (lowN <= pr[kCross - 1]!) {
      for (let i = 1; i < kCross; i++) {
        const p = pr[i]!;
        if (p >= lowN && p < highN) s[(p - 1) / 2 - I0] = 1;
      }
    }
    // The pre-sieved primes 3 … p_c sit below every segment past the first; restore them too.
    if (I0 === 0) {
      for (let i = 1; i < c; i++) s[(pr[i]! - 1) / 2] = 1;
      s[0] = 0;
    }
    // Prefix counts of the prime indicator.
    {
      let run = 0;
      for (let i = 0; i < S; i++) {
        run += s[i]!;
        pic[i] = run;
      }
    }

    // Easy leaves: φ(v, b−1) = π(v) − b + 2.
    const piBase = 1 + oddPi; // π(lowN − 1) = 1 (the prime 2) + odd primes below; add pic[tl]
    for (let b = c + 1; b <= bMax; b++) {
      const p = pr[b - 1]!;
      if (b <= bSplit) {
        let m = eHi[b]!;
        const mLo = eLo[b]!;
        if (m < mLo) continue;
        let sub = 0;
        let sgn = 0;
        while (m >= mLo) {
          if (val[m]! <= p) {
            m--;
            continue;
          }
          const v = fd(m * p);
          if (v >= highN) break;
          const w = -mu[m]!;
          sub += w * pic[(v - lowN) >> 1]!;
          sgn += w;
          m--;
        }
        eHi[b] = m;
        acc += sub + sgn * (piBase + 2 - b);
        flush();
      } else {
        let j = eHi[b]!;
        const jLo = eLo[b]!;
        if (j < jLo) continue;
        let sub = 0;
        let k = 0;
        while (j >= jLo) {
          const v = fd(pr[j]! * p);
          if (v >= highN) break;
          sub += pic[(v - lowN) >> 1]!;
          k++;
          j--;
        }
        eHi[b] = j;
        acc += sub + k * (piBase + 2 - b);
        flush();
      }
    }
    // P₂: Σ π(x/p) over the primes y < p ≤ √x, p descending as x/p ascends.
    {
      let sub = 0;
      let k = 0;
      while (p2 > a) {
        const pp = pr[p2 - 1]!;
        const v = small ? Math.floor(xn / pp) : bigDiv!(pp);
        if (v >= highN) break;
        sub += pic[(v - lowN) >> 1]!;
        k++;
        p2--;
      }
      acc -= sub + k * piBase;
      flush();
    }
    check();
    oddPi += pic[S - 1]!;
  }

  // P₂'s Σ(π(p) − 1) over p = p_{a+1} … p_A is Σ (i − 1).
  const p2Tail = ((A - a) * (a + A - 1)) / 2; // Σ_{i=a+1}^{A} (i − 1)
  big += BigInt(acc);
  const phi = big + BigInt(trivial);
  const result = phi + BigInt(a) - 1n + BigInt(p2Tail);
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("primeCountDR: result past 2^53");
  return Number(result);
}
