import { expect, test } from "vite-plus/test";
import { createResolver, type Library, namesOf, packagesFor, plan } from "../src/index.ts";

test("names: heads and symbols, not text or numbers", () => {
  expect([...namesOf(["Add", ["Zeta", 2], "x", "'Zeta'", 3, { sym: "Pi" }, { fn: ["Gamma", 1] }])]).toEqual([
    "Add",
    "Zeta",
    "x",
    "Pi",
    "Gamma",
  ]);
});

test("packages: what the manifest says declares each name", () => {
  // A native head we override, a head of our own, and one only the engine has.
  expect(packagesFor(["Abs", "x"])).toContain("analytic");
  expect(packagesFor(["HypergeometricPFQ", ["List", 1], ["List", 2], 0.5])).toContain("analytic");
  // A widening counts, but not rows on carriers the package declares: an Adele brings adeles.
  const sum = [...packagesFor(["Add", 1, 2])];
  expect(sum).toContain("hypercomplex");
  for (const pkg of ["adeles", "numerals", "residues"]) expect(sum).not.toContain(pkg);
  expect([...packagesFor(["Add", ["Adele", 1], 2])]).toContain("adeles");
  // Rows on a carrier someone else declares still count (compute-engine's Interval).
  expect([...packagesFor(["Add", 1, 2])]).toContain("analytic");
  // What a head canonicalises to: Lb(x) is Log(x, 2).
  expect([...packagesFor(["Lb", "x"])]).toEqual([...packagesFor(["Log", "x"])]);
  expect([...packagesFor(["Hold", 1])]).toEqual([]);
});

const library = (name: string, log: string[], global = false): Library<object> => ({
  name,
  global,
  declare: () => {
    log.push(name);
  },
});

test("plan: requires, the host's order, globals, and what has no library", () => {
  const log: string[] = [];
  const libraries = [library("c", log), library("b", log), library("a", log), library("g", log, true)];
  const requires = (name: string): string[] => ({ a: ["b", "engine"], c: ["a"] })[name] ?? [];
  const { libraries: planned, missing } = plan(["a", "z"], libraries, requires);
  expect(planned.map((l) => l.name)).toEqual(["b", "a", "g"]);
  // Listed first, but after what it requires.
  expect(plan(["c"], libraries, requires).libraries.map((l) => l.name)).toEqual(["b", "a", "c", "g"]);
  expect(missing).toEqual(["z"]);
  expect(plan([], libraries, requires).libraries).toEqual([]);
});

test("ensure: each library once per engine", async () => {
  const log: string[] = [];
  const resolver = createResolver([library("analytic", log)]);
  const ce = {};
  expect((await resolver.ensure(ce, ["Abs", "x"])).declared).toEqual(["analytic"]);
  expect((await resolver.ensure(ce, ["Abs", "y"])).declared).toEqual([]);
  expect(await resolver.ensure({}, ["Abs", "y"])).toEqual({ declared: ["analytic"], missing: [] });
  expect(log).toEqual(["analytic", "analytic"]);
});
