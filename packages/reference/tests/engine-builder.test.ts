// The engine builder (`@enumeratio/manifest`'s `buildEngine`) over the real libraries: an
// engine built for one library holds that library, what it requires and the base, and every
// head its examples name that one of them declares resolves in it. The libraries' own
// repositories will run this check for themselves; here it covers every library we ship.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { buildEngine, DECLARE_ORDER, DECLARERS, PACKAGES, reachedNames } from "@enumeratio/manifest";
import { expect, test } from "vite-plus/test";
import { AVAILABLE, PLAN } from "../scripts/engines.ts";
import { referenceData } from "../src/node.ts";

const BASE = new Set(["evaluation", "boxes", "structures"]);
const requiresOf = (name: string): string[] => [
  ...(PACKAGES[name]?.requires ?? []),
  ...(AVAILABLE.find((library) => library.name === name)?.requires ?? []),
];

/** What declaring `name` brings: itself and its requirements, transitively, and the base. */
function closure(name: string): Set<string> {
  const names = new Set([...BASE, name]);
  for (const next of names)
    for (const dep of requiresOf(next)) if (AVAILABLE.some((l) => l.name === dep)) names.add(dep);
  return names;
}

const heads = referenceData().heads;
const bound = (ce: ComputeEngine, name: string): boolean => ce.lookupDefinition(name) !== undefined;

test("the reference engine declares every library after what it requires", () => {
  const position = new Map(PLAN.order.map((library, at) => [library.name, at]));
  expect(PLAN.missing).toEqual([]);
  for (const library of PLAN.order) {
    for (const dep of requiresOf(library.name)) {
      // `DECLARE_ORDER` wins over an extension where it says so (analytic's `Max` before structures').
      const overridden = DECLARE_ORDER.some(([first, later]) => first === library.name && later === dep);
      if (position.has(dep) && !overridden)
        expect(position.get(dep), `${dep} before ${library.name}`).toBeLessThan(position.get(library.name)!);
    }
  }
  for (const [first, later] of DECLARE_ORDER) {
    if (position.has(first) && position.has(later)) expect(position.get(first)).toBeLessThan(position.get(later)!);
  }
  // Each library says why it is there.
  for (const library of PLAN.order) expect(PLAN.reasons[library.name]).toBeDefined();
});

for (const { name } of AVAILABLE) {
  if (BASE.has(name)) continue;
  test(`an engine built for ${name} declares it and what it requires`, () => {
    const { engine, plan } = buildEngine({
      libraries: [name],
      available: AVAILABLE,
      engine: () => new ComputeEngine(),
    });
    expect(new Set(plan.order.map((library) => library.name))).toEqual(closure(name));
    expect(plan.reasons[name]).toEqual({ kind: "asked" });

    // Everything the library declares is there.
    const declared = Object.entries(DECLARERS)
      .filter(([, by]) => by.includes(name))
      .map(([head]) => head);
    expect(declared.filter((head) => !bound(engine, head))).toEqual([]);

    // And so is every head its examples name that a library in the plan declares: the heads
    // the resolver would load these libraries for, found without evaluating anything.
    const planned = new Set(plan.order.map((library) => library.name));
    const missing = new Set<string>();
    for (const head of heads.filter((h) => h.package === name)) {
      for (const example of head.entry.examples) {
        for (const used of reachedNames(example.expr)) {
          const by = DECLARERS[used];
          if (by?.some((pkg) => planned.has(pkg)) === true && !bound(engine, used)) missing.add(used);
        }
      }
    }
    expect([...missing].toSorted()).toEqual([]);
  });
}
