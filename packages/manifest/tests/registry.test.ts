import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import {
  createRegistryResolver,
  definitionRegistry,
  type Library,
  manifestRegistry,
  namespaceOf,
  qualifiedNamesOf,
  searchPath,
} from "../src/index.ts";

type Engine = InstanceType<typeof ComputeEngine>;

const evaluate = (ce: Engine, json: unknown): unknown => ce.box(json as never).evaluate().json;

test("qualified names: member calls and fields over a chain of names", () => {
  expect([
    ...qualifiedNamesOf(["Add", ["MemberCall", "Stats", "'Mean'", "x"], ["Field", "p", "'re'"], "'s.t'"]),
  ]).toEqual(["Stats.Mean", "p.re"]);
  expect([...qualifiedNamesOf(["MemberCall", ["Field", "a", "'b'"], "'c'", 1])]).toEqual(["a.b.c", "a.b"]);
  expect(namespaceOf("number-theory")).toBe("NumberTheory");
});

// A curator's namespace: `Sq` uses `Twice` through the same namespace, so resolving one closes
// over the other.
const ada = definitionRegistry<Engine>("ada", {
  Twice: { signature: "(number) -> number", body: ["Function", ["Multiply", 2, "x"], "x"] },
  Sq: { signature: "(number) -> number", body: ["Function", ["MemberCall", "ada", "'Twice'", ["Power", "x", 2]], "x"] },
  Sin: { signature: "(number) -> number", body: ["Function", 0, "x"] },
});

test("a namespace is a record of functions: its members evaluate as field calls", async () => {
  const ce = new ComputeEngine();
  const resolver = createRegistryResolver(ada);
  const json = ["MemberCall", "ada", "'Sq'", 3];
  expect(await resolver.ensure(ce, json)).toEqual({ declared: ["ada_Sq", "ada_Twice"], unresolved: [] });
  expect(evaluate(ce, json)).toBe(18);
  // A later expression adds to the namespace rather than redeclaring it.
  expect(await resolver.ensure(ce, ["MemberCall", "ada", "'Sin'", 1])).toEqual({
    declared: ["ada_Sin"],
    unresolved: [],
  });
  expect(evaluate(ce, ["MemberCall", "ada", "'Sin'", 1])).toBe(0);
  expect(evaluate(ce, json)).toBe(18);
});

test("what nothing resolves is held and reported, and a taken name is never a namespace", async () => {
  const ce = new ComputeEngine();
  const resolver = createRegistryResolver(ada);
  expect(await resolver.ensure(ce, ["MemberCall", "ada", "'Nope'", 1])).toEqual({
    declared: [],
    unresolved: ["ada.Nope"],
  });
  const taken = new ComputeEngine();
  taken.declare("ada", "integer");
  expect((await resolver.ensure(taken, ["MemberCall", "ada", "'Twice'", 1])).unresolved).toEqual(["ada.Twice"]);
});

test("libraries: only what an expression names, each once per engine", async () => {
  const log: string[] = [];
  const library = (name: string): Library<Engine> => ({ name, declare: () => void log.push(name) });
  const libraries = [library("analytic"), library("hypercomplex"), library("structures")];
  const resolver = createRegistryResolver(searchPath(ada, manifestRegistry(libraries)));
  const ce = new ComputeEngine();
  const { declared } = await resolver.ensure(ce, ["HurwitzZeta", 2, 1]);
  expect(declared).toEqual(["analytic"]);
  expect((await resolver.ensure(ce, ["HurwitzZeta", 3, 1])).declared).toEqual([]);
  // Qualified by its package's namespace, the same head; by another's, nothing.
  expect(
    (await resolver.ensure(new ComputeEngine(), ["MemberCall", "Analytic", "'HurwitzZeta'", 2, 1])).declared,
  ).toEqual(["analytic"]);
  expect(
    (await resolver.ensure(new ComputeEngine(), ["MemberCall", "Hypercomplex", "'HurwitzZeta'", 2, 1])).unresolved,
  ).toEqual(["Hypercomplex.HurwitzZeta"]);
});
