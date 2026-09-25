import { html, LitElement, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "./notatio-cell.ts";
import "./notatio-dynamic-module.ts";
import { referencesOrdinal } from "@enumeratio/notatio";
import { ensureStyles } from "./styles.ts";

export { referencesOrdinal };

// Stable identity (`id`, never reused) keys the DOM across reorder and deletion.
interface NbCell {
  id: number;
  value: string;
}

/**
 * `<notatio-notebook>` -- a thin shell around a reactive `<notatio-dynamic-module
 * tracked-symbols="all">` of `<notatio-cell>`s: the unified cell owns editing and
 * evaluation, this element owns the notebook-specific chrome (add/remove, drag to
 * reorder) and the seed.
 *
 * A cell binds a variable with `:=` (`a := 5`, `f(x) := x^2`); later cells use that
 * name, in either direction -- `TrackedSymbols -> All` schedules by dependency, not
 * document position, which is what makes reordering safe. `seed` is an optional JSON
 * array of cell sources, notatio unless `in-form="latex"`.
 *
 * Variable-centric and Desmos-like: cells can be reordered (drag the ordinal), so
 * references are by name only -- a cell-number reference draws a diagnostic (the
 * module rejects it outright, same as any other reactive `DynamicModule`). The
 * ordinal on the left is a pure display index (a CSS counter), referencing nothing.
 */
export class NotatioNotebook extends LitElement {
  static properties = {
    /** A JSON array of cell sources, used as the notebook's initial cells. */
    seed: { type: String },
    /** The seed's syntax: `notatio` (default) or `latex`, the syntax `notatio-cell` reads. */
    inForm: { type: String, attribute: "in-form" },
    _cells: { state: true },
    _dragId: { state: true },
    _dropId: { state: true },
  };

  declare seed: string;
  declare inForm: string;
  declare _cells: NbCell[];
  // Drag-to-reorder: the cell being dragged and the cell it will drop before (for
  // the insertion indicator). Undefined when no drag is in progress.
  declare _dragId: number | undefined;
  declare _dropId: number | undefined;
  #nextId = 1;

  constructor() {
    super();
    this.seed = "";
    this.inForm = "notatio";
    this._cells = [];
    this._dragId = undefined;
    this._dropId = undefined;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  #cell(value = ""): NbCell {
    return { id: this.#nextId++, value };
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("seed") && this._cells.length === 0) this.#seedCells();
  }

  #seedCells(): void {
    let seeded: string[] = [];
    try {
      const parsed = this.seed ? JSON.parse(this.seed) : [];
      if (Array.isArray(parsed)) seeded = parsed.map(String);
    } catch {
      // ignore a malformed seed
    }
    this._cells = [...seeded.map((v) => this.#cell(v)), this.#cell()];
  }

  /** `format` this notebook's syntax maps to on `<notatio-cell>`. */
  get #format(): "notatio" | "latex" {
    return this.inForm === "latex" ? "latex" : "notatio";
  }

  // Keep exactly one trailing blank cell; committing the last one grows the notebook.
  #onChange(id: number, event: Event): void {
    const notatio = (event as CustomEvent<{ notatio: string }>).detail.notatio;
    const cells = this._cells.map((c) => (c.id === id ? { ...c, value: notatio } : c));
    const last = cells[cells.length - 1];
    if (last.id === id && notatio.trim()) cells.push(this.#cell());
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

  protected override render(): unknown {
    return html`<div class="notatio-notebook">
      <notatio-dynamic-module tracked-symbols="all">
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
              <span
                class="nb-ordinal ${canDrag ? "nb-handle" : ""}"
                draggable=${canDrag ? "true" : "false"}
                title=${canDrag ? "Drag to reorder" : ""}
                @dragstart=${(e: DragEvent) => this.#onDragStart(cell.id, e)}
                @dragend=${() => this.#onDragEnd()}
              ></span>
              <notatio-cell
                .value=${cell.value}
                format=${this.#format}
                @notatio-change=${(e: Event) => this.#onChange(cell.id, e)}
              ></notatio-cell>
              <button
                class="nb-remove"
                title="Remove cell"
                aria-label="Remove cell"
                ?hidden=${blank && this._cells.length === 1}
                @click=${() => this.#remove(cell.id)}
              >
                ✕
              </button>
            </div>`;
          },
        )}
      </notatio-dynamic-module>
    </div>`;
  }
}

if (!customElements.get("notatio-notebook")) {
  customElements.define("notatio-notebook", NotatioNotebook);
}
