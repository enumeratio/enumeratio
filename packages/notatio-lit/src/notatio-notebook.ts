import { html, LitElement, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import "./notatio-in.ts";
import { loadEngine, loadMarkup } from "./mathlive.ts";
import { ensureStyles } from "./styles.ts";
import {
  type Cell,
  type CellResult,
  collectErrors,
  editorLatexOf,
  referencesOrdinal,
  runPass,
} from "@enumeratio/notatio";

export { referencesOrdinal };

/**
 * `<notatio-notebook>` -- a notebook that sits on top of `<notatio-in>` and
 * owns the session: it evaluates every cell in its own compute-engine *scope* (a
 * child of the shared engine's root, so bindings never leak to other notebooks or
 * the reference pages), tracks dependencies between cells, and re-evaluates live.
 *
 * A cell binds a variable with `:=` (`a := 5`, `f(x) := x^2`); later cells use
 * that name. `seed` is an optional JSON array of cell sources, notatio unless
 * `in-form="latex"`.
 *
 * Variable-centric and Desmos-like: cells can be reordered (drag the ordinal), so
 * references are by name only -- a cell-number reference draws a diagnostic. The
 * ordinal on the left is a pure display index (a CSS counter), referencing nothing.
 */
export class NotatioNotebook extends LitElement {
  static properties = {
    /** A JSON array of cell sources, used as the notebook's initial cells. */
    seed: { type: String },
    /** The seed's syntax: `notatio` (default) or `latex`, the editor's own form. */
    inForm: { type: String, attribute: "in-form" },
    _cells: { state: true },
    _results: { state: true },
    _dragId: { state: true },
    _dropId: { state: true },
  };

  declare seed: string;
  declare inForm: string;
  declare _cells: Cell[];
  declare _results: Record<number, CellResult>;
  // Drag-to-reorder: the cell being dragged and the cell it will drop before (for
  // the insertion indicator). Undefined when no drag is in progress.
  declare _dragId: number | undefined;
  declare _dropId: number | undefined;
  #nextId = 1;
  #evalToken = 0;

  constructor() {
    super();
    this.seed = "";
    this.inForm = "notatio";
    this._cells = [];
    this._results = {};
    this._dragId = undefined;
    this._dropId = undefined;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  #cell(value = ""): Cell {
    return { id: this.#nextId++, value };
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("seed") && this._cells.length === 0) void this.#seedCells();
    if (changed.has("_cells")) void this.#evaluate();
  }

  // A notatio seed becomes the editor's LaTeX first, which needs the engine; a source
  // that will not read is dropped rather than shown as a broken cell.
  async #seedCells(): Promise<void> {
    let seeded: string[] = [];
    try {
      const parsed = this.seed ? JSON.parse(this.seed) : [];
      if (Array.isArray(parsed)) seeded = parsed.map(String);
    } catch {
      // ignore a malformed seed
    }
    if (this.inForm !== "latex" && seeded.length > 0) {
      const engine = await loadEngine();
      seeded = seeded
        .map((v) => editorLatexOf(engine, this.inForm, v, { assign: true }).latex)
        .filter((v) => v !== "");
    }
    this._cells = [...seeded.map((v) => this.#cell(v)), this.#cell()];
  }

  // Keep exactly one trailing blank cell; typing into it grows the notebook.
  #onChange(id: number, event: Event): void {
    const latex = (event as CustomEvent<{ latex: string }>).detail.latex;
    const cells = this._cells.map((c) => (c.id === id ? { ...c, value: latex } : c));
    const last = cells[cells.length - 1];
    if (last.id === id && latex.trim()) cells.push(this.#cell());
    this._cells = cells;
  }

  #remove(id: number): void {
    const cells = this._cells.filter((c) => c.id !== id);
    this._cells = cells.length > 0 ? cells : [this.#cell()];
  }

  // --- Drag-to-reorder (the trailing blank cell is not draggable). The dragged
  // cell moves to *before* the drop target, so the trailing blank always stays
  // last. Re-evaluation and the CSS ordinal counter follow the new order
  // automatically -- there is no reference bookkeeping.
  #onDragStart(id: number, event: DragEvent): void {
    this._dragId = id;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", String(id)); // Firefox needs data set
    }
  }

  #onDragOver(id: number, event: DragEvent): void {
    if (this._dragId === undefined) return;
    event.preventDefault(); // marks this a valid drop target
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    this._dropId = id === this._dragId ? undefined : id;
  }

  #onDrop(id: number, event: DragEvent): void {
    if (this._dragId === undefined) return;
    event.preventDefault();
    this.#move(this._dragId, id);
    this._dragId = undefined;
    this._dropId = undefined;
  }

  #onDragEnd(): void {
    this._dragId = undefined;
    this._dropId = undefined;
  }

  #move(dragId: number, beforeId: number): void {
    if (dragId === beforeId) return;
    const cells = [...this._cells];
    const from = cells.findIndex((c) => c.id === dragId);
    if (from < 0) return;
    const [moved] = cells.splice(from, 1);
    const to = cells.findIndex((c) => c.id === beforeId);
    cells.splice(to < 0 ? cells.length : to, 0, moved);
    this._cells = cells;
  }

  // Evaluate every cell in a fresh scope; see `runPass` for the scoping rules.
  async #evaluate(): Promise<void> {
    const token = ++this.#evalToken;
    const engine = await loadEngine();
    const convert = await loadMarkup();
    if (token !== this.#evalToken) return; // a newer pass superseded this one

    const passed = runPass(engine, this._cells, {
      // Cells can be reordered, so a cell-number reference has no stable meaning.
      rejectOrdinals: true,
      markup: convert,
      errors: collectErrors,
    });
    if (token !== this.#evalToken) return;

    const results: Record<number, CellResult> = {};
    for (const p of passed) results[p.cell.id] = p.result;
    this._results = results;
  }

  #outLine(cell: Cell): unknown {
    const r = this._results[cell.id];
    if (!cell.value.trim() || !r) return "";
    if (r.status === "invalid") {
      return html`<div class="nb-out"><span class="notatio-assert-diag">${r.detail}</span></div>`;
    }
    if (r.status === "error") {
      return html`<div class="nb-out">
        <span class="notatio-assert-diag">⚠ ${r.detail}</span>
      </div>`;
    }
    // A bound cell leads with its name (`name = value`); an anonymous cell just
    // shows the value.
    return html`<div class="nb-out">
      ${r.name ? html`<span class="nb-bind">${r.name} =</span>` : ""}
      <span class="notatio-render">${unsafeHTML(r.markup)}</span>
    </div>`;
  }

  protected override render(): unknown {
    return html`<div class="notatio-notebook">
      ${repeat(
        this._cells,
        (cell) => cell.id,
        (cell, i) => {
          const blank = i === this._cells.length - 1 && !cell.value.trim();
          // The ordinal is a pure display index (a CSS counter on .nb-cell, so it
          // renumbers on reorder with no JS) and doubles as the drag handle.
          const canDrag = !blank;
          const cls = [
            "nb-cell",
            this._dragId === cell.id ? "nb-dragging" : "",
            this._dropId === cell.id ? "nb-drop-before" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return html`<div
            class=${cls}
            @dragover=${(e: DragEvent) => this.#onDragOver(cell.id, e)}
            @drop=${(e: DragEvent) => this.#onDrop(cell.id, e)}
          >
            <div class="nb-in">
              <span
                class="nb-ordinal ${canDrag ? "nb-handle" : ""}"
                draggable=${canDrag ? "true" : "false"}
                title=${canDrag ? "Drag to reorder" : ""}
                @dragstart=${(e: DragEvent) => this.#onDragStart(cell.id, e)}
                @dragend=${() => this.#onDragEnd()}
              ></span>
              <notatio-in
                .value=${cell.value}
                @notatio-change=${(e: Event) => this.#onChange(cell.id, e)}
              ></notatio-in>
              <button
                class="nb-remove"
                title="Remove cell"
                aria-label="Remove cell"
                ?hidden=${blank && this._cells.length === 1}
                @click=${() => this.#remove(cell.id)}
              >
                ✕
              </button>
            </div>
            ${this.#outLine(cell)}
          </div>`;
        },
      )}
    </div>`;
  }
}

if (!customElements.get("notatio-notebook")) {
  customElements.define("notatio-notebook", NotatioNotebook);
}
