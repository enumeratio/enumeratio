import { expect, test } from "vite-plus/test";
import {
  adicNumerals,
  balancedRadix,
  bijectiveRadix,
  combinatorialSystem,
  factoradic,
  mixedRadix,
  negativeRadix,
  type DigitBound,
  type NumeralSystem,
  ostrowski,
  primorialRadix,
  radix,
  residueSystem,
  zeckendorf,
} from "../src/systems.ts";

/** The property every numeral system must have: digits are a faithful re-spelling. */
const roundTrips = (system: NumeralSystem, values: readonly number[]): void => {
  for (const n of values) {
    const digits = system.toDigits(n);
    expect(digits, `${system.name} has digits for ${n}`).toBeDefined();
    expect(system.fromDigits(digits ?? []), `${system.name} round-trips ${n}`).toBe(n);
  }
};

const range = (lo: number, hi: number) => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);

test("every system round-trips over its domain", () => {
  const nonNegative = range(0, 400);
  roundTrips(radix(2)!, nonNegative);
  roundTrips(radix(7)!, nonNegative);
  roundTrips(radix(16)!, nonNegative);
  roundTrips(factoradic(), nonNegative);
  roundTrips(primorialRadix(), nonNegative);
  roundTrips(zeckendorf(), nonNegative);
  roundTrips(mixedRadix([24, 60, 60])!, nonNegative);
  roundTrips(combinatorialSystem(3)!, nonNegative);
  roundTrips(residueSystem([3, 5, 7])!, range(0, 104)); // 3·5·7 = 105
  roundTrips(bijectiveRadix(26)!, range(1, 400)); // no numeral for zero
  // These three represent NEGATIVES with no sign at all.
  roundTrips(balancedRadix(3)!, range(-200, 200));
  roundTrips(negativeRadix(2)!, range(-200, 200));
  roundTrips(negativeRadix(10)!, range(-200, 200));
});

/** A system's numerals obey its own declared shape: range, width and per-place bounds. */
const keepsShape = (system: NumeralSystem, values: readonly number[]): void => {
  const {
    range: [lo, hi],
    digits,
    width,
  } = system.shape;
  const within = (d: number, [least, most]: DigitBound) =>
    d >= least && (most === undefined || d <= most);
  for (const n of values) {
    const inRange = (lo === undefined || BigInt(n) >= lo) && (hi === undefined || BigInt(n) <= hi);
    const spelled = system.toDigits(n);
    expect(spelled !== undefined, `${system.name} spells ${n} iff it is in range`).toBe(inRange);
    if (spelled === undefined) continue;
    if (width !== undefined) expect(spelled, `${system.name} width at ${n}`).toHaveLength(width);
    if (digits === undefined) continue;
    const bounds = typeof digits[0] === "number" ? undefined : (digits as readonly DigitBound[]);
    spelled.forEach((d, i) => {
      const bound = bounds?.[i] ?? (digits as DigitBound);
      expect(within(d, bound), `${system.name} digit ${i} of ${n}`).toBe(true);
    });
  }
};

test("every system keeps the shape it declares", () => {
  const sample = range(-150, 450);
  for (const system of [
    radix(2)!,
    radix(16)!,
    balancedRadix(3)!,
    negativeRadix(2)!,
    bijectiveRadix(26)!,
    mixedRadix([24, 60, 60])!,
    factoradic(),
    primorialRadix(),
    zeckendorf(),
    combinatorialSystem(3)!,
    residueSystem([3, 5, 7])!,
    residueSystem([4, 6])!,
    ostrowski([2, 2, 2])!,
    adicNumerals(10, 2)!,
    adicNumerals(3, 5)!,
  ]) {
    keepsShape(system, sample);
  }
});

// ── each system's digits, characterised independently of how they were produced ──

test("factoradic: digit at place k is at most k, and the weights are factorials", () => {
  for (const n of range(0, 300)) {
    const digits = factoradic().toDigits(n)!;
    // Least-significant-first, digit at place k must satisfy 0 ≤ d ≤ k.
    const reversed = [...digits].reverse();
    reversed.forEach((d, place) => {
      expect(d, `${n} place ${place}`).toBeGreaterThanOrEqual(0);
      expect(d, `${n} place ${place}`).toBeLessThanOrEqual(place);
    });
    // And Σ d_k · k! is n, computed here rather than trusted.
    let factorial = 1;
    let total = 0;
    reversed.forEach((d, place) => {
      total += d * factorial;
      factorial *= place + 1;
    });
    expect(total).toBe(n);
  }
  expect(factoradic().toDigits(5)).toEqual([2, 1, 0]); // 2·2! + 1·1! + 0·0!
  expect(factoradic().toDigits(463)).toEqual([3, 4, 1, 0, 1, 0]);
});

test("Zeckendorf: binary digits, never two ones adjacent", () => {
  for (const n of range(1, 400)) {
    const digits = zeckendorf().toDigits(n)!;
    expect(digits.every((d) => d === 0 || d === 1)).toBe(true);
    expect(
      digits.some((d, i) => d === 1 && digits[i + 1] === 1),
      `${n}`,
    ).toBe(false);
    expect(digits[0]).toBe(1); // no leading zero
  }
  // 100 = 89 + 8 + 3, and 89 is the tenth Fibonacci place, so the numeral is ten digits.
  expect(zeckendorf().toDigits(100)).toEqual([1, 0, 0, 0, 0, 1, 0, 1, 0, 0]);
  // Two adjacent ones is not a numeral, even though the weights would add up.
  expect(zeckendorf().fromDigits([1, 1])).toBeUndefined();
});

test("balanced ternary: digits in {−1,0,1}, and negation is digit-wise", () => {
  const system = balancedRadix(3)!;
  for (const n of range(-200, 200)) {
    const digits = system.toDigits(n)!;
    expect(digits.every((d) => d >= -1 && d <= 1)).toBe(true);
    // Negating every digit negates the number — the payoff of a signless system.
    expect(system.fromDigits(digits.map((d) => -d))).toBe(n === 0 ? 0 : -n);
  }
  expect(system.toDigits(5)).toEqual([1, -1, -1]); // 9 − 3 − 1
});

test("negative base: digits are ordinary, the place values alternate", () => {
  const system = negativeRadix(2)!;
  for (const n of range(-200, 200)) {
    expect(system.toDigits(n)!.every((d) => d === 0 || d === 1)).toBe(true);
  }
  expect(system.toDigits(-2)).toEqual([1, 0]); // (−2)^1 = −2
  expect(system.toDigits(3)).toEqual([1, 1, 1]); // 4 − 2 + 1
});

test("bijective base 26 is spreadsheet column lettering", () => {
  const system = bijectiveRadix(26)!;
  const letters = (n: number) =>
    (system.toDigits(n) ?? []).map((d) => String.fromCharCode(64 + d)).join("");
  expect(letters(1)).toBe("A");
  expect(letters(26)).toBe("Z");
  expect(letters(27)).toBe("AA");
  expect(letters(52)).toBe("AZ");
  expect(letters(702)).toBe("ZZ");
  expect(letters(703)).toBe("AAA");
  // Zero is the EMPTY numeral — the one string over {1…26} left over once every positive
  // integer has taken one. That is exactly what "bijective" claims, and declining here
  // would leave the round trip undefined at the only point where it is interesting.
  expect(system.toDigits(0)).toEqual([]);
  expect(letters(0)).toBe("");
  expect(system.fromDigits([])).toBe(0);
  for (const n of range(0, 400)) {
    expect(system.toDigits(n)!.every((d) => d >= 1 && d <= 26)).toBe(true);
    expect(system.fromDigits(system.toDigits(n)!), `round trip at ${n}`).toBe(n);
  }
});

test("mixed radix reads a second count as days, hours, minutes, seconds", () => {
  const clock = mixedRadix([24, 60, 60])!;
  expect(clock.toDigits(93_784)).toEqual([1, 2, 3, 4]); // 1d 2h 3m 4s
  expect(clock.fromDigits([1, 2, 3, 4])).toBe(93_784);
  expect(clock.fromDigits([0, 25, 0, 0])).toBeUndefined(); // 25 hours is not a digit
  for (const n of range(0, 300)) {
    const digits = clock.toDigits(n)!;
    expect(digits.length).toBe(4);
    expect(digits[1]!).toBeLessThan(24);
    expect(digits[2]!).toBeLessThan(60);
    expect(digits[3]!).toBeLessThan(60);
  }
});

test("primorial base: digit at place k is below the (k+1)-th prime", () => {
  const primes = [2, 3, 5, 7, 11, 13];
  for (const n of range(0, 300)) {
    const reversed = [...primorialRadix().toDigits(n)!].reverse();
    reversed.forEach((d, place) => expect(d).toBeLessThan(primes[place]!));
  }
  expect(primorialRadix().toDigits(30)).toEqual([1, 0, 0, 0]); // 1·30
});

test("the combinatorial system IS k-subset unranking", () => {
  const system = combinatorialSystem(3)!;
  for (const n of range(0, 200)) {
    const digits = system.toDigits(n)!;
    expect(digits.length).toBe(3);
    expect(digits.every((d, i) => i === 0 || d < digits[i - 1]!)).toBe(true); // strictly decreasing
  }
  expect(system.toDigits(0)).toEqual([2, 1, 0]); // the first 3-subset
  // Colexicographic order: the ranks march through the 3-subsets in order.
  const ranks = range(0, 9).map((n) => system.toDigits(n)!.join(""));
  expect(new Set(ranks).size).toBe(10); // all distinct
  expect(system.fromDigits([3, 2, 1])).toBe(3); // C(3,3) + C(2,2) + C(1,1)
});

test("residue systems are carry-free and need pairwise coprime moduli", () => {
  const rns = residueSystem([3, 5, 7])!;
  expect(rns.toDigits(23)).toEqual([2, 3, 2]);
  // Addition is digit-wise: no carries, which is the whole point of an RNS.
  const a = rns.toDigits(23)!;
  const b = rns.toDigits(41)!;
  const sum = a.map((d, i) => (d + b[i]!) % [3, 5, 7][i]!);
  expect(rns.fromDigits(sum)).toBe((23 + 41) % 105);
  // Outside [0, ∏m) there is no numeral.
  expect(rns.toDigits(105)).toBeUndefined();
  // Non-coprime moduli: not a bijection, and an inconsistent digit string has no value.
  const shared = residueSystem([4, 6])!;
  expect(shared.shape.bijective).toBe(false);
  expect(shared.fromDigits([1, 2])).toBeUndefined(); // n ≡ 1 (mod 4) and 2 (mod 6) is unsolvable
  expect(shared.fromDigits([2, 2])).toBe(2);
});

test("a malformed base yields no system at all", () => {
  expect(radix(1)).toBeUndefined();
  expect(balancedRadix(4)).toBeUndefined(); // must be odd
  expect(bijectiveRadix(0)).toBeUndefined();
  expect(combinatorialSystem(0)).toBeUndefined();
  expect(residueSystem([])).toBeUndefined();
  expect(mixedRadix([])).toBeUndefined();
});

test("Ostrowski numeration round-trips, and every representation is admissible", () => {
  for (const quotients of [[1, 1, 1, 1, 1, 1, 1], [2, 2, 2], [1, 2, 3, 1, 2], [3, 1, 4, 1], [5]]) {
    const system = ostrowski(quotients)!;
    // The range is exactly q_m, so the digit strings and the integers below it correspond.
    let range = 1;
    let previous = 0;
    for (const a of quotients) [previous, range] = [range, a * range + previous];
    for (let n = 0; n < range; n++) {
      const digits = system.toDigits(n);
      expect(digits, `${system.name} at ${n}`).toBeDefined();
      expect(system.fromDigits(digits!), `${system.name} at ${n}`).toBe(n);
    }
    // …and nothing outside the range has a representation.
    expect(system.toDigits(range), system.name).toBeUndefined();
    expect(system.toDigits(-1), system.name).toBeUndefined();
  }
});

test("Ostrowski at the golden ratio IS Zeckendorf", () => {
  // All quotients 1 is the continued fraction of φ, so the place values are the Fibonacci
  // numbers and the ceiling rule becomes "no two adjacent". The only difference is
  // bookkeeping: b_1 is forced to zero, because b_1 < a_1 = 1.
  const golden = ostrowski([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])!;
  const fibonacci = zeckendorf();
  const trim = (digits: readonly number[]): number[] => {
    const dropped = digits.slice(0, -1); // the forced b_1
    const first = dropped.findIndex((d) => d !== 0);
    return first < 0 ? [0] : dropped.slice(first);
  };
  for (let n = 1; n < 80; n++) {
    const viaOstrowski = golden.toDigits(n);
    if (viaOstrowski === undefined) break;
    expect(viaOstrowski[viaOstrowski.length - 1], `b₁ at ${n}`).toBe(0);
    expect(trim(viaOstrowski), `n = ${n}`).toEqual(fibonacci.toDigits(n));
  }
});

test("Ostrowski admits exactly the strings its ceiling rule allows", () => {
  // Counting them is the uniqueness statement: as many admissible strings as integers.
  const quotients = [2, 2, 2];
  const system = ostrowski(quotients)!;
  let admissible = 0;
  for (let b3 = 0; b3 <= 2; b3++) {
    for (let b2 = 0; b2 <= 2; b2++) {
      for (let b1 = 0; b1 <= 2; b1++) {
        if (system.fromDigits([b3, b2, b1]) !== undefined) admissible++;
      }
    }
  }
  expect(admissible).toBe(12); // q_3 = 2·5 + 2
  // A digit sitting at its ceiling forbids a non-zero digit below it.
  expect(system.fromDigits([0, 2, 0])).toBe(4);
  expect(system.fromDigits([0, 2, 1])).toBeUndefined();
  expect(system.fromDigits([2, 0, 1])).toBe(11);
  expect(system.fromDigits([2, 1, 0])).toBeUndefined();
  expect(ostrowski([])).toBeUndefined();
  expect(ostrowski([1, 0, 1])).toBeUndefined();
});
