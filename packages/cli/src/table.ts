// A `CollectionTable` (or any `TableViewBox`) at the terminal, over the row source the engine
// holds for it (https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Grid, §3). Where
// nothing takes keys it is the pinned first page as a ruled grid with a `Skeleton` line for the
// rest; the interactive pager is `pager.ts`.

import type { ComputeEngine } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { type Box, grid, isNode, type RowSource, tag, text } from "@enumeratio/boxes";
import { toText } from "@enumeratio/boxes/render";
import { optionsOf } from "@enumeratio/formats";
import { headOf, numOf, opsOf, rowSourceSpec, splitColumns, strOf, symOf } from "@enumeratio/frontend";
import { type CollectionRows, openRowSource, staticTable } from "@enumeratio/frontend/row-source";
import { drawBoxes } from "./cell-layout.ts";

type Json = MathJsonExpression;
type Spec = NonNullable<ReturnType<typeof rowSourceSpec>>;

/** A table opened for the terminal: its rows, and the page a static environment pinned. */
export interface Table {
  readonly source: CollectionRows;
  readonly scrollPosition?: number;
  readonly maxItems?: number;
}

/** Whether a result is a table: a `CollectionTable`, or a `TableViewBox` holding a `RowSource`. */
export const isTable = (json: Json): boolean => {
  const head = headOf(json);
  return head === "CollectionTable" || head === "TableViewBox";
};

/** The spec a table expression asks for, as the element reads its attributes. */
function specOf(json: Json): Spec | undefined {
  if (headOf(json) === "TableViewBox") {
    const held = opsOf(json)[0];
    return held === undefined ? undefined : rowSourceSpec(held);
  }
  const { ops, options } = optionsOf(json as never);
  if (ops[0] === undefined) return undefined;
  const word = (name: string): string => (options[name] === undefined ? "" : (strOf(options[name]) ?? "")).trim();
  const columns = options.Columns;
  const listed = columns !== undefined && headOf(columns) === "List" ? opsOf(columns).map((c) => strOf(c) ?? "") : [];
  return {
    collection: ops[0],
    columns: listed.length > 0 ? listed.filter(Boolean) : splitColumns(word("Columns")),
    ...(word("Filter") && { filter: word("Filter") }),
    ...(word("Sort") && { sort: word("Sort") }),
    ...(symOf(options.Descending) === "True" && { descending: true }),
    ...(word("Carrier") && { carrier: word("Carrier") }),
    ...(word("Glyph") && { glyph: word("Glyph") }),
    ...(numOf(options.N) && { n: numOf(options.N) }),
    ...(numOf(options.ScanLimit) && { scanBudget: numOf(options.ScanLimit) }),
  };
}

/** The table `json` is, opened on `ce`, or why it cannot be one. */
export function openTable(ce: ComputeEngine, json: Json): { table: Table } | { error: string } {
  const spec = specOf(json);
  if (spec === undefined) return { error: "a table needs a collection" };
  const opened = openRowSource(ce, spec);
  if (!opened.ok) return { error: opened.error };
  const { options } = optionsOf(json as never);
  const [scrollPosition, maxItems] = [numOf(options.ScrollPosition), numOf(options.MaxItems)];
  return {
    table: {
      source: opened.source,
      ...(scrollPosition !== undefined && { scrollPosition }),
      ...(maxItems !== undefined && { maxItems }),
    },
  };
}

/** Columns to skip: a glyph column is a picture, and text has the element's own. */
export const skipOf = (source: RowSource): number => (source.columns[0]?.label === "" ? 1 : 0);

/** Headings for the columns shown, index first. */
export const headersOf = (source: RowSource): string[] => [
  "#",
  ...source.columns.slice(skipOf(source)).map((c) => c.label),
];

/** The ruled grid of `rows` under `headers`, with the same rules a pinned page has. */
export function ruled(headers: readonly string[], rows: readonly (readonly Box[])[]): string {
  return drawBoxes(
    grid([headers.map((h) => tag(text(h), "ColumnHeader")), ...rows.map((r) => [...r])], { GridBoxDividers: "All" }),
  );
}

/**
 * The pinned page as text: a ruled grid of the first rows, then the `Skeleton` row's line
 * (`… 719,980 more`, or `…` for a source with no end) under it.
 */
export async function staticText(table: Table): Promise<string> {
  const page = await staticTable(table.source, {
    ...(table.scrollPosition !== undefined && { scrollPosition: table.scrollPosition }),
    ...(table.maxItems !== undefined && { maxItems: table.maxItems }),
  });
  if (!isNode(page) || page[0] !== "GridBox") return drawBoxes(page);
  const [, rows, options] = page;
  const last = rows.at(-1)?.[0];
  const skeleton =
    last !== undefined && isNode(last) && last[0] === "TagBox" && last[2] === "Skeleton" ? last : undefined;
  if (skeleton === undefined) return drawBoxes(page);
  const body = ["GridBox", rows.slice(0, -1), options ?? {}] as unknown as Box;
  return `${drawBoxes(body)}\n${toText(skeleton)}`;
}
