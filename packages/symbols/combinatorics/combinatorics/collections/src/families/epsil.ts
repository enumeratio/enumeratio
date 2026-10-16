// A family defined in Epsil: its count, unrank, rank and membership are expressions, and the
// kernel that runs them belongs to an engine. Compiled code (generated ahead of time by
// scripts/compile-families.ts, else compiled on first use) answers while the fiber's count is a
// safe integer, since it computes in doubles; past that, where the compiler declines, or where
// its code disagreed with the interpreter when generated, the interpreter answers with
// compute-engine's exact integers.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import { compileTyped, definitionHash, type GeneratedRun, runtimeHelpers } from "@enumeratio/engine/compiled";
import { evaluateEpsil } from "@enumeratio/structures";
import { COMPILED_FAMILIES } from "./compiled-families.generated.js";
import {
  type Count,
  type Element,
  type FamilyKernel,
  type FamilyShape,
  type NumberKernel,
  numberKernel,
} from "./types.ts";

/** A family's definitions. Each is over the family's `params`; `unrank` also over `_r` (a
 *  0-based rank in the fiber), `rank` and `valid` over `_x` (an element). */
export interface FamilyEpsil {
  readonly count: unknown;
  readonly unrank: unknown;
  /** Asked only of a member: the kernel checks `valid` first. */
  readonly rank: unknown;
  readonly valid: unknown;
  /**
   * A list of integers over the params alone (completion counts, DP rows) that the other
   * definitions read as `_tables`. The kernel evaluates it once per distinct params and reuses it
   * across every call, so a definition reads the table instead of building it.
   */
  readonly tables?: unknown;
}

/** A hand-written reading of a family in plain numbers, in the same order as its Epsil
 *  definition (tests/fast-kernels.test.ts holds the two together). Each operation takes the
 *  family's params in order; any may throw or answer undefined to leave the question to Epsil. */
export type FastKernel = {
  /** A bigint where the count is exact past 2^53; undefined leaves it to Epsil. */
  readonly count: (p: number[]) => number | bigint | undefined;
  /** Undefined declines a fiber the kernel won't try; a throw reads as a bad argument (a rank outside
   *  the fiber). Both leave the question to Epsil. */
  readonly unrank: (p: number[], r: number) => ReturnType<NumberKernel["unrank"]> | undefined;
  readonly rank: (element: unknown, p: number[]) => number | undefined;
  readonly valid: (element: unknown, p: number[]) => boolean | undefined;
};

export interface EpsilFamily extends FamilyShape {
  /** The names the definitions give the family's params, in order. */
  readonly params: readonly string[];
  /** The compiler's type for an element, where the kind's own is too loose: a fixed-length
   *  element read by position is a tuple, since `At` on a `list<list<integer>>` may be missing. */
  readonly elementType?: string;
  /** Past 2^53, where compiled code can't answer, unrank and rank decline (unknown) rather
   *  than interpret: for definitions the interpreter takes minutes over at that size. The count
   *  stays exact, unless this is "count": the table the count reads is out of the interpreter's
   *  reach there too, so it declines as well, and the fast path alone answers unrank (a small
   *  rank) and rank (a rank a double holds) there. Membership never reads the count. */
  readonly declinePastDoubles?: true | "count";
  /** The interpreter's answers are reduced once more before they are read (`settled`): for a
   *  definition whose last fold step compute-engine leaves unreduced, which would read as no answer. */
  readonly settle?: true;
  /** Answers settled before any table is built, for calls that would otherwise build one only to
   *  decline or to say no. Each is a necessary condition, written in plain JS. */
  readonly early?: {
    /** True where the count is certainly past 2^53: with `declinePastDoubles: "count"`, the count
     *  then declines at once. */
    readonly pastDoubles?: (p: readonly number[]) => boolean;
    /** Membership of a well-formed `element`: false where it is certainly no member, "decline"
     *  where the question is too big to try, undefined to go on to the definition. */
    readonly member?: (element: unknown, p: readonly number[]) => false | "decline" | undefined;
  };
  readonly epsil: FamilyEpsil;
  /** A verified fast path: used while the fiber's count is a safe integer, ahead of Epsil.
   *  The definitions stay the meaning; this is not part of `familyHash`. */
  readonly fast?: FastKernel;
  /** A fast count alone, for a family whose unrank, rank and membership stay Epsil's: read as
   *  `fast.count` is (a bigint where the count is exact past 2^53), and ignored where `fast` is set. */
  readonly fastCount?: FastKernel["count"];
}

/** A family's definitions compiled ahead of time, with the hash of the definitions they came from. */
export interface GeneratedFamily {
  readonly hash: string;
  readonly count?: GeneratedRun;
  readonly unrank?: GeneratedRun;
  readonly rank?: GeneratedRun;
  readonly valid?: GeneratedRun;
  readonly tables?: GeneratedRun;
  /** Operations whose compiled code disagreed with the interpreter when generated: they are
   *  interpreted, never compiled on first use. */
  readonly interpreted?: readonly Operation[];
}

export type AnyFamily = FamilyKernel | EpsilFamily;

export const isEpsilFamily = (family: AnyFamily): family is EpsilFamily => "epsil" in family;

/** A family as an area lists it: an Epsil definition as it is, a NumberKernel lifted into the bigint contract. */
export const liftFamily = (family: NumberKernel | EpsilFamily): AnyFamily =>
  "epsil" in family ? family : numberKernel(family);

export const OPERATIONS = ["count", "unrank", "rank", "valid", "tables"] as const;
export type Operation = (typeof OPERATIONS)[number];

// A nested element has no compiled type: its definitions are interpreted.
const ELEMENT_TYPES: Readonly<Record<FamilyShape["kind"], string | undefined>> = {
  ints: "list<integer>",
  blocks: "list<list<integer>>",
  scalar: "integer",
  nested: undefined,
};

/** The operations a family defines: `tables` only where it has some. */
export const operationsOf = (family: EpsilFamily): Operation[] =>
  OPERATIONS.filter((operation) => family.epsil[operation] !== undefined);

/** The compiler's types for an operation's free variables; undefined when it can't be typed. */
export function operationTypes(family: EpsilFamily, operation: Operation): Record<string, string> | undefined {
  const types: Record<string, string> = Object.fromEntries(family.params.map((name) => [name, "integer"]));
  if (operation !== "tables" && family.epsil.tables !== undefined) types._tables = "list<integer>";
  if (operation === "unrank") types._r = "integer";
  if (operation === "rank" || operation === "valid") {
    const element = family.elementType ?? ELEMENT_TYPES[family.kind];
    if (element === undefined) return undefined;
    types._x = element;
  }
  return types;
}

/** The hash generated code is keyed by: every definition, `tables` included, and the params they name. */
export const familyHash = (family: EpsilFamily): string =>
  definitionHash({ params: family.params, epsil: family.epsil });

const isInteger = (value: unknown): value is number => Number.isSafeInteger(value);
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/** A fast path answers only for a fiber of at most this many members, the most a double counts
 *  exactly. Its kernels are plain JS, written exact up to it: bits read as two 32-bit words, no
 *  rank plus count, no float quotient, no product that passes 2^53 on the way to a smaller answer. */
export const FAST_LIMIT = MAX_SAFE;
/** Counts of at least this many bits (16 KB) are not kept per params, only as the last one answered. */
const MEMO_LIMIT = 1n << 131_072n;

/** Whether `value` is a plain-JS element of this shape, every entry an exact integer. */
function wellFormed(kind: FamilyShape["kind"], value: unknown): boolean {
  switch (kind) {
    case "scalar":
      return isInteger(value) || typeof value === "bigint";
    case "ints":
      return Array.isArray(value) && value.every(isInteger);
    case "blocks":
      return Array.isArray(value) && value.every((block) => Array.isArray(block) && block.every(isInteger));
    default:
      return isInteger(value) || (Array.isArray(value) && value.every((node) => wellFormed("nested", node)));
  }
}

const bigintJson = (value: bigint): unknown =>
  value <= MAX_SAFE && value >= -MAX_SAFE ? Number(value) : { num: value.toString() };

export const elementJson = (value: unknown): unknown =>
  Array.isArray(value) ? ["List", ...value.map(elementJson)] : typeof value === "bigint" ? bigintJson(value) : value;

/** An interpreted integer result, exactly; undefined for anything else. */
export function integerOf(json: unknown): bigint | undefined {
  if (isInteger(json)) return BigInt(json);
  // compute-engine writes a big integer as digits and an exponent: {num: "15511210043330985984e+6"}.
  const num = typeof json === "object" && json !== null ? (json as { num?: unknown }).num : undefined;
  const match = typeof num === "string" ? /^(-?\d+)(?:e\+?(\d+))?$/.exec(num) : null;
  return match === null ? undefined : BigInt(match[1]) * 10n ** BigInt(match[2] ?? 0);
}

/** An interpreted term of a scalar family: a number where it is exact in one, else the bigint itself,
 *  cast through `Element` (as the TS kernels' terms were; compute-engine boxes either). */
const termOf = (json: unknown): Element | undefined => {
  const big = integerOf(json);
  return big === undefined
    ? undefined
    : big <= MAX_SAFE && big >= -MAX_SAFE
      ? Number(big)
      : (big as unknown as Element);
};

/** Whether an interpreted answer still holds a power or a search the interpreter left unevaluated. */
const unexpanded = (json: unknown): boolean => /"(Power|Reduce)"/.test(JSON.stringify(json));

/** A `tables` expression at `params`, interpreted. compute-engine can leave the last entry of a
 *  fold of rows an unevaluated sum, so an entry that isn't an integer is evaluated again. */
export function evaluateTables(ce: ComputeEngine, tables: unknown, params: Record<string, unknown>): unknown {
  const table = evaluateEpsil(ce, tables, params);
  if (!Array.isArray(table)) return table;
  return table.map((entry, index) =>
    index === 0 || integerOf(entry) !== undefined ? entry : evaluateEpsil(ce, entry, {}),
  );
}

/** An interpreted answer with any step compute-engine left unreduced (the last of a fold's, whose
 *  body it evaluates lazily) reduced, so an answer that is a number, a boolean or a list of them is
 *  read as one. */
function settled(ce: ComputeEngine, json: unknown, rounds = 3): unknown {
  if (!Array.isArray(json)) return json;
  if (json[0] === "List") return ["List", ...json.slice(1).map((item) => settled(ce, item, rounds))];
  if (rounds === 0) return json;
  const again = evaluateEpsil(ce, json, {});
  return JSON.stringify(again) === JSON.stringify(json) ? json : settled(ce, again, rounds - 1);
}

/** An interpreted element as plain JS; undefined when it isn't one. */
export function elementOf(json: unknown): Element | undefined {
  if (isInteger(json)) return json;
  if (!Array.isArray(json) || json[0] !== "List") return undefined;
  const items = json.slice(1).map(elementOf);
  return items.every((item) => item !== undefined) ? (items as Element) : undefined;
}

/** How many distinct params a kernel keeps tables for, per precision. */
export const TABLES_CACHE_SIZE = 16;

export interface KernelOptions {
  /** Distinct params whose tables the kernel keeps; the least recently used is dropped past it. */
  readonly tablesCacheSize?: number;
  /** Called each time a table is computed, not read from the cache. */
  readonly onTables?: (params: readonly number[], precision: "double" | "exact") => void;
  /** `false` ignores the family's `fast` path, so the kernel runs its Epsil definitions alone. */
  readonly fast?: boolean;
  /** Called with whatever compiled code throws, before the kernel falls back to the interpreter, which
   *  answers as if it hadn't. A ReferenceError, SyntaxError or TypeError here is a bug in the generated
   *  code; tests/compiled-family-ops.test.ts fails on one. */
  readonly onCompiledError?: (operation: Operation, error: unknown) => void;
}

/** A map holding at most `size` entries, dropping the least recently read or written. */
class Lru<V> {
  private readonly entries = new Map<string, V>();
  private readonly size: number;
  constructor(size: number) {
    this.size = size;
  }
  get(key: string): V | undefined {
    const value = this.entries.get(key);
    if (value !== undefined) {
      this.entries.delete(key);
      this.entries.set(key, value);
    }
    return value;
  }
  set(key: string, value: V): void {
    this.entries.delete(key);
    this.entries.set(key, value);
    if (this.entries.size > this.size) this.entries.delete(this.entries.keys().next().value!);
  }
}

/** The family's kernel on `ce`. A family still written as a TS kernel is returned as it is. */
export function kernelOn(
  ce: ComputeEngine,
  family: AnyFamily,
  generated: Readonly<Record<string, GeneratedFamily>> = COMPILED_FAMILIES,
  options: KernelOptions = {},
): FamilyKernel {
  if (!isEpsilFamily(family)) return family;
  const {
    params,
    epsil,
    elementType: _,
    declinePastDoubles,
    settle,
    early,
    fast: fastKernel,
    fastCount,
    ...shape
  } = family;
  const maybeSettled = (json: unknown): unknown => (settle === true ? settled(ce, json) : json);
  const quick = options.fast === false ? undefined : fastKernel;
  const quickCounter = options.fast === false ? undefined : (fastKernel?.count ?? fastCount);
  const ahead = generated[family.head];
  const current = ahead?.hash === familyHash(family) ? ahead : undefined;
  // An operation that never reads `_tables` (a closed-form count) doesn't wait for the table.
  const readers = new Map<Operation, boolean>();
  const reads = (operation: Operation): boolean => {
    if (!readers.has(operation))
      readers.set(
        operation,
        epsil.tables !== undefined && operation !== "tables" && JSON.stringify(epsil[operation]).includes('"_tables"'),
      );
    return readers.get(operation)!;
  };

  const bind = (p: number[]): Record<string, number> => Object.fromEntries(params.map((name, i) => [name, p[i]]));

  const runs = new Map<Operation, ((vars: Record<string, unknown>) => unknown) | null>();
  const compiled = (operation: Operation): ((vars: Record<string, unknown>) => unknown) | null => {
    if (!runs.has(operation)) {
      const code = current?.[operation];
      if (current?.interpreted?.includes(operation) === true) runs.set(operation, null);
      else if (code !== undefined) {
        const sys = runtimeHelpers(ce);
        runs.set(operation, (vars) => code(sys, vars));
      } else {
        const types = operationTypes(family, operation);
        runs.set(operation, types === undefined ? null : (compileTyped(ce, epsil[operation], types)?.run ?? null));
      }
    }
    return runs.get(operation)!;
  };
  const attempt = (operation: Operation, vars: Record<string, unknown>): unknown => {
    const code = compiled(operation);
    if (code === null) return undefined;
    try {
      return code(vars);
    } catch (error) {
      options.onCompiledError?.(operation, error);
      return undefined;
    }
  };
  const interpret = (operation: Operation, p: number[], extra: Record<string, unknown>): unknown =>
    maybeSettled(
      evaluateEpsil(ce, epsil[operation], {
        ...bind(p),
        ...extra,
        ...(reads(operation) ? { _tables: exactTables(p) } : {}),
      }),
    );

  // A table depends on the params alone, so it is computed once per params and read by every
  // call. Compiled code reads it as doubles, the interpreter as compute-engine's exact integers
  // (a JSON list), each in its own cache.
  const tablesSize = options.tablesCacheSize ?? TABLES_CACHE_SIZE;
  // "overflow" marks a compiled table that ran past what doubles hold (a number entry Infinity or NaN, or
  // compiled code stopping at the safe integers): one the compiled code can't use, and whose exact twin
  // the interpreter takes minutes over.
  const doubleCache = new Lru<readonly number[] | null | "overflow">(tablesSize);
  const exactCache = new Lru<unknown>(tablesSize);
  function exactTables(p: number[]): unknown {
    const key = p.join(",");
    let table = exactCache.get(key);
    if (table === undefined) {
      options.onTables?.(p, "exact");
      table = evaluateTables(ce, epsil.tables, bind(p));
      exactCache.set(key, table);
    }
    return table;
  }
  /** The table as doubles; undefined when compiled code can't produce it, "overflow" when doubles can't hold it. */
  const doubleTables = (p: number[]): readonly number[] | "overflow" | undefined => {
    const key = p.join(",");
    let table = doubleCache.get(key);
    if (table === undefined) {
      options.onTables?.(p, "double");
      const code = compiled("tables");
      let value: unknown;
      try {
        value = code?.(bind(p));
      } catch (error) {
        // Compiled code stops at the edge of the safe integers with this RangeError: past what doubles hold.
        // Any other failure leaves the table unproduced, as before; a blown stack says nothing of the
        // params, so it isn't kept.
        if (error instanceof RangeError && error.message.includes("beyond the safe integer range")) value = "overflow";
        else if (error instanceof RangeError && error.message.includes("call stack")) return undefined;
        else options.onCompiledError?.("tables", error);
      }
      table = Array.isArray(value) && value.every(Number.isInteger) ? (value as number[]) : null;
      if (
        value === "overflow" ||
        (Array.isArray(value) && value.some((x) => typeof x === "number" && !Number.isFinite(x)))
      )
        table = "overflow";
      doubleCache.set(key, table);
    }
    return table ?? undefined;
  };

  const run = (operation: Operation, p: number[], extra: Record<string, unknown>): unknown => {
    const vars = { ...bind(p), ...extra };
    if (!reads(operation)) return attempt(operation, vars);
    const table = doubleTables(p);
    // Past what doubles hold, a family that declines there says so at once rather than interpret.
    if (table === "overflow" && declinePastDoubles !== undefined && wellParamed(p)) return decline(p, "table");
    return table === undefined || table === "overflow" ? undefined : attempt(operation, { ...vars, _tables: table });
  };
  // The message `needsBigint` recognises: the handlers answer unknown.
  const decline = (p: number[], why: "count" | "table" = "count"): never => {
    throw new RangeError(
      `${family.head}(${p.join(", ")}): ${why === "count" ? "past 2^53" : "its table doesn't fit in doubles"}, not bigint yet`,
    );
  };
  const fail = (operation: Operation, p: number[], json: unknown): never => {
    throw new Error(`${family.head}(${p.join(", ")}): its ${operation} definition gave ${JSON.stringify(json)}`);
  };

  // The fast kernels read the params as written, so they take only the family's own arity of
  // non-negative integers; anything else is left to Epsil.
  const wellParamed = (p: readonly number[]): boolean => {
    if (p.length !== params.length) return false;
    for (const x of p) if (!(Number.isSafeInteger(x) && x >= 0)) return false;
    return true;
  };
  // The fast count as it answers, asked once per cold call; one that throws leaves the question to Epsil.
  const quickTotal = (p: number[]): number | bigint | undefined => {
    if (quickCounter === undefined || !wellParamed(p)) return undefined;
    try {
      return quickCounter(p);
    } catch {
      return undefined;
    }
  };

  const counts = new Map<string, Count>();
  // Calls come in runs at the same params, so the last fiber is found without building a key.
  let lastParams: readonly number[] = [];
  let lastTotal: Count | undefined;
  const isLast = (p: readonly number[]): boolean => {
    if (p.length !== lastParams.length) return false;
    for (let i = 0; i < p.length; i++) if (p[i] !== lastParams[i]) return false;
    return true;
  };
  const count = (p: number[]): Count => {
    if (lastTotal !== undefined && isLast(p)) return lastTotal;
    const key = p.join(",");
    let total = counts.get(key);
    if (total === undefined) {
      const raw = quickTotal(p);
      // A fast count that is a double past 2^53, for a family that declines there: no need to run its table.
      const doubled = typeof raw === "number" && Number.isFinite(raw) && !Number.isSafeInteger(raw);
      if (declinePastDoubles === "count" && (doubled || early?.pastDoubles?.(p) === true)) return decline(p);
      const fromQuick = typeof raw === "bigint" ? raw : Number.isSafeInteger(raw) ? BigInt(raw as number) : undefined;
      const fast = (raw === Number.POSITIVE_INFINITY ? raw : fromQuick) ?? run("count", p, {});
      if (typeof fast === "bigint") total = fast;
      else if (fast === Number.POSITIVE_INFINITY) total = fast;
      else if (isInteger(fast)) total = BigInt(fast);
      else if (declinePastDoubles === "count" && wellParamed(p)) return decline(p);
      else {
        const json = interpret("count", p, {});
        total = json === "PositiveInfinity" ? Number.POSITIVE_INFINITY : (integerOf(json) ?? Number.NaN);
      }
      // A huge count is the last one's alone to keep, not the map's.
      if (typeof total !== "bigint" || total < MEMO_LIMIT) counts.set(key, total);
    }
    lastParams = [...p];
    lastTotal = total;
    return total;
  };
  /** The count, or undefined where a family that declines past 2^53 has no count to give. */
  const knownCount = (p: number[]): Count | undefined => {
    try {
      return count(p);
    } catch (error) {
      if (declinePastDoubles === "count" && error instanceof RangeError) return undefined;
      throw error;
    }
  };
  // Compiled code runs in doubles, so it answers only for a fiber a double counts exactly.
  const exact = (p: number[]): boolean => {
    const total = count(p);
    return typeof total === "bigint" && total <= MAX_SAFE;
  };

  const fits = (p: number[]): boolean => {
    const total = count(p);
    return typeof total === "bigint" && total <= FAST_LIMIT && wellParamed(p);
  };

  // A scalar read as a bigint past what a number holds exactly, which only the interpreter answers.
  const beyondDoubles = (element: unknown): boolean =>
    typeof element === "bigint" && (element > MAX_SAFE || element < -MAX_SAFE);

  const valid = (given: unknown, p: number[]): boolean => {
    if (!wellFormed(family.kind, given)) return false;
    const element = typeof given === "bigint" && !beyondDoubles(given) ? Number(given) : given;
    const settledEarly = early?.member?.(element, p);
    if (settledEarly === false) return false;
    if (settledEarly === "decline") return decline(p);
    // Membership never reads the count: the fast path answers at any params it reads as written.
    if (quick !== undefined && wellParamed(p) && !beyondDoubles(element)) {
      try {
        const answer = quick.valid(element, p);
        if (typeof answer === "boolean") return answer;
      } catch {}
    }
    const fast = beyondDoubles(element) ? undefined : run("valid", p, { _x: element });
    if (typeof fast === "boolean") return fast;
    // A compiled answer that isn't a boolean can't tell: decline rather than interpret the definition
    // (and its table) to find out. Only a compiled run that threw or never compiled reaches the interpreter.
    if (fast !== undefined) return decline(p);
    // An interpreter that fails declines, as past 2^53, rather than raising out of `Element`; so does
    // an answer that is neither True nor False, which is no reading of the element as a non-member.
    let answer: unknown;
    try {
      answer = interpret("valid", p, { _x: elementJson(element) });
    } catch {
      return decline(p);
    }
    return answer === "True" ? true : answer === "False" ? false : decline(p);
  };

  return {
    ...shape,
    ...(quickCounter === undefined ? {} : { fast: true as const }),
    count,
    valid,
    unrank: (p, r) => {
      const total = knownCount(p);
      // The definitions read a rank outside the fiber as garbage.
      if (typeof total === "bigint" && (r < 0n || r >= total))
        throw new RangeError(`${family.head}(${p.join(", ")}): rank ${r} is outside the fiber of ${total}`);
      // Past 2^53 in a family that declines there, whether its count is unknown or only a fast count's
      // bigint: a small rank is still the fast path's to answer.
      if (total === undefined || (declinePastDoubles === "count" && typeof total === "bigint" && total > MAX_SAFE)) {
        if (quick !== undefined && wellParamed(p) && r >= 0n && r <= MAX_SAFE) {
          try {
            const element = quick.unrank(p, Number(r));
            if (element !== undefined) return element;
          } catch {}
        }
        return decline(p);
      }
      // A fiber with no end (the terms of a sequence): doubles answer what they hold exactly, the
      // interpreter the terms past that.
      if (total === Number.POSITIVE_INFINITY) {
        if (r < 0n) throw new RangeError(`${family.head}(${p.join(", ")}): rank ${r} is outside the fiber`);
        if (r <= MAX_SAFE) {
          if (quick !== undefined && wellParamed(p)) {
            try {
              const element = quick.unrank(p, Number(r));
              if (element !== undefined) return element;
            } catch {}
          }
          const fast = run("unrank", p, { _r: Number(r) });
          if (wellFormed(family.kind, fast)) return fast as Element;
        }
        const json = interpret("unrank", p, { _r: bigintJson(r) });
        // A term left unevaluated (a power too large to expand) is past the interpreter: unknown, not a bad definition.
        return termOf(json) ?? (unexpanded(json) ? decline(p) : fail("unrank", p, json));
      }
      if (typeof total === "bigint" && total <= MAX_SAFE) {
        if (quick !== undefined && r >= 0n && r < total && total <= FAST_LIMIT && wellParamed(p)) {
          try {
            const element = quick.unrank(p, Number(r));
            if (element !== undefined) return element;
          } catch {}
        }
        const fast = run("unrank", p, { _r: Number(r) });
        if (wellFormed(family.kind, fast)) return fast as Element;
      } else if (declinePastDoubles) decline(p);
      const json = interpret("unrank", p, { _r: bigintJson(r) });
      return elementOf(json) ?? fail("unrank", p, json);
    },
    rank: (given, p) => {
      if (!valid(given, p)) return -1n;
      const element = typeof given === "bigint" && !beyondDoubles(given) ? Number(given) : given;
      const known = knownCount(p);
      // A member of a one-member fiber is that fiber's only place, whatever the size.
      if (known === 1n) return 0n;
      // A fiber with no end: as in unrank, doubles where the element is one, else the interpreter.
      if (known === Number.POSITIVE_INFINITY) {
        if (!beyondDoubles(element)) {
          if (quick !== undefined && wellParamed(p)) {
            try {
              const place = quick.rank(element, p);
              if (isInteger(place)) return BigInt(place);
            } catch {}
          }
          const fast = run("rank", p, { _x: element });
          if (isInteger(fast)) return BigInt(fast);
        }
        const json = interpret("rank", p, { _x: elementJson(element) });
        return integerOf(json) ?? (beyondDoubles(element) || unexpanded(json) ? decline(p) : fail("rank", p, json));
      }
      if (known === undefined || (declinePastDoubles === "count" && typeof known === "bigint" && known > MAX_SAFE)) {
        // Past 2^53, as above: the fast rank answers where a double holds it.
        if (quick !== undefined && wellParamed(p)) {
          try {
            const place = quick.rank(element, p);
            if (isInteger(place)) return BigInt(place);
          } catch {}
        }
        return decline(p);
      }
      if (exact(p)) {
        if (quick !== undefined && fits(p)) {
          try {
            const place = quick.rank(element, p);
            if (isInteger(place)) return BigInt(place);
          } catch {}
        }
        const fast = run("rank", p, { _x: element });
        if (isInteger(fast)) return BigInt(fast);
      } else if (declinePastDoubles) decline(p);
      const json = interpret("rank", p, { _x: elementJson(element) });
      return integerOf(json) ?? fail("rank", p, json);
    },
  };
}

/** The family's kernel on `ce` running its Epsil definitions alone, ignoring any `fast` path. */
export const epsilKernelOn = (ce: ComputeEngine, family: AnyFamily): FamilyKernel =>
  kernelOn(ce, family, COMPILED_FAMILIES, { fast: false });

/** Every family's kernel on `ce`. */
export const kernelsOn = (ce: ComputeEngine, families: readonly AnyFamily[]): FamilyKernel[] =>
  families.map((family) => kernelOn(ce, family));
