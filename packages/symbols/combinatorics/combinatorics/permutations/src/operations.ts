// `PermutationProduct` and `PermutationPower` are groupalgebra's (Cycles and one-line words);
// groupalgebra can't see the `Permutation` carrier, so combinatorics widens them to it. A
// `Permutation` is read as its word and the call goes to groupalgebra's own head, so the order
// (left factor first) and the padding with fixed points are defined once, there.
import {
  type Engine,
  type Expr,
  isNativeHead,
  operandsOf,
  refusing,
  widenSignature,
  wrapOperator,
} from "@enumeratio/engine";

const isPermutation = (op: Expr): boolean => op.operator === "Permutation";

/** The call with every `Permutation` operand read as its word, or undefined if the answer isn't a
 *  permutation. A `Cycles` operand makes the answer `Cycles` (Wolfram's rule); otherwise a `Permutation`. */
function viaWords(ce: Engine, head: string, ops: readonly Expr[]): Expr | undefined {
  const words = ops.map((op) => (isPermutation(op) ? (operandsOf(op)[0] ?? op) : op));
  const answer = ce.function(head, words).evaluate();
  if (answer.operator === "Cycles") return answer;
  return answer.operator === "List" ? ce.function("Permutation", [answer]) : undefined;
}

export function declarePermutationOperations(ce: Engine): void {
  // A bare host (a package test declaring combinatorics alone) has no groupalgebra heads.
  if (!isNativeHead(ce, "PermutationProduct")) return;
  const any = "permutation | expression<Cycles> | list<integer>";
  widenSignature(ce, "PermutationProduct", `((${any})*) -> ${any}`);
  wrapOperator(
    ce,
    ["PermutationProduct"],
    (ops) => ops.some(isPermutation),
    (native) => (ops, options) => viaWords(ce, "PermutationProduct", ops) ?? native?.(ops, options),
    { compile: refusing(() => true, "no compiled lowering") },
  );
  widenSignature(ce, "PermutationPower", `(${any}, integer) -> ${any}`);
  wrapOperator(
    ce,
    ["PermutationPower"],
    (ops) => ops.length > 0 && isPermutation(ops[0]!),
    (native) => (ops, options) => viaWords(ce, "PermutationPower", ops) ?? native?.(ops, options),
    { compile: refusing(() => true, "no compiled lowering") },
  );
}
