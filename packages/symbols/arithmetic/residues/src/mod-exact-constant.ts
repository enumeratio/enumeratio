import { bigRationalAt, symbolNameOf, wrapOperator, type Engine } from "@enumeratio/engine";

export function declareModExactConstant(ce: Engine): void {
  // compile builtin: a bare constant symbol (Pi) against a numeric modulus: the exact remainder equals the lowering's value
  wrapOperator(
    ce,
    ["Mod", 2],
    (ops) => {
      if (ops.length !== 2 || ops[0] === undefined || ops[1] === undefined) return false;
      const [x, m] = ops;
      if (symbolNameOf(x) === undefined) return false; // a bare constant symbol only
      if (bigRationalAt(x) !== undefined) return false; // already exact: native handles it
      const mNum = m.re;
      if (!(Number.isFinite(mNum) && mNum > 0)) return false;
      const xNum = x.N().re;
      if (!Number.isFinite(xNum)) return false; // a free variable, not a numeric constant
      const ratio = xNum / mNum;
      return Math.abs(ratio - Math.round(ratio)) > 1e-6; // margin from a boundary case
    },
    () => (ops, options) => {
      const [x, m] = ops;
      const k = Math.floor(x.N().re / m.re!);
      const expr = ce.function("Subtract", [x, ce.function("Multiply", [ce.number(k), m])]);
      return options.numericApproximation ? expr.N() : expr.evaluate();
    },
    { compile: "builtin" },
  );
}
