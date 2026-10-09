import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { symbolNameOf, wrapOperator } from "@enumeratio/engine";
import { conform, member } from "./conform.ts";
import { ensureProtocols } from "./protocols.ts";

// Algebras. A type whose values name an algebra (`HeckeAlgebra(3, q)`, `Quaternions`) conforms
// to `FiniteDimensionalAlgebra`, and `Basis`, `AlgebraDimension` and `Element` dispatch on it.
//
// The ordered product is not a protocol yet: its operands are elements, which have no types
// of their own to dispatch on. Until they do, each library registers a product that declines
// what isn't its own, and the first answer wins.

/**
 * The ordered product of `operands` under `head`, or undefined when they aren't this
 * library's. `head` distinguishes `CircleTimes` — total, and commutative once neither side
 * carries a generator — from `NonCommutativeMultiply`/`GeometricProduct`, which must decline
 * a generator-free product rather than fold it into `Multiply`: that would silently assume
 * commutativity the caller never granted.
 */
export type Product = (operands: readonly BoxedExpression[], head: string) => BoxedExpression | undefined;

const PRODUCT_HEADS = ["NonCommutativeMultiply", "GeometricProduct", "CircleTimes"];

// On the engine rather than in a module-level map: a library's dist and another's source can
// both load this module, and they must share one list.
const PRODUCTS = Symbol.for("@enumeratio/structures:products");
const productsOf = (ce: ComputeEngine): Map<string, Product> | undefined =>
  (ce as unknown as Record<symbol, Map<string, Product> | undefined>)[PRODUCTS];

/** Declare the ordered product heads and `Element`'s algebra case, once per engine. */
export function ensureAlgebraHeads(ce: ComputeEngine): void {
  if (productsOf(ce) !== undefined) return;
  ensureProtocols(ce);
  const products = new Map<string, Product>();
  (ce as unknown as Record<symbol, Map<string, Product>>)[PRODUCTS] = products;

  // `Multiply` is commutative, so canonicalisation sorts its operands before any handler
  // runs: fatal for a Clifford or diagram algebra. Wolfram splits the non-commutative
  // product onto its own head for the same reason.
  for (const head of PRODUCT_HEADS) {
    ce.declare(head, {
      signature: "(number*) -> number",
      commutative: false,
      associative: true,
      evaluate: (ops: readonly BoxedExpression[]) => {
        for (const product of products.values()) {
          const answer = product(ops, head);
          if (answer !== undefined) return answer;
        }
        return undefined;
      },
    });
  }

  // `Element(x, A)` for an algebra `A`: its `HasElement`. Everything else stays native.
  wrapOperator(
    ce,
    ["Element", "x", "Integers"],
    // A bare unknown is a variable, not an algebra; `HeckeAlgebra(3, q)` carries its parameter.
    (ops) => ops[1] !== undefined && (ops[1].unknowns.length === 0 || symbolNameOf(ops[1]) === undefined),
    (native) => (ops, options) => {
      const verdict = member(ce, "HasElement", [ops[1]!, ops[0]!]);
      const name = verdict === undefined ? undefined : symbolNameOf(verdict);
      return name === "True" || name === "False" ? verdict : native?.(ops, options);
    },
    { ...BUILTIN, arity: 2 },
  );
}

/** Add a library's ordered product. Idempotent per name. */
export function registerProduct(ce: ComputeEngine, name: string, product: Product): void {
  ensureAlgebraHeads(ce);
  const products = productsOf(ce)!;
  if (!products.has(name)) products.set(name, product);
}

/** A family of algebras: what its values' type answers. Each method returns `undefined` for no answer. */
export interface AlgebraFamily {
  /** The type whose values name these algebras, minted by the library. */
  readonly type: string;
  basis(algebra: BoxedExpression): BoxedExpression | undefined;
  dimension(algebra: BoxedExpression): BoxedExpression | undefined;
  contains?(element: BoxedExpression, algebra: BoxedExpression): BoxedExpression | undefined;
  /** The ordered product of this family's elements. */
  product?: Product;
}

// Answers Element only for an algebra, which compiled numeric code never holds.
const BUILTIN = { compile: "builtin" } as const;

/** Make `family.type` a `FiniteDimensionalAlgebra` and register its product. */
export function declareAlgebra(ce: ComputeEngine, family: AlgebraFamily): void {
  ensureAlgebraHeads(ce);
  conform(ce, family.type, {
    FiniteDimensionalAlgebra: {
      Basis: (a) => family.basis(a),
      AlgebraDimension: (a) => family.dimension(a),
      HasElement: (a, x) => family.contains?.(x, a),
    },
  });
  if (family.product !== undefined) registerProduct(ce, family.type, family.product);
}
