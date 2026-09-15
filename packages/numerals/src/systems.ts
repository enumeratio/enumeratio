// Numeral systems: a number and its digits are different things, and the map between
// them is the whole subject here.
//
// Every system below is a BIJECTION between integers (of some range) and digit strings,
// so the one property that matters is the round trip — and that is what the tests pin,
// for every system, over a range, rather than spot values. Digits are written
// most-significant-first throughout, matching compute-engine's own `IntegerDigits`.
//
// The systems are not variations on base-b. Three of them (balanced, negative, residue)
// represent negatives or wrap with no sign at all; two (factoradic, combinatorial) are
// the unranking maps for permutations and subsets wearing a different hat; one
// (Zeckendorf) has a digit ALPHABET but a forbidden pattern instead of a place bound.

/** A numeral system: the two directions, plus what its digits are allowed to be. */
export interface NumeralSystem {
  readonly name: string;
  /** Digits of `n`, most significant first. `undefined` if `n` is outside the domain. */
  toDigits(n: number): number[] | undefined;
  /** The integer a digit string denotes, or `undefined` if the digits are invalid. */
  fromDigits(digits: readonly number[]): number | undefined;
  /** One line on what the digits look like — used by the docs and the error path. */
  readonly shape: string;
}

const isInt = (x: number): boolean => Number.isSafeInteger(x);

// ── fixed radix, and its three twists ───────────────────────────────────────────

/** Ordinary base b, digits 0…b−1. Non-negative only, like compute-engine's own. */
export function radix(b: number): NumeralSystem | undefined {
  if (!isInt(b) || b < 2) return undefined;
  return {
    name: `Radix(${b})`,
    shape: `digits 0…${b - 1}`,
    toDigits: (n) => {
      if (!isInt(n) || n < 0) return undefined;
      if (n === 0) return [0];
      const digits: number[] = [];
      for (let rest = n; rest > 0; rest = Math.floor(rest / b)) digits.unshift(rest % b);
      return digits;
    },
    fromDigits: (digits) =>
      digits.every((d) => isInt(d) && d >= 0 && d < b)
        ? digits.reduce((acc, d) => acc * b + d, 0)
        : undefined,
  };
}

/**
 * Balanced base b (b odd): digits run −(b−1)/2 … (b−1)/2. Balanced ternary is the
 * famous one — it represents NEGATIVE integers with no sign, and rounding to the
 * nearest is just truncation.
 */
export function balancedRadix(b: number): NumeralSystem | undefined {
  if (!isInt(b) || b < 3 || b % 2 === 0) return undefined;
  const half = (b - 1) / 2;
  return {
    name: `BalancedRadix(${b})`,
    shape: `digits −${half}…${half}, and negatives need no sign`,
    toDigits: (n) => {
      if (!isInt(n)) return undefined;
      if (n === 0) return [0];
      const digits: number[] = [];
      let rest = n;
      while (rest !== 0) {
        let digit = ((rest % b) + b) % b;
        if (digit > half) digit -= b;
        digits.unshift(digit);
        rest = Math.round((rest - digit) / b);
      }
      return digits;
    },
    fromDigits: (digits) =>
      digits.every((d) => isInt(d) && Math.abs(d) <= half)
        ? digits.reduce((acc, d) => acc * b + d, 0)
        : undefined,
  };
}

/**
 * Base −b: digits 0…b−1 again, but the place values alternate sign, so every integer —
 * negative ones included — has exactly one representation and there is no sign bit.
 */
export function negativeRadix(b: number): NumeralSystem | undefined {
  if (!isInt(b) || b < 2) return undefined;
  return {
    name: `NegativeRadix(${b})`,
    shape: `digits 0…${b - 1} over place values (−${b})^k`,
    toDigits: (n) => {
      if (!isInt(n)) return undefined;
      if (n === 0) return [0];
      const digits: number[] = [];
      let rest = n;
      while (rest !== 0) {
        const digit = ((rest % b) + b) % b;
        digits.unshift(digit);
        rest = Math.round((rest - digit) / -b);
      }
      return digits;
    },
    fromDigits: (digits) =>
      digits.every((d) => isInt(d) && d >= 0 && d < b)
        ? digits.reduce((acc, d) => acc * -b + d, 0)
        : undefined,
  };
}

/**
 * Bijective base k: digits 1…k, with no zero at all. Every POSITIVE integer has exactly
 * one representation and there are no leading-zero ambiguities — bijective base 26 is
 * how spreadsheet columns are lettered (A, …, Z, AA, …).
 */
export function bijectiveRadix(k: number): NumeralSystem | undefined {
  if (!isInt(k) || k < 1) return undefined;
  return {
    name: `BijectiveRadix(${k})`,
    shape: `digits 1…${k}, no zero digit; zero is the EMPTY numeral`,
    toDigits: (n) => {
      if (!isInt(n) || n < 0) return undefined;
      // Zero is the empty string, not a missing case. That is what makes the system
      // BIJECTIVE: every non-negative integer corresponds to exactly one finite string over
      // {1…k}, and the one string left over — the empty one — is what zero gets. Declining
      // here would leave the round trip undefined at the one point the name promises.
      const digits: number[] = [];
      let rest = n;
      while (rest > 0) {
        let digit = rest % k;
        if (digit === 0) digit = k;
        digits.unshift(digit);
        rest = (rest - digit) / k;
      }
      return digits;
    },
    fromDigits: (digits) =>
      digits.every((d) => isInt(d) && d >= 1 && d <= k)
        ? digits.reduce((acc, d) => acc * k + d, 0)
        : undefined,
  };
}

// ── mixed radix: a different base per place ─────────────────────────────────────

/**
 * Mixed radix over `bases`, listed most-significant-place-first, as in Wolfram's
 * `MixedRadix`. The weight of a place is the product of every base AFTER it, so
 * `MixedRadix([24,60,60])` reads a second count as days, hours, minutes, seconds. The
 * leading digit is unbounded; digit i is bounded by `bases[i]`.
 */
export function mixedRadix(bases: readonly number[]): NumeralSystem | undefined {
  if (bases.length === 0 || !bases.every((b) => isInt(b) && b >= 1)) return undefined;
  const weights = bases.map((_, i) => bases.slice(i + 1).reduce((a, b) => a * b, 1));
  const total = bases.reduce((a, b) => a * b, 1);
  return {
    name: `MixedRadix(${bases.join(",")})`,
    shape: `digit i below ${bases.join(", ")}; leading digit unbounded`,
    toDigits: (n) => {
      if (!isInt(n) || n < 0) return undefined;
      const digits = [Math.floor(n / total)];
      let rest = n % total;
      for (const weight of weights) {
        digits.push(Math.floor(rest / weight));
        rest %= weight;
      }
      return digits;
    },
    fromDigits: (digits) => {
      if (digits.length !== bases.length + 1) return undefined;
      if (!digits.every((d) => isInt(d) && d >= 0)) return undefined;
      if (digits.slice(1).some((d, i) => d >= bases[i]!)) return undefined;
      return digits.slice(1).reduce((acc, d, i) => acc + d * weights[i]!, digits[0]! * total);
    },
  };
}

/**
 * Factoradic: place k has weight k! and digit at most k. The digits of n are the LEHMER
 * CODE of the n-th permutation in lexicographic order, which is why unranking a
 * permutation and writing a number in this system are the same operation.
 */
export function factoradic(): NumeralSystem {
  return {
    name: "Factoradic",
    shape: "digit at place k is at most k; the units digit is always 0",
    toDigits: (n) => {
      if (!isInt(n) || n < 0) return undefined;
      if (n === 0) return [0];
      const digits: number[] = [];
      let rest = n;
      for (let place = 1; rest > 0; place++) {
        digits.unshift(rest % place);
        rest = Math.floor(rest / place);
      }
      return digits;
    },
    fromDigits: (digits) => {
      // Read least-significant-first: place 0 has weight 0! and must hold 0.
      const reversed = [...digits].reverse();
      let factorial = 1;
      let total = 0;
      for (const [place, digit] of reversed.entries()) {
        if (!isInt(digit) || digit < 0 || digit > place) return undefined;
        total += digit * factorial;
        factorial *= place + 1;
      }
      return total;
    },
  };
}

const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];

/**
 * Primorial base: place k has weight p_1···p_k and digit below p_{k+1}. The same idea as
 * factoradic with the primes in place of the naturals.
 */
export function primorialRadix(): NumeralSystem {
  return {
    name: "PrimorialRadix",
    shape: "digit at place k is below the (k+1)-th prime",
    toDigits: (n) => {
      if (!isInt(n) || n < 0) return undefined;
      if (n === 0) return [0];
      const digits: number[] = [];
      let rest = n;
      for (let place = 0; rest > 0; place++) {
        const prime = PRIMES[place];
        if (prime === undefined) return undefined; // past the table
        digits.unshift(rest % prime);
        rest = Math.floor(rest / prime);
      }
      return digits;
    },
    fromDigits: (digits) => {
      const reversed = [...digits].reverse();
      let weight = 1;
      let total = 0;
      for (const [place, digit] of reversed.entries()) {
        const prime = PRIMES[place];
        if (prime === undefined) return undefined;
        if (!isInt(digit) || digit < 0 || digit >= prime) return undefined;
        total += digit * weight;
        weight *= prime;
      }
      return total;
    },
  };
}

// ── systems whose digits are constrained by a PATTERN, not a bound ──────────────

/** Fibonacci numbers 1, 2, 3, 5, 8, … — the Zeckendorf place values. */
function fibonacciWeights(limit: number): number[] {
  const weights = [1, 2];
  while (weights[weights.length - 1]! <= limit) {
    weights.push(weights[weights.length - 1]! + weights[weights.length - 2]!);
  }
  return weights;
}

/**
 * Zeckendorf: binary digits over the Fibonacci place values 1, 2, 3, 5, 8, … Every
 * positive integer has exactly one representation with NO TWO ADJACENT ONES, which is
 * the constraint that replaces a per-place bound. Greedy works, which is Zeckendorf's
 * theorem.
 */
export function zeckendorf(): NumeralSystem {
  return {
    name: "Zeckendorf",
    shape: "binary digits over Fibonacci places, with no two adjacent ones",
    toDigits: (n) => {
      if (!isInt(n) || n < 0) return undefined;
      if (n === 0) return [0];
      const weights = fibonacciWeights(n);
      const digits: number[] = [];
      let rest = n;
      let started = false;
      for (let i = weights.length - 1; i >= 0; i--) {
        const weight = weights[i]!;
        if (weight <= rest) {
          digits.push(1);
          rest -= weight;
          started = true;
        } else if (started) digits.push(0);
      }
      return digits;
    },
    fromDigits: (digits) => {
      if (!digits.every((d) => d === 0 || d === 1)) return undefined;
      // The forbidden pattern is the whole point: two adjacent ones is not a numeral.
      if (digits.some((d, i) => d === 1 && digits[i + 1] === 1)) return undefined;
      const weights = fibonacciWeights(2 ** digits.length);
      return digits.reduce<number>(
        (acc, d, i) => acc + d * (weights[digits.length - 1 - i] ?? 0),
        0,
      );
    },
  };
}

const binomial = (n: number, k: number): number => {
  if (k < 0 || n < k) return 0;
  let result = 1;
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1);
  return Math.round(result);
};

/**
 * The combinatorial number system of degree k: n ↔ the strictly decreasing tuple
 * c_k > … > c_1 ≥ 0 with n = C(c_k,k) + … + C(c_1,1). This IS the unranking of
 * k-subsets in colexicographic order — the digits are the subset.
 */
export function combinatorialSystem(k: number): NumeralSystem | undefined {
  if (!isInt(k) || k < 1) return undefined;
  return {
    name: `CombinatorialSystem(${k})`,
    shape: `a strictly decreasing k-tuple c_k > … > c_1 ≥ 0`,
    toDigits: (n) => {
      if (!isInt(n) || n < 0) return undefined;
      const digits: number[] = [];
      let rest = n;
      for (let place = k; place >= 1; place--) {
        // The largest c with C(c, place) ≤ rest.
        let c = place - 1;
        while (binomial(c + 1, place) <= rest) c++;
        digits.push(c);
        rest -= binomial(c, place);
      }
      return digits;
    },
    fromDigits: (digits) => {
      if (digits.length !== k) return undefined;
      if (!digits.every((d) => isInt(d) && d >= 0)) return undefined;
      if (digits.some((d, i) => i > 0 && d >= digits[i - 1]!)) return undefined; // strictly decreasing
      return digits.reduce((acc, c, i) => acc + binomial(c, k - i), 0);
    },
  };
}

// ── residue systems: no place values at all ─────────────────────────────────────

const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));

function inverseMod(a: number, m: number): number | undefined {
  let [old, cur] = [((a % m) + m) % m, m];
  let [s, next] = [1, 0];
  while (cur !== 0) {
    const q = Math.floor(old / cur);
    [old, cur] = [cur, old - q * cur];
    [s, next] = [next, s - q * next];
  }
  return old === 1 ? ((s % m) + m) % m : undefined;
}

/**
 * Residue number system: the "digits" are n mod each modulus, and there are no place
 * values — the digits are INDEPENDENT, which is what makes addition and multiplication
 * carry-free and parallel. By CRT the map is a bijection onto [0, ∏mᵢ) exactly when the
 * moduli are pairwise coprime; otherwise it is not a numeral system at all, and
 * `fromDigits` says so by returning nothing for an inconsistent digit string.
 */
export function residueSystem(moduli: readonly number[]): NumeralSystem | undefined {
  if (moduli.length === 0 || !moduli.every((m) => isInt(m) && m >= 2)) return undefined;
  const coprime = moduli.every((m, i) =>
    moduli.every((other, j) => i === j || gcd(m, other) === 1),
  );
  const total = moduli.reduce((a, b) => a * b, 1);
  return {
    name: `ResidueSystem(${moduli.join(",")})`,
    shape: coprime
      ? `independent residues mod ${moduli.join(", ")} — a bijection onto [0, ${total})`
      : `residues mod ${moduli.join(", ")} — NOT pairwise coprime, so not a bijection`,
    toDigits: (n) => {
      if (!isInt(n) || n < 0 || n >= total) return undefined;
      return moduli.map((m) => n % m);
    },
    fromDigits: (digits) => {
      if (digits.length !== moduli.length) return undefined;
      if (!digits.every((d, i) => isInt(d) && d >= 0 && d < moduli[i]!)) return undefined;
      // Reconstruct by CRT, then CHECK — with non-coprime moduli a digit string can be
      // inconsistent, and there is no integer to return.
      let result = 0;
      let combined = 1;
      for (const [i, m] of moduli.entries()) {
        const inverse = inverseMod(combined % m, m);
        if (inverse === undefined) {
          // Shared factor: fall back to a search over the span the CRT cannot resolve.
          const candidate = searchResidues(digits, moduli, total);
          return candidate;
        }
        const shift = (((digits[i]! - result) % m) + m) % m;
        result += combined * ((shift * inverse) % m);
        combined *= m;
      }
      return result % total;
    },
  };
}

/**
 * Ostrowski numeration: the numeral system a CONTINUED FRACTION defines.
 *
 * Given partial quotients $a_1, a_2, \dots$ of an irrational α, the denominators of its
 * convergents obey q_k = a_k q_{k−1} + q_{k−2}, and those are the place values. Every
 * integer in range then has exactly one representation
 *
 *     N = b_1 q_0 + b_2 q_1 + ⋯ + b_m q_{m−1}
 *
 * subject to 0 ≤ b_1 < a_1, 0 ≤ b_k ≤ a_k, and — the rule that does the real work —
 * b_{k−1} = 0 whenever b_k reaches its ceiling a_k. That last condition is what forbids a
 * carry and makes the representation unique; it is the general form of Zeckendorf's "no
 * two adjacent Fibonacci numbers".
 *
 * Which is not a coincidence: all quotients equal to 1 is the golden ratio, the q_k are
 * the Fibonacci numbers, and the ceiling rule becomes exactly that. Zeckendorf is the
 * α = φ case of this system, and the tests check the two against each other.
 *
 * Digits are most significant first, i.e. [b_m, …, b_1].
 */
export function ostrowski(quotients: readonly number[]): NumeralSystem | undefined {
  const m = quotients.length;
  if (m === 0 || m > 64) return undefined;
  if (!quotients.every((a) => isInt(a) && a >= 1)) return undefined;
  // q_0 = 1, and q_k = a_k q_{k−1} + q_{k−2} — the convergents' denominators.
  const places: number[] = [1];
  for (let k = 1; k <= m; k++) {
    const next = quotients[k - 1]! * places[k - 1]! + (k >= 2 ? places[k - 2]! : 0);
    if (!Number.isSafeInteger(next)) return undefined;
    places.push(next);
  }
  const ceiling = (index: number): number => quotients[index]!; // index is k − 1
  /** Whether [b_m … b_1] obeys the ceilings and the no-carry rule. */
  const admits = (digits: readonly number[]): boolean => {
    // digits[i] is b_{m−i}; read it back in ascending order as b_1 … b_m.
    const ascending = [...digits].reverse();
    if (ascending[0]! >= ceiling(0)) return false; // b_1 < a_1, strictly
    for (let k = 1; k < m; k++) {
      if (ascending[k]! > ceiling(k)) return false;
      if (ascending[k] === ceiling(k) && ascending[k - 1] !== 0) return false;
    }
    return true;
  };
  return {
    name: `Ostrowski([${quotients.join(", ")}])`,
    shape: `digits over the convergent denominators ${places.slice(0, m).join(", ")}, no digit at its ceiling above a non-zero one`,
    toDigits: (n) => {
      if (!isInt(n) || n < 0 || n >= places[m]!) return undefined;
      // Greedy from the top. It lands inside the constraints by itself: taking as much as
      // possible at q_k leaves less than q_k, hence never enough to fill q_{k−1} to its
      // ceiling as well.
      const digits: number[] = [];
      let rest = n;
      for (let k = m; k >= 1; k--) {
        const place = places[k - 1]!;
        const digit = Math.floor(rest / place);
        digits.push(digit);
        rest -= digit * place;
      }
      return digits;
    },
    fromDigits: (digits) => {
      if (digits.length > m || !digits.every((d) => isInt(d) && d >= 0)) return undefined;
      const padded = [...Array.from({ length: m - digits.length }, () => 0), ...digits];
      if (!admits(padded)) return undefined;
      return padded.reduce((total, digit, i) => total + digit * places[m - 1 - i]!, 0);
    },
  };
}

/** The unique n < total matching every residue, when CRT cannot be run directly. */
function searchResidues(
  digits: readonly number[],
  moduli: readonly number[],
  total: number,
): number | undefined {
  for (let n = 0; n < total; n++) {
    if (moduli.every((m, i) => n % m === digits[i])) return n;
  }
  return undefined;
}

// ── b-adic truncation ───────────────────────────────────────────────────────────

/**
 * The first `prec` b-adic digits, always `prec` of them: the expansion has no left end, so
 * a fixed cut is the only honest width. For n ≥ 0 these are the base-b digits with
 * leading zeros; for n < 0 they are the digits of n mod b^prec — `−1` is `prec` copies
 * of b−1 — which is where this system and fixed radix part ways: the sign is spelled by
 * the digits. Reading back takes the residue nearest zero, so the round trip is a
 * bijection between (−b^prec/2, b^prec/2] and width-`prec` strings.
 */
export function adicNumerals(b: number, prec: number = 20): NumeralSystem | undefined {
  if (!isInt(b) || b < 2 || !isInt(prec) || prec < 1) return undefined;
  const base = BigInt(b);
  const modulus = base ** BigInt(prec);
  const nearestZero = (residue: bigint, span: bigint): bigint =>
    residue * 2n > span ? residue - span : residue;
  return {
    name: `AdicNumerals(${b}, ${prec})`,
    shape: `${prec} digits 0…${b - 1}; a negative carries infinitely many leading ${b - 1}s, cut at ${prec}`,
    toDigits: (n) => {
      if (!isInt(n)) return undefined;
      let rest = ((BigInt(n) % modulus) + modulus) % modulus;
      if (nearestZero(rest, modulus) !== BigInt(n)) return undefined; // does not fit the width
      const digits: number[] = [];
      for (let i = 0; i < prec; i += 1) {
        digits.unshift(Number(rest % base));
        rest /= base;
      }
      return digits;
    },
    fromDigits: (digits) => {
      if (!digits.every((d) => isInt(d) && d >= 0 && d < b)) return undefined;
      const span = base ** BigInt(digits.length);
      const residue = digits.reduce((acc, d) => acc * base + BigInt(d), 0n);
      const signed = nearestZero(residue, span);
      return Number.isSafeInteger(Number(signed)) ? Number(signed) : undefined;
    },
  };
}
