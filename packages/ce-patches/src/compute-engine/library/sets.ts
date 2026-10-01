import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, operandsOf, symbolNameOf } from "@enumeratio/engine";

// cortex-js/compute-engine: `QuotientRing` (`library/sets.ts`) is inert. `QuotientRing(Integers,
// m)` -- what `\mathbb{Z}/m\mathbb{Z}` and `\mathbb{Z}_m` parse to -- is not a collection, so
// `Count` of it stays unevaluated and `Element` of it is undecided, though ℤ/mℤ is finite with
// m elements. Its type handler (`quotientRingType`, `library/type-handlers.ts`) gives it the
// base's element type, `set<integer>`; but an element of ℤ/mℤ is a residue class, not an
// integer: `Element(7, QuotientRing(Integers, 5))` would type-check as `7 ∈ ℤ`.
//
// Fixed here by giving the head collection handlers for an integer base and a positive integer
// modulus (count m, finite, `isEmpty` false), and a type that doesn't claim the base's elements.
// The elements need a value for a residue class, and compute-engine has none: a host supplies
// one with `setResidueClasses` (what `IntegerMod(k, m)` is in @enumeratio/residues), and
// without one the ring counts but neither enumerates nor decides membership.

/** How a host writes the residue classes of ℤ/mℤ. */
export interface ResidueClasses {
  /** The class of `k` mod `m`, for `0 ≤ k < m`. */
  readonly element: (ce: ComputeEngine, k: bigint, m: bigint) => BoxedExpression;
  /** The modulus of a residue class, or `undefined` when `x` is not one. */
  readonly modulusOf: (x: BoxedExpression) => bigint | undefined;
  /** The type of a class, as a type expression (`value`). */
  readonly type: string;
}

const representations = new WeakMap<ComputeEngine, ResidueClasses>();

/** Give `ce`'s `QuotientRing(Integers, m)` its elements. */
export function setResidueClasses(ce: ComputeEngine, classes: ResidueClasses): void {
  representations.set(ce, classes);
}

/** `m` of `QuotientRing(Integers, m)`, for an integer `m ≥ 1`. */
export function integerQuotientModulus(expr: BoxedExpression): bigint | undefined {
  if (expr.operator !== "QuotientRing") return undefined;
  const [base, m] = operandsOf(expr);
  if (base === undefined || symbolNameOf(base) !== "Integers") return undefined;
  const modulus = bigIntegerAt(m);
  return modulus !== undefined && modulus >= 1n ? modulus : undefined;
}

type OperatorDefinition = NonNullable<BoxedExpression["operatorDefinition"]>;
type CollectionHandlers = NonNullable<OperatorDefinition["collection"]>;
type TypeHandler = NonNullable<OperatorDefinition["type"]>;

/** Install `QuotientRing`'s collection handlers and element type on `ce`, in place. */
export function quotientRingOverIntegers(ce: ComputeEngine): void {
  const definition = ce.lookupDefinition("QuotientRing");
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  if (operator === undefined || operator.collection !== undefined) return;
  const classes = (): ResidueClasses | undefined => representations.get(ce);

  const collection: CollectionHandlers = {
    // Any other base, or a symbolic modulus, isn't a collection: its handlers stay inert.
    isCollection: (expr) => integerQuotientModulus(expr) !== undefined,
    count: (expr) => {
      const m = integerQuotientModulus(expr);
      return m === undefined ? undefined : Number(m);
    },
    isEmpty: (expr) => (integerQuotientModulus(expr) === undefined ? undefined : false),
    isFinite: (expr) => (integerQuotientModulus(expr) === undefined ? undefined : true),
    isEnumerable: (expr) => integerQuotientModulus(expr) !== undefined && classes() !== undefined,
    iterator: (expr) => {
      const m = integerQuotientModulus(expr);
      const write = classes();
      let k = 0n;
      return {
        next: () =>
          m !== undefined && write !== undefined && k < m
            ? { value: write.element(ce, k++, m), done: false }
            : { value: undefined, done: true },
      };
    },
    contains: (expr, target) => {
      const m = integerQuotientModulus(expr);
      const read = classes();
      if (m === undefined || read === undefined) return undefined;
      const n = read.modulusOf(target);
      // Not a residue class at all (an integer, a symbol): undecided rather than false.
      return n === undefined ? undefined : n === m;
    },
  };
  operator.collection = collection;

  // The classes' type when a host has given them, else no claim at all -- `set<unknown>`, as
  // `adjoinType` answers for an adjunct it can't type. Never the base's elements.
  const elements = (): string => classes()?.type ?? "unknown";
  const nativeType = operator.type as TypeHandler | undefined;
  operator.type = ((ops, context) => {
    const base = ops[0]?.type;
    const overIntegers = base !== undefined && ce.type(base).matches("set<integer>");
    if (!overIntegers) return nativeType?.(ops, context) ?? "set";
    return ce.type(`set<${elements()}>`);
  }) as TypeHandler;
}
