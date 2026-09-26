// The one order an implementations record is written in, whichever tool writes it: examples
// as the entry lists them, then our own forms, then the systems in the order given, each row's
// fields as `SystemImplementation` declares them. Anything unlisted follows, by code unit.

import type { ExampleImplementations, HeadImplementations } from "./types.ts";

const OWN_FORMS = ["epsil", "tex", "traditional", "fullform", "notatio"];
const FIELDS = ["in", "out", "shown", "tex", "verdict", "kind", "note", "issue", "tolerance", "messages", "back"];

/** `keys`, those in `first` in that order, then the rest by code unit (not locale). */
function ordered(keys: readonly string[], first: readonly string[]): string[] {
  const rank = (key: string): number => {
    const i = first.indexOf(key);
    return i === -1 ? first.length : i;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
}

const reorder = <T extends object>(record: T, first: readonly string[]): T =>
  Object.fromEntries(ordered(Object.keys(record), first).map((key) => [key, record[key as keyof T]])) as T;

/** `record` in canonical order, given the head's example ids and the systems' order. */
export function orderImplementations(
  record: HeadImplementations,
  exampleIds: readonly string[],
  systems: readonly string[],
): HeadImplementations {
  const keys = [...OWN_FORMS, ...systems];
  return Object.fromEntries(
    ordered(Object.keys(record), exampleIds).map((id) => {
      const rows = reorder(record[id] as ExampleImplementations, keys);
      return [id, Object.fromEntries(Object.entries(rows).map(([key, row]) => [key, reorder(row, FIELDS)]))];
    }),
  );
}
