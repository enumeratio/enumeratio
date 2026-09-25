// The rules an `implementations` block has to satisfy, as a function rather than a test, so
// that every package holding reference entries can enforce them over its OWN entries — the
// entries live in the package that owns the heads, and the rule has to travel to them.

import type { ReferenceEntry, ReferenceImplementation } from "./types.ts";

/** Does this path exist? Supplied by the caller so this module stays free of node:fs. */
export type Exists = (path: string) => boolean;

export interface Problem {
  readonly entry: string;
  readonly message: string;
}

const rows = (entry: ReferenceEntry): readonly ReferenceImplementation[] => entry.implementations ?? [];

/**
 * Check every entry's implementation rows. Returns the problems; an empty array is a pass.
 *
 * `exists` is optional: omit it to skip the source-pointer check (for a caller with no
 * filesystem, such as the browser).
 */
export function checkImplementations(entries: readonly ReferenceEntry[], exists?: Exists): Problem[] {
  const problems: Problem[] = [];
  const fail = (entry: string, message: string): void => void problems.push({ entry, message });

  for (const entry of entries) {
    const implementations = rows(entry);
    if (implementations.length === 0) continue;

    // Nothing is silently irreducible — design/namespaces.md §6.1.
    const reduces = implementations.some((r) => r.origin === "reference");
    if (!reduces && entry.primitive === undefined)
      fail(entry.name, "has implementations but neither a reference row nor a `primitive` reason");

    for (const row of implementations) {
      if (row.origin === "reference" && row.expr === undefined)
        fail(entry.name, "a reference row must carry the defining expression");
      if (row.origin !== "reference" && row.expr !== undefined)
        fail(entry.name, `a ${row.origin} row must not carry an expression`);

      // A component's meaning IS the rendered element, so it has to say where and what.
      if (row.origin === "component") {
        if (row.environment !== "browser") fail(entry.name, "a component row runs in the browser");
        if (row.produces === undefined) fail(entry.name, "a component row must say what it produces");
      }

      // A pointer only helps if it points somewhere; a copy of the source would rot.
      if (exists && row.source !== undefined && !row.source.startsWith("<")) {
        const [path] = row.source.split(":");
        if (path !== undefined && !exists(path)) fail(entry.name, `missing source: ${row.source}`);
      }
    }
  }
  return problems;
}
