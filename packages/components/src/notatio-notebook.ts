import { html, LitElement, type PropertyValues } from "lit";
import { keyed } from "lit/directives/keyed.js";
import { repeat } from "lit/directives/repeat.js";
import "./notatio-cell.ts";
import "./notatio-dynamic-module.ts";
import { referencesOrdinal, toIpynb } from "@enumeratio/frontend/core";
import {
  browserStore,
  type CellAnswer,
  isSeed,
  notebookKey,
  openingCells,
  RECORD_CHANNEL,
  type RecordStore,
} from "./notebook-record.ts";
import { ensureStyles } from "./styles.ts";

export { referencesOrdinal };

// Which tab a record's change came from, so a tab ignores its own.
const TAB = Math.random().toString(36).slice(2);
// Edits are kept once typing pauses.
const SAVE_MS = 300;

// Stable identity (`id`, never reused) keys the DOM across reorder and deletion.
interface NbCell {
  id: number;
  value: string;
  answer?: CellAnswer;
}

/**
 * `<Notebook>` -- a thin shell around a reactive `<DynamicModule
 * tracked-symbols="all">` of `<Cell>`s: the unified cell owns editing and
 * evaluation, this element owns the notebook-specific chrome (add/remove, drag to
 * reorder) and the seed.
 *
 * A cell binds a variable with `:=` (`a := 5`, `f(x) := x^2`); later cells use that
 * name, in either direction -- `TrackedSymbols -> All` schedules by dependency, not
 * document position, which is what makes reordering safe. `seed` is an optional JSON
 * array of cell sources, Epsil unless `in-form="latex"`.
 *
 * Variable-centric and Desmos-like: cells can be reordered (drag the ordinal), so
 * references are by name only -- a cell-number reference draws a diagnostic (the
 * module rejects it outright, same as any other reactive `DynamicModule`). The
 * ordinal on the left is a pure display index (a CSS counter), referencing nothing.
 *
 * The reader's cells are kept (`notebook-record.ts`): a reload, or another tab on the same
 * page, opens the notebook as they left it. Reset returns it to the seed.
 */
export class NotatioNotebook extends LitElement {
  static properties = {
    /** A JSON array of cell sources, used as the notebook's initial cells. */
    seed: { type: String },
    /** The seed's syntax: `epsil` (default) or `latex`, the syntax `notatio-cell` reads. */
    inForm: { type: String, attribute: "in-form" },
    /** `Transient -> True`: keep nothing, so every visit opens from the seed. */
    transient: { type: Boolean },
    _cells: { state: true },
    _ready: { state: true },
    _generation: { state: true },
    _dragId: { state: true },
    _dropId: { state: true },
  };

  declare seed: string;
  declare inForm: string;
  declare transient: boolean;
  declare _cells: NbCell[];
  // Cells draw once the record is read, so a reader's notebook never flashes its seed.
  declare _ready: boolean;
  // Bumped when the cells are replaced wholesale (Reset, another tab): the reactive module
  // under them starts over, so no cell keeps bindings from the cells it replaced.
  declare _generation: number;
  // Drag-to-reorder: the cell being dragged and the cell it will drop before (for
  // the insertion indicator). Undefined when no drag is in progress.
  declare _dragId: number | undefined;
  declare _dropId: number | undefined;
  #nextId = 1;
  #store: RecordStore | undefined;
  #key = "";
  #channel: BroadcastChannel | undefined;
  #saveTimer: ReturnType<typeof setTimeout> | undefined;
  // Set while cells come from the record, so applying them doesn't write them straight back.
  #restoring = false;
  // Each cell's latest answer, by cell id: kept with the cells, and what an export writes.
  readonly #answers = new Map<number, CellAnswer>();
  // Whether the pending save changed the sources, which the other tabs are told of.
  #announce = false;

  constructor() {
    super();
    this.seed = "";
    this.inForm = "epsil";
    this.transient = false;
    this._cells = [];
    this._ready = false;
    this._generation = 0;
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

  override connectedCallback(): void {
    super.connectedCallback();
    this.#store = this.transient ? undefined : browserStore();
    if (this.#store === undefined) {
      this._ready = true;
      return;
    }
    const index = [...document.querySelectorAll("notatio-notebook")].indexOf(this);
    this.#key = notebookKey(location.pathname, this.id, index);
    this.#channel = new BroadcastChannel(RECORD_CHANNEL);
    this.#channel.onmessage = (e: MessageEvent<{ key: string; tab: string }>) => {
      if (e.data.key === this.#key && e.data.tab !== TAB) void this.#restore(true);
    };
    void this.#restore(false);
  }

  override disconnectedCallback(): void {
    this.#flush();
    this.#channel?.close();
    this.#channel = undefined;
    super.disconnectedCallback();
  }

  /** The seed's cell sources. */
  get #seeded(): string[] {
    try {
      const parsed = this.seed ? JSON.parse(this.seed) : [];
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      // a malformed seed seeds nothing
      return [];
    }
  }

  /** Open with the reader's cells, if they left any; `fresh` starts the module over. */
  async #restore(fresh: boolean): Promise<void> {
    const record = await this.#store?.get(this.#key);
    const cells = openingCells(record, this.#seeded);
    // Another tab announces only a change of sources; one already shown needs no redraw.
    if (fresh && this._ready && sameSources(cells, this._cells)) return;
    this.#apply(cells, fresh);
  }

  #apply(cells: readonly NbCell[], fresh: boolean): void {
    this.#restoring = true;
    this.#answers.clear();
    for (const cell of cells) if (cell.answer !== undefined) this.#answers.set(cell.id, cell.answer);
    this.#nextId = Math.max(0, ...cells.map((c) => c.id)) + 1;
    const last = cells.at(-1);
    this._cells = last === undefined || last.value.trim() !== "" ? [...cells, this.#cell()] : [...cells];
    if (fresh) this._generation++;
    this._ready = true;
  }

  protected override willUpdate(changed: PropertyValues): void {
    // A seed set after the notebook opened (a framework binding it late) seeds an empty one.
    if (changed.has("seed") && this._ready && this._cells.length === 0) this.#apply([], false);
  }

  protected override updated(changed: PropertyValues): void {
    if (!changed.has("_cells")) return;
    if (this.#restoring) {
      this.#restoring = false;
      return;
    }
    this.#save(true);
  }

  #save(announce: boolean): void {
    if (this.#store === undefined) return;
    this.#announce ||= announce;
    clearTimeout(this.#saveTimer);
    this.#saveTimer = setTimeout(() => this.#flush(), SAVE_MS);
  }

  /** A cell's Out answered: kept, so the notebook shows it at once next time. */
  #onResult = (event: Event): void => {
    // An Out with no value yet (its cell still reading the input) has nothing to keep.
    if (((event.target as { value?: string }).value ?? "") === "") return;
    const cell = (event.target as Element).closest<HTMLElement & { value?: string }>("notatio-cell");
    const id = Number(cell?.dataset.cellId);
    if (cell === null || !Number.isInteger(id)) return;
    const { latex, markup, inputform, asciimath } = (event as CustomEvent<Omit<CellAnswer, "source">>).detail;
    if (latex) this.#answers.set(id, { source: cell.value ?? "", latex, markup, inputform, asciimath });
    else this.#answers.delete(id);
    this.#save(false);
  };

  /** Keep the cells and their answers now. Edited sources are announced to the other tabs. */
  #flush(): void {
    if (this.#saveTimer === undefined || this.#store === undefined) return;
    clearTimeout(this.#saveTimer);
    this.#saveTimer = undefined;
    const announce = this.#announce;
    this.#announce = false;
    const cells = this._cells.map(({ id, value }) => {
      const answer = this.#answers.get(id);
      return answer?.source === value ? { id, value, answer } : { id, value };
    });
    void this.#store
      .put({ key: this.#key, cells, seed: this.seed })
      .then(() => {
        if (announce) this.#channel?.postMessage({ key: this.#key, tab: TAB });
      })
      .catch(() => undefined);
  }

  /** The notebook as a Jupyter notebook file, for the reader to save. */
  #export(): void {
    const cells = this._cells.map(({ id, value }) => {
      const answer = this.#answers.get(id);
      return { source: value, format: this.#format, ...(answer?.source === value ? { output: answer } : {}) };
    });
    const title = document.title.split("|")[0]?.trim() || "Notebook";
    const blob = new Blob([JSON.stringify(toIpynb(cells, { title }), null, 1)], {
      type: "application/x-ipynb+json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${title.replace(/[^\w-]+/g, "-").toLowerCase()}.ipynb`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /** Back to the author's cells, here and in the other tabs. */
  #reset(): void {
    clearTimeout(this.#saveTimer);
    this.#saveTimer = undefined;
    this.#apply(
      this.#seeded.map((value, i) => ({ id: i + 1, value })),
      true,
    );
    void this.#store
      ?.delete(this.#key)
      .then(() => this.#channel?.postMessage({ key: this.#key, tab: TAB }))
      .catch(() => undefined);
  }

  /** `format` this notebook's syntax maps to on `<Cell>`. */
  get #format(): "epsil" | "latex" {
    return this.inForm === "latex" ? "latex" : "epsil";
  }

  // Keep exactly one trailing blank cell; committing the last one grows the notebook.
  #onChange(id: number, event: Event): void {
    const epsil = (event as CustomEvent<{ epsil: string }>).detail.epsil;
    const cells = this._cells.map((c) => (c.id === id ? { ...c, value: epsil } : c));
    const last = cells[cells.length - 1];
    if (last.id === id && epsil.trim()) cells.push(this.#cell());
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
    if (!this._ready) return html``;
    const edited = this.#store !== undefined && !isSeed(this._cells, this.#seeded);
    return html`<div class="notatio-notebook" @notatio-result=${this.#onResult}>
      <span class="nb-actions">
        ${
          edited
            ? html`<button class="nb-reset" title="Back to the notebook as written" @click=${() => this.#reset()}>
                Reset
              </button>`
            : ""
        }
        <button class="nb-export" title="Save as a Jupyter notebook (.ipynb)" @click=${() => this.#export()}>
          Export
        </button>
      </span>
      ${keyed(
        this._generation,
        html`<notatio-dynamic-module tracked-symbols="all">
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
                  data-cell-id=${cell.id}
                  .value=${cell.value}
                  .provisional=${cell.answer?.source === cell.value ? cell.answer.markup : undefined}
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
        </notatio-dynamic-module>`,
      )}
    </div>`;
  }
}

if (!customElements.get("notatio-notebook")) {
  customElements.define("notatio-notebook", NotatioNotebook);
}

const sameSources = (a: readonly NbCell[], b: readonly NbCell[]): boolean =>
  a.length === b.length && a.every((cell, i) => cell.id === b[i]?.id && cell.value === b[i]?.value);
