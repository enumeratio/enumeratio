import { type Engine, type Expr, extendHead, isSymbol, operandsOf, symbolNameOf } from "@enumeratio/engine";
import type { EvalOptions } from "@enumeratio/ce-patches";

// Solve(g(f(x)) == c, x) for a head f that is a bijection of the reals with a known inverse: the
// equation is solved for y = f(x), and each real root y gives x = f⁻¹(y), as Wolfram substitutes.
// Only where x occurs nowhere but inside f(x), and every root y is real (a complex y has no
// guaranteed preimage under the principal branch), so the answer is never short of a solution.

const INVERSES: Readonly<Record<string, (ce: Engine, y: Expr) => Expr>> = {
  CubeRoot: (ce, y) => ce.function("Power", [y, ce.number(3)]).evaluate(),
  InverseErfc: (ce, y) => ce.function("Erfc", [y]).evaluate(),
};

/** The invertible heads applied directly to the symbol `unknown` anywhere in `expr`. */
function callsOf(expr: Expr, unknown: string, found: Set<string>): Set<string> {
  const args = operandsOf(expr);
  if (expr.operator in INVERSES && args.length === 1 && symbolNameOf(args[0]!) === unknown) found.add(expr.operator);
  for (const arg of args) callsOf(arg, unknown, found);
  return found;
}

function replaceCalls(ce: Engine, expr: Expr, unknown: string, head: string, placeholder: Expr): Expr {
  const args = operandsOf(expr);
  if (expr.operator === head && args.length === 1 && symbolNameOf(args[0]!) === unknown) return placeholder;
  if (args.length === 0) return expr;
  return ce.function(
    expr.operator,
    args.map((arg) => replaceCalls(ce, arg, unknown, head, placeholder)),
  );
}

/** A root of the substituted equation, when it is a real constant: its numeric value for ordering. */
function realValue(y: Expr): number | undefined {
  if (y.unknowns.length > 0) return undefined;
  const value = y.N();
  return Number.isFinite(value.re) && value.im === 0 ? value.re : undefined;
}

export function declareSolveInverseHeads(ce: Engine): void {
  const definition = ce.lookupDefinition("Solve");
  const native = definition !== undefined && "operator" in definition ? definition.operator.evaluate : undefined;
  if (native === undefined) return;

  extendHead(ce, "Solve", {
    evaluate: (ops: readonly Expr[], options: EvalOptions) => {
      const answer = native(ops, options);
      if (answer !== undefined || ops.length !== 2) return answer;
      const [statement, spec] = [ops[0]!.canonical, ops[1]!];
      const unknown = isSymbol(spec) ? spec.symbol : undefined;
      if (unknown === undefined || statement.operator !== "Equal") return undefined;
      const heads = callsOf(statement, unknown, new Set());
      if (heads.size !== 1) return undefined;
      const [head] = [...heads] as [string];

      // Scoped, so the placeholder never lands among the engine's own symbols.
      ce.pushScope();
      try {
        const placeholder = ce.symbol("solveInverseRoot");
        const substituted = replaceCalls(ce, statement, unknown, head, placeholder);
        if (substituted.unknowns.includes(unknown)) return undefined;
        const roots = ce.function("Solve", [substituted, placeholder]).evaluate();
        if (roots.operator !== "List") return undefined;
        const values = operandsOf(roots).map((y) => ({ y, value: realValue(y) }));
        if (values.some(({ value }) => value === undefined)) return undefined;
        values.sort((a, b) => a.value! - b.value!);
        return ce.function(
          "List",
          values.map(({ y }) => INVERSES[head]!(ce, y)),
        );
      } finally {
        ce.popScope();
      }
    },
  });
}
