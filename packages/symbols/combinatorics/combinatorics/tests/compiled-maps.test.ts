// Maps compiled at build from their Epsil (src/compiled-maps.generated.js): every compiled map
// gives the interpreter's answers exactly, over the small elements of every family on its
// source carrier.

import { bareEngine } from "@enumeratio/engine/testing";
import { applyComposition } from "@enumeratio/structures";
import { expect, test } from "vite-plus/test";
import { CARRIERS, declareCombinatoricsCarriers } from "../src/carriers.ts";
import { COMPILED_MAPS } from "../src/compiled-maps.generated.js";
import { composedDefinition, compositionHash, compositionSteps, fastDefinition, mapKey } from "../src/compiled.ts";
import { declareMaps, evaluateDefinition, MAPS } from "../src/maps.ts";
import { evaluateTable } from "../scripts/compile-maps.ts";
import { allElements, smallElements } from "../scripts/samples.ts";

// The interpreter is the slow side of the comparison: a small sample in the standard run, more
// under DEEP_TESTS.
const DEEP = process.env.DEEP_TESTS === "1";
const MAX_SIZE = DEEP ? 6 : 4;
const PER_FAMILY = DEEP ? 60 : 6;

const carrierByType = new Map(CARRIERS.map((carrier) => [carrier.type, carrier]));

/** Small elements of every family whose elements are values of `carrier`, as its contents. */
const subjectsOf = (carrier: string): unknown[] => smallElements(ce, carrier, MAX_SIZE, PER_FAMILY);

const ce = bareEngine();

test("the build compiled maps", () => {
  expect(Object.keys(COMPILED_MAPS).length).toBeGreaterThan(0);
});

// Maps whose Epsil the compiler can't take, left to the interpreter on purpose: each is pinned here with its
// reason, so one that starts to compile (or is dropped) shows up as a failure rather than going unnoticed.
const INTERPRETED: Readonly<Record<string, string>> = {
  "Rsk@permutation":
    "its image is a pair of constructed tableaux (StandardTableau(rows)), which compiled code can't make",
  "ToPermutation@standard_tableau_pair":
    "its argument is a pair of constructed tableaux, which the compiled path's toJs doesn't read",
};

test("the pinned maps are declared and not compiled", () => {
  for (const key of Object.keys(INTERPRETED)) {
    expect(
      MAPS.some((m) => `${m.name}@${m.from}` === key),
      key,
    ).toBe(true);
    expect(COMPILED_MAPS[key]?.run, key).toBeUndefined();
  }
});

// Families overlap, and the build's cross-checks cost per subject.
test("each small element is sampled once", () => {
  const subjects = smallElements(ce, "Permutation").map((s) => JSON.stringify(s));
  const all = allElements(ce, "Permutation").map((s) => JSON.stringify(s));
  expect(subjects.length).toBeGreaterThan(0);
  expect(new Set(subjects).size).toBe(subjects.length);
  expect(subjects).toEqual([...new Set(all)]);
});

// A map's subjects run in chunks of one test each, so the file's total grows with the sample
// but no test comes near `testTimeout`.
const CHUNK = 40;

// Every map compiled ahead of time, run from its generated code, against the interpreter. A map
// the generator left interpreted (its compiled code disagreed) has no code to run.
for (const map of MAPS.filter((m) => m.composedOf === undefined && COMPILED_MAPS[mapKey(m)]?.run !== undefined)) {
  const from = carrierByType.get(map.from)!;
  const to = carrierByType.get(map.to)!;
  let fallbacks = 0;
  const run = fastDefinition({
    ce,
    body: map.body,
    guard: map.guard,
    from: from.shape,
    to: to.shape,
    cache: false,
    generated: COMPILED_MAPS[`${map.name}@${map.from}`],
    interpret: (contents) => {
      fallbacks++;
      return evaluateDefinition(ce, map, contents);
    },
  });
  const subjects = subjectsOf(from.name);
  const title = `${map.name} from ${map.from}: compiled agrees with interpreted`;
  for (let start = 0; start < subjects.length; start += CHUNK) {
    test(subjects.length > CHUNK ? `${title} (${start / CHUNK + 1})` : title, () => {
      for (const contents of subjects.slice(start, start + CHUNK))
        expect(run(contents), JSON.stringify(contents)).toEqual(evaluateDefinition(ce, map, contents));
    });
  }
  test(`${map.name} from ${map.from}: the generated code answers`, () => {
    expect(fallbacks).toBeLessThan(subjects.length);
  });
}

// A composition (`composedOf`) runs as one chain once every map it applies has compiled code, and
// is interpreted while one has none.
const compositions = MAPS.filter((m) => m.composedOf !== undefined);

test("a composition is compiled exactly while all its steps are", () => {
  expect(compositions.length).toBeGreaterThan(0);
  for (const map of compositions) {
    const steps = compositionSteps(MAPS, map);
    expect(steps, `${mapKey(map)} resolves`).toBeDefined();
    const compiled = steps!.every((step) => COMPILED_MAPS[mapKey(step)]?.run !== undefined);
    expect(COMPILED_MAPS[mapKey(map)]?.run !== undefined, mapKey(map)).toBe(compiled);
  }
});

test("a chain declines at a failed guard and at an image compiled code can't hand back exactly", () => {
  const chain = (...steps: string[]) =>
    evaluateTable([
      { key: "Inc@x", hash: "", body: "_._raw.map((x) => x + 1)" },
      { key: "Half@x", hash: "", body: "_._raw.map((x) => x / 2)" },
      { key: "Odd@x", hash: "", body: "_._raw", guard: "_._raw[0] > 1 && _._image.length === _._raw.length" },
      { key: "Chain@x", hash: "", steps },
    ])["Chain@x"]!.run(null, { _raw: [1, 2] });
  expect(chain("Inc@x")).toEqual([2, 3]);
  expect(chain("Odd@x", "Inc@x")).toBeUndefined();
  expect(chain("Inc@x", "Odd@x")).toEqual([2, 3]);
  expect(chain("Half@x")).toBeUndefined();
});

test("compositions resolve through the carrier each step delivers, and are keyed on every step", () => {
  const step = (name: string, from: string, to: string, body: unknown = [name]) => ({ name, from, to, body });
  const a = step("A", "x", "y");
  const b = step("B", "y", "z");
  const inner = { ...step("AB", "x", "z"), body: undefined, composedOf: ["B", "A"] };
  const outer = { ...step("Outer", "x", "w"), body: undefined, composedOf: ["C", "AB"] };
  const c = step("C", "z", "w");
  const maps = [a, b, c, inner, outer];
  expect(compositionSteps(maps, inner)).toEqual([a, b]);
  // A composed step stands for its own steps.
  expect(compositionSteps(maps, outer)).toEqual([a, b, c]);
  // A step on the wrong carrier, a missing step, or a chain ending elsewhere has no steps.
  expect(compositionSteps([a, c, outer], outer)).toBeUndefined();
  expect(compositionSteps(maps, { ...inner, to: "y" })).toBeUndefined();
  expect(compositionSteps([a, step("B", "q", "z"), inner], inner)).toBeUndefined();
  // Editing any step, or the order, changes the hash.
  const hash = compositionHash([a, b, c]);
  expect(compositionHash([a, { ...b, body: ["B2"] }, c])).not.toBe(hash);
  expect(compositionHash([a, { ...b, guard: ["True"] }, c])).not.toBe(hash);
  expect(compositionHash([b, a, c])).not.toBe(hash);
});

const heads = bareEngine();
declareCombinatoricsCarriers(heads);
declareMaps(heads, Object.fromEntries(CARRIERS.map((c) => [c.type, c.name])));

// The chain against the interpreter applying the same maps' definitions, and the declared head (which
// runs the chain) against its steps applied head by head.
for (const map of compositions.filter((m) => COMPILED_MAPS[mapKey(m)]?.run !== undefined)) {
  const steps = compositionSteps(MAPS, map)!;
  const from = carrierByType.get(map.from)!;
  const chain = composedDefinition({ ce, steps, generated: COMPILED_MAPS[mapKey(map)] })!;
  const subjects = subjectsOf(from.name);
  let declined = 0;
  const interpret = (contents: unknown): unknown => {
    let value = contents;
    for (const step of steps) {
      value = evaluateDefinition(ce, step, value);
      if (value === undefined) return undefined;
    }
    return value;
  };
  const title = `${map.name} from ${map.from}: the compiled composition`;
  for (let start = 0; start < subjects.length; start += CHUNK) {
    const part = subjects.length > CHUNK ? ` (${start / CHUNK + 1})` : "";
    test(`${title} agrees with the interpreter${part}`, () => {
      for (const contents of subjects.slice(start, start + CHUNK)) {
        const answer = chain(contents);
        if (answer === undefined) declined++;
        else expect(answer, JSON.stringify(contents)).toEqual(interpret(contents));
      }
    });
    test(`${title} agrees with its steps as heads${part}`, () => {
      for (const contents of subjects.slice(start, start + CHUNK)) {
        const subject = heads.box([from.name, contents] as never);
        expect(heads.box([map.name, subject.json] as never).evaluate().json, JSON.stringify(contents)).toEqual(
          applyComposition(heads, map.composedOf!, subject).json,
        );
      }
    });
  }
  test(`${title} answers`, () => {
    expect(declined).toBeLessThan(subjects.length);
  });
}
