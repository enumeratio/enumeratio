// The predicate-scan sets defined in Epsil (src/families/scan-definitions.ts), held to references written
// here from each set's definition (factorizations off a sieve): every stated bound holds the n-th member,
// the definitions agree with the references on the first ranks, on every number in a range and on ranks;
// the kernel from the definitions alone and the one with its TS fast path agree with them where the
// interpreter reaches, and decline, never answer wrong, past it. DEEP_TESTS=1 goes farther.

import { compileTyped } from "@enumeratio/engine/compiled";
import { bareEngine } from "@enumeratio/engine/testing";
import { evaluateEpsil } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import {
  epsilKernelOn,
  type EpsilFamily,
  isEpsilFamily,
  kernelOn,
  liftFamily,
  operationTypes,
} from "../src/families/epsil.ts";
import { entries as digits } from "../src/families/numeric-digits-primes.ts";
import { entries as divisor } from "../src/families/numeric-divisor.ts";
import { entries as sets } from "../src/families/numeric-sets.ts";
import { definitions, scans } from "../src/families/scan-definitions.ts";
import { needsBigint } from "../src/families/types.ts";

const ce = bareEngine();
const DEEP = process.env.DEEP_TESTS === "1";

// ---- References: each set's definition read off the factorization of n. ----

const SIEVE = DEEP ? 12_000_000 : 2_000_000;
const smallest = new Int32Array(SIEVE + 1);
for (let i = 2; i <= SIEVE; i++)
  if (smallest[i] === 0) for (let j = i; j <= SIEVE; j += i) if (smallest[j] === 0) smallest[j] = i;

/** The primes of n and their exponents, ascending. */
function factor(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let m = n; m > 1;) {
    const p = smallest[m];
    let e = 0;
    while (m % p === 0) [m, e] = [m / p, e + 1];
    out.push([p, e]);
  }
  return out;
}
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const sigma = (n: number): number => {
  let total = 1;
  for (const [p, e] of factor(n)) total *= (p ** (e + 1) - 1) / (p - 1);
  return total;
};
const omega = (n: number): number => factor(n).reduce((sum, [, e]) => sum + e, 0);
const divisorGcd = (n: number): number => factor(n).reduce((g, [, e]) => gcd(g, e), 0);

/** Whether n ≥ 1 is a member, for the family at `p`. */
const MEMBER: Record<string, (n: number, p: number[]) => boolean> = {
  PrimeNumbers: (n) => omega(n) === 1,
  SemiprimeNumbers: (n) => omega(n) === 2,
  SquarefreeSemiprimes: (n) => omega(n) === 2 && factor(n).length === 2,
  SphenicNumbers: (n) => omega(n) === 3 && factor(n).length === 3,
  PrimePowerNumbers: (n) => factor(n).length === 1,
  KAlmostPrimes: (n, [k]) => omega(n) === k,
  RoughNumbers: (n, [k]) => factor(n).every(([q]) => q >= k),
  AbundantNumbers: (n) => sigma(n) > 2 * n,
  DeficientNumbers: (n) => sigma(n) < 2 * n,
  SquareFreeNumbers: (n) => factor(n).every(([, e]) => e === 1),
  KFreeIntegers: (n, [k]) => factor(n).every(([, e]) => e < k),
  SmoothNumbers: (n, [k]) => factor(n).every(([q]) => q <= k),
  PowerfulNumbers: (n) => factor(n).every(([, e]) => e >= 2),
  PerfectPowerNumbers: (n) => n > 1 && divisorGcd(n) >= 2,
  AchillesNumbers: (n) => n > 1 && factor(n).every(([, e]) => e >= 2) && divisorGcd(n) === 1,
};

/** The params each family is checked at. */
const PARAMS: Record<string, number[][]> = {
  KAlmostPrimes: [[0], [1], [2], [3], [4]],
  RoughNumbers: [[0], [1], [2], [3], [5], [7]],
  KFreeIntegers: [[0], [1], [2], [3], [4]],
  SmoothNumbers: [[0], [1], [2], [3], [5]],
};
const paramsOf = (head: string): number[][] => PARAMS[head] ?? [[]];
const where = (head: string, p: number[]): string => `${head}(${p.join(", ")})`;
/** How many members: none below Ω = 0 and just 1 at it; just 1 below k = 2 for k-free and k-smooth numbers. */
const countOf = (head: string, [k]: number[]): bigint | number =>
  head === "KAlmostPrimes" && k < 1
    ? BigInt(k === 0 ? 1 : 0)
    : ["KFreeIntegers", "SmoothNumbers"].includes(head) && k < 2
      ? 1n
      : Infinity;

/** The first `count` members, or as many as fit under the sieve (smooth numbers are rare: those are built). */
function membersOf(head: string, p: number[], wanted: number): number[] {
  const count = Math.min(wanted, Number(countOf(head, p)));
  const out: number[] = [];
  if (head === "SmoothNumbers") {
    // Every product of the primes up to k, in order: a set of sorted values grown by one prime at a time.
    const primes = Array.from({ length: Math.max(p[0] - 1, 0) }, (_, i) => i + 2).filter((q) => omega(q) === 1);
    let found = [1];
    for (const q of primes) {
      const next = new Set(found);
      for (const x of found) for (let y = x * q; y < 1e12; y *= q) next.add(y);
      found = [...next].toSorted((a, b) => a - b);
    }
    return found.slice(0, count);
  }
  for (let n = 1; n <= SIEVE && out.length < count; n++) if (MEMBER[head](n, p)) out.push(n);
  return out;
}

/** An Epsil definition's operation, compiled. */
function compiled(
  family: EpsilFamily,
  operation: "unrank" | "rank" | "valid",
): (vars: Record<string, unknown>) => unknown {
  const run = compileTyped(ce, family.epsil[operation], operationTypes(family, operation)!)?.run;
  expect(run, `${family.head}.${operation} compiles`).toBeDefined();
  return run!;
}

const found = [...sets, ...divisor, ...digits];
const entry = (head: string) => liftFamily(found.find((f) => f.head === head)!);
const epsil = (head: string) => epsilKernelOn(ce, definitions.get(head)!);
const full = (head: string) => kernelOn(ce, entry(head));
const answer = <T>(read: () => T): T | "declined" => {
  try {
    return read();
  } catch (error) {
    if (needsBigint(error)) return "declined";
    throw error;
  }
};

/** The ranks, members and numbers the interpreter alone reaches at `p`: where `early` stops declining. */
function reachOf(head: string, p: number[]): { ranks: number; members: number; numbers: number } {
  const early = definitions.get(head)!.early!;
  const last = (declines: (x: number) => boolean, from: number): number => {
    let x = from;
    while (x < 10 ** 12 && !declines(x + 1)) x = x < 1000 ? x + 1 : Math.floor(x * 1.01);
    return x;
  };
  return {
    ranks: last((r) => early.unrank!(BigInt(r), p) === "decline", 0),
    members: last((x) => early.rank!(x, p) === "decline", 1),
    numbers: last((x) => early.member!(x, p) === "decline", 1),
  };
}

const family = (head: string): EpsilFamily => definitions.get(head)!;

test("the scans are Epsil definitions with their TS kernels as fast paths", () => {
  expect(definitions.size).toBe(Object.keys(MEMBER).length);
  for (const head of definitions.keys()) {
    const entryFamily = entry(head);
    expect(isEpsilFamily(entryFamily), head).toBe(true);
    expect(kernelOn(ce, entryFamily).fast, head).toBe(true);
    expect(epsil(head).fast, head).toBeUndefined();
  }
});

// A bound that fell short of the n-th member would give a count where the member should be: every one is held to the members.
test("every bound holds the n-th member", () => {
  for (const { head, bound } of scans) {
    for (const p of paramsOf(head)) {
      const count = head === "SmoothNumbers" ? 40 : DEEP ? 3000 : 1000;
      const members = membersOf(head, p, count);
      const types = Object.fromEntries([["_n", "integer"], ...(p.length === 0 ? [] : [["_k", "integer"]])]);
      const run = compileTyped(ce, bound("_n"), types)?.run;
      expect(run, `${where(head, p)} bound compiles`).toBeDefined();
      members.forEach((member, i) => {
        const limit = run!({ _n: i + 1, _k: p[0] }) as number;
        expect([where(head, p), i + 1, member <= limit], `${member} <= ${limit}`).toEqual([
          where(head, p),
          i + 1,
          true,
        ]);
      });
      // The family has the members the bound reaches for (no tests of a member that does not exist).
      expect(members.length, where(head, p)).toBe(Math.min(count, Number(countOf(head, p))));
    }
  }
});

for (const head of definitions.keys()) {
  for (const p of paramsOf(head)) {
    const at = where(head, p);
    const bind = (vars: Record<string, unknown>): Record<string, unknown> => ({
      ...(p.length === 0 ? {} : { _k: p[0] }),
      ...vars,
    });
    // How many ranks the definition's own run is checked at: a scan costs the sum of its predicate over the bound.
    const ranks =
      (DEEP ? 3 : 1) * ({ PerfectPowerNumbers: 120, PowerfulNumbers: 120, AchillesNumbers: 25 }[head] ?? 150);

    test(`${at}: the first members, their ranks and the numbers between`, () => {
      const members = membersOf(head, p, head === "SmoothNumbers" ? 18 : ranks);
      const unrank = compiled(family(head), "unrank");
      const place = compiled(family(head), "rank");
      const valid = compiled(family(head), "valid");
      members.forEach((member, r) => expect([at, r, unrank(bind({ _r: r }))]).toEqual([at, r, member]));
      const last = members.at(-1)!;
      const horizon = Math.min(last, head === "SmoothNumbers" ? 2000 : DEEP ? 60_000 : 6000);
      for (let x = -2; x <= horizon; x++) {
        const rank = x < 1 ? -1 : members.indexOf(x);
        expect([at, x, valid(bind({ _x: x }))]).toEqual([at, x, x >= 1 && MEMBER[head](x, p)]);
        // A rank costs a scan below the number, so it is read only for the lower part of the range.
        if (x <= (DEEP ? 1500 : 400) && x !== 0) expect([at, x, place(bind({ _x: x }))]).toEqual([at, x, rank]);
      }
    });

    // Ranks past the first few hundred come from the same scan: a sample as far out as the bounds are cheap.
    test(`${at}: ranks far out`, () => {
      if (head === "SmoothNumbers" || countOf(head, p) !== Infinity) return;
      const far = { PerfectPowerNumbers: [300, 600], PowerfulNumbers: [300, 600], AchillesNumbers: [60, 100] }[
        head
      ] ?? [400, 1000, 2000];
      const members = membersOf(head, p, Math.max(...far) + 1);
      const unrank = compiled(family(head), "unrank");
      const place = compiled(family(head), "rank");
      for (const r of far.slice(0, DEEP ? 3 : 2)) {
        expect([at, r, unrank(bind({ _r: r }))]).toEqual([at, r, members[r]]);
        expect([at, r, place(bind({ _x: members[r] }))]).toEqual([at, r, r]);
      }
    });

    test(`${at}: the kernels from the definitions and with the fast path agree where the interpreter reaches`, () => {
      const reach = reachOf(head, p);
      const members = membersOf(head, p, Math.min(reach.ranks + 1, 400) + 5);
      const count = Math.min(members.length - 5, Math.min(reach.ranks + 1, 400));
      for (const [name, kernel] of [
        ["Epsil", epsil(head)],
        ["fast", full(head)],
      ] as const) {
        expect([name, kernel.count(p)]).toEqual([name, countOf(head, p)]);
        for (let r = 0; r < Math.min(count, Number(countOf(head, p))); r++)
          expect([name, r, kernel.unrank(p, BigInt(r))]).toEqual([name, r, members[r]]);
        for (let x = -1; x <= Math.min(members[count - 1] ?? 30, 150); x++) {
          const member = x >= 1 && MEMBER[head](x, p);
          expect([name, x, kernel.valid(x, p)]).toEqual([name, x, member]);
          // The definitions alone decline the rank of a member past their reach.
          if (member && (name === "fast" || x <= reach.members))
            expect([name, x, kernel.rank(x, p)]).toEqual([name, x, BigInt(members.indexOf(x))]);
          else if (!member) expect([name, x, kernel.rank(x, p)]).toEqual([name, x, -1n]);
        }
      }
    });
  }
}

// Past the reach the interpreter alone declines; the kernel with its fast path still answers, exactly.
test("what is out of the interpreter's reach is declined by the definitions and answered by the fast path", () => {
  for (const head of definitions.keys()) {
    for (const p of paramsOf(head)) {
      const at = where(head, p);
      if (countOf(head, p) !== Infinity) continue;
      const { ranks, members, numbers } = reachOf(head, p);
      const kernel = epsil(head);
      const fast = full(head);
      for (const r of [BigInt(ranks + 1), 10n ** 6n, 2n ** 60n]) {
        expect([at, r, answer(() => kernel.unrank(p, r))]).toEqual([at, r, "declined"]);
      }
      // The first rank past the reach, where the sets are cheap to scan, is a fast-path answer.
      const next = membersOf(head, p, ranks + 2);
      if (head !== "SmoothNumbers") expect([at, fast.unrank(p, BigInt(ranks + 1))]).toEqual([at, next[ranks + 1]]);
      // A member past the reach of rank is declined, never answered wrong; the fast path knows its rank.
      const wide = membersOf(head, p, members + 40).find((m) => m > members);
      if (wide !== undefined) {
        expect([at, wide, answer(() => kernel.rank(wide, p))]).toEqual([at, wide, "declined"]);
        expect([at, wide, fast.rank(wide, p)]).toEqual([at, wide, BigInt(membersOf(head, p, 100_000).indexOf(wide))]);
      }
      expect(numbers, at).toBeGreaterThan(1000);
    }
  }
});

// A number too large to scan is declined (a member is never denied), at 2^53 and far beyond.
test("a number past the safe integers is declined or answered true, never denied", () => {
  const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
  const prime = 2n ** 89n - 1n;
  const members: Record<string, [bigint, number[]]> = {
    PrimeNumbers: [prime, []],
    SemiprimeNumbers: [2n * prime, []],
    SquarefreeSemiprimes: [3n * prime, []],
    SphenicNumbers: [6n * prime, []],
    PrimePowerNumbers: [2n ** 100n, []],
    KAlmostPrimes: [4n * prime, [3]],
    RoughNumbers: [prime, [3]],
    AbundantNumbers: [6n * 10n ** 30n, []],
    DeficientNumbers: [prime, []],
    SquareFreeNumbers: [prime, []],
    KFreeIntegers: [prime, [3]],
    SmoothNumbers: [2n ** 100n * 3n ** 50n, [3]],
    PowerfulNumbers: [10n ** 30n, []],
    PerfectPowerNumbers: [10n ** 30n, []],
    // 8q² for the prime q = 2^31 − 1.
    AchillesNumbers: [8n * (2n ** 31n - 1n) ** 2n, []],
  };
  expect(Object.keys(members).toSorted()).toEqual([...definitions.keys()].toSorted());
  for (const [head, [x, p]] of Object.entries(members)) {
    expect(x > MAX_SAFE, head).toBe(true);
    for (const [name, kernel] of [
      ["Epsil", epsil(head)],
      ["fast", full(head)],
    ] as const) {
      const verdict = answer(() => kernel.valid(x as never, p));
      expect([head, name, verdict === false]).toEqual([head, name, false]);
      const place = answer(() => kernel.rank(x as never, p));
      expect([head, name, place === -1n]).toEqual([head, name, false]);
    }
  }
});

test("a rank below 0 is outside the fiber, and a number that is not an integer is no member", () => {
  for (const head of definitions.keys()) {
    for (const p of paramsOf(head).slice(0, 4)) {
      if (epsil(head).count(p) === 0n) continue;
      expect(() => epsil(head).unrank(p, -1n), head).toThrow(RangeError);
      expect(() => full(head).unrank(p, -1n), head).toThrow(RangeError);
      for (const [name, kernel] of [
        ["Epsil", epsil(head)],
        ["fast", full(head)],
      ] as const)
        for (const x of [0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY, [1]])
          expect([head, name, x, kernel.valid(x as never, p)]).toEqual([head, name, x, false]);
    }
  }
});

// The definitions as the interpreter reads them, bypassing compiled code and the fast paths.
test("the interpreted definitions give the same members and ranks", () => {
  for (const [head, definition] of definitions) {
    const p = paramsOf(head).at(Math.min(2, paramsOf(head).length - 1))!;
    const bind = p.length === 0 ? {} : { _k: p[0] };
    const members = membersOf(head, p, head === "SmoothNumbers" ? 6 : 3);
    members.slice(0, head === "AchillesNumbers" ? 1 : 3).forEach((member, r) => {
      expect([head, r, evaluateEpsil(ce, definition.epsil.unrank, { ...bind, _r: r })]).toEqual([head, r, member]);
      expect([head, r, evaluateEpsil(ce, definition.epsil.rank, { ...bind, _x: member })]).toEqual([head, r, r]);
    });
    for (let x = 1; x <= 12; x++)
      expect([head, x, evaluateEpsil(ce, definition.epsil.valid, { ...bind, _x: x })]).toEqual([
        head,
        x,
        MEMBER[head](x, p) ? "True" : "False",
      ]);
  }
});
