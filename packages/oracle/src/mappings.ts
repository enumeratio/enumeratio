// Head → external-system source, discriminated by SIGNATURE rather than by name.
//
// A name map is not enough, and `Zeta` is the reason. compute-engine's one-argument `Zeta`
// is Riemann's; its two-argument form is Hurwitz's. SymPy spells both `zeta` with an
// optional second argument; mpmath likewise; Sage has a separate `hurwitz_zeta` and its
// plain `zeta` takes one argument only. So "what does `Zeta` mean over there" has no
// answer — "what does `Zeta` of two arguments mean over there" does. Arity is the coarsest
// useful discriminator and the one used here; `when` is available for the cases where arity
// is not enough (a real versus complex branch, say).
//
// Templates substitute `$1`, `$2`, … with the emitted operands. A system absent from `emit`
// is UNMAPPED, which a scan reports as its own outcome — not as a disagreement, and not as
// evidence the function is missing. Growing this table is the iteration: the scan says which
// head is costing the most coverage, you add a row, you rescan.

import { MAPPINGS_DATA } from "./mappings-data.ts";
import type { System } from "./systems.ts";

export interface Mapping {
  readonly head: string;
  /** Operand count this row applies to. Omitted matches any arity. */
  readonly arity?: number;
  /** Source template per system, `$n` for the n-th operand. */
  readonly emit: Partial<Record<System, string>>;
  /**
   * 1-based operand this head threads over (Wolfram's Listable), for the Python-family
   * systems (sympy, mpmath, sage) whose plain function call does not auto-thread a Python
   * list the way compute-engine and Wolfram do. When that operand's raw expression is a
   * `List` — arbitrarily nested — emit rebuilds the same nesting as Python list literals,
   * applying the template to each leaf, instead of handing the whole list to the scalar
   * function (which fails: e.g. sympy's `primepi([10, 2])` raises `AttributeError`).
   */
  readonly threadArg?: number;
  /** A convention difference worth remembering when a scan disagrees. */
  readonly note?: string;
}

/** Systems whose function calls need `threadArg`'s help: the Python family, and Julia/Nemo —
 * our emit templates are plain calls (`binomial(ZZ($1), ZZ($2))`), not `f.($1)` broadcasts, so
 * a raw Julia `Vector` hits the same "no method" wall a bare Python list does. Only Wolfram's
 * own heads are Listable without this. */
export const THREADS_MANUALLY: readonly System[] = ["sympy", "mpmath", "sage", "julia"];

/** Head → external-system source, generated from every head's `origin: mapped` `bindings:`
 * rows (https://github.com/enumeratio/enumeratio/wiki/Speculative-Symbol-Metadata step 5;
 * `packages/reference/scripts/collect-mappings.ts`, pinned current by
 * `mappings-migration.test.ts`). */
export const MAPPINGS: readonly Mapping[] = MAPPINGS_DATA;

/**
 * The mapping that applies to a head at a given arity, preferring the arity-specific one; `extra`
 * (a library's own, `mappingsFromBindings`) before the system's.
 */
export function mappingFor(head: string, arity: number, extra: readonly Mapping[] = []): Mapping | undefined {
  for (const table of [extra, MAPPINGS]) {
    const rows = table.filter((mapping) => mapping.head === head);
    const found = rows.find((mapping) => mapping.arity === arity) ?? rows.find((m) => m.arity === undefined);
    if (found !== undefined) return found;
  }
  return undefined;
}

/** A binding row of a head's record, as far as a mapping reads it. */
interface MappedBinding {
  readonly origin: string;
  readonly form: string;
  readonly arity?: number;
  readonly template?: string;
  readonly threadArg?: number;
  readonly note?: string;
}

/**
 * The mappings each head's `origin: mapped` bindings make, one row per head and arity, sorted. A
 * binding with no `template` is prose about a system, not a row. `name` is the head as an
 * expression calls it: a library's `ns.Name`.
 */
export function mappingsFromBindings(
  entries: readonly { readonly name: string; readonly bindings?: readonly MappedBinding[] }[],
): Mapping[] {
  const byKey = new Map<
    string,
    { head: string; arity?: number; emit: Record<string, string>; threadArg?: number; note?: string }
  >();
  for (const entry of entries)
    for (const b of entry.bindings ?? []) {
      if (b.origin !== "mapped" || b.template === undefined) continue;
      const key = `${entry.name}\0${b.arity ?? ""}`;
      const row = byKey.get(key) ?? { head: entry.name, arity: b.arity, emit: {} };
      row.emit[b.form] = b.template;
      if (b.threadArg !== undefined) row.threadArg = b.threadArg;
      if (b.note !== undefined) row.note = b.note;
      byKey.set(key, row);
    }
  return [...byKey.values()].toSorted(
    (a, b) => a.head.localeCompare(b.head) || (a.arity ?? -1) - (b.arity ?? -1),
  ) as Mapping[];
}

/** Every head this table says anything about. */
export const mappedHeads = (): string[] => [...new Set(MAPPINGS.map((m) => m.head))].toSorted();
