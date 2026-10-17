import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { emit } from "@enumeratio/engine";

type Evaluate = (ops: readonly BoxedExpression[], options: never) => BoxedExpression | undefined;
type Operator = { evaluate: Evaluate | undefined };

/** A number written or computed as a float, even an integer-valued one (`12.0`). */
const isInexactNumber = (op: BoxedExpression): boolean =>
  op.isNumber === true && (op as Partial<{ isExact: boolean }>).isExact === false;

/**
 * `FactorInteger` is declared `(integer) -> list<tuple<integer, integer>>`, and `12.0` is a float
 * on every route, yet the native handler factors it. A float is not an exact number: the call
 * stays as written, and says so (`FactorInteger::exact`, as in Wolfram).
 */
export function declineInexactFactorInteger(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("FactorInteger");
  const operator = definition !== undefined && "operator" in definition ? (definition.operator as Operator) : undefined;
  const native = operator?.evaluate;
  if (operator === undefined || native === undefined) return;
  operator.evaluate = (ops, options) => {
    const [x] = ops;
    if (x !== undefined && isInexactNumber(x)) {
      emit(ce, "FactorInteger", "exact", [x]);
      return undefined;
    }
    return native(ops, options);
  };
}
