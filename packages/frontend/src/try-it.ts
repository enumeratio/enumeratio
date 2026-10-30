// A "Try it" panel's source: an example's typed literals as a Manipulate -- the `params`
// tuples (typed: integer step, `Boolean`, …) and the body as a template over their slots.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type HeadSignature, inferFromSignature, paramsOf } from "./infer-controls.ts";
import { epsil } from "./mathjson.ts";
import { slotted } from "./symbols.ts";

export interface TryIt {
  /** `<notatio-manipulate params>`: one tuple per lifted argument. */
  readonly params: string;
  /** The body, as Epsil over the slots (`IntegerPartitions(_n)`), for a `<dynamic-box value>`. */
  readonly value: string;
}

/** The panel for `expr` (an example) over its head's typed signature; undefined when no argument lifts. */
export function tryItOf(expr: MathJsonExpression, signature: HeadSignature): TryIt | undefined {
  const { body, specs } = inferFromSignature(expr, signature);
  const tuples = specs.map((spec) => ({ name: spec.name, params: paramsOf(spec) }));
  const drawn = tuples.filter((t): t is { name: string; params: string } => t.params !== undefined);
  if (drawn.length === 0) return undefined;
  return {
    params: drawn.map((t) => t.params).join("; "),
    value: epsil(slotted(body as MathJsonExpression, new Set(drawn.map((t) => t.name)))),
  };
}
