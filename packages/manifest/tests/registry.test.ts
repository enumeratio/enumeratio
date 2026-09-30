import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import {
  createRegistryResolver,
  type Definition,
  definitionRegistry,
  type Library,
  manifestRegistry,
  namespaceOf,
  pinOf,
  qualifiedNamesOf,
  combineRegistries,
  SearchPathError,
  searchPath,
} from "../src/index.ts";

type Engine = InstanceType<typeof ComputeEngine>;

const evaluate = (ce: Engine, json: unknown): unknown => ce.box(json as never).evaluate().json;
const unary = (body: unknown, requires?: Record<string, string>): Definition => ({
  signature: "(number) -> number",
  body: ["Function", body, "x"],
  ...(requires === undefined ? {} : { requires }),
});

test("qualified names: member calls and fields over a chain of names", () => {
  expect([
    ...qualifiedNamesOf(["Add", ["MemberCall", "Stats", "'Mean'", "x"], ["Field", "p", "'re'"], "'s.t'"]),
  ]).toEqual(["Stats.Mean", "p.re"]);
  expect([...qualifiedNamesOf(["MemberCall", ["Field", "a", "'b'"], "'c'", 1])]).toEqual(["a.b.c", "a.b"]);
  expect(namespaceOf("number-theory")).toBe("NumberTheory");
});

test("a pin is the content: equal definitions share one, any change makes another", async () => {
  const pin = await pinOf(unary(["Multiply", 2, "x"]));
  expect(pin).toMatch(/^sha256-[0-9a-f]{64}$/);
  expect(await pinOf({ body: ["Function", ["Multiply", 2, "x"], "x"], signature: "(number) -> number" })).toBe(pin);
  expect(await pinOf(unary(["Multiply", 3, "x"]))).not.toBe(pin);
});

// A curator's namespace. `Twice` has two versions; `Sq` pins the first, so the second
// changing `Twice` doesn't change `Sq`.
const twice1 = unary(["Multiply", 2, "x"]);
const twice2 = unary(["Multiply", 20, "x"]);
const ada = async () => {
  const pin = await pinOf(twice1);
  return definitionRegistry<Engine>("ada", {
    Twice: [twice1, twice2],
    Sq: unary(["MemberCall", "ada", "'Twice'", ["Power", "x", 2]], { "ada.Twice": pin }),
    Loose: unary(["MemberCall", "ada", "'Twice'", "x"]),
    Sin: unary(0),
  });
};

test("a definition's dependencies are declared at their pins, whatever is latest", async () => {
  const ce = new ComputeEngine();
  const resolver = createRegistryResolver(await ada());
  const sq = ["MemberCall", "ada", "'Sq'", 3];
  const ensured = await resolver.ensure(ce, sq);
  expect(ensured.errors).toEqual([]);
  expect(ensured.declared).toHaveLength(2);
  expect(evaluate(ce, sq)).toBe(18);
  // The expression's own unpinned name takes the latest: both versions live side by side.
  const twice = ["MemberCall", "ada", "'Twice'", 3];
  await resolver.ensure(ce, twice);
  expect(evaluate(ce, twice)).toBe(60);
  expect(evaluate(ce, sq)).toBe(18);
});

test("a lock pins the expression's own names; what resolved is reported for the lock", async () => {
  const registry = await ada();
  const twice = ["MemberCall", "ada", "'Twice'", 3];
  const latest = await createRegistryResolver(registry).ensure(new ComputeEngine(), twice);
  expect(latest.pins).toEqual({ "ada.Twice": await pinOf(twice2) });
  const ce = new ComputeEngine();
  await createRegistryResolver(registry).ensure(ce, twice, { "ada.Twice": await pinOf(twice1) });
  expect(evaluate(ce, twice)).toBe(6);
});

test("a dependency beyond the system must be pinned; a pin that isn't there fails", async () => {
  const resolver = createRegistryResolver(await ada());
  const loose = await resolver.ensure(new ComputeEngine(), ["MemberCall", "ada", "'Loose'", 1]);
  expect(loose.errors).toEqual(["ada.Loose: ada.Twice isn't a system name, and has no pin in requires"]);
  const missing = await resolver.ensure(new ComputeEngine(), ["MemberCall", "ada", "'Twice'", 1], {
    "ada.Twice": "sha256-00",
  });
  expect(missing.unresolved).toEqual(["ada.Twice"]);
});

test("a definition may use system names unpinned: they move with the system", async () => {
  const log: string[] = [];
  const library = (name: string): Library<Engine> => ({ name, declare: () => void log.push(name) });
  const registry = combineRegistries(
    manifestRegistry([library("analytic")]),
    definitionRegistry<Engine>("ada", { Zh: unary(["MemberCall", "Analytic", "'HurwitzZeta'", "x", 1]) }),
  );
  const ensured = await createRegistryResolver(registry).ensure(new ComputeEngine(), ["MemberCall", "ada", "'Zh'", 2]);
  expect(ensured.errors).toEqual([]);
  expect(log).toEqual(["analytic"]);
});

test("what nothing resolves is held and reported, and a taken name is never a namespace", async () => {
  const resolver = createRegistryResolver(await ada());
  expect((await resolver.ensure(new ComputeEngine(), ["MemberCall", "ada", "'Nope'", 1])).unresolved).toEqual([
    "ada.Nope",
  ]);
  const taken = new ComputeEngine();
  taken.declare("ada", "integer");
  expect((await resolver.ensure(taken, ["MemberCall", "ada", "'Sin'", 1])).unresolved).toEqual(["ada.Sin"]);
});

test("libraries: only what an expression names, each once per engine", async () => {
  const log: string[] = [];
  const library = (name: string): Library<Engine> => ({ name, declare: () => void log.push(name) });
  const libraries = [library("analytic"), library("hypercomplex"), library("structures")];
  const resolver = createRegistryResolver(combineRegistries(await ada(), manifestRegistry(libraries)));
  const ce = new ComputeEngine();
  expect((await resolver.ensure(ce, ["HurwitzZeta", 2, 1])).declared).toEqual(["analytic"]);
  expect((await resolver.ensure(ce, ["HurwitzZeta", 3, 1])).declared).toEqual([]);
  // Qualified by its package's namespace, the same head; by another's, nothing.
  const qualified = ["MemberCall", "Analytic", "'HurwitzZeta'", 2, 1];
  expect((await resolver.ensure(new ComputeEngine(), qualified)).declared).toEqual(["analytic"]);
  const wrong = ["MemberCall", "Hypercomplex", "'HurwitzZeta'", 2, 1];
  expect((await resolver.ensure(new ComputeEngine(), wrong)).unresolved).toEqual(["Hypercomplex.HurwitzZeta"]);
});

const bob = definitionRegistry<Engine>("bob", {
  Sq: unary(["Power", "x", 2]),
  Halve: unary(["Divide", "x", 2]),
  Sin: unary(1),
});

test("a search path settles bare names when it is set up, not when an expression meets them", async () => {
  const registry = combineRegistries(await ada(), bob);
  // `Sq` is both curators'; `Sin` is the system's, which no namespace shadows.
  const error = await searchPath(registry, { use: ["ada", "bob"] }).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SearchPathError);
  expect((error as SearchPathError).conflicts).toEqual([
    { name: "Sq", namespaces: ["ada", "bob"], system: false },
    { name: "Sin", namespaces: ["ada", "bob"], system: true },
  ]);
  // Preferring the system's name away doesn't work; excluding it does.
  await expect(searchPath(registry, { use: ["ada", "bob"], prefer: { Sq: "bob", Sin: "ada" } })).rejects.toThrow(
    "Sin: the system, ada, bob",
  );
  await expect(searchPath(registry, { use: ["nobody"] })).rejects.toThrow("no registry serves the namespace nobody");
});

test("a bare head the path brings in is its qualified name; a symbol stays itself", async () => {
  const registry = combineRegistries(await ada(), bob);
  const path = await searchPath(registry, { use: ["ada", "bob"], prefer: { Sq: "bob" }, exclude: ["Sin"] });
  const resolver = createRegistryResolver(registry, { path });
  const ce = new ComputeEngine();
  const ensured = await resolver.ensure(ce, ["Add", ["Sq", 3], ["Halve", "Sq"]]);
  expect(ensured.expression).toEqual(["Add", ["MemberCall", "bob", "'Sq'", 3], ["MemberCall", "bob", "'Halve'", "Sq"]]);
  expect(evaluate(ce, ["Add", ["MemberCall", "bob", "'Sq'", 3], ["MemberCall", "bob", "'Halve'", 4]])).toBe(11);
  // Excluded, `Sin` is the system's own.
  expect((await resolver.ensure(ce, ["Sin", 0])).expression).toEqual(["Sin", 0]);
});
