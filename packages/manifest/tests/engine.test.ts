// An engine built from the hierarchy: the order it declares in, why each library is there, and
// how a library's package says what declares it. Libraries here are stand-ins that record the
// order they are declared in; the real ones are checked against the real engines in `reference`.

import { expect, test } from "vite-plus/test";
import { buildEngine, DECLARE_ORDER, dependedLibraries, enginePlan, loadLibraries } from "../src/index.ts";
import type { Library, StagedLibrary } from "../src/index.ts";

type Engine = { declared: string[] };

const library = (name: string, extra: Partial<Library<Engine>> = {}): Library<Engine> => ({
  name,
  declare: (ce) => void ce.declared.push(name),
  ...extra,
});

// Listed in a deliberately wrong order: the plan, not the list, puts requirements first.
const AVAILABLE = [
  "combinatorics",
  "number-theory",
  "adeles",
  "modular",
  "numerals",
  "residues",
  "structures",
  "boxes",
  "evaluation",
].map((name) => library(name));

const names = (libraries: readonly { readonly name: string }[]): string[] => libraries.map((l) => l.name);

test("a library comes with the base and what it requires, requirements first", () => {
  const { order, reasons } = enginePlan({ libraries: ["numerals"], available: AVAILABLE });
  expect(names(order)).toEqual(["evaluation", "boxes", "structures", "residues", "numerals"]);
  expect(reasons).toEqual({
    evaluation: { kind: "base" },
    boxes: { kind: "base" },
    structures: { kind: "base" },
    residues: { kind: "required", by: ["numerals"] },
    numerals: { kind: "asked" },
  });
});

test("without the base, only what is asked for and required", () => {
  const { order } = enginePlan({ libraries: ["residues"], available: AVAILABLE, base: false });
  expect(names(order)).toEqual(["boxes", "structures", "residues"]);
});

test("a library nobody can declare is missing, and an engine refuses to be built without it", () => {
  expect(enginePlan({ libraries: ["hopf"], available: AVAILABLE }).missing).toEqual(["hopf"]);
  expect(() => buildEngine({ libraries: ["hopf"], available: AVAILABLE, engine: () => ({ declared: [] }) })).toThrow(
    /hopf/,
  );
});

test("an included library is declared whatever is asked, after what it requires", () => {
  const extra = library("catalog", { requires: ["residues"] });
  const { order, reasons } = enginePlan({ libraries: ["residues"], available: AVAILABLE, include: [extra] });
  expect(names(order).at(-1)).toBe("catalog");
  expect(reasons.catalog).toEqual({ kind: "asked" });
});

test("a declare-order pair holds whatever order the host lists libraries in, though adeles extends number-theory", () => {
  expect(DECLARE_ORDER).toContainEqual(["adeles", "number-theory"]);
  for (const available of [AVAILABLE, AVAILABLE.toReversed()]) {
    const order = names(enginePlan({ libraries: ["adeles", "modular"], available }).order);
    expect(order.indexOf("adeles")).toBeLessThan(order.indexOf("number-theory"));
    expect(order.indexOf("modular")).toBeLessThan(order.indexOf("number-theory"));
  }
});

test("libraries go in the preference order where nothing else decides", () => {
  const order = names(enginePlan({ libraries: ["combinatorics", "modular", "numerals"], available: AVAILABLE }).order);
  expect(order).toEqual(["evaluation", "boxes", "structures", "residues", "numerals", "modular", "combinatorics"]);
});

test("late steps follow every library's own, in the same order", () => {
  const calls: string[] = [];
  const staged = (name: string, extra: Partial<StagedLibrary<Engine>>): StagedLibrary<Engine> => ({
    name,
    declare: () => calls.push(name),
    ...extra,
  });
  const available = [
    staged("structures", { main: () => calls.push("structures"), late: () => calls.push("structures late") }),
    staged("boxes", {}),
    staged("evaluation", {}),
    staged("residues", {}),
    // Nothing before it: only a late step.
    staged("combinatorics", { late: () => calls.push("combinatorics late") }),
  ];
  const { plan } = buildEngine({ libraries: ["combinatorics"], available, engine: () => ({ declared: [] }) });
  expect(calls).toEqual(["evaluation", "boxes", "structures", "residues", "structures late", "combinatorics late"]);
  expect(plan.steps.map((step) => `${step.library.name} ${step.phase}`)).toEqual([
    "evaluation main",
    "boxes main",
    "structures main",
    "residues main",
    "structures late",
    "combinatorics late",
  ]);
});

test("a declare-order pair wins over an extension; two that contradict each other fail", () => {
  const order = names(
    enginePlan({ libraries: ["numerals"], available: AVAILABLE, after: [["numerals", "residues"]] }).order,
  );
  expect(order.indexOf("numerals")).toBeLessThan(order.indexOf("residues"));
  expect(() =>
    enginePlan({
      libraries: ["residues"],
      available: AVAILABLE,
      after: [
        ["structures", "residues"],
        ["residues", "structures"],
      ],
    }),
  ).toThrow(/cycle/);
});

test("buildEngine declares into a fresh engine in plan order", () => {
  const { engine, plan } = buildEngine({
    libraries: ["adeles", "modular"],
    available: AVAILABLE,
    engine: () => ({ declared: [] }),
  });
  expect(engine.declared).toEqual(names(plan.order));
  expect(engine.declared).toContain("number-theory");
});

test("a library's package says what declares it, and where", async () => {
  const modules: Record<string, unknown> = {
    "@enumeratio/one/package.json": { enumeratio: { declare: ["declareA", "declareB"], names: ["Registry"] } },
    "@enumeratio/one": {
      declareA: (ce: Engine) => ce.declared.push("a"),
      declareB: (ce: Engine) => ce.declared.push("b"),
    },
    "@enumeratio/two/package.json": { enumeratio: { declare: "./sub#declareTwo", requires: ["one"] } },
    "@enumeratio/two/sub": { declareTwo: (ce: Engine) => ce.declared.push("two") },
    "@enumeratio/nothing/package.json": {},
  };
  const loaded = await loadLibraries<Engine>(["two", "nothing", "one"], async (specifier) => modules[specifier]);
  // A package with no `declare` is no library; a name the hierarchy does not place keeps the order given.
  expect(names(loaded)).toEqual(["two", "one"]);
  const [two, one] = loaded;
  expect(one).toMatchObject({ names: ["Registry"] });
  expect(two).toMatchObject({ requires: ["one"] });
  const ce: Engine = { declared: [] };
  one!.declare(ce);
  two!.declare(ce);
  expect(ce.declared).toEqual(["a", "b", "two"]);
});

test("a declare the package names but does not export is an error", async () => {
  const modules: Record<string, unknown> = {
    "@enumeratio/one/package.json": { enumeratio: { declare: "declareMissing" } },
    "@enumeratio/one": {},
  };
  await expect(loadLibraries(["one"], async (specifier) => modules[specifier])).rejects.toThrow(/declareMissing/);
});

test("a host's libraries are the ones its package depends on, in the layers it asks for", () => {
  const pkg = {
    dependencies: { "@enumeratio/residues": "workspace:*", "@enumeratio/formats": "workspace:*", react: "^19" },
    devDependencies: { "@enumeratio/boxes": "workspace:*", "@enumeratio/census": "workspace:*" },
  };
  expect(dependedLibraries(pkg).toSorted()).toEqual(["boxes", "residues"]);
  expect(dependedLibraries(pkg, ["presentation"])).toEqual(["formats"]);
});
