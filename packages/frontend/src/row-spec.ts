// What a `RowSource(collection, Columns -> …, Filter -> …)` asks for, and how it is written as the
// held expression a `TableViewBox` carries. Engine-free, so a page that only draws the table can
// build it; the engine's half, which answers rows, is `./row-source.ts`.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";

type Json = MathJsonExpression;

export interface RowSourceSpec {
  /** The collection as MathJSON, or Epsil text (a string literal) for the kernel to read. */
  readonly collection: Json;
  /** Statistic columns: a head (`Descents`) or an expression over the row `_`. */
  readonly columns: readonly string[];
  /** A predicate over `_`. */
  readonly filter?: string;
  /** The column (as written) the rows are ordered by. */
  readonly sort?: string;
  readonly descending?: boolean;
  /** The carrier the rows inhabit, when the collection's own is not the one wanted. */
  readonly carrier?: string;
  /** A glyph column: `permutation`, `partition`, `dyck`, … */
  readonly glyph?: string;
  /** Ground-set size for the `subset` glyph. */
  readonly n?: number;
  /** Source rows a filter or sort scan covers before it stalls and offers to go on. */
  readonly scanBudget?: number;
}

const str = (value: string): Json => ({ str: value }) as unknown as Json;
const rule = (name: string, value: Json): Json => ["KeyValuePair", name, value] as unknown as Json;

/** The `RowSource` expression for `spec`, which a `TableViewBox` holds. */
export function rowSourceExpression(spec: RowSourceSpec): Json {
  const options: Json[] = [];
  if (spec.columns.length > 0) options.push(rule("Columns", ["List", ...spec.columns.map(str)] as unknown as Json));
  if (spec.filter) options.push(rule("Filter", str(spec.filter)));
  if (spec.sort) options.push(rule("SortBy", str(spec.sort)));
  if (spec.descending) options.push(rule("Descending", "True" as Json));
  if (spec.carrier) options.push(rule("Carrier", str(spec.carrier)));
  if (spec.glyph) options.push(rule("Glyph", str(spec.glyph)));
  if (spec.n) options.push(rule("GroundSetSize", spec.n as Json));
  if (spec.scanBudget) options.push(rule("ScanBudget", spec.scanBudget as Json));
  return ["RowSource", spec.collection, ...options] as unknown as Json;
}

/** A collection written as Epsil text, for the kernel that reads it. */
export const collectionText = (epsil: string): Json => str(epsil);
