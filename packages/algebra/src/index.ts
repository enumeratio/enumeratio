import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";

// The shared seam for algebra libraries.
//
// compute-engine lets you REPLACE a built-in operator's definition, which is how these
// extensions hook into arithmetic. It does NOT let you replace a definition that an
// extension already made: a second `ce.declare("NonCommutativeMultiply", …)` throws
// "already declared in this scope". So the moment two libraries want to answer for the
// same head — and they do, since `Basis` of a Clifford algebra and `Basis` of a
// Temperley–Lieb algebra are the same question — the heads have to be declared ONCE and
// dispatched.
//
// That is all this package is: the heads, declared once per engine, walking a list of
// providers and taking the first answer. A provider returns `undefined` for anything it
// does not recognise, so adding a new family of algebras is a matter of registering one
// object, not of editing this file.

/** One library's answers. Every method returns `undefined` to pass to the next. */
export interface AlgebraProvider {
  readonly name: string;
  /** The basis of a named algebra, as a list. */
  basis?(algebra: BoxedExpression): BoxedExpression | undefined;
  /** Its dimension. */
  dimension?(algebra: BoxedExpression): BoxedExpression | undefined;
  /** Its signature vector, where that means anything. */
  signature?(algebra: BoxedExpression): BoxedExpression | undefined;
  /** Whether `element` lies in `algebra`. */
  contains?(element: BoxedExpression, algebra: BoxedExpression): BoxedExpression | undefined;
  /** The ordered product of operands this provider owns. */
  product?(operands: readonly BoxedExpression[]): BoxedExpression | undefined;
}

type NativeEvaluate = NonNullable<BoxedExpression["operatorDefinition"]>["evaluate"];
type EvaluateOptions = Parameters<NonNullable<NativeEvaluate>>[1];

const registries = new WeakMap<ComputeEngine, AlgebraProvider[]>();

/** The providers registered on an engine, in registration order. */
export const providersOf = (ce: ComputeEngine): readonly AlgebraProvider[] =>
  registries.get(ce) ?? [];

/**
 * Register a provider and, on first call for this engine, declare the shared heads.
 * Idempotent per (engine, provider name), so a library may be declared twice without
 * stacking duplicate answers.
 */
export function registerAlgebra(ce: ComputeEngine, provider: AlgebraProvider): void {
  const existing = registries.get(ce);
  if (existing === undefined) {
    registries.set(ce, [provider]);
    declareSharedHeads(ce);
    return;
  }
  if (!existing.some((p) => p.name === provider.name)) existing.push(provider);
}

/** First non-undefined answer across the providers. */
function ask<T extends keyof AlgebraProvider>(
  ce: ComputeEngine,
  method: T,
  run: (provider: AlgebraProvider) => BoxedExpression | undefined,
): BoxedExpression | undefined {
  for (const provider of providersOf(ce)) {
    if (provider[method] === undefined) continue;
    const answer = run(provider);
    if (answer !== undefined) return answer;
  }
  return undefined;
}

function declareSharedHeads(ce: ComputeEngine): void {
  const accessor = (
    head: string,
    method: "basis" | "dimension" | "signature",
    signature: string,
  ): void => {
    ce.declare(head, {
      signature,
      evaluate: (ops: readonly BoxedExpression[]) => {
        const algebra = ops[0];
        if (algebra === undefined) return undefined;
        return ask(ce, method, (p) => p[method]?.(algebra));
      },
    });
  };

  accessor("Basis", "basis", "(value) -> list");
  accessor("AlgebraDimension", "dimension", "(value) -> integer");
  accessor("AlgebraSignature", "signature", "(value) -> list");

  // The ordered product. `Multiply` is declared commutative, so canonicalisation sorts
  // its operands before any handler runs — which is fine for a commutative algebra and
  // fatal for a Clifford or diagram one. Wolfram splits the non-commutative product
  // onto its own head for the same reason.
  for (const head of ["NonCommutativeMultiply", "GeometricProduct", "CircleTimes"]) {
    ce.declare(head, {
      signature: "(number*) -> number",
      commutative: false,
      associative: true,
      evaluate: (ops: readonly BoxedExpression[]) => ask(ce, "product", (p) => p.product?.(ops)),
    });
  }

  // `Element` IS a built-in, so it keeps its native behaviour for everything the
  // providers do not claim.
  // Scoped, because boxing a probe declares the free symbols it names — `x` read here
  // would stay bound for the session.
  ce.pushScope();
  const nativeElement = ce.box(["Element", "x", "Integers"]).operatorDefinition?.evaluate;
  ce.popScope();
  ce.declare("Element", {
    signature: "(any, any, boolean?) -> boolean",
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      const element = ops[0];
      const algebra = ops[1];
      if (element !== undefined && algebra !== undefined) {
        const answer = ask(ce, "contains", (p) => p.contains?.(element, algebra));
        if (answer !== undefined) return answer;
      }
      return nativeElement?.(ops, options);
    },
  });
}
