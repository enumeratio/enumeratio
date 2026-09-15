// Where a symbol name points, by the kind of reference it is. One table so every cross
// reference on the site is written the same way and resolved in one place -- our own
// reference pages, and the outside sources a head is worth comparing against.
//
// The default kind is `notatio`: an internal link to /reference/symbol/<Name>, which is the
// only kind that also carries a tooltip (the entry knows its own signature and summary).

import { type CrosswalkSystem, SOURCES } from "@enumeratio/reference";

export type SymbolKind = "notatio" | CrosswalkSystem;

export interface SymbolSource {
  /** What to call this source in a tooltip or an aria-label. */
  readonly label: string;
  /** Build the target from the slug (the `to` override, or the link text), when the system has a URL scheme. */
  readonly href?: (slug: string) => string;
  /** Internal links stay in the tab; a reference on someone else's site opens beside it. */
  readonly external: boolean;
}

// The outside systems are the crosswalk's (`@enumeratio/reference`), so a `<Symbol type>`
// in prose and a chip on a reference page name the same places the same way.
export const SYMBOL_SOURCES: Readonly<Record<SymbolKind, SymbolSource>> = {
  notatio: {
    label: "notatio symbol reference",
    href: (slug) => `/reference/symbol/${slug}`,
    external: false,
  },
  ...(Object.fromEntries(
    Object.entries(SOURCES).map(([system, source]) => [
      system,
      { label: source.label, ...(source.href ? { href: source.href } : {}), external: true },
    ]),
  ) as Record<CrosswalkSystem, SymbolSource>),
};

/**
 * Inline code spans that must never auto-link, even when a head of that name exists: the
 * word is ordinary English far more often than it is the head, and a linked `Sign` in the
 * middle of a sentence about signs is noise. Writing `<Symbol>Sign</Symbol>` still works.
 */
export const NEVER_AUTOLINK: ReadonlySet<string> = new Set([
  "Count",
  "Sum",
  "Max",
  "Min",
  "Sign",
  "Order",
  "Depth",
  "Height",
  "Range",
  "List",
  "Set",
  "Map",
  "Filter",
  "Length",
  "Add",
  "Divide",
  "Power",
  "Round",
  "Abs",
  "Blocks",
  "Runs",
  "Corners",
  "Area",
  "Perimeter",
]);
