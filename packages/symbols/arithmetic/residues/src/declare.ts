import {
  bigIntegerAt,
  bigRationalAt,
  extendHead,
  operandsOf,
  threadOverLists,
  widenSignature,
  wrapOperator,
  type EvaluateOptions,
  type Engine,
  type Expr,
} from "@enumeratio/engine";
import { declareCarriers } from "@enumeratio/structures";
import { RESIDUES_CARRIERS } from "./carrier-data.ts";
import { declareIntegerMod } from "./integer-mod.ts";
import { declareResidueClass, residueClassOf } from "./residue-class-declare.ts";
import { declareModExactConstant } from "./mod-exact-constant.ts";
import { discreteLog, multiplicativeOrder, primitiveRootCount, primitiveRootList, primitiveRoots } from "./logs.ts";
import { powerModList } from "./roots.ts";
import { declareTables } from "./table-declare.ts";

// Wiring ℤ/m to compute-engine. Every head answers over bigints and stays unevaluated —
// never approximate — when it cannot answer: no such residue, an unfactorable modulus, or
// more roots than it will list.
//
// PowerMod, PowerModList, PrimitiveRootList, RationalReconstruction (in number-theory) and
// MultiplicativeOrder are compute-engine's own heads. Each is widened in place (its
// signature, list threading) and wrapped so the native handler answers first; ours answers
// only what it declines: the forms Wolfram gives them and compute-engine lacks (a rational
// base, the order of a unit of ℤ/m, the roots of a huge modulus counted without listing).

/** Past this modulus a native handler is not asked to factor it. */
const NATIVE_FACTORING_LIMIT = 2n ** 64n;

type Native = ((ops: readonly Expr[], options: EvaluateOptions) => unknown) | undefined;

/** Did the native handler give an answer, rather than decline (nothing, or the call back)? */
const answered = (r: unknown, head: string): r is Expr => r !== undefined && (r as Expr).operator !== head;

/** `ours` answers whatever `native` declines, and `first` calls skip native altogether. */
function extend(
  ce: Engine,
  head: string,
  ours: (ops: readonly Expr[]) => Expr | undefined,
  first: (ops: readonly Expr[]) => boolean = () => false,
): void {
  // Native's lazy heads type-check their own operands in a canonical handler the widened
  // signature doesn't reach; let the signature do it, with the operands evaluated up front.
  const operator = (ce.lookupDefinition(head) as { operator?: Record<string, unknown> } | undefined)?.operator;
  if (operator?.lazy === true) Object.assign(operator, { lazy: false, canonical: undefined });
  wrapOperator(
    ce,
    [head],
    () => true,
    (native: Native) => (ops, options) => {
      if (first(ops)) return ours(ops);
      const r = native?.(ops, options);
      return answered(r, head) ? r : ours(ops);
    },
  );
}

export function declareResidues(ce: Engine): void {
  // This package's own carrier — moved from combinatorics' domains/LEFTOVER_DOMAINS. Types,
  // constructor, plural type-space name and `Element` membership, all in one call.
  declareCarriers(ce, RESIDUES_CARRIERS);
  declareTables(ce);

  const list = (xs: readonly bigint[]): Expr =>
    ce.function(
      "List",
      xs.map((x) => ce.number(x)),
    );

  /** a^(s/r) mod m, as the list of every x with xʳ ≡ aˢ — the heart of both heads below. */
  const roots = (ops: readonly Expr[]): bigint[] | undefined => {
    const a = bigRationalAt(ops[0]);
    const exponent = bigRationalAt(ops[1]);
    const m = bigIntegerAt(ops[2]);
    if (a === undefined || exponent === undefined || m === undefined) return undefined;
    return powerModList(a, exponent[0], exponent[1], m);
  };

  // Native takes integers (a rational exponent for the two power heads); a call it would
  // reject on type, say a rational base or a list, reaches ours instead.
  const mayBeRational = (op: Expr): boolean => op.isRational !== false;
  const mayBeInteger = (op: Expr): boolean => op.isInteger !== false;

  // Wolfram's PowerModList[a, s/r, m]. Threads over lists, as Wolfram's does.
  widenSignature(ce, "PowerModList", "(number, number, number) -> list<number>", mayBeRational);
  threadOverLists(ce, ["PowerModList"]);
  extend(
    ce,
    "PowerModList",
    (ops) => {
      const found = roots(ops);
      return found === undefined ? undefined : list(found);
    },
    // Native factors the modulus without a bound (a product of two 21-digit primes aborts the
    // evaluation); ours declines past what it can factor.
    (ops) => (bigIntegerAt(ops[2]) ?? 0n) >= NATIVE_FACTORING_LIMIT,
  );

  // PowerMod with Wolfram's rational exponent — `PowerMod(a, 1/r, m)` is the least r-th
  // root — and a rational base.
  widenSignature(ce, "PowerMod", "(number, number, number) -> number", mayBeRational);
  threadOverLists(ce, ["PowerMod"]);
  extend(
    ce,
    "PowerMod",
    (ops) => {
      // a⁰ ≡ 1 (mod m) whatever a and m are — Wolfram evaluates this even for the negative
      // or zero m where native PowerMod declines, because it never touches a.
      if (ops[1] !== undefined && bigIntegerAt(ops[1]) === 0n)
        return ce.function("Mod", [ce.number(1), ops[2]!]).evaluate();
      const found = roots(ops);
      return found === undefined || found.length === 0 ? undefined : ce.number(found[0]!);
    },
    (ops) => ops[1] !== undefined && bigIntegerAt(ops[1]) === 0n,
  );

  // MultiplicativeOrder[k, n, {r₁, …}]: the least m > 0 with kᵐ ≡ some rᵢ — a discrete log —
  // is native; the order of a unit of ℤ/m, MultiplicativeOrder(ResidueClass(k, n)), is ours.
  widenSignature(ce, "MultiplicativeOrder", "(value, integer?, list<integer>?) -> integer", mayBeInteger);
  extend(ce, "MultiplicativeOrder", (ops) => {
    const unit = ops.length === 1 ? residueClassOf(ops[0]) : undefined;
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
  });

  // PrimitiveRootList threads over a list, and past the listing cap stays unevaluated but is
  // still a collection: Length and At answer from φ(φ(n)) and an ascending scan, without the
  // whole list.
  threadOverLists(ce, ["PrimitiveRootList"]);
  extend(ce, "PrimitiveRootList", (ops) => {
    const n = bigIntegerAt(ops[0]);
    const found = n === undefined ? undefined : primitiveRootList(n);
    return found === undefined ? undefined : list(found);
  });
  extendHead(ce, "PrimitiveRootList", {
    collection: {
      count: (c: Expr) => {
        const n = bigIntegerAt(operandsOf(c)[0]);
        const count = n === undefined ? undefined : primitiveRootCount(n);
        return count === undefined || count > BigInt(Number.MAX_SAFE_INTEGER) ? undefined : Number(count);
      },
      isFinite: () => true,
      isLazy: () => true,
      iterator: (c: Expr) => {
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
      at: (c: Expr, index: unknown) => {
        const n = bigIntegerAt(operandsOf(c)[0]);
        if (n === undefined || typeof index !== "number" || index < 1) return undefined;
        let k = 0;
        for (const g of primitiveRoots(n)) if (++k === index) return ce.number(g);
        return undefined;
      },
    },
  });

  declareResidueClass(ce);
  declareIntegerMod(ce);
  declareModExactConstant(ce);
}
