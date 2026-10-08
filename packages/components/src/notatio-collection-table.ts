import { describeCount } from "@enumeratio/boxes";
import {
  collectionText,
  columnLabel,
  debug,
  rowSourceExpression,
  splitColumns,
  type RowSourceSpec,
} from "@enumeratio/frontend/core";
import { html, LitElement, nothing } from "lit";
import { ensureStyles } from "./styles.ts";
import type { TableStatus } from "./table-view-box.ts";

const log = debug("collection-table");

/**
 * `<CollectionTable expr="Subsets(4)">` -- the chrome around a `<table-view-box>`: the editors
 * for the collection, its columns and a filter, and the table they drive. The rows are the box's
 * (the wiki's Speculative-Lazy-Grid): a row source over the collection, registered with the
 * page's kernel, which answers only the rows in view, so `SymmetricGroup(25)` scrolls as cheaply
 * as `Subsets(4)` and `NonNegativeIntegers` scrolls without end. The `#` column is the index
 * that reproduces each row, `At(expr, #)`.
 *
 * `columns` names statistics to apply to every row -- a head (`Descents`) or any expression
 * over the row `_` (`Max(_) - Min(_)`), comma-separated, addable and removable live. `filter`
 * is a predicate over `_`; it is answered like `Filter`, by a scan the kernel runs in slices,
 * so the count is a lower bound until the scan covers the source, and a slice that finds
 * nothing says how far it looked and offers to go on. Sorting by a column is a scan too, for a
 * finite source: the best rows are kept and labeled until it completes; an infinite source
 * declines. `page` and `page-size` open the table on the row where that page would start.
 */
export class NotatioCollectionTable extends LitElement {
  static properties = {
    /** The collection to enumerate, in Epsil: `Subsets(4)`, `SymmetricGroup(5)`. */
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
    /** With `page`: the table opens on the first row of that page. */
    pageSize: { type: Number, attribute: "page-size" },
    /** The page (1-based, of `page-size` rows) the table opens on. */
    page: { type: Number, reflect: true },
    /**
     * The carrier its rows inhabit -- the constructor head from `@enumeratio/combinatorics`,
     * e.g. `Permutation`. Auto-derived from the first row's own operator, so this is an OVERRIDE,
     * needed only when a story wants a different reading than the collection's own.
     */
    carrier: { type: String },
    /** Draw each row as a glyph too: `permutation`, `subset`, `partition`, `dyck`, … */
    glyph: { type: String },
    /** Ground-set size for the `subset` glyph; taken from the collection's first argument when 0. */
    n: { type: Number },
    /** How many source rows a filter or sort scan covers before it pauses and offers to go on. */
    scanLimit: { type: Number, attribute: "scan-limit" },
    /** Hide the editors (expression, columns, filter) and show only the table. */
    readonly: { type: Boolean },
    /** Pages in place of a scroll. */
    pagination: { type: Boolean },
    /** The first row in view (`ScrollPosition`): digits, so a row past 2^53 stays exact. */
    scrollPosition: { type: String, attribute: "scroll-position" },
    /** Rows of a pinned page (`MaxItems`). */
    maxItems: { type: Number, attribute: "max-items" },
    _status: { state: true },
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
  declare readonly: boolean;
  declare pagination: boolean;
  declare scrollPosition: string;
  declare maxItems: number;
  declare _status: TableStatus | undefined;

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
    this.scanLimit = 0;
    this.readonly = false;
    this.pagination = false;
    this.scrollPosition = "";
    this.maxItems = 0;
    this._status = undefined;
    ensureStyles();
    ensureTableStyles();
  }

  // Light DOM, like the other elements: one shared page-level stylesheet.
  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  // ---- the source ------------------------------------------------------------------------

  /** The source this table shows: the collection as the kernel reads it, and what to do to each row. */
  #spec(): RowSourceSpec {
    return {
      collection: collectionText(this.expr.trim()),
      columns: splitColumns(this.columns ?? ""),
      ...(this.filter.trim() && { filter: this.filter.trim() }),
      ...(this.sort.trim() && { sort: this.sort.trim() }),
      ...(this.descending && { descending: true }),
      ...(this.carrier && { carrier: this.carrier }),
      ...(this.glyph && { glyph: this.glyph }),
      ...(this.n > 0 && { n: this.n }),
      ...(this.scanLimit > 0 && { scanBudget: this.scanLimit }),
    };
  }

  /** The headings drawn before any row is known, so the viewport is its size from the first paint. */
  #headers(): string[] {
    return [...(this.glyph ? [""] : []), "element", ...splitColumns(this.columns ?? "").map(columnLabel)];
  }

  /** The display column the sort is on (past the glyph and element columns), if any. */
  #sortedDisplayColumn(): number | undefined {
    const key = this.sort.trim();
    const index = key === "" ? -1 : splitColumns(this.columns ?? "").indexOf(key);
    return index < 0 ? undefined : index + (this.glyph ? 1 : 0) + 1;
  }

  // ---- interaction -----------------------------------------------------------------------

  #onSort(event: CustomEvent<{ column: number }>): void {
    const stat = event.detail.column - (this.glyph ? 1 : 0) - 1;
    const key = splitColumns(this.columns ?? "")[stat];
    if (key === undefined) return;
    if (this.sort !== key) {
      this.sort = key;
      this.descending = false;
    } else if (!this.descending) {
      this.descending = true;
    } else {
      this.sort = "";
      this.descending = false;
    }
  }

  #addColumn(text: string): void {
    const t = text.trim();
    if (!t) return;
    const existing = splitColumns(this.columns ?? "");
    if (existing.includes(t)) return;
    this.columns = [...existing, t].join(", ");
  }

  #removeColumn(source: string): void {
    this.columns = splitColumns(this.columns ?? "")
      .filter((c) => c !== source)
      .join(", ");
    if (this.sort === source) this.sort = "";
  }

  #onEnter(apply: (value: string) => void) {
    return (event: KeyboardEvent): void => {
      if (event.key !== "Enter") return;
      const input = event.target as HTMLInputElement;
      apply(input.value);
      if (input.dataset.clear) input.value = "";
    };
  }

  // ---- render ----------------------------------------------------------------------------

  #summary(): unknown {
    const status = this._status;
    if (status?.error) return html`<span class="nct-error">${status.error}</span>`;
    if (status === undefined) return html`<span class="nct-count">loading…</span>`;
    const count = describeCount(status.count);
    const noun = this.filter.trim()
      ? status.count.kind === "exact" && status.count.n === 1n
        ? "match"
        : "matches"
      : "rows";
    return html`<span class="nct-count">${count} ${noun}</span>${
        status.warning ? html`<span class="nct-error">${status.warning}</span>` : nothing
      }`;
  }

  #editors(): unknown {
    if (this.readonly) return nothing;
    const cols = splitColumns(this.columns ?? "");
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
          })}
        />
      </label>
      <label class="nct-field">
        <span>columns</span>
        <span class="nct-chips">
          ${cols.map(
            (source) =>
              html`<span class="nct-chip"
                >${columnLabel(source)}<button
                  type="button"
                  aria-label="remove ${columnLabel(source)}"
                  @click=${() => this.#removeColumn(source)}
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

  protected override render(): unknown {
    const source = this.expr.trim();
    const start =
      this.scrollPosition !== ""
        ? this.scrollPosition
        : this.page > 1
          ? String((this.page - 1) * Math.max(1, this.pageSize) + 1)
          : "";
    if (source !== "") log("render", source);
    return html`<div class="nct">
      <div class="nct-head">
        <code class="nct-title">${this.expr}</code>
        ${this.#summary()}
      </div>
      ${this.#editors()}
      ${
        source === ""
          ? nothing
          : html`<table-view-box
              source=${JSON.stringify(rowSourceExpression(this.#spec()))}
              headers=${JSON.stringify(this.#headers())}
              sortable
              sort-column=${this.#sortedDisplayColumn() ?? nothing}
              ?sort-descending=${this.descending}
              scroll-position=${start === "" ? nothing : start}
              max-items=${this.maxItems > 0 ? String(this.maxItems) : this.pagination ? String(this.pageSize) : nothing}
              ?pagination=${this.pagination}
              @table-status=${(e: CustomEvent<TableStatus>) => {
                this._status = e.detail;
              }}
              @table-sort=${(e: CustomEvent<{ column: number }>) => this.#onSort(e)}
            ></table-view-box>`
      }
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
.nct table-view-box { margin: 0; border: 0; border-radius: 0; }
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
`;

if (!customElements.get("notatio-collection-table")) {
  customElements.define("notatio-collection-table", NotatioCollectionTable);
}
