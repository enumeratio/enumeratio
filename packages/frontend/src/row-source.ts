// The engine's half of a `TableViewBox` (https://github.com/enumeratio/enumeratio/wiki/Speculative-Lazy-Grid, §2): a
// `RowSource` over an ordered collection, answering rows by range. A kernel holds one per
// registered handle; the page's own engine holds one where there is no kernel. The column,
// carrier and filter logic is the collection table's, moved to the side that has the engine.
//
// Rows are numbered by the index `At(collection, #)` reproduces, as bigints. A collection with
// `At` answers any range directly; one without it is walked, with a window of the walk kept. A
// filter or a sort scans in slices that yield and honor an abort, and say how far they have got.

import type { BoxedExpression, BoxedType, ComputeEngine } from "@cortex-js/compute-engine";
import { type MathJsonExpression, serializeEpsil } from "@cortex-js/compute-engine/epsil";
import {
  type Box,
  type ColumnSpec,
  type IndexRange,
  pinnedPage,
  type RowBatch,
  type RowCount,
  type RowSource,
  tag,
  text,
} from "@enumeratio/boxes";
import { optionsOf } from "@enumeratio/formats";
import { parseExpression } from "@enumeratio/formats/expression";
import { normalizeInputForm } from "@enumeratio/formats/inputform";
import { allCarrierParams, carrierTypeForName } from "@enumeratio/structures";
import {
  blockLists,
  blocksToRgs,
  carrierBody,
  type CellValue,
  columnLabel,
  columnSource,
  compareCells,
  flatInts,
  substituteRow,
  substituteRowPerHead,
  wantsCarrier,
} from "./collection-table.ts";
import { debug } from "./debug.ts";
import { type RowSourceSpec } from "./row-spec.ts";
import { type GlyphKind, renderGlyph } from "./glyphs.ts";
import { headOf, numOf, opsOf, strOf, symOf } from "./symbols.ts";

type Json = MathJsonExpression;
type BoxInput = Parameters<ComputeEngine["box"]>[0];

const log = debug("row-source");

// --- the held head -------------------------------------------------------------------------

export { type RowSourceSpec, rowSourceExpression } from "./row-spec.ts";

/** The spec a `RowSource(…)` expression says, or `undefined` when it is not one. */
export function rowSourceSpec(expr: Json): RowSourceSpec | undefined {
  if (headOf(expr) !== "RowSource") return undefined;
  const { ops, options } = optionsOf(expr);
  if (ops[0] === undefined) return undefined;
  const text = (name: string): string | undefined => (options[name] === undefined ? undefined : strOf(options[name]));
  const number = (name: string): number | undefined => (options[name] === undefined ? undefined : numOf(options[name]));
  const columns = options.Columns === undefined ? [] : opsOf(options.Columns).map((c) => strOf(c) ?? "");
  return {
    collection: ops[0],
    columns: columns.filter(Boolean),
    ...(text("Filter") && { filter: text("Filter") }),
    ...(text("SortBy") && { sort: text("SortBy") }),
    ...(options.Descending !== undefined && symOf(options.Descending) === "True" && { descending: true }),
    ...(text("Carrier") && { carrier: text("Carrier") }),
    ...(text("Glyph") && { glyph: text("Glyph") }),
    ...(number("GroundSetSize") && { n: number("GroundSetSize") }),
    ...(number("ScanBudget") && { scanBudget: number("ScanBudget") }),
  };
}

// --- budgets -------------------------------------------------------------------------------

/** How long one slice of a scan or a walk may hold the thread before it yields. */
const SLICE_MS = 12;
/** Source rows a filter or sort scan covers before it stalls and offers to go on. */
export const SCAN_BUDGET = 20_000;
/** The walk of a source with no `At` refuses a jump this far past what it has walked. */
export const WALK_BUDGET = 2_000_000;
/** How many of the best rows a sort keeps. */
export const SORT_KEEP = 10_000;
/** Elements of a walk kept, the last ones. */
const WALK_WINDOW = 8192;
/** Memoized cells kept before the memo starts over. */
const CELL_MEMO = 50_000;
const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

const yieldNow = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function checkAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw signal.reason ?? new DOMException("The rows call was aborted.", "AbortError");
}

/** A row on one line: a long permutation must not wrap into a bracket layout. */
const oneLine = (json: Json): string =>
  serializeEpsil(normalizeInputForm(json), { margin: Number.POSITIVE_INFINITY, softMargin: Number.POSITIVE_INFINITY });

/** An exact integer from MathJSON: a number, or `{num}` digits (with the engine's `e+6` form). */
export function bigintOf(json: unknown): bigint | undefined {
  if (typeof json === "number") return Number.isInteger(json) ? BigInt(json) : undefined;
  const digits = typeof json === "object" && json !== null ? (json as { num?: unknown }).num : json;
  if (typeof digits !== "string") return undefined;
  const m = /^(-?\d+)(?:\.(\d+))?(?:[eE]\+?(-?\d+))?$/.exec(digits.replaceAll("_", ""));
  if (!m) return undefined;
  const fraction = m[2] ?? "";
  const shift = Number(m[3] ?? 0) - fraction.length;
  if (shift < 0) return undefined;
  return BigInt(`${m[1]}${fraction}`) * 10n ** BigInt(shift);
}

interface Column {
  readonly source: string;
  readonly label: string;
  readonly json: Json | undefined;
  readonly error: string;
}

/** Why a collection cannot be a row source, or the source itself. */
export type OpenedRows =
  | { readonly ok: true; readonly source: CollectionRows }
  | { readonly ok: false; readonly error: string };

/** A row source over `spec.collection` on `ce`; declines with a reason when it has no stable order. */
export function openRowSource(ce: ComputeEngine, spec: RowSourceSpec): OpenedRows {
  try {
    return { ok: true, source: new CollectionRows(ce, spec) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

const GLYPH_KINDS = new Set<GlyphKind>([
  "permutation",
  "partition",
  "tableau",
  "composition",
  "subset",
  "dyck",
  "tree",
  "binary-tree",
  "set-partition",
  "lattice",
  "diagram",
]);

export class CollectionRows implements RowSource {
  readonly random: boolean;
  readonly columns: readonly ColumnSpec[];
  readonly rowHeight = 1.9;
  readonly #ce: ComputeEngine;
  readonly #spec: RowSourceSpec;
  readonly #coll: BoxedExpression;
  /** The collection's own count: exact, infinite, or not known (a walk will find out). */
  readonly #total: RowCount;
  readonly #cols: readonly Column[];
  readonly #predicate: { json?: Json; error: string };
  #carrierName: string | undefined;
  #carrierParams = 0;
  #bareType: BoxedType | undefined;
  #carrierType: BoxedType | undefined;
  readonly #wrapCache = new Map<string, boolean>();
  readonly #cells = new Map<string, CellValue>();
  readonly #elements = new Map<bigint, BoxedExpression>();

  // The walk of a source with no `At`.
  #walker: Iterator<BoxedExpression, undefined> | undefined;
  #walked = 0n;
  #walkEnd: bigint | undefined;

  // A filter's scan: source indices that pass, and how far the source has been covered.
  #matches: bigint[] = [];
  #scanned = 0n;
  #scanDone = false;
  #scanLimit: bigint;

  // A sort's scan: the best rows so far, as source indices, in order.
  #best: { index: bigint; value: CellValue }[] = [];
  #sorted = false;
  #sortDeclined: string | undefined;

  constructor(ce: ComputeEngine, spec: RowSourceSpec) {
    this.#ce = ce;
    this.#spec = spec;
    const coll = ce.box(spec.collection as BoxInput);
    if (!coll.isCollection) throw new Error("not a collection");
    this.#coll = coll;
    this.random = coll.isIndexedCollection === true;
    // A finite collection with no `At` is a set: its iterator order is not one a table can keep.
    if (!this.random && coll.isFiniteCollection === true)
      throw new Error("no row order: a finite set has no stable order");
    this.#total = this.#countOf(coll);
    this.#scanLimit = BigInt(Math.max(1, spec.scanBudget ?? SCAN_BUDGET));
    this.#resolveCarrier();
    this.#cols = spec.columns.map((source) => {
      const parsed = this.#parse(columnSource(source));
      return { source, label: columnLabel(source), json: parsed.json, error: parsed.error };
    });
    this.#predicate = spec.filter ? this.#parse(spec.filter) : { error: "" };
    if (spec.sort !== undefined && spec.sort !== "") {
      if (!this.#cols.some((c) => c.source === spec.sort)) this.#sortDeclined = `no column ${spec.sort} to sort by`;
      else if (this.#total.kind === "infinite") this.#sortDeclined = "an infinite collection cannot be sorted";
      else if (this.#total.kind !== "exact") this.#sortDeclined = "a collection of unknown size cannot be sorted";
    }
    const glyph = spec.glyph as GlyphKind | undefined;
    this.columns = [
      ...(glyph !== undefined && GLYPH_KINDS.has(glyph) ? [{ label: "", width: 3 }] : []),
      { label: "element", width: 14 },
      ...this.#cols.map((c) => ({ label: c.label, width: 6, numeric: true })),
    ];
  }

  get error(): string {
    return this.#predicate.error;
  }

  get sortDeclined(): string | undefined {
    return this.#sortDeclined;
  }

  // ---- counts ----------------------------------------------------------------------------

  #countOf(coll: BoxedExpression): RowCount {
    const known = coll.count;
    if (known === Number.POSITIVE_INFINITY) return { kind: "infinite" };
    if (typeof known === "bigint") return { kind: "exact", n: known };
    if (typeof known === "number" && Number.isFinite(known)) return { kind: "exact", n: BigInt(known) };
    if (coll.isFiniteCollection === false) return { kind: "infinite" };
    // Past 2^53 the handler declines; `Count` carries the exact integer.
    try {
      const counted = this.#ce.box(["Count", coll.json] as BoxInput).evaluate();
      if (counted.json === "PositiveInfinity") return { kind: "infinite" };
      const n = bigintOf(counted.json);
      if (n !== undefined) return { kind: "exact", n };
    } catch (error) {
      log("count failed", error);
    }
    return { kind: "atLeast", n: 0n, growing: true };
  }

  /** The rows the view has, as far as is known. */
  count(): RowCount {
    if (this.#sorting) {
      const n = BigInt(this.#best.length);
      return this.#sorted ? { kind: "exact", n } : { kind: "atLeast", n, upper: this.#viewCap(), growing: true };
    }
    if (this.#filtered) {
      const n = BigInt(this.#matches.length);
      if (this.#scanDone) return { kind: "exact", n };
      if (this.#total.kind === "exact") {
        return { kind: "atLeast", n, upper: n + this.#total.n - this.#scanned, growing: true };
      }
      return { kind: "atLeast", n, growing: true };
    }
    if (this.#total.kind === "atLeast") {
      return this.#walkEnd !== undefined
        ? { kind: "exact", n: this.#walkEnd }
        : { kind: "atLeast", n: this.#walked, growing: true };
    }
    return this.#total;
  }

  get #filtered(): boolean {
    return this.#predicate.json !== undefined;
  }

  get #sorting(): boolean {
    return this.#sortColumn() !== undefined && this.#sortDeclined === undefined;
  }

  #viewCap(): bigint | undefined {
    if (this.#total.kind !== "exact") return undefined;
    const keep = BigInt(SORT_KEEP);
    return this.#total.n < keep ? this.#total.n : keep;
  }

  // ---- elements --------------------------------------------------------------------------

  /** The row at a source index, by unranking (random) or from the walk's window. */
  #at(index: bigint): BoxedExpression | undefined {
    const hit = this.#elements.get(index);
    if (hit) return hit;
    if (!this.random) return undefined;
    const elt = this.#unrank(index);
    if (elt === undefined || elt.json === "Missing" || elt.operator === "Error") return undefined;
    if (this.#elements.size > 4096) this.#elements.clear();
    this.#elements.set(index, elt);
    return elt;
  }

  #unrank(index: bigint): BoxedExpression | undefined {
    const coll = this.#coll;
    if (index <= MAX_SAFE)
      return coll.at(Number(index)) ?? this.#ce.box(["At", coll.json, Number(index)] as BoxInput).evaluate();
    // One past 2^53 goes to the collection's `at` as digits, which a number cannot carry.
    const operator = coll.operator;
    const def = this.#ce.lookupDefinition(operator);
    const handlers =
      def && "operator" in def
        ? (def.operator as { collection?: { at?: unknown } } | undefined)?.collection
        : undefined;
    const at = handlers?.at as ((c: BoxedExpression, i: string) => BoxedExpression | undefined) | undefined;
    return at?.(coll, index.toString());
  }

  /**
   * Walk the iterator up to `index` (a source with no `At`), keeping a window of the last
   * elements. Returns false when the walk would pass `budget` steps in this call, or the source
   * ended first (`#walkEnd` says where).
   */
  async #walkTo(index: bigint, signal: AbortSignal | undefined, budget: number): Promise<boolean> {
    if (index <= this.#walked && this.#elements.has(index)) return true;
    const windowStart = this.#walked - BigInt(WALK_WINDOW);
    if (this.#walker === undefined || index <= windowStart) {
      this.#walker = this.#coll.each();
      this.#walked = 0n;
      this.#elements.clear();
    }
    const walker = this.#walker!;
    let steps = 0;
    let started = performance.now();
    while (this.#walked < index) {
      if (this.#walkEnd !== undefined && this.#walked >= this.#walkEnd) return false;
      if (++steps > budget) return false;
      const next = walker.next();
      if (next.done === true) {
        this.#walkEnd = this.#walked;
        return false;
      }
      this.#walked++;
      this.#elements.set(this.#walked, next.value);
      const old = this.#walked - BigInt(WALK_WINDOW);
      if (old > 0n) this.#elements.delete(old);
      if (performance.now() - started > SLICE_MS) {
        await yieldNow();
        checkAborted(signal);
        started = performance.now();
      }
    }
    return true;
  }

  /** The element at `index`, walking to it when the source has no `At`. */
  async #element(
    index: bigint,
    signal: AbortSignal | undefined,
    budget = WALK_BUDGET,
  ): Promise<BoxedExpression | undefined> {
    if (this.random) return this.#at(index);
    return (await this.#walkTo(index, signal, budget)) ? this.#elements.get(index) : undefined;
  }

  // ---- cells -----------------------------------------------------------------------------

  #parse(source: string): { json?: Json; error: string } {
    const ce = this.#ce;
    const { json, errors } = parseExpression(source, { ce, parseLatex: (tex) => ce.parse(tex).json });
    return errors.length > 0 ? { error: errors.join("; ") } : { json, error: "" };
  }

  /**
   * The carrier in play: the spec's, else read off the first row's own operator when it names a
   * registered carrier. Each column and the filter address the row in it only where the statistic
   * declares that carrier as its argument type -- never a blanket wrap.
   */
  #resolveCarrier(): void {
    const ce = this.#ce;
    const first = this.random ? this.#at(1n) : this.#probeFirst();
    const op = first?.operator;
    const derived = op !== undefined && carrierTypeForName(ce, op) !== undefined ? op : undefined;
    this.#carrierName = this.#spec.carrier || derived || undefined;
    this.#carrierParams = (this.#carrierName && allCarrierParams(ce).get(this.#carrierName)) || 0;
    this.#bareType = undefined;
    this.#carrierType = undefined;
    this.#wrapCache.clear();
    this.#cells.clear();
  }

  #probeFirst(): BoxedExpression | undefined {
    const next = this.#coll.each().next();
    return next.done === true ? undefined : next.value;
  }

  #representations(elt: BoxedExpression): { bare: Json; wrapped: Json } {
    const name = this.#carrierName;
    const json = elt.json;
    if (!name || elt.operator !== name || !Array.isArray(json) || json.length !== 2)
      return { bare: json, wrapped: json };
    return { bare: carrierBody(json[1] as Json, this.#carrierParams), wrapped: json };
  }

  #typesFor(
    elt: BoxedExpression,
    bare: Json,
    wrapped: Json,
  ): { bareType: BoxedType; carrierType: BoxedType | undefined } {
    if (!this.#carrierName) return { bareType: elt.type, carrierType: undefined };
    if (!this.#bareType) {
      try {
        this.#bareType = bare === elt.json ? elt.type : this.#ce.box(bare as BoxInput).type;
      } catch (error) {
        log("bare type probe failed", error);
      }
    }
    if (!this.#carrierType) {
      try {
        this.#carrierType = wrapped === elt.json ? elt.type : this.#ce.box(wrapped as BoxInput).type;
      } catch (error) {
        log("carrier type probe failed", this.#carrierName, error);
      }
    }
    return { bareType: this.#bareType ?? elt.type, carrierType: this.#carrierType };
  }

  #decide(head: string, argIndex: number, bareType: BoxedType, carrierType: BoxedType | undefined): boolean {
    const key = `${head}\0${argIndex}`;
    const cached = this.#wrapCache.get(key);
    if (cached !== undefined) return cached;
    const decision = wantsCarrier(this.#ce, head, argIndex, bareType, carrierType);
    this.#wrapCache.set(key, decision);
    return decision;
  }

  #substitute(json: Json, elt: BoxedExpression): Json {
    if (!this.#carrierName) return substituteRow(json, elt.json);
    const { bare, wrapped } = this.#representations(elt);
    const { bareType, carrierType } = this.#typesFor(elt, bare, wrapped);
    return substituteRowPerHead(json, bare, wrapped, (head, i) => this.#decide(head, i, bareType, carrierType));
  }

  #cell(col: Column, index: bigint, elt: BoxedExpression): CellValue {
    const key = `${col.source}\0${index}`;
    const hit = this.#cells.get(key);
    if (hit) return hit;
    let value: CellValue;
    if (!col.json) {
      value = { text: "⚠" };
    } else {
      try {
        const result = this.#ce.box(this.#substitute(col.json, elt) as BoxInput).evaluate();
        if (result.operator === "Error") value = { text: "⚠" };
        else if (Number.isFinite(result.re) && result.im === 0) value = { num: result.re, text: String(result.re) };
        else value = { text: oneLine(result.json) };
      } catch (error) {
        log("cell failed", col.source, index, error);
        value = { text: "⚠" };
      }
    }
    if (this.#cells.size > CELL_MEMO) this.#cells.clear();
    this.#cells.set(key, value);
    return value;
  }

  #holds(elt: BoxedExpression): boolean {
    try {
      return this.#ce.box(this.#substitute(this.#predicate.json!, elt) as BoxInput).evaluate().json === "True";
    } catch {
      return false;
    }
  }

  #glyph(json: Json): string {
    const kind = this.#spec.glyph as GlyphKind;
    if (!GLYPH_KINDS.has(kind)) return "";
    let ints = flatInts(json);
    if (!ints && (kind === "set-partition" || kind === "diagram")) {
      const blocks = blockLists(json);
      if (blocks) ints = blocksToRgs(blocks);
    }
    if (!ints) return "";
    try {
      return renderGlyph(kind, ints, { n: kind === "subset" ? this.#groundSize() : undefined });
    } catch {
      return "";
    }
  }

  #groundSize(): number | undefined {
    if (this.#spec.n) return this.#spec.n;
    const json = this.#coll.json;
    const first: unknown = Array.isArray(json) ? json[1] : undefined;
    return typeof first === "number" && Number.isInteger(first) ? first : undefined;
  }

  /** A row's cells, over the display columns `[first, last)`. */
  #cellsOf(index: bigint, elt: BoxedExpression, first: number, last: number): Box[] {
    const hasGlyph = this.columns.length > this.#cols.length + 1;
    const out: Box[] = [];
    for (let c = first; c < Math.min(last, this.columns.length); c++) {
      if (hasGlyph && c === 0) {
        const svg = this.#glyph(this.#representations(elt).bare);
        out.push(svg === "" ? "" : tag(svg, "Glyph"));
      } else if (c === (hasGlyph ? 1 : 0)) {
        out.push(text(oneLine(elt.json)));
      } else {
        const col = this.#cols[c - (hasGlyph ? 2 : 1)]!;
        out.push(text(this.#cell(col, index, elt).text));
      }
    }
    return out;
  }

  // ---- the filter's scan -----------------------------------------------------------------

  /** The source indices the scan may cover: the whole of a finite source, or without end. */
  #sourceEnd(): bigint | undefined {
    return this.#total.kind === "exact" ? this.#total.n : undefined;
  }

  /**
   * Scan on from where it stopped until `matches` holds `wanted` entries, the budget for this
   * call runs out, or the source ends. A call that spends its budget leaves the scan resumable.
   */
  async #scanFor(wanted: bigint, signal: AbortSignal | undefined): Promise<void> {
    const end = this.#sourceEnd();
    const limit = this.#scanned + this.#scanLimit;
    let started = performance.now();
    while (!this.#scanDone && BigInt(this.#matches.length) < wanted && this.#scanned < limit) {
      if (end !== undefined && this.#scanned >= end) {
        this.#scanDone = true;
        break;
      }
      const index = this.#scanned + 1n;
      const elt = await this.#element(index, signal, Number(this.#scanLimit) + 1);
      if (elt === undefined) {
        // The source ended (a walk), or the walk could not go on within its budget.
        if (this.#walkEnd !== undefined && index > this.#walkEnd) this.#scanDone = true;
        break;
      }
      this.#scanned = index;
      if (this.#holds(elt)) this.#matches.push(index);
      if (performance.now() - started > SLICE_MS) {
        await yieldNow();
        checkAborted(signal);
        started = performance.now();
      }
    }
    if (end !== undefined && this.#scanned >= end) this.#scanDone = true;
  }

  // ---- the sort's scan -------------------------------------------------------------------

  #sortColumn(): Column | undefined {
    const key = this.#spec.sort?.trim();
    return key ? this.#cols.find((c) => c.source === key) : undefined;
  }

  /** Scan the source (through the filter, if any) keeping the best `SORT_KEEP` rows by the sort column. */
  async #sortScan(signal: AbortSignal | undefined): Promise<void> {
    const col = this.#sortColumn()!;
    const end = this.#sourceEnd()!;
    const limit = this.#scanned + this.#scanLimit;
    const flip = this.#spec.descending === true ? -1 : 1;
    const order = (a: { index: bigint; value: CellValue }, b: { index: bigint; value: CellValue }): number =>
      flip * compareCells(a.value, b.value) || (a.index < b.index ? -1 : a.index > b.index ? 1 : 0);
    let started = performance.now();
    while (this.#scanned < end && this.#scanned < limit) {
      const index = this.#scanned + 1n;
      const elt = await this.#element(index, signal);
      this.#scanned = index;
      if (elt !== undefined && (!this.#filtered || this.#holds(elt))) {
        this.#best.push({ index, value: this.#cell(col, index, elt) });
        if (this.#best.length > 2 * SORT_KEEP) {
          this.#best.sort(order);
          this.#best.length = SORT_KEEP;
        }
      }
      if (performance.now() - started > SLICE_MS) {
        await yieldNow();
        checkAborted(signal);
        started = performance.now();
      }
    }
    this.#best.sort(order);
    if (this.#best.length > SORT_KEEP) this.#best.length = SORT_KEEP;
    if (this.#scanned >= end) this.#sorted = true;
  }

  /** Let the filter or the sort scan cover another budget's worth of the source. */
  extend(): void {
    this.#scanLimit += BigInt(Math.max(1, this.#spec.scanBudget ?? SCAN_BUDGET));
  }

  // ---- rows ------------------------------------------------------------------------------

  async rows(range: IndexRange, [first, last]: readonly [number, number], signal?: AbortSignal): Promise<RowBatch> {
    checkAborted(signal);
    const [from, to] = range;
    const declined = this.#sortDeclined;
    if (this.#sorting) return this.#sortedRows(from, to, first, last, signal);
    if (this.#filtered) {
      await this.#scanFor(to - 1n, signal);
      return this.#rowsOf(from, to, first, last, (k) => this.#matches[Number(k - 1n)], signal, declined);
    }
    return this.#rowsOf(from, to, first, last, (k) => k, signal, declined);
  }

  async #sortedRows(
    from: bigint,
    to: bigint,
    first: number,
    last: number,
    signal: AbortSignal | undefined,
  ): Promise<RowBatch> {
    if (!this.#sorted && this.#scanned < this.#scanLimit) await this.#sortScan(signal);
    const stalled = this.#sorted ? undefined : { scanned: this.#scanned };
    const batch = await this.#rowsOf(
      from,
      to,
      first,
      last,
      (k) => this.#best[Number(k - 1n)]?.index,
      signal,
      undefined,
    );
    return stalled === undefined ? batch : { ...batch, stalled };
  }

  /** Rows `[from, to)` of the view, `keyOf` mapping a view position to a source index. */
  async #rowsOf(
    from: bigint,
    to: bigint,
    first: number,
    last: number,
    keyOf: (position: bigint) => bigint | undefined,
    signal: AbortSignal | undefined,
    declined: string | undefined,
  ): Promise<RowBatch> {
    const rows: Box[][] = [];
    let ended = false;
    let stalled: RowBatch["stalled"];
    for (let k = from < 1n ? 1n : from; k < to; k++) {
      const index = keyOf(k);
      if (index === undefined) {
        ended = !this.#filtered || this.#scanDone;
        if (this.#filtered && !this.#scanDone) stalled = { scanned: this.#scanned };
        break;
      }
      const elt = await this.#element(index, signal);
      if (elt === undefined) {
        ended = this.random ? true : this.#walkEnd !== undefined;
        if (!ended) stalled = { scanned: this.#walked };
        break;
      }
      rows.push(this.#cellsOf(index, elt, first, last));
    }
    const start = from < 1n ? 1n : from;
    const count = this.count();
    // A view that has reached its own end says so, and what the walk found is its count.
    const reachedEnd = ended || (count.kind === "exact" && start + BigInt(rows.length) > count.n);
    return {
      start,
      rows,
      count,
      ...(reachedEnd && { end: true }),
      ...(stalled !== undefined && { stalled }),
      ...(declined !== undefined && { declined }),
    };
  }

  /** The source index of view position `position`, when it is one the view has. */
  indexOf(position: bigint): bigint | undefined {
    if (this.#sorting) return this.#best[Number(position - 1n)]?.index;
    if (this.#filtered) return this.#matches[Number(position - 1n)];
    return position;
  }
}

// --- the static page -----------------------------------------------------------------------

export interface PinnedOptions {
  /** The first row (1-based). */
  readonly scrollPosition?: number;
  /** How many rows. */
  readonly maxItems?: number;
}

/**
 * What a static environment draws of a table: the header, a first page of rows and a `Skeleton`
 * row for the rest, as the plain `GridBox` a print, a pipe or an SSR page can draw.
 */
export async function staticTable(source: CollectionRows, options: PinnedOptions = {}): Promise<Box> {
  const from = BigInt(Math.max(1, options.scrollPosition ?? 1));
  const to = from + BigInt(Math.max(1, options.maxItems ?? 20));
  // A glyph column is a picture; a static page draws the element's own text.
  const skip = source.columns[0]?.label === "" ? 1 : 0;
  const batch = await source.rows([from, to], [skip, source.columns.length]);
  return pinnedPage(["#", ...source.columns.slice(skip).map((c) => c.label)], {
    ...batch,
    rows: batch.rows.map((row, i) => [String(batch.start + BigInt(i)), ...row]),
  });
}

// --- the wire ------------------------------------------------------------------------------

/** A kernel's rows requests (`@enumeratio/evaluation`'s `rows` hook): register, ask, abort by id. */
export type RowsRequest =
  | { readonly op: "register"; readonly handle: string; readonly source: Json }
  | {
      readonly op: "range";
      readonly handle: string;
      /** Ranges of view positions `[from, to)`, answered in one reply. */
      readonly ranges: readonly IndexRange[];
      /** Display columns `[first, last)`. */
      readonly columns: readonly [number, number];
    }
  | { readonly op: "extend"; readonly handle: string }
  | { readonly op: "release"; readonly handle: string };

export type RowsReply =
  | {
      readonly ok: true;
      readonly columns?: readonly ColumnSpec[];
      readonly random?: boolean;
      readonly rowHeight?: number;
      readonly count: RowCount;
      readonly batches?: readonly RowBatch[];
      /** A filter that did not parse. */
      readonly warning?: string;
    }
  | { readonly ok: false; readonly error: string };

/** Text the host reads as Epsil, with the libraries it names declared (a kernel's `read`). */
export type ReadEpsil = (source: { readonly text: string; readonly format: string }) => Promise<unknown>;

/**
 * The kernel's side of the protocol: the sources registered by handle, and the calls on them. A
 * collection written as a string is Epsil for `read` to turn into MathJSON, which is how a page
 * with no engine of its own names one; `read` also declares the libraries the columns name.
 */
export function createRowsHost(
  ce: ComputeEngine,
  read?: ReadEpsil,
): (request: RowsRequest, signal: AbortSignal) => Promise<RowsReply> {
  const sources = new Map<string, CollectionRows>();
  return async (request, signal) => {
    try {
      if (request.op === "register") {
        let spec = rowSourceSpec(request.source);
        if (spec === undefined) return { ok: false, error: "not a RowSource" };
        const written = strOf(spec.collection);
        if (written !== undefined) {
          if (read === undefined) return { ok: false, error: "this host reads no text" };
          const collection = (await read({ text: written, format: "epsil" })) as Json;
          for (const text of [...spec.columns.map(columnSource), ...(spec.filter ? [spec.filter] : [])]) {
            await read({ text, format: "epsil" }).catch(() => undefined);
          }
          spec = { ...spec, collection };
        }
        const opened = openRowSource(ce, spec);
        if (!opened.ok) return opened;
        sources.set(request.handle, opened.source);
        const { source } = opened;
        return {
          ok: true,
          columns: source.columns,
          random: source.random,
          rowHeight: source.rowHeight,
          count: source.count(),
          ...(source.error !== "" && { warning: `filter: ${source.error}` }),
          ...(source.sortDeclined !== undefined && { warning: source.sortDeclined }),
        };
      }
      const source = sources.get(request.handle);
      if (request.op === "release") {
        sources.delete(request.handle);
        return { ok: true, count: { kind: "exact", n: 0n } };
      }
      if (source === undefined) return { ok: false, error: `no row source ${request.handle}` };
      if (request.op === "extend") {
        source.extend();
        return { ok: true, count: source.count() };
      }
      const batches: RowBatch[] = [];
      for (const range of request.ranges) batches.push(await source.rows(range, request.columns, signal));
      return { ok: true, count: source.count(), batches };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  };
}
