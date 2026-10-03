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

export interface EpsilFamily extends FamilyShape {
  /** The names the definitions give the family's params, in order. */
  readonly params: readonly string[];
  /** The compiler's type for an element, where the kind's own is too loose: a fixed-length
   *  element read by position is a tuple, since `At` on a `list<list<integer>>` may be missing. */
  readonly elementType?: string;
  /** Past 2^53, where compiled code can't answer, unrank and rank decline (unknown) rather
   *  than interpret: for definitions the interpreter takes minutes over at that size. The count
   *  stays exact. */
  readonly declinePastDoubles?: true;
  readonly epsil: FamilyEpsil;
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

/** Whether `value` is a plain-JS element of this shape, every entry an exact integer. */
function wellFormed(kind: FamilyShape["kind"], value: unknown): boolean {
  switch (kind) {
    case "scalar":
      return isInteger(value);
    case "ints":
      return Array.isArray(value) && value.every(isInteger);
    case "blocks":
      return Array.isArray(value) && value.every((block) => Array.isArray(block) && block.every(isInteger));
    default:
      return isInteger(value) || (Array.isArray(value) && value.every((node) => wellFormed("nested", node)));
  }
}

export const elementJson = (value: unknown): unknown =>
  Array.isArray(value) ? ["List", ...value.map(elementJson)] : value;

const bigintJson = (value: bigint): unknown =>
  value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : { num: value.toString() };

/** An interpreted integer result, exactly; undefined for anything else. */
export function integerOf(json: unknown): bigint | undefined {
  if (isInteger(json)) return BigInt(json);
  // compute-engine writes a big integer as digits and an exponent: {num: "15511210043330985984e+6"}.
  const num = typeof json === "object" && json !== null ? (json as { num?: unknown }).num : undefined;
  const match = typeof num === "string" ? /^(-?\d+)(?:e\+?(\d+))?$/.exec(num) : null;
  return match === null ? undefined : BigInt(match[1]) * 10n ** BigInt(match[2] ?? 0);
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
  const { params, epsil, elementType: _, declinePastDoubles, ...shape } = family;
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
    } catch {
      return undefined;
    }
  };
  const interpret = (operation: Operation, p: number[], extra: Record<string, unknown>): unknown =>
    evaluateEpsil(ce, epsil[operation], {
      ...bind(p),
      ...extra,
      ...(reads(operation) ? { _tables: exactTables(p) } : {}),
    });

  // A table depends on the params alone, so it is computed once per params and read by every
  // call. Compiled code reads it as doubles, the interpreter as compute-engine's exact integers
  // (a JSON list), each in its own cache.
  const tablesSize = options.tablesCacheSize ?? TABLES_CACHE_SIZE;
  const doubleCache = new Lru<readonly number[] | null>(tablesSize);
  const exactCache = new Lru<unknown>(tablesSize);
  function exactTables(p: number[]): unknown {
    const key = p.join(",");
    let table = exactCache.get(key);
    if (table === undefined) {
      options.onTables?.(p, "exact");
      table = evaluateEpsil(ce, epsil.tables, bind(p));
      exactCache.set(key, table);
    }
    return table;
  }
  /** The table as doubles; undefined when compiled code can't produce it. */
  const doubleTables = (p: number[]): readonly number[] | undefined => {
    const key = p.join(",");
    let table = doubleCache.get(key);
    if (table === undefined) {
      options.onTables?.(p, "double");
      const value = attempt("tables", bind(p));
      table = Array.isArray(value) && value.every(Number.isInteger) ? (value as number[]) : null;
      doubleCache.set(key, table);
    }
    return table ?? undefined;
  };

  const run = (operation: Operation, p: number[], extra: Record<string, unknown>): unknown => {
    const vars = { ...bind(p), ...extra };
    if (!reads(operation)) return attempt(operation, vars);
    const table = doubleTables(p);
    return table === undefined ? undefined : attempt(operation, { ...vars, _tables: table });
  };
  // The message `needsBigint` recognises: the handlers answer unknown.
  const decline = (p: number[]): never => {
    throw new RangeError(`${family.head}(${p.join(", ")}): past 2^53, not bigint yet`);
  };
  const fail = (operation: Operation, p: number[], json: unknown): never => {
    throw new Error(`${family.head}(${p.join(", ")}): its ${operation} definition gave ${JSON.stringify(json)}`);
  };

  const counts = new Map<string, Count>();
  const count = (p: number[]): Count => {
    const key = p.join(",");
    let total = counts.get(key);
    if (total === undefined) {
      const fast = run("count", p, {});
      if (isInteger(fast)) total = BigInt(fast);
      else {
        const json = interpret("count", p, {});
        total = json === "PositiveInfinity" ? Number.POSITIVE_INFINITY : (integerOf(json) ?? Number.NaN);
      }
      counts.set(key, total);
    }
    return total;
  };
  // Compiled code runs in doubles, so it answers only for a fiber a double counts exactly.
  const exact = (p: number[]): boolean => {
    const total = count(p);
    return typeof total === "bigint" && total <= BigInt(Number.MAX_SAFE_INTEGER);
  };

  const valid = (element: unknown, p: number[]): boolean => {
    if (!wellFormed(family.kind, element)) return false;
    const fast = run("valid", p, { _x: element });
    if (typeof fast === "boolean") return fast;
    return interpret("valid", p, { _x: elementJson(element) }) === "True";
  };

  return {
    ...shape,
    count,
    valid,
    unrank: (p, r) => {
      if (exact(p)) {
        const fast = run("unrank", p, { _r: Number(r) });
        if (wellFormed(family.kind, fast)) return fast as Element;
      } else if (declinePastDoubles) decline(p);
      const json = interpret("unrank", p, { _r: bigintJson(r) });
      return elementOf(json) ?? fail("unrank", p, json);
    },
    rank: (element, p) => {
      if (!valid(element, p)) return -1n;
      if (exact(p)) {
        const fast = run("rank", p, { _x: element });
        if (isInteger(fast)) return BigInt(fast);
      } else if (declinePastDoubles) decline(p);
      const json = interpret("rank", p, { _x: elementJson(element) });
      return integerOf(json) ?? fail("rank", p, json);
    },
  };
}

/** Every family's kernel on `ce`. */
export const kernelsOn = (ce: ComputeEngine, families: readonly AnyFamily[]): FamilyKernel[] =>
  families.map((family) => kernelOn(ce, family));
