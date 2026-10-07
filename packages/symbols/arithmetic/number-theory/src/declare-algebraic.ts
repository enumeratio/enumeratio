import { algebraicNumbers, applyPatch, numberField, readAlgebraic } from "@enumeratio/ce-patches";
import { type Engine, type Expr, operandsOf, optionsOf, wrapOperator } from "@enumeratio/engine";
import { SUMMARIES } from "@enumeratio/manifest/package/number-theory";

// Orders of number fields past degree 2: AlgebraicIntegers(θ), the ring of integers of ℚ(θ), and
// AlgebraicOrder(θ), ℤ[θ]. In degrees 1 and 2 they are the rings already named: Integers,
// QuadraticIntegers(d) and QuadraticOrder(D). Either is a ring for `Over`: IsPrime asks whether
// (x) is a prime ideal, O/(x) a field. The arithmetic is ce-patches' algebraic-numbers kernel.

const { equationOrder, maximalOrder, monogenicOrder, orderDiscriminant, orderIndex, generatesPrime } = numberField;

type Order = numberField.Order;

/** The order a ring names, and its generator read in its field; `undefined` when it isn't one. */
function orderOf(ce: Engine, ring: Expr): { order: Order; degree: number } | undefined {
  if (ring.operator !== "AlgebraicIntegers" && ring.operator !== "AlgebraicOrder") return undefined;
  const [generator0, ...rest] = operandsOf(ring);
  if (generator0 === undefined || rest.length > 0) return undefined;
  const read = readAlgebraic(ce, generator0);
  if (read === undefined) return undefined;
  const { field, generator } = read;
  const degree = field.f.length - 1;
  if (ring.operator === "AlgebraicIntegers") {
    const order = maximalOrder(field.f);
    return order && { order, degree };
  }
  // ℤ[θ] is an order only for θ integral.
  if (!numberField.isIntegral(field.f, generator)) return undefined;
  const order =
    generator.den === 1n && generator.num.every((c, i) => c === (i === 1 ? 1n : 0n))
      ? equationOrder(field.f)
      : monogenicOrder(field.f, generator);
  return { order, degree };
}

/** The ring a degree-1 or -2 order is already named as. */
function namedRing(ce: Engine, ring: Expr): Expr | undefined {
  const named = orderOf(ce, ring);
  if (named === undefined || named.degree > 2) return undefined;
  if (named.degree === 1) return ce.symbol("Integers");
  const D = orderDiscriminant(named.order);
  if (orderIndex(maximalOrder(named.order.f)!) !== orderIndex(named.order)) {
    return ce.function("QuadraticOrder", [ce.number(Number(D))]);
  }
  // D_K = d or 4d, d squarefree.
  const d = D % 4n === 0n ? D / 4n : D;
  if (d === -1n) return ce.symbol("GaussianIntegers");
  return ce.function("QuadraticIntegers", [ce.number(Number(d))]);
}

export function declareAlgebraic(ce: Engine): void {
  applyPatch(ce, algebraicNumbers);
  // Held when past degree 2, as QuadraticIntegers is: a ring for `Over`, not a value to expand.
  for (const head of ["AlgebraicIntegers", "AlgebraicOrder"] as const) {
    ce.declare(head, {
      description: SUMMARIES[head],
      signature: "(number) -> set<number>",
      evaluate: (ops: readonly Expr[]) => namedRing(ce, ce.function(head, [...ops])),
    });
  }

  // IsPrime(x, Over -> AlgebraicIntegers(θ)): (x) a prime ideal, in degree 3 and past; the
  // quadratic rings answer through their own names.
  wrapOperator(
    ce,
    ["IsPrime"],
    (ops) => ops.length === 2,
    (native) => (ops, options) => {
      const split = optionsOf(["IsPrime", ...ops.map((op) => op.json)] as never);
      const over = split.options.Over;
      const ring = over === undefined ? undefined : ce.box(over as never);
      const named = ring && orderOf(ce, ring);
      if (named === undefined || named.degree <= 2) return native?.(ops, options);
      const read = readAlgebraic(ce, operandsOf(ring!)[0]!, ops[0]!);
      if (read === undefined) return undefined;
      const prime = generatesPrime(named.order, read.x);
      return prime === undefined ? undefined : ce.symbol(prime ? "True" : "False");
    },
  );
}
