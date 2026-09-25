import { ComputeEngine } from "@cortex-js/compute-engine";
import { declareAestimatio } from "@enumeratio/aestimatio";
import { expect, test } from "vite-plus/test";
import { configure } from "./worker-engine-setup.ts";

// The site declares its libraries in its own order (engine-libraries.ts), which neither the
// reference engine nor census's uses. A head two libraries both declare only throws in the
// order that meets it second -- and when the site's engine throws, every Cell on every page
// shows the error (#184's PermutationCycles). So build the site's engine here, the way a
// session worker does: aestimatio first, then the shared sequence.
const siteEngine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  declareAestimatio(ce);
  configure(ce);
  return ce;
};

test("the site's engine declares every library without throwing", () => {
  expect(siteEngine).not.toThrow();
});

test("heads more than one library declares still evaluate on the site's engine", () => {
  const ce = siteEngine();
  const run = (json: unknown): unknown => ce.box(json as never).evaluate().json;
  expect(run(["Add", 1, 1])).toEqual(2);
  // domains' carrier constructor and groupalgebra's cycle notation share the name.
  expect(run(["PermutationCycles", ["List", 2, 1, 3]])).toEqual([
    "Cycles",
    ["List", ["List", 1, 2]],
  ]);
});
