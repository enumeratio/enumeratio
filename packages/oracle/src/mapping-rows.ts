// A mapping row's shape, and the rows a head's `origin: mapped` bindings make. Apart from
// mappings.ts so the build that writes `mappings-data.ts` can read them without it.

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
