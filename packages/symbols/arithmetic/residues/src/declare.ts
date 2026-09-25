import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { bigIntegerAt, bigRationalAt, operandsOf, type EvaluateOptions } from "@enumeratio/boxed";
import { declareIntegerMod, integerModOf } from "./integer-mod-declare.ts";
import { declareModExactConstant } from "./mod-exact-constant.ts";
import { discreteLog, multiplicativeOrder, primitiveRootCount, primitiveRootList, primitiveRoots } from "./logs.ts";
import { powerModList } from "./roots.ts";

// Wiring ℤ/m to compute-engine. Every head answers over bigints and stays unevaluated —
// never approximate — when it cannot answer: no such residue, an unfactorable modulus, or
// more roots than it will list.
//
// PowerMod and MultiplicativeOrder are compute-engine's own heads, re-declared here for the
// forms Wolfram gives them and compute-engine lacks (a rational exponent; the list of
// targets). The native handler is captured first and still answers everything else.

type Native = ((ops: readonly BoxedExpression[], options: EvaluateOptions) => unknown) | undefined;

const nativeEvaluate = (ce: ComputeEngine, name: string): Native => {
  const definition = ce.lookupDefinition(name);
  const operator = definition !== undefined && "operator" in definition ? definition.operator : undefined;
  return operator?.evaluate as Native;
};

export function declareResidues(ce: ComputeEngine): void {
  const list = (xs: readonly bigint[]): BoxedExpression =>
    ce.function(
      "List",
      xs.map((x) => ce.number(x)),
    );

  /** a^(s/r) mod m, as the list of every x with xʳ ≡ aˢ — the heart of both heads below. */
  const roots = (ops: readonly BoxedExpression[]): bigint[] | undefined => {
    const a = bigRationalAt(ops[0]);
    const exponent = bigRationalAt(ops[1]);
    const m = bigIntegerAt(ops[2]);
    if (a === undefined || exponent === undefined || m === undefined) return undefined;
    return powerModList(a, exponent[0], exponent[1], m);
  };

  // Wolfram's PowerModList[a, s/r, m]. Threads over lists, as Wolfram's does.
  ce.declare("PowerModList", {
    description: "Every x in [0, m) with x^r ≡ a^s (mod m), for an exponent s/r; a rational a = u/v reads as u·v⁻¹.",
    signature: "(number, number, number) -> list<number>",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const found = roots(ops);
      return found === undefined ? undefined : list(found);
    },
  });

  // PowerMod with Wolfram's rational exponent — `PowerMod(a, 1/r, m)` is the least r-th
  // root — and a rational base. Integer forms go to the native handler unchanged.
  const nativePowerMod = nativeEvaluate(ce, "PowerMod");
  ce.declare("PowerMod", {
    description:
      "a^b mod m. A negative b inverts a; a rational b = s/r gives the least x with x^r ≡ a^s; a rational a = u/v reads as u·v⁻¹.",
    signature: "(number, number, number) -> number",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[], options: EvaluateOptions) => {
      // a⁰ ≡ 1 (mod m) whatever a and m are — Wolfram evaluates this even for the negative
      // or zero m where PowerMod otherwise declines, because it never touches a. Route it
      // through Mod directly rather than the native handler, which declines on m ≤ 0.
      if (ops[1] !== undefined && bigIntegerAt(ops[1]) === 0n) {
        return ce.function("Mod", [ce.number(1), ops[2]!]).evaluate();
      }
      if (ops.every((op) => op.isInteger === true) && nativePowerMod !== undefined) {
        return nativePowerMod(ops, options) as BoxedExpression | undefined;
      }
      const found = roots(ops);
      return found === undefined || found.length === 0 ? undefined : ce.number(found[0]!);
    },
  });

  // MultiplicativeOrder[k, n, {r₁, …}]: the least m > 0 with kᵐ ≡ some rᵢ — a discrete log.
  ce.declare("MultiplicativeOrder", {
    description:
      "The least m > 0 with k^m ≡ 1 (mod n); with a list of targets, the least m with k^m ≡ any of them — a discrete logarithm.",
    signature: "(any, integer?, list<integer>?) -> integer",
    evaluate: (ops: readonly BoxedExpression[]) => {
      // MultiplicativeOrder(IntegerMod(k, n)) is MultiplicativeOrder(k, n).
      const unit = ops.length === 1 ? integerModOf(ops[0]) : undefined;
      const k = unit?.residue ?? bigIntegerAt(ops[0]);
      const n = unit?.modulus ?? bigIntegerAt(ops[1]);
      if (k === undefined || n === undefined) return undefined;
      if (ops[2] === undefined) {
        const order = multiplicativeOrder(k, n);
        return order === undefined ? undefined : ce.number(order);
      }
      const targets = operandsOf(ops[2]).map(bigIntegerAt);
      if (targets.some((t) => t === undefined)) return undefined;
      const log = discreteLog(k, n, targets as bigint[]);
      return log === undefined ? undefined : ce.number(log);
    },
  });

  ce.declare("PrimitiveRootList", {
    description: "Every primitive root of n, ascending — empty unless (ℤ/n)* is cyclic.",
    signature: "(integer) -> list<integer>",
    broadcastable: true,
    evaluate: (ops: readonly BoxedExpression[]) => {
      const n = bigIntegerAt(ops[0]);
      const found = n === undefined ? undefined : primitiveRootList(n);
      return found === undefined ? undefined : list(found);
    },
    // Past the listing cap the head stays unevaluated but is still a collection: Length and
    // At answer from φ(φ(n)) and an ascending scan, without the whole list.
    collection: {
      count: (c) => {
        const n = bigIntegerAt(operandsOf(c)[0]);
        const count = n === undefined ? undefined : primitiveRootCount(n);
        return count === undefined || count > BigInt(Number.MAX_SAFE_INTEGER) ? undefined : Number(count);
      },
      isFinite: () => true,
      isLazy: () => true,
      iterator: (c) => {
        const n = bigIntegerAt(operandsOf(c)[0]);
        const roots = n === undefined ? undefined : primitiveRoots(n);
        return {
          next: () => {
            const next = roots?.next();
            return next === undefined || next.done === true
              ? { value: undefined, done: true }
              : { value: ce.number(next.value), done: false };
          },
        };
      },
      at: (c, index) => {
        const n = bigIntegerAt(operandsOf(c)[0]);
        if (n === undefined || typeof index !== "number" || index < 1) return undefined;
        let k = 0;
        for (const g of primitiveRoots(n)) if (++k === index) return ce.number(g);
        return undefined;
      },
    },
  });

  declareIntegerMod(ce);
  declareModExactConstant(ce);
}
