// A `setup` module for tests that need a worker's evaluation to genuinely throw (`ok:
// false` from `evaluateCooperatively`) rather than compute-engine's usual habit of turning
// anything malformed into an `["Error", …]` MathJSON value instead of raising. Declares
// `Boom()`, which always throws when evaluated.

import type { ComputeEngine } from "@cortex-js/compute-engine";

export function configure(ce: ComputeEngine): void {
  ce.declare("Boom", {
    signature: "() -> any",
    evaluate: () => {
      throw new Error("Boom: deliberate test failure");
    },
  });
}
