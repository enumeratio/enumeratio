import type { BoxedExpression } from "@cortex-js/compute-engine";
import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { toInputForm } from "@enumeratio/formats/inputform";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { loadEngine } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import {
  blockLists,
  blocksToRgs,
  type CellValue,
  columnLabel,
  columnSource,
  compareCells,
  debug,
  flatInts,
  formatCount,
  type GlyphKind,
  MAX_INDEX,
  pageCount,
  renderGlyph,
  splitColumns,
  substituteRow,
} from "@enumeratio/notatio";

const log = debug("collection-table");

type Engine = Awaited<ReturnType<typeof loadEngine>>;
type BoxInput = Parameters<Engine["box"]>[0];

interface Column {
  /** As authored: `Descents`, or `Max(_) - Min(_)`. */
  readonly source: string;
  readonly label: string;
  /** The expression over `_`, or undefined when it did not parse. */
  readonly json: MathJsonExpression | undefined;
  readonly error: string;
}

interface Row {
  /** The 1-based index in the SOURCE collection — `At(expr, index)` is this row. */
  readonly index: number;
  readonly text: string;
  readonly glyph: string;
  readonly cells: readonly CellValue[];
}

const PAGE_SIZES = [10, 20, 50, 100];
const SORT_LIMITS = [500, 2000, 10000];
const SCAN_STEP = 20000;
/** How long one scan slice may hold the main thread before yielding. */
const SLICE_MS = 12;

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

/**
 * `<notatio-collection-table expr="Subsets(4)">` -- a paged table over a lazy indexed
 * collection. Rows are produced by unranking (`At(expr, i)`), one page at a time, so a
 * collection is never materialised: `SymmetricGroup(20)` pages as cheaply as
 * `Subsets(4)`, and the `#` column is the index that reproduces each row.
 *
 * `columns` names statistics to apply to every row — a head (`Descents`) or any
 * expression over the row `_` (`Max(_) - Min(_)`), comma-separated, addable and
 * removable live. `filter` is a predicate over `_`; it is answered like `Filter`, by
 * scanning the source in the background, bounded by `scan-limit` and extendable from
 * the UI, and the match count is exact once the scan has covered the whole source.
 * Sorting by a column has to materialise that column, so it is bounded by `sort-limit`
 * and the table says when the order covers only a prefix of the rows.
 */
export class NotatioCollectionTable extends LitElement {
  static properties = {
    /** The collection to enumerate, in notatio: `Subsets(4)`, `SymmetricGroup(5)`. */
    expr: { type: String },
    /**
     * Statistic columns, comma-separated. A bare head applies to the row (`Descents`
     * means `Descents(_)`); anything else is an expression over `_`.
     */
    columns: { type: String, reflect: true },
    /** A predicate over the row `_`, e.g. `FixedPoints(_) == 0`. Empty for no filter. */
    filter: { type: String, reflect: true },
    /** The column (as written in `columns`) the rows are ordered by. Empty for index order. */
    sort: { type: String, reflect: true },
    /** Sort descending rather than ascending. */
    descending: { type: Boolean, reflect: true },
    /** Rows per page. */
    pageSize: { type: Number, attribute: "page-size" },
    /** The current page, 1-based. */
    page: { type: Number, reflect: true },
    /**
     * The carrier its rows inhabit -- the constructor head from `@enumeratio/domains`,
     * e.g. `Permutation`. Set it and each row is handed to the columns and the filter AS
     * that carrier, so a statistic of a permutation (`Cycles`, `FixedPoints`) can be asked
     * for at all: those heads take the carrier, not a bare list. Leave it unset and rows
     * stay bare lists, which only the list-function statistics accept.
     */
    carrier: { type: String },
    /** Draw each row as a glyph too: `permutation`, `subset`, `partition`, `dyck`, … */
    glyph: { type: String },
    /** Ground-set size for the `subset` glyph; taken from the collection's first argument when 0. */
    n: { type: Number },
    /** How many source rows a filter scan covers before it pauses and offers to go on. */
    scanLimit: { type: Number, attribute: "scan-limit" },
    /** How many rows a sort materialises; past this the order covers only a prefix. */
    sortLimit: { type: Number, attribute: "sort-limit" },
    /** Hide the editors (expression, columns, filter) and show only the table and pager. */
    readonly: { type: Boolean },
    _total: { state: true },
    _error: { state: true },
    _cols: { state: true },
    _predicate: { state: true },
    _matches: { state: true },
    _scanned: { state: true },
    _scanning: { state: true },
    _order: { state: true },
    _rows: { state: true },
  };

  declare expr: string;
  declare columns: string;
  declare filter: string;
  declare sort: string;
  declare descending: boolean;
  declare pageSize: number;
  declare page: number;
  declare carrier: string;
  declare glyph: string;
  declare n: number;
  declare scanLimit: number;
  declare sortLimit: number;
  declare readonly: boolean;
  /** `Count(expr)` — a double, so only exact below 2^53. */
  declare _total: number;
  declare _error: string;
  declare _cols: readonly Column[];
  declare _predicate: { json?: MathJsonExpression; error: string };
  /** Source indices that pass the filter, in index order, as far as the scan has gone. */
  declare _matches: number[] | null;
  declare _scanned: number;
  declare _scanning: boolean;
  /** Source indices in sorted order, over the bounded candidate set; null when unsorted. */
  declare _order: number[] | null;
  declare _rows: readonly Row[];

  #engine: Engine | undefined;
  #coll: BoxedExpression | undefined;
  /** Bumps on every reload / refilter so a stale scan slice stops itself. */
  #generation = 0;
  #elements = new Map<number, BoxedExpression>();
  #cells = new Map<string, CellValue>();

  constructor() {
    super();
    this.expr = "";
    this.columns = "";
    this.filter = "";
    this.sort = "";
    this.descending = false;
    this.pageSize = 20;
    this.page = 1;
    this.carrier = "";
    this.glyph = "";
    this.n = 0;
    this.scanLimit = SCAN_STEP;
    this.sortLimit = 2000;
    this.readonly = false;
    this._total = 0;
    this._error = "";
    this._cols = [];
    this._predicate = { error: "" };
    this._matches = null;
    this._scanned = 0;
    this._scanning = false;
    this._order = null;
    this._rows = [];
    ensureStyles();
    ensureTableStyles();
  }

  // Light DOM, like the other elements: one shared page-level stylesheet.
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override disconnectedCallback(): void {
    this.#generation++;
    super.disconnectedCallback();
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("expr")) {
      void this.#load();
      return;
    }
    if (!this.#coll) return;
    if (changed.has("columns")) this.#parseColumns();
    if (changed.has("filter")) this.#restartScan();
    if (changed.has("scanLimit") && this._matches && !this._scanning) this.#resumeScan();
    if (
      changed.has("columns") ||
      changed.has("filter") ||
      changed.has("sort") ||
      changed.has("descending") ||
      changed.has("sortLimit") ||
      changed.has("pageSize") ||
      changed.has("page") ||
      changed.has("glyph") ||
      changed.has("n")
    ) {
      this.#refresh();
    }
  }

  // ---- the collection --------------------------------------------------------------

  async #load(): Promise<void> {
    const generation = ++this.#generation;
    this.#coll = undefined;
    this.#elements.clear();
    this.#cells.clear();
    this._matches = null;
    this._scanned = 0;
    this._scanning = false;
    this._order = null;
    this._rows = [];
    this._error = "";
    const src = this.expr?.trim() ?? "";
    if (!src) return;
    try {
      const engine = await loadEngine();
      if (generation !== this.#generation) return;
      this.#engine = engine;
      const { json, errors } = parseNotatio(src, {
        parseLatex: (tex) => engine.parse(tex).json,
      });
      if (errors.length > 0) throw new Error(errors.join("; "));
      const coll = engine.box(json as BoxInput);
      if (!coll.isCollection || coll.isFiniteCollection === false) {
        throw new Error(`${src} is not a finite collection`);
      }
      const total = coll.count ?? engine.box(["Count", json] as BoxInput).evaluate().re;
      if (typeof total !== "number" || !Number.isFinite(total)) {
        throw new Error(`Count(${src}) is not known`);
      }
      this.#coll = coll;
      this._total = total;
      this.#parseColumns();
      this.#restartScan();
      this.#refresh();
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      log("load failed", src, err);
    }
  }

  /** The row at a source index, by unranking; cached for the current collection. */
  #element(index: number): BoxedExpression | undefined {
    const coll = this.#coll;
    const engine = this.#engine;
    if (!coll || !engine) return undefined;
    let elt = this.#elements.get(index);
    if (elt) return elt;
    elt = coll.at(index) ?? engine.box(["At", coll.json, index] as BoxInput).evaluate();
    if (elt.json === "Missing" || elt.operator === "Error") return undefined;
    this.#elements.set(index, elt);
    return elt;
  }

  #parse(source: string): { json?: MathJsonExpression; error: string } {
    const engine = this.#engine;
    if (!engine) return { error: "engine not ready" };
    const { json, errors } = parseNotatio(source, {
      parseLatex: (tex) => engine.parse(tex).json,
    });
    return errors.length > 0 ? { error: errors.join("; ") } : { json, error: "" };
  }

  // ---- columns ---------------------------------------------------------------------

  #parseColumns(): void {
    this._cols = splitColumns(this.columns ?? "").map((text) => {
      const parsed = this.#parse(columnSource(text));
      return { source: text, label: columnLabel(text), json: parsed.json, error: parsed.error };
    });
  }

  /**
   * The row as the columns and the filter see it: the bare element, or that element wrapped
   * in its carrier constructor when `carrier` says what these rows are. A statistic of a
   * permutation takes a `Permutation`, not a list -- the wrapping is what lets it be asked.
   */
  #subject(elt: BoxedExpression): MathJsonExpression {
    return this.carrier ? ([this.carrier, elt.json] as MathJsonExpression) : elt.json;
  }

  /** Evaluate a column at a row; memoised per (column, index) for the collection. */
  #cell(col: Column, index: number, elt: BoxedExpression): CellValue {
    const key = `${col.source}\0${index}`;
    const hit = this.#cells.get(key);
    if (hit) return hit;
    let value: CellValue;
    if (!col.json) {
      value = { text: "⚠" };
    } else {
      try {
        const result = this.#engine!
          .box(substituteRow(col.json, this.#subject(elt)) as BoxInput)
          .evaluate();
        if (result.operator === "Error") {
          value = { text: "⚠" };
        } else if (Number.isFinite(result.re) && result.im === 0) {
          value = { num: result.re, text: String(result.re) };
        } else {
          value = { text: toInputForm(result.json) };
        }
      } catch (err) {
        log("cell failed", col.source, index, err);
        value = { text: "⚠" };
      }
    }
    this.#cells.set(key, value);
    return value;
  }

  // ---- filter: a background scan of the source ---------------------------------------

  #restartScan(): void {
    this.#generation++;
    this._scanning = false;
    const text = this.filter?.trim() ?? "";
    if (!text) {
      this._predicate = { error: "" };
      this._matches = null;
      this._scanned = 0;
      return;
    }
    this._predicate = this.#parse(text);
    // A predicate that does not parse filters nothing: the view stays the whole source.
    this._matches = this._predicate.json ? [] : null;
    this._scanned = 0;
    if (this._predicate.json) this.#resumeScan();
  }

  /** Continue scanning from where the last pass stopped, up to the current limit. */
  #resumeScan(): void {
    if (!this.#coll || !this._matches || !this._predicate.json) return;
    if (this._scanned >= this.#scanEnd()) return;
    const generation = this.#generation;
    this._scanning = true;
    const slice = (): void => {
      if (generation !== this.#generation) return;
      const pred = this._predicate.json!;
      const matches = this._matches!;
      const end = this.#scanEnd();
      const started = performance.now();
      let i = this._scanned;
      while (i < end && performance.now() - started < SLICE_MS) {
        i++;
        const elt = this.#element(i);
        if (elt && this.#holds(pred, elt)) matches.push(i);
      }
      this._scanned = i;
      // Unranked rows are cheap to redo; keeping every scanned one is not.
      if (this.#elements.size > 4 * this.pageSize + 1000) this.#elements.clear();
      const done = i >= end;
      this._scanning = !done;
      this.#refresh();
      if (!done) setTimeout(slice, 0);
    };
    setTimeout(slice, 0);
  }

  #scanEnd(): number {
    return Math.min(this._total, Math.max(0, this.scanLimit), MAX_INDEX);
  }

  #holds(pred: MathJsonExpression, elt: BoxedExpression): boolean {
    try {
      const r = this.#engine!.box(substituteRow(pred, this.#subject(elt)) as BoxInput).evaluate();
      return r.json === "True";
    } catch {
      return false;
    }
  }

  #scanMore(): void {
    this.scanLimit = Math.min(this._total, this.scanLimit + SCAN_STEP);
  }

  // ---- the view: sort, then page -------------------------------------------------------

  /** The rows the view ranges over: the matches so far, or the whole source (null). */
  #candidates(): number[] | null {
    return this._matches;
  }

  #viewCount(): number {
    const c = this.#candidates();
    return c ? c.length : Math.min(this._total, MAX_INDEX);
  }

  #sortColumn(): Column | undefined {
    const key = this.sort?.trim();
    return key ? this._cols.find((c) => c.source === key) : undefined;
  }

  /** How many rows the current sort actually ordered (0 when unsorted). */
  #sortedCount(): number {
    return this._order ? this._order.length : 0;
  }

  #refresh(): void {
    if (!this.#coll) return;
    const col = this.#sortColumn();
    if (col) {
      const candidates = this.#candidates();
      const limit = Math.max(1, this.sortLimit);
      const pool = candidates
        ? candidates.slice(0, limit)
        : Array.from({ length: Math.min(this._total, limit) }, (_, i) => i + 1);
      const keyed = pool.map((index) => {
        const elt = this.#element(index);
        return { index, value: elt ? this.#cell(col, index, elt) : { text: "" } };
      });
      keyed.sort((a, b) => compareCells(a.value, b.value) || a.index - b.index);
      if (this.descending) keyed.reverse();
      this._order = keyed.map((k) => k.index);
    } else {
      this._order = null;
    }
    const pages = pageCount(this.#viewCount(), this.pageSize);
    const page = Math.min(Math.max(1, Math.floor(this.page) || 1), pages);
    if (page !== this.page) this.page = page;
    this._rows = this.#pageRows(page);
  }

  #pageRows(page: number): Row[] {
    const start = (page - 1) * this.pageSize;
    const view = this._order ?? this.#candidates();
    const count = view ? view.length : this.#viewCount();
    const rows: Row[] = [];
    for (let k = start; k < Math.min(start + this.pageSize, count); k++) {
      const index = view ? view[k] : k + 1;
      const elt = this.#element(index);
      if (!elt) continue;
      rows.push({
        index,
        text: toInputForm(elt.json),
        glyph: this.#glyph(elt.json),
        cells: this._cols.map((col) => this.#cell(col, index, elt)),
      });
    }
    return rows;
  }

  #glyph(json: MathJsonExpression): string {
    const kind = this.glyph as GlyphKind;
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

  /** `n` for the subset glyph: the attribute, else the collection's first integer argument. */
  #groundSize(): number | undefined {
    if (this.n > 0) return this.n;
    const json = this.#coll?.json;
    const first: unknown = Array.isArray(json) ? json[1] : undefined;
    return typeof first === "number" && Number.isInteger(first) ? first : undefined;
  }

  // ---- interaction -----------------------------------------------------------------

  #toggleSort(col: Column): void {
    if (this.sort !== col.source) {
      this.sort = col.source;
      this.descending = false;
    } else if (!this.descending) {
      this.descending = true;
    } else {
      this.sort = "";
      this.descending = false;
    }
    this.page = 1;
  }

  #addColumn(text: string): void {
    const t = text.trim();
    if (!t) return;
    const existing = splitColumns(this.columns ?? "");
    if (existing.includes(t)) return;
    this.columns = [...existing, t].join(", ");
  }

  #removeColumn(col: Column): void {
    this.columns = splitColumns(this.columns ?? "")
      .filter((c) => c !== col.source)
      .join(", ");
    if (this.sort === col.source) this.sort = "";
  }

  #onEnter(apply: (value: string) => void) {
    return (event: KeyboardEvent): void => {
      if (event.key !== "Enter") return;
      const input = event.target as HTMLInputElement;
      apply(input.value);
      if (input.dataset.clear) input.value = "";
    };
  }

  #goto(page: number): void {
    const pages = pageCount(this.#viewCount(), this.pageSize);
    this.page = Math.min(Math.max(1, page), pages);
  }

  // ---- render ----------------------------------------------------------------------

  #summary(): unknown {
    const total = formatCount(this._total);
    if (!this._matches) {
      return html`<span class="nct-count">${total} rows</span>${
          this._predicate.error
            ? html`<span class="nct-error">filter: ${this._predicate.error}</span>`
            : nothing
        }`;
    }
    const matched = formatCount(this._matches.length);
    const complete = this._scanned >= Math.min(this._total, MAX_INDEX);
    if (complete) {
      return html`<span class="nct-count">${matched} of ${total} match</span>`;
    }
    return html`<span class="nct-count"
        >${matched} match${this._matches.length === 1 ? "" : "es"} in the first
        ${formatCount(this._scanned)} of ${total}</span
      >${
        this._scanning
          ? html`<span class="nct-note">scanning…</span>`
          : html`<button type="button" class="nct-btn" @click=${() => this.#scanMore()}>
              scan ${formatCount(Math.min(SCAN_STEP, this._total - this._scanned))} more
            </button>`
      }`;
  }

  #sortNote(): unknown {
    const col = this.#sortColumn();
    if (!col) return nothing;
    const ordered = this.#sortedCount();
    const view = this.#viewCount();
    const bounded = ordered < view;
    return html`<div class="nct-sortnote">
      sorted by <code>${col.label}</code>${this.descending ? " ↓" : " ↑"}
      ${
        bounded
          ? html`over the first ${formatCount(ordered)} of ${formatCount(view)} rows — sorting
            materialises the column, so it is bounded:`
          : html`over all ${formatCount(ordered)} rows ·`
      }
      <select
        class="nct-select"
        .value=${String(this.sortLimit)}
        @change=${(e: Event) => {
          this.sortLimit = Number((e.target as HTMLSelectElement).value);
        }}
      >
        ${SORT_LIMITS.map(
          (n) =>
            html`<option value=${n} ?selected=${n === this.sortLimit}>
              up to ${formatCount(n)}
            </option>`,
        )}
      </select>
    </div>`;
  }

  #editors(): unknown {
    if (this.readonly) return nothing;
    return html`<div class="nct-editors">
      <label class="nct-field">
        <span>collection</span>
        <input
          class="nct-input nct-expr"
          spellcheck="false"
          .value=${this.expr}
          @keydown=${this.#onEnter((v) => {
            this.expr = v.trim();
            this.page = 1;
          })}
        />
      </label>
      <label class="nct-field">
        <span>filter <code>_</code></span>
        <input
          class="nct-input"
          spellcheck="false"
          placeholder="predicate over _, e.g. FixedPoints(_) == 0"
          .value=${this.filter}
          @keydown=${this.#onEnter((v) => {
            this.filter = v.trim();
            this.page = 1;
          })}
        />
        ${
          this._predicate.error
            ? html`<span class="nct-error">${this._predicate.error}</span>`
            : nothing
        }
      </label>
      <label class="nct-field">
        <span>columns</span>
        <span class="nct-chips">
          ${this._cols.map(
            (col) =>
              html`<span class="nct-chip ${col.error ? "is-error" : ""}" title=${col.error}
                >${col.label}<button
                  type="button"
                  aria-label="remove ${col.label}"
                  @click=${() => this.#removeColumn(col)}
                >
                  ×
                </button></span
              >`,
          )}
          <input
            class="nct-input nct-add"
            spellcheck="false"
            data-clear="1"
            placeholder="add: a head (Descents) or an expression over _"
            @keydown=${this.#onEnter((v) => this.#addColumn(v))}
          />
        </span>
      </label>
    </div>`;
  }

  #table(): unknown {
    const sortCol = this.#sortColumn();
    return html`<div class="nct-scroll">
      <table class="nct-table">
        <thead>
          <tr>
            <th class="nct-index" title="index in the source collection: At(expr, #)">#</th>
            ${this.glyph ? html`<th class="nct-glyph"></th>` : nothing}
            <th class="nct-elt">element</th>
            ${this._cols.map(
              (col) =>
                html`<th
                  class="nct-stat ${sortCol === col ? "is-sorted" : ""} ${col.error ? "is-error" : ""}"
                  title=${col.error || `sort by ${col.label}`}
                >
                  <button type="button" @click=${() => this.#toggleSort(col)}>
                    ${col.label}${sortCol === col ? (this.descending ? " ↓" : " ↑") : ""}
                  </button>
                </th>`,
            )}
          </tr>
        </thead>
        <tbody>
          ${this._rows.map(
            (row) => html`<tr>
              <td class="nct-index">${row.index.toLocaleString("en-US")}</td>
              ${this.glyph ? html`<td class="nct-glyph">${unsafeHTML(row.glyph)}</td>` : nothing}
              <td class="nct-elt"><code>${row.text}</code></td>
              ${row.cells.map((cell) => html`<td class="nct-stat">${cell.text}</td>`)}
            </tr>`,
          )}
          ${
            this._rows.length === 0
              ? html`<tr>
                  <td class="nct-empty" colspan=${2 + (this.glyph ? 1 : 0) + this._cols.length}>
                    ${this._scanning ? "scanning…" : "no rows"}
                  </td>
                </tr>`
              : nothing
          }
        </tbody>
      </table>
    </div>`;
  }

  #pager(): unknown {
    const pages = pageCount(this.#viewCount(), this.pageSize);
    return html`<div class="nct-pager">
      <button
        type="button"
        class="nct-btn"
        ?disabled=${this.page <= 1}
        @click=${() => this.#goto(1)}
      >
        «
      </button>
      <button
        type="button"
        class="nct-btn"
        ?disabled=${this.page <= 1}
        @click=${() => this.#goto(this.page - 1)}
      >
        ‹
      </button>
      <span class="nct-pageno"
        >page
        <input
          class="nct-input nct-page"
          type="number"
          min="1"
          max=${pages}
          .value=${String(this.page)}
          @keydown=${this.#onEnter((v) => this.#goto(Number(v)))}
          @change=${(e: Event) => this.#goto(Number((e.target as HTMLInputElement).value))}
        />
        of ${formatCount(pages)}</span
      >
      <button
        type="button"
        class="nct-btn"
        ?disabled=${this.page >= pages}
        @click=${() => this.#goto(this.page + 1)}
      >
        ›
      </button>
      <button
        type="button"
        class="nct-btn"
        ?disabled=${this.page >= pages}
        @click=${() => this.#goto(pages)}
      >
        »
      </button>
      <select
        class="nct-select"
        aria-label="rows per page"
        @change=${(e: Event) => {
          this.pageSize = Number((e.target as HTMLSelectElement).value);
          this.page = 1;
        }}
      >
        ${PAGE_SIZES.map(
          (n) => html`<option value=${n} ?selected=${n === this.pageSize}>${n} / page</option>`,
        )}
      </select>
    </div>`;
  }

  protected override render(): unknown {
    return html`<div class="nct">
      <div class="nct-head">
        <code class="nct-title">${this.expr}</code>
        ${this._error ? html`<span class="nct-error">${this._error}</span>` : this.#summary()}
      </div>
      ${this.#editors()}
      ${this._error ? nothing : html`${this.#sortNote()}${this.#table()}${this.#pager()}`}
    </div>`;
  }
}

let stylesInjected = false;

// Table styles live here rather than in the shared stylesheet; same light-DOM,
// page-level pattern, one `<style>` per document.
function ensureTableStyles(): void {
  if (stylesInjected || typeof document === "undefined") return;
  stylesInjected = true;
  const style = document.createElement("style");
  style.id = "notatio-collection-table";
  style.textContent = CSS;
  document.head.append(style);
}

const CSS = `
notatio-collection-table { display: block; margin: 0.75rem 0; }
.nct {
  border: 1px solid var(--notatio-border, var(--vp-c-divider, #d4d4d8));
  border-radius: 10px;
  background: var(--notatio-bg, var(--vp-c-bg, #fff));
  font-size: 0.85rem;
  overflow: hidden;
}
.nct-head {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0.55rem 0.8rem;
  border-bottom: 1px solid var(--vp-c-divider, #e5e5e5);
  background: var(--vp-c-bg-soft, #f6f6f7);
}
.nct-title { font-size: 0.9rem; font-weight: 600; color: var(--vp-c-brand-1, #3451b2); }
.nct-count { color: var(--vp-c-text-2, #555); font-variant-numeric: tabular-nums; }
.nct-note { color: var(--vp-c-text-3, #888); font-style: italic; }
.nct-error { color: var(--vp-c-danger-1, #c0392b); font-family: var(--notatio-mono, ui-monospace, monospace); font-size: 0.78rem; }
.nct-editors {
  display: grid;
  gap: 0.4rem;
  padding: 0.55rem 0.8rem;
  border-bottom: 1px solid var(--vp-c-divider, #e5e5e5);
}
.nct-field { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
.nct-field > span:first-child {
  flex: 0 0 5.5rem;
  color: var(--vp-c-text-3, #888);
  font-size: 0.72rem;
  font-family: var(--notatio-mono, ui-monospace, monospace);
  user-select: none;
}
.nct-input {
  flex: 1 1 12rem;
  min-width: 0;
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--vp-c-divider, #d4d4d8);
  border-radius: 6px;
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-1, inherit);
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.8rem;
}
.nct-input:focus { outline: 2px solid var(--vp-c-brand-1, #3451b2); outline-offset: -1px; }
.nct-chips { display: flex; flex: 1 1 auto; flex-wrap: wrap; gap: 0.35rem; align-items: center; }
.nct-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.2rem;
  padding: 0.1rem 0.25rem 0.1rem 0.5rem;
  border: 1px solid var(--vp-c-divider, #d4d4d8);
  border-radius: 999px;
  background: var(--vp-c-bg-soft, #f6f6f7);
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.78rem;
}
.nct-chip.is-error { border-color: var(--vp-c-danger-1, #c0392b); color: var(--vp-c-danger-1, #c0392b); }
.nct-chip button {
  border: 0;
  background: none;
  color: var(--vp-c-text-3, #888);
  font-size: 0.9rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 0.2rem;
}
.nct-chip button:hover { color: var(--vp-c-danger-1, #c0392b); }
.nct-add { flex: 1 1 14rem; }
.nct-sortnote {
  padding: 0.35rem 0.8rem;
  color: var(--vp-c-text-2, #555);
  font-size: 0.78rem;
  border-bottom: 1px solid var(--vp-c-divider, #e5e5e5);
}
.nct-scroll { overflow-x: auto; }
.nct-table { width: 100%; border-collapse: collapse; margin: 0; }
.nct-table th, .nct-table td {
  padding: 0.3rem 0.6rem;
  border-bottom: 1px solid var(--vp-c-divider, #eee);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}
.nct-table thead th {
  font-size: 0.72rem;
  font-weight: 600;
  color: var(--vp-c-text-3, #888);
  background: var(--vp-c-bg, #fff);
  user-select: none;
}
.nct-table th button {
  border: 0;
  background: none;
  padding: 0;
  color: inherit;
  font: inherit;
  cursor: pointer;
  text-decoration: underline dotted var(--vp-c-divider, #bbb);
  text-underline-offset: 3px;
}
.nct-table th button:hover, .nct-table th.is-sorted button { color: var(--vp-c-brand-1, #3451b2); }
.nct-table th.is-error button { color: var(--vp-c-danger-1, #c0392b); }
.nct-table tbody tr:hover { background: var(--vp-c-bg-soft, #f6f6f7); }
.nct-index {
  color: var(--vp-c-text-3, #888);
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  text-align: right !important;
}
.nct-elt code {
  font-family: var(--notatio-mono, ui-monospace, monospace);
  font-size: 0.82rem;
  background: none;
  padding: 0;
  color: var(--vp-c-text-1, inherit);
}
.nct-stat { font-variant-numeric: tabular-nums; text-align: right !important; }
.nct-glyph { line-height: 0; width: 1px; }
.nct-glyph svg { height: 1.6em; width: auto; display: inline-block; vertical-align: middle; }
.nct-empty { color: var(--vp-c-text-3, #888); font-style: italic; text-align: center !important; }
.nct-pager {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.45rem 0.8rem;
  color: var(--vp-c-text-2, #555);
  font-size: 0.78rem;
}
.nct-pageno { display: inline-flex; align-items: center; gap: 0.35rem; margin: 0 0.35rem; }
.nct-page { flex: 0 0 auto; width: 5.5rem; padding: 0.15rem 0.4rem; text-align: right; }
.nct-btn {
  border: 1px solid var(--vp-c-divider, #d4d4d8);
  border-radius: 6px;
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-2, #555);
  font-size: 0.78rem;
  padding: 0.15rem 0.5rem;
  cursor: pointer;
}
.nct-btn:hover:not([disabled]) { color: var(--vp-c-brand-1, #3451b2); border-color: currentColor; }
.nct-btn[disabled] { opacity: 0.4; cursor: default; }
.nct-select {
  margin-left: auto;
  border: 1px solid var(--vp-c-divider, #d4d4d8);
  border-radius: 6px;
  background: var(--vp-c-bg, #fff);
  color: var(--vp-c-text-2, #555);
  font-size: 0.78rem;
  padding: 0.15rem 0.35rem;
}
.nct-sortnote .nct-select { margin-left: 0.35rem; }
`;

if (!customElements.get("notatio-collection-table")) {
  customElements.define("notatio-collection-table", NotatioCollectionTable);
}
