// A symbol's mappings (https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup §4.4): what it is
// tied to outside itself, for the targets a library says it tracks. Picked out of a head's
// record: the references other sources give it, how other systems write it, and each
// example as those systems write and answer it. What a library publishes as `mappings.json`.

import type { HeadImplementations, ReferenceBinding } from "./types.ts";
import type { Reference } from "./reference.ts";
import type { HeadRecord } from "./record.ts";

export interface SymbolMappings {
  readonly references?: readonly Reference[];
  readonly bindings?: readonly ReferenceBinding[];
  /** Each example's rows, by id, for the targets only. */
  readonly implementations?: HeadImplementations;
}

/** `record`'s mappings to `targets`: undefined when it has none. */
export function mappingsOf(record: HeadRecord, targets: readonly string[]): SymbolMappings | undefined {
  const wanted = new Set(targets);
  const references = (record.entry.references ?? []).filter((r) => wanted.has(r.system));
  const bindings = (record.entry.bindings ?? []).filter((b) => wanted.has(b.form));
  const implementations = Object.fromEntries(
    Object.entries(record.implementations ?? {}).flatMap(([id, rows]) => {
      const kept = Object.fromEntries(Object.entries(rows).filter(([system]) => wanted.has(system)));
      return Object.keys(kept).length > 0 ? [[id, kept]] : [];
    }),
  ) as HeadImplementations;
  const mappings: SymbolMappings = {
    ...(references.length > 0 ? { references } : {}),
    ...(bindings.length > 0 ? { bindings } : {}),
    ...(Object.keys(implementations).length > 0 ? { implementations } : {}),
  };
  return Object.keys(mappings).length > 0 ? mappings : undefined;
}

/** The targets `mappings` has anything for. */
export function targetsOf(mappings: SymbolMappings): string[] {
  const found = new Set<string>();
  for (const r of mappings.references ?? []) found.add(r.system);
  for (const b of mappings.bindings ?? []) found.add(b.form);
  for (const rows of Object.values(mappings.implementations ?? {}))
    for (const system of Object.keys(rows)) found.add(system);
  return [...found].toSorted();
}
