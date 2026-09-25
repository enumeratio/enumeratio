import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { symbolNameOf } from "@enumeratio/boxed";

// Wolfram's chained-comparison form: `Inequality(a, Less, b, LessEqual, c, ...)` is
// `a < b`, `b <= c`, ... all at once, with the relations possibly MIXED (a homogeneous
// chain like `0 < x < 5` is already `Less(0, x, 5)` on both sides — see
// packages/wolfram/src/to-wolfram.ts and the compute-engine docs for `Less` — so this
// head only has work to do when the relation changes partway through the chain).
//
// Evaluating it as the conjunction of its pairwise links, via the relation heads
// compute-engine already ships (`Less`, `LessEqual`, ...), means correctness rides on
// their own evaluation rather than anything reimplemented here: numeric links fold all
// the way to `True`/`False` (through `And`'s own short-circuiting), and a symbolic link
// is left as that pairwise comparison, conjoined with whatever else didn't fold.

const RELATIONS = new Set(["Equal", "NotEqual", "Less", "LessEqual", "Greater", "GreaterEqual"]);

export function declareInequality(ce: ComputeEngine): void {
  ce.declare("Inequality", {
    signature: "(any, any, any, any*) -> boolean",
    lazy: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      // Value, relation, value, relation, ..., value: an odd count, relations at every
      // other position. Anything else (an even count, a non-relation in a relation slot)
      // isn't a well-formed chain — decline rather than guess at one.
      if (ops.length % 2 === 0) return undefined;
      const links: BoxedExpression[] = [];
      for (let i = 1; i < ops.length; i += 2) {
        const rel = symbolNameOf(ops[i]!);
        if (rel === undefined || !RELATIONS.has(rel)) return undefined;
        links.push(ce.function(rel, [ops[i - 1]!, ops[i + 1]!]));
      }
      return (links.length === 1 ? links[0]! : ce.function("And", links)).evaluate();
    },
  });
}
