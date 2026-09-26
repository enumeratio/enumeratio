// Shard of map.test.ts: typing, the extended built-ins, and the straightforward maps. See
// map-helpers.ts for shared setup, and the other map-*.test.ts files for the pricier shards.
import { expect, test } from "vite-plus/test";
import { ALL, ce, DOMAINS, MAPS, perm, result } from "./map-helpers.ts";

test("a map is typed by carrier, and rejects the wrong one", () => {
  // The reason domains came before maps: without them every map is list -> list.
  //
  // Checked on a map that does NOT extend a built-in — `CycleType` is ours alone, so a wrong
  // argument is a type error rather than being handed to compute-engine. The extended heads
  // deliberately behave differently; see the next test.
  expect(String(ce.box(["CycleType", perm(2, 3, 1)] as never).evaluate().type)).toBe("integer_partition");
  expect(ce.box(["CycleType", ["List", 2, 3, 1]]).evaluate().operator).toBe("Error");
  expect(ce.box(["CycleType", ["IntegerPartition", ["List", 2, 1]]] as never).evaluate().operator).toBe("Error");
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
  expect(JSON.stringify(ce.box(["Complement", ["Set", 1, 2]]).evaluate().json)).toContain("Complement_");
  expect(JSON.stringify(ce.box(["Inverse", 4]).evaluate().json)).not.toContain("Primitive");
});

test("Reverse, Complement and Inverse agree with plain readings", () => {
  for (const p of ALL) {
    const n = p.length;
    expect(result(["Reverse", perm(...p)]), `rev [${p}]`).toEqual(["List", ...[...p].reverse()]);
    expect(result(["Complement", perm(...p)]), `comp [${p}]`).toEqual(["List", ...p.map((v) => n + 1 - v)]);
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
    expect(result(["DescentSet", perm(...p)]), `[${p}]`).toEqual(["Tuple", ["List", ...descents], p.length]);
    expect(ce.box(["Descents", perm(...p)] as never).evaluate().re).toBe(descents.length);
    expect(ce.box(["MajorIndex", perm(...p)] as never).evaluate().re).toBe(descents.reduce((a, b) => a + b, 0));
  }
});

test("ToLehmerCode is subexcedant and totals the inversions", () => {
  for (const p of ALL) {
    const code = p.map((v, i) => p.slice(i + 1).filter((w) => w < v).length);
    expect(result(["ToLehmerCode", perm(...p)]), `[${p}]`).toEqual(["List", ...code]);
    expect(ce.box(["Inversions", perm(...p)] as never).evaluate().re).toBe(code.reduce((a, b) => a + b, 0));
  }
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
  const rotateRight = (p: number[]): number[] => (p.length === 0 ? [] : [p.at(-1)!, ...p.slice(0, -1)]);
  for (const p of ALL) {
    const n = p.length;
    expect(result(["CyclicShift", perm(...p)]), `shift [${p}]`).toEqual(["List", ...rotateLeft(p)]);
    expect(result(["InverseCyclicShift", perm(...p)]), `unshift [${p}]`).toEqual(["List", ...rotateRight(p)]);
    const peaks = p.map((_, k) => k + 1).filter((i) => i > 1 && i < n && p[i - 2]! < p[i - 1]! && p[i - 1]! > p[i]!);
    expect(result(["PeakSet", perm(...p)]), `peaks [${p}]`).toEqual(["Tuple", ["List", ...peaks], n]);
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
    expect(result(["ReverseComplement", perm(...p)]), `[${p}]`).toEqual(["List", ...reversed.map((v) => n + 1 - v)]);
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
