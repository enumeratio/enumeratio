// `Mod(f(args), m)` computed modulo m, without ever building f(args).
//
// compute-engine evaluates a call's operands before its handler runs, so a `Mod` handler
// only ever sees `f(args)` already evaluated: the huge value `Mod` exists to avoid. Nothing
// in its operator API holds one operand of one call. `lazy: true` on `Mod` does, but holds
// every call, and then `Mod` stops canonicalising its operands, broadcasting over lists, and
// typing as `integer` (probed against 0.152: `Mod(Multiply(3, 4), 5)` stays unfolded,
// `Mod(List(1, 2, 3), 2)` stays unevaluated, `Mod(x, 3)` loses its type). A `canonical`
// hook on `Mod` was tried too and broke every call it declined (declare-fast-recurrence.ts).
//
// So the interception is one level up, on the node: `evaluate` of a `Mod` call whose first
// operand is a registered shape answers from the registry; every other call, and every
// call that declines, runs compute-engine's own `evaluate` untouched. The one thing read
// from compute-engine's internals is that function nodes share a prototype with an
// `evaluate` and `evaluateAsync` (read through ce-internals.ts, which a compute-engine bump
// re-checks; the fast path stays off if they move).
//
// A kernel is `(args, m) => residue | undefined` over exactly-evaluated integer arguments
// and a positive modulus; `undefined` declines. `Add`, `Multiply`, `Subtract`, `Negate` and
// `Power` are closed over in Z/m, so `Mod(2·F(n) + 1, p)` stays modular throughout.
import { functionNodePrototype } from "./ce-internals.ts";
import type { Engine, Expr } from "./facade.ts";
import { bigIntegerAt, operandsOf } from "./index.ts";

/** A residue of `head(...args)` modulo `modulus` (> 0), in [0, modulus); `undefined` declines. */
export type ModularKernel = (args: readonly bigint[], modulus: bigint) => bigint | undefined;

interface Entry {
  readonly kernel: ModularKernel;
  readonly arity: number;
}

// Keyed by global symbols, not module-local maps: a second instance of this module (a duplicate
// install, hot reload) must find the first one's registry and wrapper, never add its own.
const REGISTRY = Symbol.for("enumeratio.modular.registry");
const PATCHED = Symbol.for("enumeratio.modular.patched");

const registryOf = (ce: object): Map<string, Entry> | undefined =>
  (ce as { [REGISTRY]?: Map<string, Entry> })[REGISTRY];

const residue = (a: bigint, m: bigint): bigint => {
  const r = a % m;
  return r < 0n ? r + m : r;
};

function powerMod(base: bigint, exponent: bigint, m: bigint): bigint {
  let result = 1n % m;
  let b = residue(base, m);
  for (let e = exponent; e > 0n; e >>= 1n) {
    if (e & 1n) result = (result * b) % m;
    b = (b * b) % m;
  }
  return result;
}

/** Below this exponent a `Power` is cheap exactly, so it alone never takes the modular path. */
const TRIVIAL_EXPONENT = 256n;

const exactInteger = (expr: Expr): bigint | undefined => bigIntegerAt(expr.evaluate());

interface Run {
  readonly registry: ReadonlyMap<string, Entry>;
  /** A registered kernel (or a large power) answered: the call is worth taking over. */
  used: boolean;
}

/** `expr` modulo `m` (> 0) from the registry and the ring operations, or undefined. */
function modular(expr: Expr, m: bigint, run: Run): bigint | undefined {
  const literal = bigIntegerAt(expr);
  if (literal !== undefined) return residue(literal, m);
  const ops = operandsOf(expr);
  switch (expr.operator) {
    case "Add":
    case "Multiply": {
      const add = expr.operator === "Add";
      let total = add ? 0n : 1n % m;
      for (const op of ops) {
        const r = modular(op, m, run);
        if (r === undefined) return undefined;
        total = add ? (total + r) % m : (total * r) % m;
      }
      return total;
    }
    case "Subtract": {
      if (ops.length !== 2) return undefined;
      const [a, b] = [modular(ops[0]!, m, run), modular(ops[1]!, m, run)];
      return a === undefined || b === undefined ? undefined : residue(a - b, m);
    }
    case "Negate": {
      const a = ops.length === 1 ? modular(ops[0]!, m, run) : undefined;
      return a === undefined ? undefined : residue(-a, m);
    }
    case "Mod": {
      // An inner Mod is a ring element when its modulus is a positive multiple of ours.
      const k = ops.length === 2 ? exactInteger(ops[1]!) : undefined;
      if (k === undefined || k <= 0n || k % m !== 0n) return undefined;
      const inner = modular(ops[0]!, k, run);
      return inner === undefined ? undefined : residue(inner, m);
    }
    case "Power": {
      if (ops.length !== 2) return undefined;
      const exponent = exactInteger(ops[1]!);
      if (exponent === undefined || exponent <= 0n) return undefined; // 0^0 is Indeterminate
      const base = modular(ops[0]!, m, run);
      if (base === undefined) return undefined;
      if (exponent > TRIVIAL_EXPONENT) run.used = true;
      return powerMod(base, exponent, m);
    }
  }
  const entry = run.registry.get(expr.operator);
  if (entry === undefined || ops.length !== entry.arity) return undefined;
  const args: bigint[] = [];
  for (const op of ops) {
    const value = exactInteger(op);
    if (value === undefined) return undefined;
    args.push(value);
  }
  const answer = entry.kernel(args, m);
  if (answer === undefined) return undefined;
  run.used = true;
  return answer;
}

const RING = new Set(["Add", "Multiply", "Subtract", "Negate", "Mod"]);

/** Whether `expr` has a registered call or a `Power` under ring operations: a walk with no evaluation,
 *  so every other `Mod` call is left alone before its modulus is evaluated. */
function mentionsKernel(expr: Expr, registry: ReadonlyMap<string, Entry>): boolean {
  if (expr.operator === "Power" || registry.has(expr.operator)) return true;
  return RING.has(expr.operator) && operandsOf(expr).some((op) => mentionsKernel(op, registry));
}

/** The value of `Mod(operand, modulus)`, or undefined when the registry has no say. */
function take(call: Expr): Expr | undefined {
  const engine = (call as { engine?: Engine }).engine;
  const registry = engine === undefined ? undefined : registryOf(engine);
  const ops = operandsOf(call);
  if (registry === undefined || ops.length !== 2 || !call.isValid) return undefined;
  if (!mentionsKernel(ops[0]!, registry)) return undefined;
  const m = exactInteger(ops[1]!);
  if (m === undefined || m === 0n) return undefined;
  const size = m < 0n ? -m : m;
  const run: Run = { registry, used: false };
  const r = modular(ops[0]!, size, run);
  if (r === undefined || !run.used) return undefined;
  // Floored modulo: the result takes the divisor's sign.
  return engine!.number(m > 0n || r === 0n ? r : r + m);
}

type Options = { numericApproximation?: boolean };

/** Wrap `evaluate` and `evaluateAsync` once per prototype, however many module instances ask. */
function patch(ce: Engine): void {
  const prototype = functionNodePrototype(ce) as
    | (Record<string | symbol, unknown> & {
        evaluate: (this: Expr, options?: Options) => Expr;
        evaluateAsync: (this: Expr, options?: Options) => Promise<Expr>;
      })
    | undefined;
  if (prototype === undefined || prototype[PATCHED] === true) return;
  const { evaluate, evaluateAsync } = prototype;
  const answer = (node: Expr, options?: Options): Expr | undefined =>
    node.operator === "Mod" && options?.numericApproximation !== true ? take(node) : undefined;
  prototype.evaluate = function (this: Expr, options?: Options): Expr {
    return answer(this, options) ?? evaluate.call(this, options);
  };
  prototype.evaluateAsync = function (this: Expr, options?: Options): Promise<Expr> {
    const value = answer(this, options);
    return value === undefined ? evaluateAsync.call(this, options) : Promise.resolve(value);
  };
  Object.defineProperty(prototype, PATCHED, { value: true });
}

/**
 * Let `Mod(head(a₁, …, aₙ), m)` compute modulo `m` through `kernel`, for `arity` integer
 * arguments. Declines (so the ordinary evaluation runs) for a non-integer argument or
 * modulus, `m = 0`, a kernel that answers `undefined`, and numeric approximation.
 */
export function registerModularKernel(ce: Engine, head: string, kernel: ModularKernel, arity = 1): void {
  let registry = registryOf(ce);
  if (registry === undefined) {
    registry = new Map();
    Object.defineProperty(ce, REGISTRY, { value: registry });
  }
  registry.set(head, { kernel, arity });
  patch(ce);
}
