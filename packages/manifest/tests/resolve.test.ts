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
  expect(packagesFor(["BarnesG", "x"])).toContain("analytic");
  expect(packagesFor(["HypergeometricPFQ", ["List", 1], ["List", 2], 0.5])).toContain("analytic");
  // A widening counts, but not rows on carriers the package declares: an Adele brings adeles.
  const sum = [...packagesFor(["Add", 1, 2])];
  for (const pkg of ["adeles", "numerals", "residues"]) expect(sum).not.toContain(pkg);
  expect([...packagesFor(["Add", ["Adele", 1], 2])]).toContain("adeles");
  // Rows on a carrier someone else declares count where it's named (compute-engine's Interval),
  // and rows on symbols where one is (hypercomplex's generators).
  expect(sum).not.toContain("analytic");
  expect([...packagesFor(["Add", ["Interval", 1, 2], 1])]).toContain("analytic");
  expect(sum).not.toContain("hypercomplex");
  expect([...packagesFor(["Add", "i_1", 1])]).toContain("hypercomplex");
  // Rows on carrier types: skipped where the package mints them, counted where it doesn't.
  const lookup = (name: string) =>
    name === "Sign"
      ? {
          name,
          documented: [],
          overloads: [{ package: "paths", type: "(lattice_path) -> integer", types: ["lattice_path"] }],
        }
      : undefined;
  expect([...packagesFor(["Sign", -3], lookup, { Sign: ["paths"] }, { lattice_path: ["paths"] })]).toEqual([]);
  expect([...packagesFor(["Sign", -3], lookup, { Sign: ["paths"] }, { lattice_path: ["walks"] })]).toEqual(["paths"]);
  expect([...packagesFor(["Inverse", "x"])]).not.toContain("combinatorics");
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
  expect((await resolver.ensure(ce, ["BarnesG", "x"])).declared).toEqual(["analytic"]);
  expect((await resolver.ensure(ce, ["BarnesG", "y"])).declared).toEqual([]);
  expect(await resolver.ensure({}, ["BarnesG", "y"])).toEqual({ declared: ["analytic"], missing: [] });
  expect(log).toEqual(["analytic", "analytic"]);
});

test("ensure: calls at once declare in order, each waiting for what another is declaring", async () => {
  const log: string[] = [];
  // A slow import, as a browser's dynamic import is: structures takes a while to declare.
  const slow = (name: string, ms: number): Library<object> => ({
    name,
    declare: async () => {
      log.push(`start ${name}`);
      await new Promise((resolve) => setTimeout(resolve, ms));
      log.push(`end ${name}`);
    },
  });
  const resolver = createResolver([slow("structures", 20), slow("combinatorics", 1)]);
  const ce = {};
  await Promise.all([resolver.ensure(ce, ["Floor", 1]), resolver.ensure(ce, ["Permutations", 3])]);
  expect(log).toEqual(["start structures", "end structures", "start combinatorics", "end combinatorics"]);
});
