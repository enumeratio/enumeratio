import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareCollections } from "@enumeratio/collections/src";
import { expect, test } from "vite-plus/test";
import { CARRIERS, COLLECTIONS, MAPS, STATS } from "../src/catalog-data.ts";
import { REFERENCES } from "../src/references.ts";
import { declareCatalog } from "../src/declare.ts";
import { catalogRegistry, ENUMERATIO } from "../src/resources.ts";
import { pascal } from "../src/spelling.ts";

const engine = () => {
  const ce = new ComputeEngine();
  declareCollections(ce);
  declareCatalog(ce, { bless: [ENUMERATIO] });
  return ce;
};

test("the catalog is the measured shape, folded to names", () => {
  // Stats and maps are folded from (collection, stat) rows to NAMES with overload sets.
  // If these move, design/namespaces.md §1 is stale — that is the point of pinning them.
  expect(COLLECTIONS.length).toBe(282);
  expect(CARRIERS.length).toBe(87);
  expect(STATS.length).toBe(242);
  expect(MAPS.length).toBe(85);
});

test("a stat is one name defined on several carriers", () => {
  expect(STATS.find((s) => s.name === "MajorIndex")?.on).toEqual(["DyckPaths", "Permutations", "StandardTableaux"]);
});

test("every collection's carrier is itself a carrier we know", () => {
  const known = new Set(CARRIERS.map((c) => c.name));
  for (const c of COLLECTIONS) if (c.carrier) expect(known, c.name).toContain(c.carrier);
});

test("registering the whole catalog declares nothing", () => {
  // 280 collections cost one Map insert each — no heads, no engine state.
  const ce = new ComputeEngine();
  const before = COLLECTIONS.filter((c) => ce.lookupDefinition?.(c.name)).length;
  declareCatalog(ce);
  expect(COLLECTIONS.filter((c) => ce.lookupDefinition?.(c.name)).length).toBe(before);
});

test("a resource with a head evaluates; one without stays symbolic", () => {
  const ce = engine();
  expect(ce.box(["Resource", "'Subsets'", 3]).evaluate().json).toEqual(ce.box(["Subsets", 3]).evaluate().json);
  // StepCompositions is a real catalog name with no kernel of its own (it's an aliasOf
  // FibonacciCompositions, which does have one) — declining is the honest answer, not an error.
  const held = ce.box(["Resource", "'StepCompositions'", 4]).evaluate();
  expect(held.operator).toBe("Resource");
  expect(ce.box(["Resource", "'Nonesuch'", 1]).evaluate().operator).toBe("Resource");
});

test("a qualified resource evaluates, and composes with Count", () => {
  const ce = engine();
  expect(ce.box(["Resource", "'enumeratio`SetPartitions'", 3]).evaluate().json).toEqual(
    ce.box(["SetPartitions", 3]).evaluate().json,
  );
  expect(ce.box(["Count", ["Resource", "'Subsets'", 4]]).evaluate().re).toBe(16);
});

test("the curried spelling works at the MathJSON layer", () => {
  // [["Resource", "'X'"], n] canonicalises to Apply, and resolving to the head symbol is
  // enough for it to apply. It does NOT parse from LaTeX — see design/namespaces.md §3.1.
  const ce = engine();
  expect(ce.box([["Resource", "'Subsets'"], 3] as never).evaluate().json).toEqual(
    ce.box(["Subsets", 3]).evaluate().json,
  );
  expect(ce.parse("f(x)(3)").json).toEqual(["Multiply", 3, ["f", "x"]]);
});

test("an unblessed registry resolves nothing bare", () => {
  expect(catalogRegistry().resolve("Subsets")).toBeUndefined();
  expect(catalogRegistry().resolve("enumeratio`Subsets")?.kind).toBe("collection");
});

test("pascal transforms enumeratio ids", () => {
  expect(pascal("weak_compositions_into_k_parts")).toBe("WeakCompositionsIntoKParts");
});

test("most stat names are single-carrier inheritance, not overloading", () => {
  // The 1051 -> 242 fold is mostly carrier scoping: a stat on one carrier is inherited by
  // every collection over it. Only these 53 actually need overload resolution.
  const multi = STATS.filter((s) => s.on.length > 1);
  expect(STATS.length - multi.length).toBe(189);
  expect(multi.length).toBe(53);
  expect(STATS.find((s) => s.name === "BigOmega")?.on).toEqual(["IntegerFactorizations", "Numeric"]);
});

test("every reference fix lands on a row, and the fixed rows are what consumers see", () => {
  // A fix that matches nothing throws at load; this just shows the fixed shape.
  const crank = REFERENCES.filter((r) => r.subject === "Crank" && r.system === "findstat");
  expect(crank.map((r) => r.identity)).toEqual(["St000474"]);
  expect(REFERENCES.some((r) => r.subject === "Area" && r.system === "findstat")).toBe(false);
  expect(REFERENCES.find((r) => r.subject === "DyckPaths" && r.system === "mathlib4")?.url).toContain(
    "Catalan/Basic.html#catalan",
  );
});
