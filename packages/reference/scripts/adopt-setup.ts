// The adopter's worker engine: the reference engine's libraries, and `CanonicalForm(x)`, which
// gives back `Hold(x)` with `x` canonical and unevaluated. Writing an input in our own form
// then runs under the worker's time cap like evaluating it does: canonicalising
// `GeneratingFunction(Fibonacci(n), n, x)` never returns.

import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { configure as declareLibraries } from "./engines.ts";

export function configure(ce: ComputeEngine): void {
  declareLibraries(ce);
  ce.declare("CanonicalForm", {
    signature: "(any) -> any",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => ce.function("Hold", [ops[0]!.canonical]),
  });
}
