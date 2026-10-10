// Every graphics head formats declares has reference examples (its held value is pinned by
// entries.test; a head that draws may also state its box shape, held to it by `@enumeratio/frontend`'s
// example-boxes test).

import { ComputeEngine } from "@cortex-js/compute-engine";
import { GRAPHICS_HEADS } from "@enumeratio/formats";
import { expect, test } from "vite-plus/test";
import { referenceData } from "../src/node.ts";

test("every graphics head of ours has an example", () => {
  const documented = new Set(
    referenceData()
      .heads.filter((h) => h.entry.examples.length > 0)
      .map((h) => h.head),
  );
  // `Polygon` and `Text` are compute-engine's own: formats declares what it lacks.
  const bare = new ComputeEngine();
  expect(GRAPHICS_HEADS.filter((head) => !documented.has(head) && !bare.lookupDefinition(head))).toEqual([]);
});
