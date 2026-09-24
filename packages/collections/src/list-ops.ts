import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

/** Declare simple list manipulation heads: Prepend. */
export function declareListOps(ce: ComputeEngine): void {
  ce.declare("Prepend", {
    signature: "(collection<any>, value) -> collection",
    evaluate: (ops: readonly BoxedExpression[]): BoxedExpression | undefined => {
      const list = ops[0];
      const value = ops[1];
      if (list === undefined || value === undefined) return undefined;
      if (list.operator !== "List") return undefined;
      const listOps = (list as { ops?: readonly BoxedExpression[] }).ops ?? [];
      return ce.box(["List", value, ...listOps]);
    },
  });
}
