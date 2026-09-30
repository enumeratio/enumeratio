import { ComputeEngine } from "@cortex-js/compute-engine";
import { createKernel, declareEvaluation } from "@enumeratio/evaluation";
import { expect, test } from "vite-plus/test";
import { CATALOGUE } from "./worker-catalogue.ts";
import { configure } from "./worker-engine-setup.ts";

// The site declares its libraries in its own order (engine-libraries.ts), which neither the
// reference engine nor census's uses. A head two libraries both declare only throws in the
// order that meets it second -- and when the site's engine throws, every Cell on every page
// shows the error (#184's PermutationCycles). So build the site's engine here, the way a
// session worker does: evaluation first, then the shared sequence.
const siteEngine = (): ComputeEngine => {
  const ce = new ComputeEngine();
  declareEvaluation(ce);
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
  expect(run(["PermutationCycles", ["List", 2, 1, 3]])).toEqual(["Cycles", ["List", ["List", 1, 2]]]);
});

test("a kernel over the site's catalogue answers as the site's engine does, declaring on demand", async () => {
  const ce = new ComputeEngine();
  declareEvaluation(ce);
  const kernel = createKernel(ce, CATALOGUE);
  const eager = siteEngine();
  const sum = await kernel.evaluate(["Add", 1, 1]);
  expect(sum).toMatchObject({ ok: true, json: 2, declared: [] });
  // Analytic only where a call needs it.
  const cycles = await kernel.evaluate(["PermutationCycles", ["List", 2, 1, 3]]);
  expect(cycles.declared).not.toContain("analytic");
  expect(cycles.json).toEqual(eager.box(["PermutationCycles", ["List", 2, 1, 3]] as never).evaluate().json);
  for (const json of [
    ["Add", ["IntegerMod", 3, 5], 4],
    ["Multiply", "i_1", "i_1"],
  ]) {
    const lazy = await kernel.evaluate(json);
    expect(lazy.ok).toBe(true);
    expect(lazy.json).toEqual(eager.box(json as never).evaluate().json);
  }
});
