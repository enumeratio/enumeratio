import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCollections } from "@enumeratio/collections/src";
import { expect, test } from "vite-plus/test";
import { applicationCandidates, canonicalParse, prepare, rawParse } from "../src/lazy.ts";
import { ResourceRegistry } from "../src/registry.ts";
import { catalogRegistry, ENUMERATIO } from "../src/resources.ts";
import type { Resource } from "../src/types.ts";

const res = (name: string): Resource => ({ name, context: "t", kind: "collection" });

test("compute-engine reads an unknown name applied to parentheses as an application", () => {
  expect(canonicalParse(new ComputeEngine(), "\\operatorname{Foo}(3)")).toEqual(["Foo", 3]);
  // The raw stage still keeps the unresolved reading, for a front end that wants to decide.
  expect(rawParse(new ComputeEngine(), "\\operatorname{Foo}(3)")).toEqual([
    "InvisibleOperator",
    "Foo",
    ["Delimiter", 3],
  ]);
});

test("candidates are found in either tree", () => {
  const src = "\\operatorname{Foo}(3) + \\operatorname{Bar}(2) + a(b+c)";
  for (const parse of [canonicalParse, rawParse]) {
    const ce = new ComputeEngine();
    expect(applicationCandidates(parse(ce, src), ce).sort()).toEqual(["Bar", "Foo", "a"]);
  }
});

test("resolving installs the claimed names before boxing", async () => {
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
  expect(box.json).toEqual(["Add", ["a", ["Add", "b", "c"]], ["Foo", 3], ["Bar", 2]]);
  // `a` is not a name we claim, so it stays an undeclared application.
  expect(box.evaluate().toString()).toBe("a(b + c) + 50");
});

test("a declined install leaves the name undeclared", async () => {
  const ce = new ComputeEngine();
  const registry = new ResourceRegistry().add(res("Foo")).bless("t");
  const box = await prepare(ce, "\\operatorname{Foo}(3)", registry, () => false);
  expect(box.json).toEqual(["Foo", 3]);
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
