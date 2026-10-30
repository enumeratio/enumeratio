// The collection explorer a head's record implies: which expression to enumerate and how large,
// which glyph draws an element, which statistics head the columns. Pure: the record and a small
// catalog view in, a spec out, so the page, the element and a test all derive the same thing.
// A record's hand-written `enumerate:` wins field by field; what it leaves out is derived.

import { splitColumns } from "./collection-table.ts";
import { GLYPH_KINDS } from "./glyphs.ts";

/** What of a collection's record the explorer reads. */
export interface CollectionRecord {
  readonly name: string;
  readonly signature?: string;
  readonly signatures?: readonly { readonly type?: string }[];
  readonly carrier?: string;
  readonly grades?: readonly { readonly name: string; readonly role: "axis" | "param" }[];
  readonly unbounded?: boolean;
  readonly maxSize?: number;
  readonly enumerate?: {
    readonly expr: string;
    readonly columns?: string;
    readonly glyph?: string;
    readonly pageSize?: number;
  };
}

/** A statistic defined on a carrier. */
export interface Candidate {
  readonly name: string;
  readonly summary?: string;
}

/** What the explorer asks of the catalog; the page and the tests each answer from the records. */
export interface ExplorerCatalog {
  /** The glyph kind a carrier's record names, if it does. */
  glyphOf(carrier: string): string | undefined;
  /** The statistics defined on a carrier, in the order to offer them. */
  statisticsOn(carrier: string): readonly Candidate[];
  /** Whether a derived expression is a collection that opens; a build or a test can probe it (`explorer-engine.ts`). */
  opens?(expr: string): boolean | Promise<boolean>;
  /** Whether a statistic evaluates on a row of the derived collection; probed likewise. */
  usable?(expr: string, statistic: string): boolean | Promise<boolean>;
}

export interface ExplorerSize {
  /** The grade axis the control moves: the first of the record's. */
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly start: number;
}

export interface ExplorerSpec {
  /** The expression the table enumerates: the record's own, else the derived one at `size.start`. */
  readonly expr: string;
  /** The derived expression with the size as `{size}`; absent when `expr` is the record's. */
  readonly template?: string;
  readonly size?: ExplorerSize;
  readonly glyph?: string;
  readonly columns: readonly string[];
  readonly pageSize: number;
  /** Every statistic on the carrier, for a picker. */
  readonly candidates: readonly Candidate[];
  /** True when the record had no `enumerate:` and the table is entirely derived. */
  readonly derived: boolean;
}

/** The size a table opens at: small enough to draw at once. */
export const START_SIZE = 4;
/** The largest size offered when a record states no `maxSize`: an interim until records say. */
export const DEFAULT_MAX_SIZE = 6;
/** Columns a derived table opens with. */
export const DEFAULT_COLUMNS = 4;
/** The value a grade past the first (or a parameter) opens at. */
const SECONDARY = 2;
/** Elements of an unbounded collection a derived table takes. */
const UNBOUNDED_TAKE = 20;

/** The call a record's grades imply, over the size slot `{size}`; `undefined` when it cannot be told. */
function templateOf(record: CollectionRecord): string | undefined {
  const grades = record.grades;
  // A record that only catalogues a family -- no typed call returning a collection -- has nothing to enumerate.
  if (grades === undefined || !record.signatures?.some((s) => s.type?.includes("collection"))) return undefined;
  if (grades.length === 0) return record.unbounded ? `Take(${record.name}, ${UNBOUNDED_TAKE})` : undefined;
  // A signature that spells its parameters must spell as many as there are grades, as names.
  const spelled = /^[A-Za-z0-9]+\((.*)\)$/s.exec(record.signature ?? "")?.[1];
  if (spelled !== undefined && spelled !== "..." && !/^\s*$/.test(spelled)) {
    const params = spelled.split(",").map((p) => p.trim());
    if (params.length !== grades.length || !params.every((p) => /^[A-Za-z_]\w*$/.test(p))) return undefined;
  } else if (record.signature !== undefined && !/^[A-Za-z0-9]+(\(\.\.\.\))?$/.test(record.signature)) {
    return undefined;
  }
  const slot = grades.findIndex((g) => g.role === "axis");
  if (slot < 0) return undefined;
  const args = grades.map((_, i) => (i === slot ? "{size}" : String(SECONDARY)));
  return `${record.name}(${args.join(", ")})`;
}

function sizeOf(record: CollectionRecord): ExplorerSize | undefined {
  const axis = record.grades?.find((g) => g.role === "axis");
  if (axis === undefined) return undefined;
  const max = record.maxSize ?? DEFAULT_MAX_SIZE;
  return { name: axis.name, min: 1, max, start: Math.min(START_SIZE, max) };
}

/** The explorer a collection's record implies, or `undefined` when it is not a collection or none can be derived. */
export async function explorerOf(
  record: CollectionRecord,
  catalog: ExplorerCatalog,
): Promise<ExplorerSpec | undefined> {
  const explicit = record.enumerate;
  const template = templateOf(record);
  const size = template?.includes("{size}") ? sizeOf(record) : undefined;
  let expr = explicit?.expr;
  if (expr === undefined) {
    if (template === undefined) return undefined;
    expr = size === undefined ? template : template.replace("{size}", String(size.start));
    if ((await catalog.opens?.(expr)) === false) return undefined;
  }

  const candidates = record.carrier === undefined ? [] : catalog.statisticsOn(record.carrier);
  const columns = explicit?.columns !== undefined ? splitColumns(explicit.columns) : [];
  if (explicit?.columns === undefined)
    for (const c of candidates) {
      if (columns.length === DEFAULT_COLUMNS) break;
      if ((await catalog.usable?.(expr, c.name)) !== false) columns.push(c.name);
    }

  const derivedGlyph = record.carrier === undefined ? undefined : catalog.glyphOf(record.carrier);
  const glyph =
    explicit?.glyph ?? (derivedGlyph !== undefined && GLYPH_KINDS.has(derivedGlyph) ? derivedGlyph : undefined);

  return {
    expr,
    ...(explicit?.expr === undefined && template !== undefined && size !== undefined && { template }),
    ...(explicit?.expr === undefined && size !== undefined && { size }),
    ...(glyph !== undefined && { glyph }),
    columns,
    pageSize: explicit?.pageSize ?? 10,
    candidates,
    derived: explicit === undefined,
  };
}

/**
 * The catalog the records themselves say: carriers' `glyph`, statistics' `statOn`. A carrier's
 * statistics come most-used first -- by how many collections on it already head a column with
 * one -- then by name in code-unit order: the hand-written columns stand in for a "featured" flag.
 */
export function catalogOf(
  records: readonly {
    readonly name: string;
    readonly summary?: string;
    readonly glyph?: string;
    readonly carrier?: string;
    readonly catalogCarrier?: true;
    readonly statOn?: readonly string[];
    readonly enumerate?: { readonly columns?: string };
  }[],
): ExplorerCatalog {
  const used = new Map<string, number>();
  for (const r of records)
    for (const column of r.carrier === undefined ? [] : splitColumns(r.enumerate?.columns ?? ""))
      used.set(`${r.carrier}\0${column}`, (used.get(`${r.carrier}\0${column}`) ?? 0) + 1);
  const glyphs = new Map(records.filter((r) => r.catalogCarrier && r.glyph).map((r) => [r.name, r.glyph!]));
  const statistics = new Map<string, Candidate[]>();
  for (const r of records.toSorted((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)))
    for (const carrier of r.statOn ?? []) {
      const list = statistics.get(carrier) ?? [];
      list.push({ name: r.name, ...(r.summary && { summary: r.summary }) });
      statistics.set(carrier, list);
    }
  for (const [carrier, list] of statistics)
    list.sort((a, b) => (used.get(`${carrier}\0${b.name}`) ?? 0) - (used.get(`${carrier}\0${a.name}`) ?? 0));
  return { glyphOf: (carrier) => glyphs.get(carrier), statisticsOn: (carrier) => statistics.get(carrier) ?? [] };
}
