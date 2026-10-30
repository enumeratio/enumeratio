// The collection explorer a head's record implies: which expression to enumerate and how large,
// which glyph draws an element, which statistics head the columns. Pure: the record and a small
// catalog view in, a spec out, so the page, the element and a test all derive the same thing.
// A record's hand-written `enumerate:` wins field by field; what it leaves out is derived.

import { splitColumns } from "./collection-table.ts";
import { GLYPH_KINDS } from "./glyphs.ts";
import { MAP_MAX_SIZE } from "./map-explorer.ts";
import { DEFAULT_COLUMNS, templateOfExpr } from "./table-state.ts";

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
  /** Whether a statistic takes more than one value over the derived collection (a constant column says nothing). */
  varies?(expr: string, statistic: string): boolean | Promise<boolean>;
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
export { DEFAULT_COLUMNS };
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
      if ((await catalog.usable?.(expr, c.name)) !== false && (await catalog.varies?.(expr, c.name)) !== false)
        columns.push(c.name);
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

/** Where a statistic's distribution is tallied: a carrier's sized collection, as a call over `{size}`. */
export interface DistributionSource {
  readonly collection: string;
  /** `Head({size})`: the collection's call with the size slot open. */
  readonly template: string;
  /** The largest size offered, from the record (else the explorer's default). */
  readonly maxSize: number;
}

/** What the map explorer reads of a map: its carriers, and the collection it is declared graded onto. */
export interface MapField {
  readonly name: string;
  readonly carrier: string;
  readonly to?: string;
  readonly frontier?: boolean;
  readonly graded?: { readonly to: string; readonly sizeOffset: number };
}

/** Where a map is explored: the source carrier's sized collection, and what the images are drawn as. */
export interface MapExplorer {
  readonly name: string;
  /** The source carrier's collection, as `Head({size})`. */
  readonly template: string;
  /** Largest size offered: the carrier's `maxSize`, held to what a browser maps. */
  readonly maxSize: number;
  /** The size the table opens at. */
  readonly start: number;
  readonly sourceGlyph?: string;
  readonly targetGlyph?: string;
  /** The target's collection as `Head({size})` and its size relative to the source's, when the map is graded. */
  readonly target?: { readonly template: string; readonly sizeOffset: number };
  /** Source and target are one carrier at one size, so the map can be applied again. */
  readonly selfMap: boolean;
}

/** The explorer a map's page offers, or `undefined` for a frontier map or a carrier with no sized collection. */
export async function mapExplorerOf(
  field: MapField,
  records: readonly CollectionRecord[],
  catalog: ExplorerCatalog,
): Promise<MapExplorer | undefined> {
  if (field.frontier) return undefined;
  const source = await distributionSourceOf(field.carrier, records, catalog);
  if (source === undefined) return undefined;
  const glyphOf = (carrier: string | undefined): string | undefined => {
    const kind = carrier === undefined ? undefined : catalog.glyphOf(carrier);
    return kind !== undefined && GLYPH_KINDS.has(kind) ? kind : undefined;
  };
  const sourceGlyph = glyphOf(field.carrier);
  const targetGlyph = glyphOf(field.to);
  const maxSize = Math.min(source.maxSize, MAP_MAX_SIZE);
  return {
    name: field.name,
    template: source.template,
    maxSize,
    start: Math.min(START_SIZE, maxSize),
    ...(sourceGlyph !== undefined && { sourceGlyph }),
    ...(targetGlyph !== undefined && { targetGlyph }),
    ...(field.graded !== undefined && {
      target: { template: `${field.graded.to}({size})`, sizeOffset: field.graded.sizeOffset },
    }),
    // A map that changes size lands outside the collection it was applied to: no second application there.
    selfMap: field.to === field.carrier && (field.graded?.sizeOffset ?? 0) === 0,
  };
}

/** Carriers whose collection is not a record named for the carrier (`Permutations` is a type-space plural, not a head; `Tableaux` is not `Tableaus`). */
const CARRIER_COLLECTIONS: Readonly<Record<string, string>> = {
  Permutation: "SymmetricGroup",
  StandardTableau: "StandardTableaux",
};

/**
 * The collection a carrier's distributions are tallied over: the whole carrier at size `n`, as
 * one open size slot. A record named for the carrier's plural (`DyckPaths`, `IntegerCompositions`)
 * wins; else the shortest sized collection on it. `undefined` when the carrier has none (the
 * number sequences). The size is spelled as the explorer spells it, so a page, the element and a
 * test agree.
 */
export async function distributionSourceOf(
  carrier: string,
  records: readonly CollectionRecord[],
  catalog: ExplorerCatalog,
): Promise<DistributionSource | undefined> {
  const forced = CARRIER_COLLECTIONS[carrier];
  const plural = `${carrier}s`;
  const rank = (name: string): number =>
    name === forced ? 0 : name === plural ? 1 : name === `Integer${plural}` ? 2 : 3;
  const candidates = records
    .filter((r) => r.name === forced || (r.carrier === carrier && r.grades !== undefined))
    .toSorted((a, b) => rank(a.name) - rank(b.name) || a.name.length - b.name.length || (a.name < b.name ? -1 : 1));
  for (const record of candidates) {
    const spec = await explorerOf(record, catalog);
    const derived = spec?.template ?? (spec === undefined ? undefined : templateOfExpr(spec.expr));
    const isForced = record.name === forced;
    const template = isForced ? `${record.name}({size})` : derived;
    // One size slot and nothing else: a distribution over sizes has no other parameter to pick.
    if (template === undefined || (!isForced && template.includes(","))) continue;
    return {
      collection: record.name,
      template,
      maxSize: record.maxSize ?? spec?.size?.max ?? DEFAULT_MAX_SIZE,
    };
  }
  return undefined;
}
