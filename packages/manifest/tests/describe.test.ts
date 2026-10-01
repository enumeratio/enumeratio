import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import {
  combineRegistries,
  createRegistryResolver,
  type Definition,
  definitionRegistry,
  describe,
  describedIn,
  describeNow,
  manifestRegistry,
  pinOf,
} from "../src/index.ts";

type Engine = InstanceType<typeof ComputeEngine>;

const scaled: Definition = {
  signature: "(x: number, factor: number?) -> number",
  body: ["Function", ["Multiply", "factor", "x"], "x", "factor"],
  defaults: { factor: 2 },
  summary: "Its argument times factor, two unless given.",
};
const ada = definitionRegistry<Engine>("ada", { Scaled: scaled });

test("a head we know: its summary, page, every overload, and the one it is declared with", async () => {
  const sin = await describe("Sin");
  expect(sin).toMatchObject({
    name: "Sin",
    kind: "function",
    description: "The sine of x, in radians.",
    url: "https://enumeratio.dev/reference/symbol/Sin",
    signature: "(complex | infinity | ~oo) -> number",
    params: ["x"],
    documented: ["analytic"],
  });
  expect(sin.overloads?.map((o) => o.package)).toEqual(["compute-engine", "analytic"]);
  // The replacement chain ends at structures, whatever order the overloads are in.
  expect((await describe("Floor")).signature).toBe("(any, any?) -> any");
  expect(await describe("Pi")).toMatchObject({ kind: "constant", type: expect.stringMatching(/^real/) });
});

test("FindStat ids and the example count come with it", async () => {
  const major = await describe("MajorIndex");
  expect(major.findstat).toContainEqual({ id: "St000004", on: "Permutation" });
  expect(major.examples).toBeGreaterThan(0);
});

test("an unknown name, and a qualified one with no registry, are unknown", async () => {
  expect(await describe("Fooble")).toEqual({ name: "Fooble", kind: "unknown" });
  expect(await describe("ada.Scaled")).toEqual({ name: "ada.Scaled", kind: "unknown" });
});

test("a library symbol is described from its definition, with its defaults and the head it pins to", async () => {
  const pin = await pinOf(scaled);
  expect(await describe("ada.Scaled", { registry: ada })).toEqual({
    name: "ada.Scaled",
    kind: "function",
    description: "Its argument times factor, two unless given.",
    signature: "(x: number, factor: number?) -> number",
    params: ["x", "factor"],
    defaults: { factor: 2 },
    namespace: "ada",
    pin,
    head: `ada_Scaled_${pin.slice(7, 15)}`,
  });
});

test("a package's namespace describes the global head it declares", async () => {
  const registry = manifestRegistry<Engine>([{ name: "analytic", declare: () => {} }]);
  expect(await registry.describe?.("Analytic.Zeta")).toMatchObject({ name: "Analytic.Zeta", namespace: "Analytic" });
  expect(await registry.describe?.("Analytic.MajorIndex")).toBeUndefined();
  // Our packages' namespaces are the manifest's own: no registry needed.
  expect(await describe("Combinatorics.MajorIndex")).toMatchObject({ namespace: "Combinatorics", kind: "function" });
});

test("a glob describes every head it matches", async () => {
  const found = await describe("Zeta*");
  expect(found.map((d) => d.name)).toEqual(["Zeta"]);
  expect((await describe("*Zeta")).map((d) => d.name)).toContain("HurwitzZeta");
  expect((await describe("ada.S*", { registry: ada })).map((d) => d.name)).toEqual(["ada.Scaled"]);
});

test("what describe imported is there synchronously after", async () => {
  await describe("Zeta");
  expect(describeNow("Zeta").description).toBeDefined();
});

test("a name given to a describe-only head is described, not declared or lowered", async () => {
  const ce = new ComputeEngine();
  const registry = combineRegistries<Engine>(ada, manifestRegistry([]));
  const resolver = createRegistryResolver(registry, { describeOnly: ["About"] });
  const about = ["About", ["Field", "ada", "'Scaled'"]];
  const ensured = await resolver.ensure(ce, about);
  expect(ensured.declared).toEqual([]);
  expect(ensured.expression).toEqual(about);
  expect(ensured.described["ada.Scaled"]?.defaults).toEqual({ factor: 2 });
  expect(describedIn(ce, "ada.Scaled")?.signature).toBe(scaled.signature);
  // Used outside the head as well, it is declared there, and lowered there only.
  const both = ["List", about, ["MemberCall", "ada", "'Scaled'", 3, ["NamedArgument", "'factor'", 5]]];
  const used = await resolver.ensure(ce, both);
  expect(used.declared).toHaveLength(1);
  expect((used.expression as unknown[])[1]).toEqual(about);
});
