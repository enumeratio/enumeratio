// Epsil definitions compiled to JavaScript over BigInts, for the integers past 2^53 that
// compiled.ts's doubles can't hold. The same compute-engine compiler, with integer literals
// emitted as `Nn` and a bigint `_SYS`; it covers what is pure integer arithmetic (walks, ballot
// numbers, binomials, folds over ranges) and throws a TypeError or RangeError at run time for
// anything that mixes in a double, which a caller reads as a decline and hands to the
// interpreter. A separate entry (`@enumeratio/engine/compiled-bigint`).

import type { ComputeEngine, Expression } from "@cortex-js/compute-engine";
import { JavaScriptTarget } from "@cortex-js/compute-engine/compile";
import { type CompiledRun, runtimeHelpers, selfContainedCode } from "./compiled.ts";

class BigIntTarget extends JavaScriptTarget {
  override createTarget(options?: unknown): ReturnType<JavaScriptTarget["createTarget"]> {
    const base = super.createTarget(options as never);
    return {
      ...base,
      number: (n: number) =>
        Number.isInteger(n) ? `${n < 0 ? "(" : ""}${BigInt(n)}n${n < 0 ? ")" : ""}` : base.number(n),
    };
  }
}

/** Divide and ranged Fold rewritten to our own functions, which the compiler would otherwise lower
 *  with doubles: canonicalisation turns `x/2` into `½·x` before any target hook sees it, and the
 *  compiler counts a Range-fold's loop in doubles beside a bigint start. */
function lowered(node: unknown): unknown {
  if (!Array.isArray(node)) return node;
  if (node[0] === "Divide") return ["BigDivide", ...node.slice(1).map(lowered)];
  const range = node[3];
  if (node[0] === "Fold" && Array.isArray(range) && range[0] === "Range" && range[3] === 1)
    return ["BigFold", lowered(node[1]), lowered(node[2]), lowered(range[1]), lowered(range[2])];
  return node.map(lowered);
}

const FUNCTIONS = {
  BigDivide: "((a, b) => _SYS.bdiv(a, b))",
  BigFold: "((f, init, lo, hi) => { let acc = init; for (let i = lo; i <= hi; i++) acc = f(acc, i); return acc; })",
};

function binomial(n: bigint, k: bigint): bigint {
  if (k < 0n || k > n) return 0n;
  if (k > n - k) k = n - k;
  let result = 1n;
  for (let i = 1n; i <= k; i++) result = (result * (n - k + i)) / i;
  return result;
}

function at(list: unknown, index: bigint): unknown {
  return Array.isArray(list) && typeof index === "bigint" && index >= 1n && index <= BigInt(list.length)
    ? list[Number(index) - 1]
    : Number.NaN;
}

// Generated code guards an integer-typed binding with `Number.isInteger`, false for a bigint; the
// code is wrapped to read this instead of the global.
const bigNumber = Object.assign((x: unknown) => Number(x), Number, {
  isInteger: (x: unknown) => typeof x === "bigint" || Number.isInteger(x),
});

const sysByEngine = new WeakMap<ComputeEngine, unknown>();

/** compute-engine's runtime helpers with the integer ones replaced by bigint versions. A division
 *  that isn't exact throws a RangeError. */
export function bigintRuntime(ce: ComputeEngine): unknown {
  let sys = sysByEngine.get(ce);
  if (sys === undefined) {
    sys = Object.assign(Object.create(runtimeHelpers(ce) as object), {
      Number: bigNumber,
      bdiv: (a: bigint, b: bigint) => {
        if (a % b !== 0n) throw new RangeError("inexact division");
        return a / b;
      },
      floorMod: (a: bigint, b: bigint) => ((a % b) + b) % b,
      binomial,
      gcd: (a: bigint, b: bigint) => {
        [a, b] = [a < 0n ? -a : a, b < 0n ? -b : b];
        while (b !== 0n) [a, b] = [b, a % b];
        return a;
      },
      creal: (x: unknown) => x,
      at,
      atNumeric: at,
      atWithValueMarker: at,
    });
    sysByEngine.set(ce, sys);
  }
  return sys;
}

/** A bigint compilation: `code` is one expression of `_SYS` (from `bigintRuntime`) and `_` (the
 *  variables, as bigints and lists of them). */
interface BigintCompilation {
  readonly run: CompiledRun;
  readonly code: string;
}

/** `expression` compiled over bigints, each free variable typed; undefined when the compiler declines. */
export function compileBigint(
  ce: ComputeEngine,
  expression: unknown,
  types: Readonly<Record<string, string>>,
): BigintCompilation | undefined {
  ce.pushScope();
  try {
    for (const [name, type] of Object.entries(types)) ce.declare(name, type);
    const result = new BigIntTarget().compile(
      ce.box(lowered(expression) as never) as Expression,
      {
        functions: FUNCTIONS,
      } as never,
    ) as { success?: boolean; code?: string; preamble?: string };
    const inner = selfContainedCode(result);
    if (result.success !== true || inner === undefined) return undefined;
    const code = `(() => { const Number = _SYS.Number; return ${inner}; })()`;
    // oxlint-disable-next-line no-implied-eval -- the code is compute-engine's compiled output
    const fn = new Function("_SYS", "_", `return ${code}`) as (sys: unknown, vars: Record<string, unknown>) => unknown;
    return { run: (vars) => fn(bigintRuntime(ce), vars), code };
  } catch {
    return undefined;
  } finally {
    ce.popScope();
  }
}

/** A value for bigint code: integers as bigints, lists of them as lists, a record of variables entrywise. */
export function toBigint(value: unknown): unknown {
  if (typeof value === "number") return BigInt(value);
  if (Array.isArray(value)) return value.map(toBigint);
  return typeof value === "object" && value !== null
    ? Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toBigint(entry)]))
    : value;
}

/** The plain JS a bigint result stands for: a bigint a double holds exactly as a number, a bigger one
 *  as it is, lists elementwise. */
export function fromBigint(value: unknown): unknown {
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= -BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(value)
      : value;
  }
  return Array.isArray(value) ? value.map(fromBigint) : value;
}

/** Whether a failure of bigint code is a decline (a double mixed in, an inexact division, a rank out of
 *  reach) rather than a bug in the generated code. */
export const isBigintDecline = (error: unknown): boolean => error instanceof TypeError || error instanceof RangeError;
