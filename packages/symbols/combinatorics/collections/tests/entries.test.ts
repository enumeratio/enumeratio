import { ComputeEngine } from "@cortex-js/compute-engine";
import { expect, test } from "vite-plus/test";
import { entries } from "../src/entries.ts";
import { declareCollections } from "../src/library.ts";

const ce = new ComputeEngine();
declareCollections(ce);

// Ground every documented example against the registered library.
for (const entry of entries) {
  for (const example of entry.examples) {
    test(`${entry.name} example/${example.id}`, () => {
      const input = example.expr as unknown as Parameters<ComputeEngine["box"]>[0];
      expect(ce.box(input).evaluate().json).toEqual(example.expected);
    });
  }
}
