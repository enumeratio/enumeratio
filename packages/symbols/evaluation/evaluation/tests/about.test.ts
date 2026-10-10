import { ComputeEngine } from "@cortex-js/compute-engine";
import { createRegistryResolver, definitionRegistry, describe } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { declareAbout } from "../src/index.ts";

const engine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  declareAbout(ce);
  return ce;
};
const about = (ce: ComputeEngine, json: unknown): Record<string, unknown> =>
  (ce.box(["About", json] as never).evaluate().json as { dict: Record<string, unknown> }).dict;

test("a declared head keeps compute-engine's keys, and gains the manifest's", () => {
  const sin = about(engine(), "Sin");
  expect(sin).toMatchObject({
    name: "Sin",
    kind: "function",
    signature: "(complex) -> number",
    description: "Sine of an angle.",
    examples: ["Sin(Pi / 6)", "Sin(1)", "N(Sin(1))"],
    url: "https://enumeratio.dev/reference/symbol/Sin",
    params: ["x"],
    documented: ["analytic"],
  });
  expect(sin.overloads).toHaveLength(2);
});

test("a head not declared yet: every overload, and the signature it will have", async () => {
  // Combinatorics isn't declared here; describing it once imports its summary for the sync path.
  await describe("MajorIndex");
  const major = about(engine(), "MajorIndex");
  expect(major).toMatchObject({
    name: "MajorIndex",
    kind: "function",
    signature: "(dyck_path | list | permutation) -> integer | number",
    documented: ["combinatorics"],
    description: expect.any(String),
  });
  expect(JSON.stringify(major.findstat)).toContain("St000004");
});

test("a string is a value, as compute-engine has it; an unknown name stays compute-engine's", () => {
  const ce = engine();
  expect(about(ce, "'Sin'")).toEqual({ kind: "string", type: "string", value: "Sin" });
  expect(about(ce, "Fooble")).toEqual({ name: "Fooble", kind: "symbol", type: "unknown" });
});

test("a library name is described through the resolver, never declared", async () => {
  const ce = engine();
  const ada = definitionRegistry<ComputeEngine>("ada", {
    Scaled: {
      signature: "(x: number, factor: number?) -> number",
      body: ["Function", ["Multiply", "factor", "x"], "x", "factor"],
      defaults: { factor: 2 },
      summary: "Its argument times factor, two unless given.",
    },
  });
  const resolver = createRegistryResolver(ada, { describeOnly: ["About"] });
  const json = ["About", ["Field", "ada", "'Scaled'"]];
  const { expression, declared } = await resolver.ensure(ce, json);
  expect(declared).toEqual([]);
  expect(about(ce, (expression as unknown[])[1])).toMatchObject({
    name: "ada.Scaled",
    kind: "function",
    description: "Its argument times factor, two unless given.",
    signature: "(x: number, factor: number?) -> number",
    defaults: { dict: { factor: expect.anything() } },
    namespace: "ada",
  });
});

test("asynchronously, a summary is imported first", async () => {
  const ce = engine();
  const result = await ce.box(["About", "Abundance"] as never).evaluateAsync();
  expect((result.json as { dict: Record<string, unknown> }).dict.description).toEqual(expect.any(String));
});
