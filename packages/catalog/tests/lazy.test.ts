import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCollections } from "@enumeratio/collections/src";
import { expect, test } from "vite-plus/test";
import { applicationCandidates, prepare, rawParse } from "../src/lazy.ts";
import { ResourceRegistry } from "../src/registry.ts";
import { catalogRegistry, ENUMERATIO } from "../src/resources.ts";
import type { Resource } from "../src/types.ts";

const res = (name: string): Resource => ({ name, context: "t", kind: "collection" });

test("the non-canonical parse keeps the ambiguity that canonicalisation destroys", () => {
  const ce = new ComputeEngine();
  expect(rawParse(ce, "\\operatorname{Foo}(3)")).toEqual([
    "InvisibleOperator",
    "Foo",
    ["Delimiter", 3],
  ]);
  // …and this is why the raw parse is needed: the canonical form has already committed.
  expect(ce.parse("\\operatorname{Foo}(3)").json).toEqual(["Multiply", 3, "Foo"]);
  // Multi-argument application never had the problem — the comma defeats Multiply.
  expect(ce.parse("\\operatorname{Foo}(3,4)").json).toEqual(["Foo", 3, 4]);
});

test("candidates are found in the raw tree", () => {
  const ce = new ComputeEngine();
  const raw = rawParse(ce, "\\operatorname{Foo}(3) + \\operatorname{Bar}(2) + a(b+c)");
  expect(applicationCandidates(raw, ce).sort()).toEqual(["Bar", "Foo", "a"]);
});

test("resolving before canonicalisation repairs the tree", async () => {
  const ce = new ComputeEngine();
  const registry = new ResourceRegistry().addAll([res("Foo"), res("Bar")]).bless("t");
  const box = await prepare(
    ce,
    "\\operatorname{Foo}(3) + \\operatorname{Bar}(2) + a(b+c)",
    registry,
    (r) => {
      ce.declare(r.name, {
        signature: "(number) -> number",
        evaluate: ([n]) => ce.number(n.re * 10),
      });
      return true;
    },
  );
  expect(box.json).toEqual(["Add", ["Multiply", "a", ["Add", "b", "c"]], ["Foo", 3], ["Bar", 2]]);
  // `a` is not a name we claim, so it stays a multiplication — the registry decides.
  expect(box.evaluate().toString()).toBe("a * (b + c) + 50");
});

test("a declined install leaves the name alone", async () => {
  const ce = new ComputeEngine();
  const registry = new ResourceRegistry().add(res("Foo")).bless("t");
  const box = await prepare(ce, "\\operatorname{Foo}(3)", registry, () => false);
  expect(box.json).toEqual(["Multiply", 3, "Foo"]);
});

test("MathJSON input needs no raw-parse step — heads are already explicit", async () => {
  const ce = new ComputeEngine();
  const registry = new ResourceRegistry().add(res("Foo")).bless("t");
  const box = await prepare(ce, ["Add", ["Foo", 3], 1], registry, (r) => {
    ce.declare(r.name, {
      signature: "(number) -> number",
      evaluate: ([n]) => ce.number(n.re * 10),
    });
    return true;
  });
  expect(box.evaluate().re).toBe(31);
});

test("the loop installs a real catalog collection on demand", async () => {
  // Nothing is declared up front; `Subsets` arrives because the expression asked for it.
  const ce = new ComputeEngine();
  const registry = catalogRegistry().bless(ENUMERATIO);
  let installed = "";
  const box = await prepare(ce, ["Count", ["Subsets", 4]], registry, (r) => {
    installed = r.name;
    declareCollections(ce); // stands in for a lazy import of the owning library
    return true;
  });
  expect(installed).toBe("Subsets");
  expect(box.evaluate().re).toBe(16);
});
