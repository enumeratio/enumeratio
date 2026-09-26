// Plausible's reach (design/plausible.md §6): every head this namespace declares with collection
// handlers is a family Plausible can sample — or is exempt here, with a reason. Walking the
// engine rather than a registry means a collection can't escape by never registering.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { COLLECTIONS } from "@enumeratio/catalog/src";
import { allEntries } from "@enumeratio/collections/src";
import { PRIVATE_SUFFIX, publicName } from "@enumeratio/domains/src";
import { expect, test } from "vite-plus/test";
import { bindings, fullEngine } from "../src/engine.ts";

const EXEMPT: Record<string, string> = {
  PrimitiveRootList:
    "residues: a finite list per n, answered by φ(φ(n)) and an ascending scan; not a combinatorial family",
  IntegerModRing:
    "residues: ℤ/m as the collection of its residue classes; its elements are IntegerMod values, not kernel elements",
};

const hasCollection = (ce: ComputeEngine, name: string): boolean => {
  const def = ce.lookupDefinition(name) as
    | { operator?: { collection?: unknown }; value?: { collection?: unknown } }
    | undefined;
  return (def?.operator?.collection ?? def?.value?.collection) !== undefined;
};

test("every declared collection is a Plausible family or exempt with a reason", () => {
  const ce = fullEngine();
  const bare = bindings(new ComputeEngine());
  const families = new Set(allEntries.map((f) => f.head));
  const loose = [...bindings(ce)]
    .filter((name) => !bare.has(name) && hasCollection(ce, name))
    // extendBuiltin keeps compute-engine's own collection under a private name (Reverse_).
    .filter((name) => !(name.endsWith(PRIVATE_SUFFIX) && bare.has(publicName(name))))
    .filter((name) => !families.has(name) && EXEMPT[name] === undefined);
  expect(loose).toEqual([]);
  const staleExemptions = Object.keys(EXEMPT).filter((name) => !hasCollection(ce, name) || families.has(name));
  expect(staleExemptions).toEqual([]);
});

test("a family's declared carrier is the catalogue's", () => {
  const carrierOf = new Map(COLLECTIONS.map((c) => [c.name, c.carrier]));
  const drift = allEntries
    .filter((f) => f.declared !== undefined && carrierOf.get(f.head) !== undefined)
    .filter((f) => f.declared?.carrier !== carrierOf.get(f.head))
    .map((f) => `${f.head}: ${f.declared?.carrier} vs ${carrierOf.get(f.head)}`);
  expect(drift).toEqual([]);
});
