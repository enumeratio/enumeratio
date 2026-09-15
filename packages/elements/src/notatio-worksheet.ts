import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { html, LitElement, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import "./notatio-input.ts";
import "./notatio-complex-plot.ts";
import "./notatio-plot.ts";
import "./notatio-plot3d.ts";
import { imageUri } from "@enumeratio/formats";
import { pointsOf } from "./notatio-curve3d.ts";
import type { Point3 } from "./plot3d.ts";
import { toInputForm } from "@enumeratio/formats/inputform";
import { collectErrors } from "./assert.ts";
import { debug } from "./debug.ts";
import { loadEngine, loadMarkup } from "./mathlive.ts";
import { LONG_PRESS_MS } from "./choice-menu.ts";
import { formatValue } from "./manipulate.ts";
import { type Loop, SliderPlayback } from "./playback.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { editorLatexOf } from "./source.ts";
import {
  bindingSource,
  type Cell,
  type CellResult,
  type ControlRange,
  controlsFor,
  freeVariables,
  inferProjection,
  INTEGER_TYPES,
  type ProjectionKind,
  projectionFits,
  projectionReason,
  runPass,
  type WorksheetControl,
} from "./reactive.ts";
import { domainsOf, resolveView, settingName, type SpaceView, stackLayers } from "./space.ts";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-worksheet>` -- a set of named expressions and a shared view of what they draw.
 *
 * It is the reactive notebook with two additions, and the additions fall out of the
 * cells rather than being configured:
 *
 * - A cell that binds a plain number (`s := 2`) gets a **slider**. No separate control
 *   syntax, which is the whole point: a knob is just a binding you can move.
 * - A cell that leaves an axis variable free gets **drawn**. `z` is the complex plane
 *   and colours as a portrait, `x` is a curve, `x` and `y` a surface. A cell that
 *   binds something draws nothing, so it stays off the screen without saying so.
 *
 * Together those subsume Manipulate: `PolyLog(s, z)` over `s := 2` is a portrait with a
 * slider, and a second cell `Zeta(s, z)` is a second view sharing the same `s` — which
 * is why there is no "which function?" control. Each drawable cell carries a visibility
 * toggle, Desmos-style, and may override the projection its variables imply.
 *
 * There is no cell history and no ordinals: every cell is defined by its name and
 * recomputed from its dependencies. That is what separates a worksheet from
 * [[notatio-notebook]], whose sequential mode is exactly the transcript this lacks.
 */
export class NotatioWorksheet extends LitElement {
  static properties = {
    /**
     * A JSON array of the worksheet's initial cells. An entry is a source string, or an
     * object `{value, locked, bind, domain, integer}` -- `bind`/`domain` pin the
     * declaration so only the value can be edited. Sources are in the syntax `in-form`
     * names; a binding is `s := 2`.
     */
    seed: { type: String },
    /** The seed's syntax: `notatio` (default) or `latex`, the editor's own form. */
    inForm: { type: String, attribute: "in-form" },
    /** Where the shared view sits: `auto`, `side` or `below`. */
    screen: { type: String },
    /** Show the cells without allowing edits. Implies a fixed structure. */
    readonly: { type: Boolean },
    /** `fixed` keeps the reader from adding or removing cells; `open` (default) allows it. */
    structure: { type: String },
    /** What a sweeping binding does at the ends: `cycle` (default), `reflect` or `none`. */
    loop: { type: String, reflect: true },
    _cells: { state: true },
    _results: { state: true },
    _controls: { state: true },
    _draw: { state: true },
    _views: { state: true },
    _declined: { state: true },
    _collapsed: { state: true },
    _fatal: { state: true },
    _height: { state: true },
    _seedError: { state: true },
    _dragId: { state: true },
    _dropId: { state: true },
  };

  declare seed: string;
  declare inForm: string;
  /** Where the screen sits relative to the cells: "auto" (default), "side", "below". */
  declare screen: string;
  /** When set, cells cannot be added or removed. */
  declare readonly: boolean;
  /**
   * How much of the worksheet a reader may change: `open` (default) is everything,
   * `fixed` keeps the set of cells as the author wrote it — values stay editable, but
   * nothing can be added or removed, so a page about p and q still has p and q however
   * much is typed.
   */
  declare structure: string;
  declare loop: Loop | "";
  declare _cells: Cell[];
  declare _results: Record<number, CellResult>;
  declare _controls: WorksheetControl[];
  declare _draw: Drawable[];
  /** The resolved view per projection kind — see space.ts. */
  declare _views: Record<string, SpaceView>;
  /** Why a cell that asked to be drawn is not being drawn, by cell id. */
  declare _declined: Record<number, string>;
  /** Whether the screen is folded away. */
  declare _collapsed: boolean;
  /** A pass that could not finish at all, as opposed to a cell that could not. */
  declare _fatal: string;
  /** A height the reader dragged to, overriding what the projections asked for. */
  declare _height: number | undefined;
  declare _seedError: string;
  declare _dragId: number | undefined;
  declare _dropId: number | undefined;

  #nextId = 1;
  #evalToken = 0;
  /**
   * Cell sources a slider is driving right now, before they are committed.
   *
   * A drag must not rewrite the cell: the cell holds LaTeX, and handing new LaTeX to
   * the editor re-typesets it on every input event -- which measured 11-31ms of
   * synchronous work each, so a real drag froze the renderer outright. The override is
   * evaluated in the cell's place and written back once, on release.
   */
  #live = new Map<number, string>();
  #evalTimer: ReturnType<typeof setTimeout> | undefined;
  #lastPassAt = 0;
  /**
   * Typeset markup by the LaTeX that produced it.
   *
   * Converting LaTeX to markup is the expensive part of a pass, and a pass re-runs
   * every cell — so a dragged slider was re-typesetting every *unchanged* result
   * dozens of times a second. The cache is per worksheet and small by construction:
   * one entry per distinct result a cell has shown.
   */
  #markupCache = new Map<string, string>();
  /** How many points a curve cell evaluated to, for the elided readout. */
  #pointCount: Record<number, number> = {};
  /** Bindings the author declared whole, so a slider on them moves by ones. */
  #integerNames = new Set<string>();
  /** Host width, watched so the fold control knows which border it sits on. */
  #hostWidth = 0;
  #resize: ResizeObserver | undefined;
  /** Sweeps a binding's slider; a worksheet's targets redraw within a frame, so it interpolates. */
  #playback = new SliderPlayback(
    {
      slider: (name) => this._controls.find((c) => c.name === name),
      set: (name, value) => {
        const control = this._controls.find((c) => c.name === name);
        if (control) this.#setControl(control, String(value));
      },
      loop: () => (this.loop === "reflect" || this.loop === "none" ? this.loop : "cycle"),
      setLoop: (loop) => (this.loop = loop),
      interval: NotatioWorksheet.PLAY_INTERVAL_MS,
      motion: "continuous",
      update: () => this.requestUpdate(),
    },
    openPlaybackMenu,
    LONG_PRESS_MS,
  );
  #engine: ComputeEngine | undefined;

  constructor() {
    super();
    this.seed = "";
    this.inForm = "notatio";
    this.screen = "auto";
    this.readonly = false;
    this.structure = "open";
    this.loop = "";
    this._cells = [];
    this._results = {};
    this._controls = [];
    this._draw = [];
    this._views = {};
    this._declined = {};
    this._collapsed = false;
    this._fatal = "";
    this._height = undefined;
    this._seedError = "";
    this._dragId = undefined;
    this._dropId = undefined;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.#resize = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      // Only re-render when it crosses the breakpoint, not on every pixel.
      if (width >= SIDE_BY_SIDE_PX !== this.#hostWidth >= SIDE_BY_SIDE_PX) this.requestUpdate();
      this.#hostWidth = width;
    });
    this.#resize.observe(this);
  }

  /**
   * One seeded cell. A plain string is its source; an object may also say that the cell
   * is `locked` (it stays, and stays bound to that name), `integer` (its slider moves by
   * whole numbers), or `bind`/`domain` — which pins the declaration itself, so a page
   * *about* p and q keeps a p and a q whatever the reader types into them.
   */
  #seedCell(entry: unknown): Cell {
    if (typeof entry === "string") return this.#cell(entry);
    if (typeof entry === "object" && entry !== null) {
      const e = entry as Record<string, unknown>;
      const cell = this.#cell(typeof e.value === "string" ? e.value : "");
      if (e.locked === true) cell.locked = true;
      if (typeof e.bind === "string" && e.bind.trim()) cell.bind = e.bind.trim();
      if (typeof e.domain === "string" && e.domain.trim()) cell.domain = e.domain.trim();
      // `integer: true` is the shorthand for the commonest assertion there is.
      if (e.integer === true) cell.domain ??= "integer";
      if (cell.domain !== undefined && INTEGER_TYPES.has(cell.domain)) cell.integer = true;
      // A pinned cell is a cell that cannot be removed; there is no other reading.
      if (cell.bind !== undefined) cell.locked = true;
      return cell;
    }
    return this.#cell(String(entry));
  }

  #cell(value = ""): Cell {
    return { id: this.#nextId++, value };
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("seed") && this._cells.length === 0) void this.#seedCells();
    if (changed.has("_cells")) this.#scheduleEvaluate();
  }

  /**
   * Read the seed into cells. A notatio seed is converted to the editor's LaTeX first,
   * which needs the engine -- so the cells land after an await, which is also what
   * reports them as a change and schedules the first pass.
   */
  async #seedCells(): Promise<void> {
    let seeded: Cell[] = [];
    this._seedError = "";
    try {
      const parsed = this.seed ? JSON.parse(this.seed) : [];
      if (Array.isArray(parsed)) seeded = parsed.map((entry) => this.#seedCell(entry));
      else if (this.seed) this._seedError = "seed must be a JSON array of cell sources";
    } catch (err) {
      // Swallowing this leaves an empty sheet and no hint why. The usual cause is a
      // single backslash in a LaTeX seed: `"\\coloneq"` is a JSON escape, `"\coloneq"` is not.
      this._seedError = `seed is not valid JSON (${
        err instanceof Error ? err.message : String(err)
      })`;
    }
    if (this.inForm !== "latex" && seeded.length > 0) {
      const engine = await loadEngine();
      const problems: string[] = [];
      seeded = seeded.map((cell) => {
        const { latex, errors } = editorLatexOf(engine, this.inForm, cell.value, { assign: true });
        if (errors.length) problems.push(`${cell.value}: ${errors[0]}`);
        return { ...cell, value: latex };
      });
      if (problems.length) this._seedError = `seed is not notatio (${problems.join("; ")})`;
    }
    this._cells = seeded.length > 0 ? seeded : [this.#cell()];
  }

  // --- editing ---------------------------------------------------------------------

  #onChange(id: number, event: Event): void {
    const latex = (event as CustomEvent<{ latex: string }>).detail.latex;
    this._cells = this._cells.map((c) => (c.id === id ? { ...c, value: latex } : c));
  }

  /** May the reader add or remove cells at all? */
  get #fixed(): boolean {
    return this.readonly || this.structure === "fixed";
  }

  /** Enter opens a cell below, the way a line break works in any other document. */
  #onKeyDown(id: number, event: KeyboardEvent): void {
    if (event.key !== "Enter" || event.shiftKey || this.#fixed) return;
    event.preventDefault();
    this.#insertAfter(id);
  }

  #insertAfter(id: number): void {
    const at = this._cells.findIndex((c) => c.id === id);
    const cells = [...this._cells];
    const fresh = this.#cell();
    cells.splice(at < 0 ? cells.length : at + 1, 0, fresh);
    this._cells = cells;
    // Focus the new cell once it exists, so typing continues where the caret went.
    void this.updateComplete.then(() => {
      const el = this.querySelector<HTMLElement>(`[data-cell="${fresh.id}"] notatio-input`);
      el?.focus();
    });
  }

  #remove(id: number): void {
    if (this.#fixed || this._cells.find((c) => c.id === id)?.locked) return;
    const cells = this._cells.filter((c) => c.id !== id);
    this._cells = cells.length > 0 ? cells : [this.#cell()];
  }

  #patch(id: number, patch: Partial<Cell>): void {
    this._cells = this._cells.map((c) => (c.id === id ? { ...c, ...patch } : c));
  }

  /**
   * Move one axis of a control. This rewrites the *cell*, because the binding is the
   * value: there is nowhere else for it to live, and the cell has to keep showing what
   * the slider says. A complex binding is rewritten whole, so the part that did not
   * move is preserved.
   */
  #setControl(control: WorksheetControl, raw: string, commit = false): void {
    const v = Number(raw);
    if (!Number.isFinite(v)) return;
    const target = this._cells.find((c) => this._results[c.id]?.name === control.name);
    if (!target) return;
    const source = bindingSource(control, v, this.#integerNames.has(control.name));
    if (commit) {
      this.#live.delete(target.id);
      this.#patch(target.id, { value: source });
      return;
    }
    this.#live.set(target.id, source);
    this.#scheduleEvaluate();
  }

  /** The cells to evaluate: whatever a slider is currently driving, in place. */
  #cellsForPass(): Cell[] {
    if (this.#live.size === 0) return this._cells;
    return this._cells.map((c) => {
      const live = this.#live.get(c.id);
      return live === undefined ? c : { ...c, value: live };
    });
  }

  /** At most one pass per this many milliseconds. */
  static readonly PASS_INTERVAL_MS = 16;

  /**
   * Evaluate at most once per interval. A dragged slider emits input events faster than
   * a pass can run, and running one per event is what made the worksheet stop
   * responding rather than merely lag.
   *
   * On a timer rather than an animation frame, deliberately. Evaluating is not a
   * rendering concern, and a backgrounded tab suspends animation frames entirely — so
   * a worksheet nobody is looking at would never evaluate at all, and would still be
   * empty when its tab came back.
   */
  #scheduleEvaluate(): void {
    if (this.#evalTimer !== undefined) return;
    const since = performance.now() - this.#lastPassAt;
    const wait = Math.max(0, NotatioWorksheet.PASS_INTERVAL_MS - since);
    this.#evalTimer = setTimeout(() => {
      this.#evalTimer = undefined;
      this.#lastPassAt = performance.now();
      void this.#evaluate();
    }, wait);
  }

  /** Put every layer back to the framing its settings ask for. */
  #resetViews = (): void => {
    this._height = undefined;
    for (const el of this.querySelectorAll<HTMLElement & { resetView?: () => void }>("*")) {
      el.resetView?.();
    }
  };

  #addCell = (): void => {
    this.#insertAfter(this._cells[this._cells.length - 1]?.id ?? -1);
  };

  // --- sweeping a binding ------------------------------------------------------------

  /** Playback covers one step per this many milliseconds, whatever the frame rate. */
  static readonly PLAY_INTERVAL_MS = 120;

  // --- drag to reorder -----------------------------------------------------------------

  #onDragStart(id: number, event: DragEvent): void {
    this._dragId = id;
    event.dataTransfer?.setData("text/plain", String(id));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  }

  #onDragOver(id: number, event: DragEvent): void {
    if (this._dragId === undefined) return;
    event.preventDefault();
    this._dropId = id;
  }

  #onDrop(id: number, event: DragEvent): void {
    event.preventDefault();
    const dragId = this._dragId;
    this._dragId = undefined;
    this._dropId = undefined;
    if (dragId === undefined || dragId === id) return;
    const cells = [...this._cells];
    const from = cells.findIndex((c) => c.id === dragId);
    if (from < 0) return;
    const [moved] = cells.splice(from, 1);
    const to = cells.findIndex((c) => c.id === id);
    cells.splice(to < 0 ? cells.length : to, 0, moved);
    this._cells = cells;
  }

  #onDragEnd(): void {
    this._dragId = undefined;
    this._dropId = undefined;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#playback.stop();
    if (this.#evalTimer !== undefined) clearTimeout(this.#evalTimer);
    this.#evalTimer = undefined;
    this.#resize?.disconnect();
    this.#resize = undefined;
  }

  // --- evaluation ------------------------------------------------------------------

  /**
   * Run a pass, and survive one that goes wrong.
   *
   * Everything here used to be unguarded, and the method is called as
   * `void this.#evaluate()` — so a single throwing cell rejected the whole pass, no
   * state was ever written, and every *other* cell stopped updating with it. The
   * worksheet froze on its last good state and could not come back, because the next
   * pass hit the same cell again. A bad expression is an ordinary thing to type; it has
   * to cost only the cell it is in.
   */
  async #evaluate(): Promise<void> {
    try {
      await this.#runPass();
      this._fatal = "";
    } catch (err) {
      // The pass could not finish at all. Say so, and leave the last good render up
      // rather than blanking the worksheet.
      this._fatal = err instanceof Error ? err.message : String(err);
    }
  }

  async #runPass(): Promise<void> {
    const token = ++this.#evalToken;
    const engine = (this.#engine ??= await loadEngine());
    const convert = await loadMarkup();
    if (token !== this.#evalToken) return;

    const startedAt = performance.now();
    const passed = runPass(engine, this.#cellsForPass(), {
      rejectOrdinals: true, // a worksheet has no ordinals to reference
      markup: (latex) => {
        const hit = this.#markupCache.get(latex);
        if (hit !== undefined) return hit;
        const made = convert(latex);
        // Bound it: a swept parameter produces a new result every frame, and those
        // are exactly the ones least worth keeping.
        if (this.#markupCache.size > 256) this.#markupCache.clear();
        this.#markupCache.set(latex, made);
        return made;
      },
      errors: collectErrors,
    });
    if (token !== this.#evalToken) return;
    const afterPass = performance.now();

    const results: Record<number, CellResult> = {};
    const controls: WorksheetControl[] = [];
    const bound = new Set<string>();
    const settings = new Map<string, BoxedExpression>();
    for (const p of passed) {
      results[p.cell.id] = p.result;
      if (!p.result.name) continue;
      bound.add(p.result.name);
      const setting = settingName(p.result.name);
      // A setting is a binding like any other, so it gets its slider too -- which is
      // what makes the framing itself manipulable.
      if (setting !== undefined && p.value) settings.set(setting, p.value);
      const cell = this._cells.find((c) => c.id === p.cell.id);
      if (p.value) {
        controls.push(...controlsFor(p.result.name, p.value, cell?.range, cell?.integer));
        if (cell?.integer) this.#integerNames.add(p.result.name);
      }
    }

    // Drawables are worked out after every binding is known, so a cell over a slider
    // variable is free only in the axes it is actually plotted against.
    const draw: Drawable[] = [];
    const declined: Record<number, string> = {};
    for (const p of passed) {
      try {
        if (p.result.name !== undefined || p.result.status) continue;
        // A picture is drawn for what it is, not for what it is a function of, so it is
        // recognised from the value rather than from the variables left free.
        const uri = imageUri(p.value);
        if (uri !== undefined) {
          draw.push({ id: p.cell.id, kind: "image", source: uri, free: [] });
          continue;
        }
        // A list of points in space is a curve, for the same reason an image is a
        // picture: it is drawn for what it is, not for what it is a function of.
        const source = p.plot ?? p.value;
        const curve = p.value ? pointsOf(p.value) : [];
        if (curve.length >= 2 && source) {
          this.#pointCount[p.cell.id] = curve.length;
          draw.push({
            id: p.cell.id,
            kind: "curve3d",
            source: sourceOf(source),
            // Already evaluated here; handing the element the expression instead would
            // make it parse and sample the same curve a second time, every frame.
            points: curve,
            free: [],
          });
          continue;
        }
        if (!p.plot) continue;
        const free = freeVariables(p.plot, bound);
        const inferred = inferProjection(free);
        const chosen = p.cell.projection ?? inferred;
        if (chosen === "none") continue;
        if (!projectionFits(chosen, free)) {
          // Asked for a projection this cell cannot supply. Say so where it was asked
          // for, rather than leaving an empty screen and no account of why.
          declined[p.cell.id] = projectionReason(chosen, free);
          continue;
        }
        draw.push({ id: p.cell.id, kind: chosen, source: sourceOf(p.plot), free });
      } catch (err) {
        // Whatever this cell was going to draw, it cannot. That is this cell's problem
        // and nobody else's.
        declined[p.cell.id] = err instanceof Error ? err.message : String(err);
      }
    }

    const views: Record<string, SpaceView> = {};
    for (const d of draw) views[d.kind] ??= resolveView(d.kind, settings);
    log("pass", {
      ms: Math.round(performance.now() - startedAt),
      evalMs: Math.round(afterPass - startedAt),
      drawMs: Math.round(performance.now() - afterPass),
      cells: passed.length,
      drawn: draw.length,
    });

    this._results = results;
    this._declined = declined;
    this._controls = controls;
    this._draw = draw;
    this._views = views;
  }

  // --- rendering -------------------------------------------------------------------

  /**
   * A cell's diagnostic, placed where it came from: a cell that would not parse is a
   * problem with what was typed, so it sits under the input; anything else came out of
   * evaluating and sits under the result.
   */
  #diagnostic(cell: Cell, from: "input" | "output"): unknown {
    const declined = this._declined[cell.id];
    if (declined && from === "output") {
      return html`<div class="ws-diag">
        <span class="notatio-assert-diag">Missing — ${declined}</span>
      </div>`;
    }
    const r = this._results[cell.id];
    if (!r?.status) return "";
    const fromInput = r.status === "invalid";
    if ((from === "input") !== fromInput) return "";
    return html`<div class="ws-diag ${r.status === "error" ? "ws-diag-error" : ""}">
      <span class="notatio-assert-diag">${r.status === "error" ? "⚠ " : ""}${r.detail}</span>
    </div>`;
  }

  #outLine(cell: Cell): unknown {
    const r = this._results[cell.id];
    if (!cell.value.trim() || !r || r.status) return "";
    // A curve is hundreds of coordinates. Printing them says nothing a reader wants and
    // buries the cell; the picture below is the answer, so summarise and get out of the
    // way.
    const drawn = this._draw.find((d) => d.id === cell.id);
    if (drawn?.kind === "curve3d") {
      const count = this.#pointCount[cell.id] ?? 0;
      return html`<div class="ws-out">
        ${r.name ? html`<span class="ws-bind">${displayName(r.name)} =</span>` : ""}
        <span class="ws-elided">a curve through ${count} points</span>
      </div>`;
    }
    return html`<div class="ws-out">
      ${r.name ? html`<span class="ws-bind">${displayName(r.name)} =</span>` : ""}
      <span class="notatio-render">${unsafeHTML(r.markup)}</span>
    </div>`;
  }

  /** Edit one endpoint of a binding's range, keeping the rest as it was. */
  #setRange(cell: Cell, patch: ControlRange): void {
    this.#patch(cell.id, { range: { ...cell.range, ...patch } });
  }

  /**
   * The sliders a binding cell carries -- two if it is complex -- with its endpoints
   * shown and editable. The default range is a guess, so it has to be arguable with:
   * the number beside each end is an input, and typing in it pins that end.
   */
  #controlsFor(cell: Cell): unknown {
    const name = this._results[cell.id]?.name;
    const mine = name ? this._controls.filter((x) => x.name === name) : [];
    if (mine.length === 0) return "";
    const first = mine[0];
    return html`<div class="ws-knob">
      ${mine.map(
        (c) => html`<label class="ws-slider"
          >${mine.length > 1 ? html`<span class="ws-part">${c.part}</span>` : ""}<input
            type="range"
            min=${c.min}
            max=${c.max}
            step=${c.step}
            .value=${String(c.value)}
            @input=${(e: Event) => this.#setControl(c, (e.target as HTMLInputElement).value)}
            @change=${(e: Event) => this.#setControl(c, (e.target as HTMLInputElement).value, true)}
          /><span class="ws-slider-val">${formatValue(c.value, c.step)}</span></label
        >`,
      )}
      <div class="ws-bounds">
        <input
          type="number"
          class="ws-bound"
          title="Lower bound"
          aria-label="Lower bound"
          .value=${String(first.min)}
          @change=${(e: Event) =>
            this.#setRange(cell, { min: Number((e.target as HTMLInputElement).value) })}
        />
        <span class="ws-bound-sep">to</span>
        <input
          type="number"
          class="ws-bound"
          title="Upper bound"
          aria-label="Upper bound"
          .value=${String(first.max)}
          @change=${(e: Event) =>
            this.#setRange(cell, { max: Number((e.target as HTMLInputElement).value) })}
        />
        ${
          cell.range
            ? html`<button
                type="button"
                class="ws-bound-auto"
                title="Back to the default range"
                @click=${() => this.#patch(cell.id, { range: undefined })}
              >
                auto
              </button>`
            : ""
        }
      </div>
    </div>`;
  }

  /**
   * The gutter every cell carries. A drawable cell gets a visibility toggle shaped like
   * what it draws; a binding gets a play button; anything else gets a mark saying what
   * kind of row it is. Something in every gutter, as in Desmos -- the column reads as a
   * key to the rows even where nothing in it is clickable.
   */
  #gutter(cell: Cell, index: number, blank: boolean): unknown {
    // The ordinal a cell already has by sitting where it sits. Desmos shows it in the
    // same place, and it is what breaks ties in the drawing order, so putting it here
    // makes that order legible rather than mysterious.
    const ordinal = blank ? "" : String(index + 1);
    return html`<span class="ws-ordinal">${ordinal}</span>${this.#mark(cell)}`;
  }

  #mark(cell: Cell): unknown {
    const drawable = this._draw.find((x) => x.id === cell.id);
    const name = this._results[cell.id]?.name;
    const control = name ? this._controls.find((x) => x.name === name) : undefined;

    if (drawable) {
      const glyph = PROJECTION_GLYPH[drawable.kind] ?? PROJECTION_GLYPH.portrait;
      return html`<button
        type="button"
        class="ws-mark ws-toggle ${cell.hidden ? "ws-off" : ""}"
        title=${`${cell.hidden ? "Show" : "Hide"} this ${drawable.kind}`}
        aria-label=${`${cell.hidden ? "Show" : "Hide"} this ${drawable.kind}`}
        aria-pressed=${cell.hidden ? "false" : "true"}
        @click=${() => this.#patch(cell.id, { hidden: !cell.hidden })}
      >
        ${glyph}
      </button>`;
    }

    if (control) {
      const playing = this.#playback.has(control.name);
      const press = this.#playback.press(control.name);
      return html`<button
        type="button"
        class="ws-mark ws-play ${playing ? "ws-playing" : ""}"
        title=${playing ? `Stop ${control.name}` : `Sweep ${control.name}; hold for speed and loop`}
        aria-label=${playing ? `Stop ${control.name}` : `Sweep ${control.name}`}
        aria-pressed=${playing ? "true" : "false"}
        @pointerdown=${press.down}
        @pointerup=${press.up}
        @pointercancel=${press.cancel}
        @pointerleave=${press.cancel}
        @contextmenu=${press.contextmenu}
        @click=${(e: Event) => {
          if (!press.click(e)) this.#playback.toggle(control.name);
        }}
      >
        ${playing ? "⏸" : "▶"}
      </button>`;
    }

    const mark = name !== undefined ? "=" : cell.value.trim() ? "·" : "+";
    return html`<span class="ws-mark ws-static" aria-hidden="true">${mark}</span>`;
  }

  #screen(): unknown {
    // Every cell that *could* be drawn, not only those currently shown: hiding the last
    // visible one should leave an empty screen you can put something back into, not
    // take the screen away. A worksheet with nothing drawable at all has no screen.
    if (this._draw.length === 0) return "";
    const visible = this._draw.filter((d) => !this._cells.find((c) => c.id === d.id)?.hidden);
    const layers = stackLayers(visible, (d) => d.kind);
    const height = layers.length
      ? Math.max(...layers.map((l) => this._views[l.item.kind]?.height ?? 320))
      : 0;
    const side = this.#sideBySide();
    return html`<div class="ws-stage" data-side=${side ? "true" : "false"}>
      <div
        class="ws-screen"
        ?hidden=${this._collapsed}
        style=${`height:${this._collapsed ? 0 : (this._height ?? height)}px`}
      >
        ${repeat(
          layers,
          (l) => l.item.id,
          (l) => html`<div class="ws-layer" style=${`z-index:${l.z}`}>
            ${paneFor(l.item, this._views[l.item.kind])}
          </div>`,
        )}
      </div>
      ${
        this._collapsed
          ? ""
          : html`<div
              class="ws-grip"
              title="Drag to resize"
              role="separator"
              aria-label="Resize the screen"
              @pointerdown=${this.#onResize}
            ></div>`
      }
      <button
        type="button"
        class="ws-fold"
        title=${this._collapsed ? "Show the screen" : "Hide the screen"}
        aria-label=${this._collapsed ? "Show the screen" : "Hide the screen"}
        aria-expanded=${this._collapsed ? "false" : "true"}
        @click=${() => {
          this._collapsed = !this._collapsed;
        }}
      >
        ${foldGlyph(side, this._collapsed)}
      </button>
    </div>`;
  }

  /**
   * Drag the screen taller or shorter. Advisory, deliberately: a projection still asks
   * for the height it wants, and this only overrides it — so the same worksheet in a
   * narrower column, or with a different layer on top, is not stuck with a size that
   * was right somewhere else.
   */
  #onResize = (event: PointerEvent): void => {
    event.preventDefault();
    const grip = event.currentTarget as HTMLElement;
    const screen = this.querySelector<HTMLElement>(".ws-screen");
    if (!screen) return;
    const startY = event.clientY;
    const startHeight = screen.getBoundingClientRect().height;
    grip.setPointerCapture(event.pointerId);
    const move = (m: PointerEvent) => {
      this._height = Math.min(
        MAX_SCREEN_PX,
        Math.max(MIN_SCREEN_PX, startHeight + (m.clientY - startY)),
      );
    };
    const up = () => {
      grip.removeEventListener("pointermove", move);
      grip.removeEventListener("pointerup", up);
      grip.removeEventListener("pointercancel", up);
    };
    grip.addEventListener("pointermove", move);
    grip.addEventListener("pointerup", up);
    grip.addEventListener("pointercancel", up);
  };

  /** Is the screen beside the cells rather than below them? Matches the CSS breakpoint. */
  #sideBySide(): boolean {
    if (this.screen === "below") return false;
    if (this.screen === "side") return true;
    return this.#hostWidth >= SIDE_BY_SIDE_PX;
  }

  protected override render(): unknown {
    return html`<div class="notatio-worksheet" data-screen=${this.screen}>
      <div class="ws-toolbar">
        <button type="button" title="Reset every view" @click=${this.#resetViews}>⟲ reset</button>
        ${
          this.#fixed
            ? ""
            : html`<button type="button" title="Add a cell" @click=${this.#addCell}>+ cell</button>`
        }
        <span class="ws-toolbar-spacer"></span>
      </div>
      <div class="ws-body">
        <div class="ws-cells">
          ${
            this._seedError
              ? html`<div class="ws-diag ws-diag-error">
                  <span class="notatio-assert-diag">⚠ ${this._seedError}</span>
                </div>`
              : ""
          }
          ${repeat(
            this._cells,
            (cell) => cell.id,
            (cell, i) => {
              const blank = !cell.value.trim();
              return html`<div
                data-cell=${cell.id}
                class=${[
                  "ws-cell",
                  this._dragId === cell.id ? "ws-dragging" : "",
                  this._dropId === cell.id ? "ws-drop-before" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                @dragover=${(e: DragEvent) => this.#onDragOver(cell.id, e)}
                @drop=${(e: DragEvent) => this.#onDrop(cell.id, e)}
              >
                <div class="ws-in">
                  <span
                    class="ws-gutter"
                    draggable=${blank ? "false" : "true"}
                    title=${blank ? "" : "Drag to reorder"}
                    @dragstart=${(e: DragEvent) => this.#onDragStart(cell.id, e)}
                    @dragend=${() => this.#onDragEnd()}
                    >${this.#gutter(cell, i, blank)}</span
                  >
                  <notatio-input
                    .value=${cell.value}
                    .bind=${cell.bind ?? ""}
                    .domain=${cell.domain ?? ""}
                    @notatio-change=${(e: Event) => this.#onChange(cell.id, e)}
                    @keydown=${(e: KeyboardEvent) => this.#onKeyDown(cell.id, e)}
                  ></notatio-input>
                  <button
                    class="ws-mark ws-static"
                    title="Remove cell"
                    aria-label="Remove cell"
                    ?hidden=${this.#fixed || cell.locked || this._cells.length === 1}
                    @click=${() => this.#remove(cell.id)}
                  >
                    ✕
                  </button>
                </div>
                ${this.#diagnostic(cell, "input")} ${this.#controlsFor(cell)} ${this.#outLine(cell)}
                ${this.#diagnostic(cell, "output")}
              </div>`;
            },
          )}
        </div>
        ${this.#screen()}
      </div>
    </div>`;
  }
}

const log = debug("worksheet");

interface Drawable {
  id: number;
  kind: ProjectionKind;
  /** The cell's expression, as notatio the plot elements can re-parse. */
  source: string;
  /** For a curve, the points already evaluated, so the element need not resample. */
  points?: Point3[];
  free: string[];
}

/**
 * The mark a drawable's toggle wears: what it draws, not a generic eye. A reader
 * scanning the gutter can then tell a curve from a surface without reading the row.
 */
/**
 * A bound name as a reader should see it. A setting is the symbol `extent_sansserif`
 * internally; that spelling is an implementation detail of the namespace and has no
 * business on the page.
 */
const displayName = (name: string): string => settingName(name) ?? name;

/** The container width at which the screen moves beside the cells; matches the CSS. */
const SIDE_BY_SIDE_PX = 46 * 16;

/** How far a dragged screen may be taken. Below the first, nothing is legible. */
const MIN_SCREEN_PX = 120;
const MAX_SCREEN_PX = 1200;

/**
 * The fold control's arrow, pointing the way the screen will move. Beside the cells it
 * folds to the right, below them it folds up.
 */
const foldGlyph = (side: boolean, collapsed: boolean): string =>
  side ? (collapsed ? "\u25c2" : "\u25b8") : collapsed ? "\u25be" : "\u25b4";

const PROJECTION_GLYPH: Record<string, string> = {
  portrait: "▦",
  surface: "◳",
  curve: "∿",
  point: "•",
  image: "▣",
  curve3d: "◠",
};

/**
 * The expression a pane plots -- see `PassCell.plot` for why it is not evaluated.
 *
 * InputForm, not `toString`. A pane re-parses what it is handed, and compute-engine's
 * own rendering lowercases function names: given `sin(2x)` a pane parses the head
 * `sin`, which nothing knows, and draws an empty picture without complaining.
 * InputForm is notatio you could have typed, so it parses back to what it printed.
 */
function sourceOf(value: BoxedExpression): string {
  try {
    return toInputForm(value.json);
  } catch {
    return value.toString();
  }
}

function paneFor(d: Drawable, view: SpaceView | undefined): unknown {
  const v = view ?? {
    center: [0, 0] as [number, number],
    extent: 4,
    azimuth: 45,
    elevation: 30,
    height: 320,
  };
  const { x, y } = domainsOf(v);
  if (d.kind === "portrait") {
    // `.bare` as a property, not an attribute: a pane is built by Lit, so binding it
    // directly sidesteps attribute conversion entirely.
    return html`<notatio-complex-plot
      .value=${d.source}
      .bare=${true}
      center=${`${v.center[0]},${v.center[1]}`}
      extent=${v.extent}
      height=${v.height}
    ></notatio-complex-plot>`;
  }
  if (d.kind === "image") {
    return html`<img class="ws-image" src=${d.source} alt="" />`;
  }
  if (d.kind === "curve3d") {
    return html`<notatio-curve3d
      .value=${d.source}
      .points=${d.points}
      azimuth=${v.azimuth}
      elevation=${v.elevation}
    ></notatio-curve3d>`;
  }
  if (d.kind === "curve") {
    return html`<notatio-plot .value=${d.source} domain=${`${x[0]},${x[1]}`}></notatio-plot>`;
  }
  return html`<notatio-plot3d
    .value=${d.source}
    x-domain=${`${x[0]},${x[1]}`}
    y-domain=${`${y[0]},${y[1]}`}
    azimuth=${v.azimuth}
    elevation=${v.elevation}
  ></notatio-plot3d>`;
}

if (!customElements.get("notatio-worksheet")) {
  customElements.define("notatio-worksheet", NotatioWorksheet);
}
