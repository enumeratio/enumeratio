// `declareCarriers`/`declareCarrierPlurals`/`declareCarrierElement` (design/speculative/
// combinatorics-layering-and-plausible.md §4 step 1): every owning package calls these with
// its own carrier data, so two packages minting the SAME plural name (as combinatorics and
// number-theory both briefly did for `GaussianIntegers`, #411) has to settle by a registry
// check regardless of which package's declare call runs first — never by call order.

import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import type { CarrierDeclaration } from "../src/carriers.ts";
import { declareCarrierElement, declareCarrierPlurals, declareCarriers } from "../src/carriers.ts";

const SAME_CARRIER: readonly CarrierDeclaration[] = [
  { name: "Widget", type: "widget", shape: "list<integer>", id: "widget", plural: "Widgets" },
];

test("two packages minting the same carrier plural settle regardless of order", () => {
  for (const order of [
    ["a", "b"],
    ["b", "a"],
  ] as const) {
    const ce = new ComputeEngine();
    // Both "packages" declare the SAME data — the shape #411 hit, before number-theory owned
    // its own Gaussian carriers, was two packages minting the same plural name.
    declareCarriers(ce, SAME_CARRIER);
    for (const who of order) {
      void who; // both calls are identical; only the ORDER varies
      expect(() => declareCarrierPlurals(ce, SAME_CARRIER)).not.toThrow();
    }
    declareCarrierElement(ce, SAME_CARRIER);

    expect(String(ce.type("widget"))).toBe("widget");
    expect(ce.lookupDefinition("Widgets")).toBeDefined();
    expect(ce.box(["Element", ["Widget", ["List", 1]], "Widgets"]).evaluate().json).toBe("True");
  }
});
