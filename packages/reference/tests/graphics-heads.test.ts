// Every graphics head formats declares has reference examples (its held value is pinned by
// entries.test; a head that draws may also state its box shape, held to it by `@enumeratio/frontend`'s
// example-boxes test).

import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareGraphics, GRAPHICS_HEADS } from "@enumeratio/formats";
import { declareStructures } from "@enumeratio/structures";
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

// Hosts declare graphics and structures in either order; `Point` must stay the geometric one.
test.each([
  [
    "graphics, then structures",
    (ce: ComputeEngine) => {
      declareGraphics(ce);
      declareStructures(ce);
    },
  ],
  [
    "structures, then graphics",
    (ce: ComputeEngine) => {
      declareStructures(ce);
      declareGraphics(ce);
    },
  ],
])("Midpoint of two points evaluates with %s", (_, declare) => {
  const ce = new ComputeEngine();
  declare(ce);
  const mid = ce.box(["Midpoint", ["Point", ["List", 0, 0]], ["Point", ["List", 2, 2]]] as never).evaluate();
  expect(mid.json).toEqual(["Point", ["List", 1, 1]]);
});
