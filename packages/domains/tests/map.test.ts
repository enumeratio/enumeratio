import { ComputeEngine } from "@cortex-js/compute-engine";
import { ALL_STATISTICS, declareStatistics } from "@enumeratio/statistics/src";
import { expect, test } from "vite-plus/test";
import { declareDomains } from "../src/declare.ts";
import { DOMAINS } from "../src/domain-data.ts";
import { declareMaps, MAPS } from "../src/map.ts";

const domainTypes = Object.fromEntries(DOMAINS.map((d) => [d.name, d.type]));
const constructorFor = Object.fromEntries(DOMAINS.map((d) => [d.type, d.name]));

const ce = new ComputeEngine();
declareDomains(ce);
declareStatistics(ce, ALL_STATISTICS, { domainTypes });
declareMaps(ce, constructorFor);

const perm = (...entries: number[]): unknown => ["Permutation", ["List", ...entries]];
/** The contents of a map's result — the list inside the constructor. */
const result = (expr: unknown): unknown => {
  const evaluated = ce.box(expr as never).evaluate();
  const [contents] = (evaluated as unknown as { ops?: { json: unknown }[] }).ops ?? [];
  return contents?.json;
};

function permutations(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (const rest of permutations(n - 1))
    for (let i = 0; i <= rest.length; i++) out.push([...rest.slice(0, i), n, ...rest.slice(i)]);
  return out;
}
const ALL = [1, 2, 3, 4, 5].flatMap(permutations);

test("a map is typed by carrier, and rejects the wrong one", () => {
  // The reason domains came before maps: without them every map is list -> list.
  //
  // Checked on a map that does NOT extend a built-in — `CycleType` is ours alone, so a wrong
  // argument is a type error rather than being handed to compute-engine. The extended heads
  // deliberately behave differently; see the next test.
  expect(String(ce.box(["CycleType", perm(2, 3, 1)] as never).evaluate().type)).toBe(
    "integer_partition",
  );
  expect(ce.box(["CycleType", ["List", 2, 3, 1]]).evaluate().operator).toBe("Error");
  expect(
    ce.box(["CycleType", ["IntegerPartition", ["List", 2, 1]]] as never).evaluate().operator,
  ).toBe("Error");
});

test("extending a built-in keeps everything the built-in did", () => {
  // `Reverse`, `Complement` and `Inverse` are already compute-engine heads. Extending rather
  // than replacing means our carrier case is added as one more overload while every original
  // one survives — including the LAZY collection behaviour of `Reverse`, which has no
  // `evaluate` to delegate to and would have been lost by a naive replacement.
  expect(ce.box(["Count", ["Reverse", ["List", 1, 2, 3]]]).evaluate().re).toBe(3);
  expect(ce.box(["At", ["Reverse", ["List", 1, 2, 3]], 1]).evaluate().re).toBe(3);

  // An evaluate-backed head (Inverse) needs no second symbol and leaks nothing. A
  // collection-backed one (Complement) does, and a HELD built-in result prints under that
  // private name. The alternative — declaring our clause `-> collection` so the handlers can
  // sit on our own definition — removes the leak but breaks written composition, because the
  // head's declared return type stops being the carrier. Composition is worth more than the
  // cosmetics; see the composition test below.
  expect(JSON.stringify(ce.box(["Complement", ["Set", 1, 2]]).evaluate().json)).toContain(
    "Complement_",
  );
  expect(JSON.stringify(ce.box(["Inverse", 4]).evaluate().json)).not.toContain("Primitive");
});

test("Reverse, Complement and Inverse agree with plain readings", () => {
  for (const p of ALL) {
    const n = p.length;
    expect(result(["Reverse", perm(...p)]), `rev [${p}]`).toEqual(["List", ...[...p].reverse()]);
    expect(result(["Complement", perm(...p)]), `comp [${p}]`).toEqual([
      "List",
      ...p.map((v) => n + 1 - v),
    ]);
    const inverse = Array.from({ length: n }, (_, i) => p.indexOf(i + 1) + 1);
    expect(result(["Inverse", perm(...p)]), `inv [${p}]`).toEqual(["List", ...inverse]);
  }
});

test("Inverse is an involution, and Reverse is too", () => {
  // A property rather than a table — the kind of check a typed map makes expressible.
  for (const p of ALL) {
    expect(result(["Inverse", ["Inverse", perm(...p)]]), `[${p}]`).toEqual(["List", ...p]);
    expect(result(["Reverse", ["Reverse", perm(...p)]]), `[${p}]`).toEqual(["List", ...p]);
  }
});

test("DescentSet's size and sum are Descents and MajorIndex", () => {
  // The reduction worth having: two statistics become properties of one map's output.
  for (const p of ALL) {
    const descents = p
      .slice(0, -1)
      .map((_, k) => k + 1)
      .filter((i) => p[i - 1]! > p[i]!);
    // A finset is (members, n) — it carries its ground size — so the result is a Tuple. That
    // the shape shows up here rather than being papered over is the point of extracting
    // carrier shapes from enumeratio rather than guessing them.
    expect(result(["DescentSet", perm(...p)]), `[${p}]`).toEqual([
      "Tuple",
      ["List", ...descents],
      p.length,
    ]);
    expect(ce.box(["Descents", perm(...p)] as never).evaluate().re).toBe(descents.length);
    expect(ce.box(["MajorIndex", perm(...p)] as never).evaluate().re).toBe(
      descents.reduce((a, b) => a + b, 0),
    );
  }
});

test("ToLehmerCode is subexcedant and totals the inversions", () => {
  for (const p of ALL) {
    const code = p.map((v, i) => p.slice(i + 1).filter((w) => w < v).length);
    expect(result(["ToLehmerCode", perm(...p)]), `[${p}]`).toEqual(["List", ...code]);
    expect(ce.box(["Inversions", perm(...p)] as never).evaluate().re).toBe(
      code.reduce((a, b) => a + b, 0),
    );
  }
});

test("CycleType crosses carriers and partitions n", () => {
  const cycleLengths = (p: number[]): number[] => {
    const seen = new Array<boolean>(p.length).fill(false);
    const lengths: number[] = [];
    for (let start = 0; start < p.length; start++) {
      if (seen[start]) continue;
      let length = 0;
      let at = start;
      do {
        seen[at] = true;
        at = p[at]! - 1;
        length++;
      } while (at !== start);
      lengths.push(length);
    }
    return lengths.sort((a, b) => b - a);
  };
  expect(String(ce.box(["CycleType", perm(2, 3, 1)] as never).evaluate().type)).toBe(
    "integer_partition",
  );
  for (const p of ALL)
    expect(result(["CycleType", perm(...p)]), `[${p}]`).toEqual(["List", ...cycleLengths(p)]);
});

test("a map's output feeds a statistic of the TARGET carrier", () => {
  // CycleType(p) is an integer partition, so partition statistics apply to it — and
  // permutation statistics do not. That composition is the whole point of typing maps.
  const p = perm(2, 3, 1, 5, 4);
  expect(ce.box(["Length", ["CycleType", p]] as never).evaluate().operator).not.toBe("Error");
  expect(ce.box(["LargestPart", ["CycleType", p]] as never).evaluate().re).toBe(3);
  expect(ce.box(["FixedPoints", ["CycleType", p]] as never).evaluate().operator).toBe("Error");
});

test("the new maps agree with plain readings", () => {
  const rotateLeft = (p: number[]): number[] => (p.length === 0 ? [] : [...p.slice(1), p[0]!]);
  const rotateRight = (p: number[]): number[] =>
    p.length === 0 ? [] : [p.at(-1)!, ...p.slice(0, -1)];
  for (const p of ALL) {
    const n = p.length;
    expect(result(["CyclicShift", perm(...p)]), `shift [${p}]`).toEqual(["List", ...rotateLeft(p)]);
    expect(result(["InverseCyclicShift", perm(...p)]), `unshift [${p}]`).toEqual([
      "List",
      ...rotateRight(p),
    ]);
    const peaks = p
      .map((_, k) => k + 1)
      .filter((i) => i > 1 && i < n && p[i - 2]! < p[i - 1]! && p[i - 1]! > p[i]!);
    expect(result(["PeakSet", perm(...p)]), `peaks [${p}]`).toEqual([
      "Tuple",
      ["List", ...peaks],
      n,
    ]);
    expect(ce.box(["Peaks", perm(...p)] as never).evaluate().re, `[${p}]`).toBe(peaks.length);
  }
});

test("a written composition type-checks through an extended built-in", () => {
  // This is what the private-symbol route buys. `Reverse` declares `-> permutation`, so
  // `Complement(Reverse(p))` type-checks as written rather than only when each step is
  // evaluated first.
  const p = perm(2, 3, 1);
  expect(result(["Complement", ["Reverse", p]])).toEqual(result(["ReverseComplement", p]));
  expect(String(ce.box(["Reverse", p] as never).evaluate().type)).toBe("permutation");
});

test("a composed map really composes its steps", () => {
  // ReverseComplement is declared as Complement-after-Reverse rather than as a fresh walk,
  // and InverseAfterComplementAfterReverse stacks three. Each intermediate value is a
  // properly constructed carrier, so the composition is type-checked at every step.
  for (const p of ALL) {
    const n = p.length;
    const reversed = [...p].reverse();
    expect(result(["ReverseComplement", perm(...p)]), `[${p}]`).toEqual([
      "List",
      ...reversed.map((v) => n + 1 - v),
    ]);
    expect(result(["ReverseComplement", perm(...p)]), `= Complement(Reverse) [${p}]`).toEqual(
      result(["Complement", ["Reverse", perm(...p)]]),
    );
    expect(result(["InverseAfterComplementAfterReverse", perm(...p)]), `three-step [${p}]`).toEqual(
      result(["Inverse", ["Complement", ["Reverse", perm(...p)]]]),
    );
  }
});

test("every map names a carrier that exists", () => {
  for (const map of MAPS) {
    expect(
      DOMAINS.some((d) => d.type === map.from),
      map.name,
    ).toBe(true);
    expect(
      DOMAINS.some((d) => d.type === map.to),
      map.name,
    ).toBe(true);
  }
});

test("CyclePartition labels each position with its cycle's rank", () => {
  // A set partition IS a restricted growth string, so the block label is the rank of the
  // cycle's least element — not an arbitrary identifier.
  const rgs = (p: number[]): number[] => {
    const seen = new Array<boolean>(p.length).fill(false);
    const labels = new Array<number>(p.length).fill(0);
    let block = 0;
    for (let start = 0; start < p.length; start++) {
      if (seen[start]) continue;
      block++;
      let at = start;
      do {
        seen[at] = true;
        labels[at] = block;
        at = p[at]! - 1;
      } while (at !== start);
    }
    return labels;
  };
  for (const p of ALL)
    expect(result(["CyclePartition", perm(...p)]), `[${p}]`).toEqual(["List", ...rgs(p)]);
});

/** Every restricted growth string of length n — i.e. every set partition of [n], in the
 *  canonical encoding (block label = rank of first appearance). */
function restrictedGrowthStrings(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  const build = (rgs: number[], maxSoFar: number): void => {
    if (rgs.length === n) {
      out.push([...rgs]);
      return;
    }
    for (let label = 1; label <= maxSoFar + 1; label++) {
      rgs.push(label);
      build(rgs, Math.max(maxSoFar, label));
      rgs.pop();
    }
  };
  build([], 0);
  return out;
}

test("ArcRepresentation links each position to the next in its block", () => {
  // The reference: for position i, the smallest LATER position sharing i's label, or i itself
  // when none does — exactly the standard arc representation, read as a function.
  const linking = (rgs: number[]): number[] =>
    rgs.map((label, i) => {
      for (let j = i + 1; j < rgs.length; j++) if (rgs[j] === label) return j + 1;
      return i + 1;
    });
  for (const n of [1, 2, 3, 4, 5])
    for (const rgs of restrictedGrowthStrings(n))
      expect(result(["ArcRepresentation", ["SetPartition", ["List", ...rgs]]]), `${rgs}`).toEqual([
        "List",
        ...linking(rgs),
      ]);
});

test("DescentComposition cuts n at the descents", () => {
  for (const p of ALL) {
    const descents = p
      .slice(0, -1)
      .map((_, k) => k + 1)
      .filter((i) => p[i - 1]! > p[i]!);
    const bounds = [0, ...descents, p.length];
    const parts = bounds.slice(1).map((b, k) => b - bounds[k]!);
    expect(result(["DescentComposition", perm(...p)]), `[${p}]`).toEqual(["List", ...parts]);
    expect(
      parts.reduce((a, b) => a + b, 0),
      `[${p}] sums to n`,
    ).toBe(p.length);
    expect(parts.length, `[${p}] length`).toBe(descents.length + 1);
  }
});

test("the empty word has a composition with NO parts", () => {
  // Worth its own test because the obvious plain-loop reading gets it wrong: cutting [] at
  // its (nonexistent) descents gives [0], but a composition of 0 has no parts at all. The
  // expression was right and the reference was the artifact.
  expect(result(["DescentComposition", ["Permutation", ["List"]]])).toEqual(["List"]);
});

/** The permutation's cycles, each as its forward orbit [start, p(start), p(p(start)), …]. */
function cyclesOf(p: number[]): number[][] {
  const n = p.length;
  const seen = new Array<boolean>(n + 1).fill(false);
  const cycles: number[][] = [];
  for (let start = 1; start <= n; start++) {
    if (seen[start]) continue;
    const cycle: number[] = [];
    let at = start;
    do {
      seen[at] = true;
      cycle.push(at);
      at = p[at - 1]!;
    } while (at !== start);
    cycles.push(cycle);
  }
  return cycles;
}
const cycleTypeOf = (p: number[]): number[] =>
  cyclesOf(p)
    .map((c) => c.length)
    .sort((a, b) => b - a);
const conjugateOf = (parts: number[]): number[] => {
  const max = Math.max(0, ...parts);
  return Array.from({ length: max }, (_, k) => parts.filter((part) => part >= k + 1).length);
};
/** Cycles in decreasing length, filled with consecutive integers, each cycle written as a
 *  cyclic left-shift of its block — the convention ConjugacyClassRepresentative documents. */
function canonicalRepresentative(p: number[]): number[] {
  const word: number[] = [];
  let start = 1;
  for (const len of cycleTypeOf(p)) {
    for (let k = 0; k < len; k++) word.push(k < len - 1 ? start + k + 1 : start);
    start += len;
  }
  return word;
}
/** Foata's first fundamental transformation: each cycle rotated to start at its own maximum,
 *  cycles ordered by increasing maximum, parentheses erased. */
function foataOf(p: number[]): number[] {
  const rotated = cyclesOf(p).map((cycle) => {
    const maxAt = cycle.indexOf(Math.max(...cycle));
    return [...cycle.slice(maxAt), ...cycle.slice(0, maxAt)];
  });
  rotated.sort((a, b) => a[0]! - b[0]!);
  return rotated.flat();
}
const leftToRightMaxima = (word: number[]): number =>
  word.filter((v, i) => word.slice(0, i).every((w) => w < v)).length;

test("ConjugateAfterCycleType is the conjugate of the cycle type", () => {
  for (const p of ALL) {
    expect(result(["ConjugateAfterCycleType", perm(...p)]), `[${p}]`).toEqual([
      "List",
      ...conjugateOf(cycleTypeOf(p)),
    ]);
  }
});

test("ConjugacyClassRepresentative is canonical and shares the cycle type", () => {
  for (const p of ALL) {
    const rep = canonicalRepresentative(p);
    expect(result(["ConjugacyClassRepresentative", perm(...p)]), `[${p}]`).toEqual([
      "List",
      ...rep,
    ]);
    expect(cycleTypeOf(rep), `[${p}] same cycle type`).toEqual(cycleTypeOf(p));
    // Already canonical: representing the representative is a no-op.
    expect(canonicalRepresentative(rep), `[${p}] idempotent`).toEqual(rep);
  }
});

test("Foata agrees with the cycle-rotation reading", () => {
  for (const p of ALL) {
    expect(result(["Foata", perm(...p)]), `[${p}]`).toEqual(["List", ...foataOf(p)]);
  }
});

test("Foata (via the engine) is a bijection on S_n for n <= 5, sending k cycles to k left-to-right maxima", () => {
  // The defining property of the first fundamental transformation, checked against the
  // ENGINE's own output rather than only the reference reading. Capped at n = 5 — each
  // `evaluate()` call here costs a few hundred ms regardless of n (boxing the map's
  // expression dominates), so S6 alone is minutes of wall time; see the n <= 7 check below
  // for the same property over the reference algorithm.
  for (let n = 1; n <= 5; n++) {
    const seen = new Set<string>();
    for (const p of permutations(n)) {
      const word = result(["Foata", perm(...p)]) as readonly unknown[];
      const image = word.slice(1) as number[];
      expect(
        image.slice().sort((a, b) => a - b),
        `[${p}] a permutation`,
      ).toEqual(Array.from({ length: n }, (_, k) => k + 1));
      seen.add(image.join(","));
      expect(leftToRightMaxima(image), `[${p}] maxima = cycles`).toBe(cyclesOf(p).length);
    }
    expect(seen.size, `S${n} bijective`).toBe(permutations(n).length);
  }
});

test("Foata's defining property holds on S_n for n <= 7 (reference algorithm)", () => {
  // The same bijection + left-to-right-maxima check, over the plain JS reading rather than
  // the engine — `foataOf` is line-for-line the same construction the map body evaluates
  // (blocks from cycle maxima, values read off by iterating the permutation), and the
  // previous test already cross-checks the two agree for every n <= 5. This just extends the
  // property itself to n = 6, 7, where a CE `evaluate()` per permutation is too slow to run
  // exhaustively (roughly 5040 * 0.3s for S7 alone).
  for (let n = 1; n <= 7; n++) {
    const seen = new Set<string>();
    for (const p of permutations(n)) {
      const image = foataOf(p);
      expect(
        image.slice().sort((a, b) => a - b),
        `[${p}] a permutation`,
      ).toEqual(Array.from({ length: n }, (_, k) => k + 1));
      seen.add(image.join(","));
      expect(leftToRightMaxima(image), `[${p}] maxima = cycles`).toBe(cyclesOf(p).length);
    }
    expect(seen.size, `S${n} bijective`).toBe(permutations(n).length);
  }
});
