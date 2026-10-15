import { bigIntegerAt, type Engine, type Expr } from "@enumeratio/engine";
import { factorInteger } from "@enumeratio/residues";
import { SUMMARIES } from "@enumeratio/manifest/package/number-theory";

// Abundance and AliquotSum are compositions over DivisorSigma, and SquareFreePart and
// SquarePartRoot split n = ±s²·q by FactorInteger. All four take a nonzero integer and read
// its sign as a unit, as PrimeOmega does:
// they work on |n|. Each stays unevaluated where it can't answer.

const nonzeroInteger = (op: Expr | undefined): bigint | undefined => {
  const n = op === undefined ? undefined : bigIntegerAt(op);
  return n === undefined || n === 0n ? undefined : n < 0n ? -n : n;
};

export function declareDivisorParts(ce: Engine): void {
  // σ(|n|) − c·|n|, written as the expression it is rather than computed by a kernel.
  const sigmaMinus = (multiple: number) => (ops: readonly Expr[]) => {
    const n = nonzeroInteger(ops[0]);
    if (n === undefined) return undefined;
    const answer = ce
      .box([
        "Subtract",
        ["DivisorSigma", 1, { num: n.toString() }],
        ["Multiply", multiple, { num: n.toString() }],
      ] as never)
      .evaluate();
    return bigIntegerAt(answer) === undefined ? undefined : answer;
  };

  ce.declare("Abundance", {
    description: SUMMARIES.Abundance,
    signature: "(integer) -> integer",
    broadcastable: true,
    evaluate: sigmaMinus(2),
  });

  ce.declare("AliquotSum", {
    description: SUMMARIES.AliquotSum,
    signature: "(integer) -> integer",
    broadcastable: true,
    evaluate: sigmaMinus(1),
  });

  // The primes with an odd exponent make q; half of every exponent makes s.
  const squareSplit = (part: "free" | "root") => (ops: readonly Expr[]) => {
    const n = nonzeroInteger(ops[0]);
    if (n === undefined) return undefined;
    const factors = factorInteger(n);
    if (factors === undefined) return undefined;
    let result = 1n;
    for (const [p, e] of factors) result *= p ** BigInt(part === "free" ? e % 2 : Math.floor(e / 2));
    return ce.number(result);
  };

  ce.declare("SquareFreePart", {
    description: SUMMARIES.SquareFreePart,
    signature: "(integer) -> integer",
    broadcastable: true,
    evaluate: squareSplit("free"),
  });

  ce.declare("SquarePartRoot", {
    description: SUMMARIES.SquarePartRoot,
    signature: "(integer) -> integer",
    broadcastable: true,
    evaluate: squareSplit("root"),
  });
}
