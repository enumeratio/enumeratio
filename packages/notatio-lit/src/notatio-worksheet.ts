import type { BoxedExpression, ComputeEngine } from "@cortex-js/compute-engine";
import { html, LitElement, type PropertyValues } from "lit";
import { repeat } from "lit/directives/repeat.js";
import "./notatio-cell.ts";
import "./notatio-dynamic-module.ts";
import "./notatio-complex-plot.ts";
import "./notatio-plot.ts";
import "./notatio-plot-3d.ts";
import { imageUri } from "@enumeratio/formats";
import { toInputForm } from "@enumeratio/formats/inputform";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { pointsOf } from "./notatio-curve-3d.ts";
import { loadEngine } from "./mathlive.ts";
import { LONG_PRESS_MS } from "./choice-menu.ts";
import { openPlaybackMenu } from "./playback-menu.ts";
import { ensureStyles } from "./styles.ts";
import {
  bindingNotatio,
  type Cell,
  type ControlRange,
  controlsFor,
  domainsOf,
  formatValue,
  INTEGER_TYPES,
  inferProjection,
  type Loop,
  projectionFits,
  type ProjectionKind,
  projectionReason,
  resolveView,
  settingName,
  type SpaceView,
  stackLayers,
  type Triple,
  type WorksheetControl,
} from "@enumeratio/notatio";
import { SliderPlayback } from "./sweep.ts";

/**
 * `<notatio-worksheet>` -- a set of named expressions and a shared view of what they draw.
 *
 * Built on the same unified pieces `<notatio-notebook>` is: a reactive
 * `<notatio-dynamic-module tracked-symbols="all">` of `<notatio-cell>`s owns editing and
 * evaluation; this element owns the worksheet-specific chrome (add/remove, drag to
 * reorder, the gutter's marks) and the two things a worksheet adds on top:
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
 * The knob/projection inference is read off every cell's own `notatio-result` event --
 * `<notatio-cell>`'s `plot` option (`notatio-out.ts`) reports the input substituted but
 * not evaluated, and `elide-above` keeps a long curve from being typeset every frame.
 * A slider drives a cell through `<notatio-cell>`'s `liveValue` (a property, not
 * `value`): the Out re-evaluates on every frame, the editor field does not, which is
 * what keeps a drag from re-typesetting the very field being dragged.
 *
 * There is no cell history and no ordinals: every cell is defined by its name and
 * recomputed from its dependencies, the same reactive schedule `<notatio-notebook>`
 * uses -- which is what separates a worksheet from a plain transcript, whose sequential
 * mode is exactly the history this lacks.
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
    /** The seed's syntax: `notatio` (default) or `latex`. Cells are notatio internally. */
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
    _controls: { state: true },
    _draw: { state: true },
    _views: { state: true },
    _declined: { state: true },
    _collapsed: { state: true },
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
  declare _controls: WorksheetControl[];
  declare _draw: Drawable[];
  /** The resolved view per projection kind — see space.ts. */
  declare _views: Record<string, SpaceView>;
  /** Why a cell that asked to be drawn is not being drawn, by cell id. */
  declare _declined: Record<number, string>;
  /** Whether the screen is folded away. */
  declare _collapsed: boolean;
  /** A height the reader dragged to, overriding what the projections asked for. */
  declare _height: number | undefined;
  declare _seedError: string;
  declare _dragId: number | undefined;
  declare _dropId: number | undefined;

  #nextId = 1;
  /**
   * Cell sources a slider is driving right now, in notatio -- handed to the cell's own
   * `liveValue`, not `value`. `<notatio-cell>`'s own doc comment has the reason: `value`
   * feeds the editor field, and rewriting it on every drag frame is what measured
   * 11-31ms of synchronous MathLive relayout each, freezing the renderer outright. The
   * override is evaluated in the cell's place and written into `value` once, on release.
   */
  #live = new Map<number, string>();
  /** Per-cell facts read off its `notatio-result` event -- see `#onResult`. */
  #cellData = new Map<number, CellData>();
  /** `#cellData`'s evaluated JSON, boxed -- cached by JSON text, since a slider redraws
   * only the cell it drives; every OTHER cell's box is unchanged from the last pass. */
  #boxedCache = new Map<string, BoxedExpression | null>();
  #deriveTimer: ReturnType<typeof setTimeout> | undefined;
  #lastDeriveAt = 0;
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
    this._controls = [];
    this._draw = [];
    this._views = {};
    this._declined = {};
    this._collapsed = false;
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
    void loadEngine().then((engine) => {
      this.#engine = engine;
      this.#deriveState();
    });
  }

  /** `format` every cell reads its source in -- notatio unless the seed asked for LaTeX. */
  get #format(): "notatio" | "latex" {
    return this.inForm === "latex" ? "latex" : "notatio";
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
  }

  /**
   * Read the seed into cells, kept in notatio (`#format`'s syntax) -- the syntax every
   * `<notatio-cell>` below reads directly, so this is synchronous unless the seed itself
   * asked for `in-form="latex"`, which needs the engine to convert it once.
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
    if (this.inForm === "latex" && seeded.length > 0) {
      const engine = await loadEngine();
      seeded = seeded.map((cell) => {
        if (!cell.value.trim()) return cell;
        try {
          return { ...cell, value: toInputForm(engine.parse(cell.value, { form: "raw" }).json) };
        } catch {
          // Left as authored; the cell's own Out reports the parse error, same as any
          // other cell a reader mistypes.
          return cell;
        }
      });
    }
    this._cells = seeded.length > 0 ? seeded : [this.#cell()];
  }

  // --- editing ---------------------------------------------------------------------

  #onChange(id: number, event: Event): void {
    const notatio = (event as CustomEvent<{ notatio: string }>).detail.notatio;
    this.#live.delete(id);
    this._cells = this._cells.map((c) => (c.id === id ? { ...c, value: notatio } : c));
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
      const el = this.querySelector<HTMLElement>(
        `[data-cell="${fresh.id}"] notatio-cell notatio-in`,
      );
      el?.focus();
    });
  }

  #remove(id: number): void {
    if (this.#fixed || this._cells.find((c) => c.id === id)?.locked) return;
    this.#cellData.delete(id);
    this.#live.delete(id);
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
    const targetId = this.#cellIdFor(control.name);
    if (targetId === undefined) return;
    const source = bindingNotatio(control, v, this.#integerNames.has(control.name));
    if (commit) {
      this.#live.delete(targetId);
      this.#patch(targetId, { value: source });
      this.#notifyReactive(targetId, source);
      return;
    }
    this.#live.set(targetId, source);
    this.#scheduleRerender();
  }

  /** The cell currently bound to `name`, from the last pass's own facts. */
  #cellIdFor(name: string): number | undefined {
    for (const [id, data] of this.#cellData) if (data.name === name) return id;
    return undefined;
  }

  /**
   * Tell the reactive module a slider just committed `source` into cell `id`, the same
   * way a reader's own edit would: `<notatio-cell>`'s `value` PROPERTY changing (which
   * `#patch`, above, already did) only reloads that one cell's own display
   * (`notatio-cell.ts`'s `#load`) -- it does not fire `notatio-change`, which is the
   * only thing `<notatio-dynamic-module>`'s reactive graph listens for
   * (`reactive-module.ts`'s `commit`). Without this, a downstream cell reading the
   * slider's binding would keep showing what it read before the slider moved.
   */
  #notifyReactive(id: number, source: string): void {
    let json: unknown;
    try {
      json = parseNotatio(source, { allow: ["Assign"] }).json;
    } catch {
      return;
    }
    void this.updateComplete.then(() => {
      const el = this.querySelector<Element>(`[data-cell="${id}"] notatio-cell`);
      el?.dispatchEvent(
        new CustomEvent("notatio-change", {
          detail: { notatio: source, json },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  /** At most one re-render per this many milliseconds -- a dragged slider's own throttle. */
  static readonly PASS_INTERVAL_MS = 16;

  /**
   * Re-render at most once per interval. A dragged slider emits input events faster than
   * a frame can afford to redraw, and redrawing on every one is what made the worksheet
   * stop responding rather than merely lag.
   */
  #scheduleRerender(): void {
    if (this.#deriveTimer !== undefined) return;
    const since = performance.now() - this.#lastDeriveAt;
    const wait = Math.max(0, NotatioWorksheet.PASS_INTERVAL_MS - since);
    this.#deriveTimer = setTimeout(() => {
      this.#deriveTimer = undefined;
      this.#lastDeriveAt = performance.now();
      this.requestUpdate();
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
    if (this.#deriveTimer !== undefined) clearTimeout(this.#deriveTimer);
    this.#deriveTimer = undefined;
    this.#resize?.disconnect();
    this.#resize = undefined;
  }

  // --- reading the module's cells ----------------------------------------------------

  /**
   * A descendant `<notatio-cell>`'s Out reported a result -- the trigger this element
   * reacts to, the way `<notatio-notebook>`'s module reacts to `notatio-change`. Kept
   * per cell (`#cellData`), then folded into the controls/drawables every cell's facts
   * are worked out from together (`#deriveState`), throttled the same way a dragged
   * slider's own re-renders are.
   */
  #onResult = (event: Event): void => {
    const detail = (event as CustomEvent<ResultDetail>).detail;
    const cellEl = (event.target as Element | null)?.closest<HTMLElement>("[data-cell]");
    const id = cellEl ? Number(cellEl.dataset.cell) : Number.NaN;
    if (!Number.isFinite(id)) return;
    this.#cellData.set(id, {
      name: detail.name,
      jsonStr: detail.json ?? "",
      plotFree: detail.plot?.free,
      plotSource: detail.plot?.source,
    });
    this.#scheduleRerender();
    // A rerender alone would not re-run `#deriveState` (it only recomputes on a timer
    // tick, see `#scheduleRerender`); tie the two together here so `_controls`/`_draw`
    // catch up in the same throttle window as the redraw they feed.
    this.#deriveOnNextRerender = true;
  };

  #deriveOnNextRerender = false;

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (this.#deriveOnNextRerender) {
      this.#deriveOnNextRerender = false;
      this.#deriveState();
    }
  }

  /** `jsonStr`, boxed -- cached, since most cells are unchanged from the last pass. */
  #boxedFor(jsonStr: string): BoxedExpression | undefined {
    if (!this.#engine || !jsonStr) return undefined;
    const hit = this.#boxedCache.get(jsonStr);
    if (hit !== undefined) return hit ?? undefined;
    let value: BoxedExpression | null = null;
    try {
      value = this.#engine.box(JSON.parse(jsonStr));
    } catch {
      value = null;
    }
    if (this.#boxedCache.size > 256) this.#boxedCache.clear();
    this.#boxedCache.set(jsonStr, value);
    return value ?? undefined;
  }

  /**
   * Fold every cell's own facts (`#cellData`) into the shared state: which bindings get
   * a slider, which cells draw, and what view each projection resolves to. The
   * per-cell work (evaluating, typesetting) already happened inside that cell's own
   * `<notatio-out>`; this only reads it back.
   */
  #deriveState(): void {
    if (!this.#engine) return;
    const controls: WorksheetControl[] = [];
    const settings = new Map<string, BoxedExpression>();
    const draw: Drawable[] = [];
    const declined: Record<number, string> = {};

    for (const cell of this._cells) {
      const data = this.#cellData.get(cell.id);
      if (!data || !data.jsonStr) continue;
      const value = this.#boxedFor(data.jsonStr);
      if (data.name !== undefined) {
        if (!value) continue;
        const setting = settingName(data.name);
        if (setting !== undefined) settings.set(setting, value);
        controls.push(...controlsFor(data.name, value, cell.range, cell.integer));
        if (cell.integer) this.#integerNames.add(data.name);
        continue;
      }
      try {
        // A picture is drawn for what it is, not for what it is a function of, so it is
        // recognised from the value rather than from the variables left free.
        const uri = value ? imageUri(value) : undefined;
        if (uri !== undefined) {
          draw.push({ id: cell.id, kind: "image", source: uri, free: [] });
          continue;
        }
        // A list of points in space is a curve, for the same reason an image is a
        // picture: it is drawn for what it is, not for what it is a function of.
        const curve = value ? pointsOf(value) : [];
        if (curve.length >= 2 && data.plotSource) {
          this.#pointCount[cell.id] = curve.length;
          draw.push({
            id: cell.id,
            kind: "curve3d",
            source: data.plotSource,
            points: curve,
            free: [],
          });
          continue;
        }
        if (!data.plotSource) continue;
        const free = data.plotFree ?? [];
        const inferred = inferProjection(free);
        const chosen = cell.projection ?? inferred;
        if (chosen === "none") continue;
        if (!projectionFits(chosen, free)) {
          // Asked for a projection this cell cannot supply. Say so where it was asked
          // for, rather than leaving an empty screen and no account of why.
          declined[cell.id] = projectionReason(chosen, free);
          continue;
        }
        draw.push({ id: cell.id, kind: chosen, source: data.plotSource, free });
      } catch (err) {
        // Whatever this cell was going to draw, it cannot. That is this cell's problem
        // and nobody else's.
        declined[cell.id] = err instanceof Error ? err.message : String(err);
      }
    }

    const views: Record<string, SpaceView> = {};
    for (const d of draw) views[d.kind] ??= resolveView(d.kind, settings);

    this._declined = declined;
    this._controls = controls;
    this._draw = draw;
    this._views = views;
  }

  // --- rendering -------------------------------------------------------------------

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
    const name = this.#cellData.get(cell.id)?.name;
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

  #declinedDiag(cell: Cell): unknown {
    const declined = this._declined[cell.id];
    if (!declined) return "";
    return html`<div class="ws-diag">
      <span class="notatio-assert-diag">Missing — ${declined}</span>
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
    const name = this.#cellData.get(cell.id)?.name;
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
          <notatio-dynamic-module tracked-symbols="all" @notatio-result=${this.#onResult}>
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
                    <notatio-cell
                      .value=${cell.value}
                      format=${this.#format}
                      .bind=${cell.bind ?? ""}
                      .domain=${cell.domain ?? ""}
                      evaluate
                      elide-above="64"
                      plot
                      .liveValue=${this.#live.get(cell.id)}
                      @notatio-change=${(e: Event) => this.#onChange(cell.id, e)}
                      @keydown=${(e: KeyboardEvent) => this.#onKeyDown(cell.id, e)}
                    ></notatio-cell>
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
                  ${this.#declinedDiag(cell)} ${this.#controlsFor(cell)}
                </div>`;
              },
            )}
          </notatio-dynamic-module>
        </div>
        ${this.#screen()}
      </div>
    </div>`;
  }
}

interface Drawable {
  id: number;
  kind: ProjectionKind;
  /** The cell's expression, as notatio the plot elements can re-parse. */
  source: string;
  /** For a curve, the points already evaluated, so the element need not resample. */
  points?: Triple[];
  free: readonly string[];
}

/** One cell's facts, read off its own `notatio-result` event. */
interface CellData {
  /** The bound symbol, when the cell is an assignment. */
  name?: string;
  /** The evaluated result, as MathJSON text -- `""` for a blank or errored cell. */
  jsonStr: string;
  /** The names still free in the substituted-but-unevaluated input, when `plot` reported one. */
  plotFree?: readonly string[];
  /** That input's InputForm, for a pane to re-parse. */
  plotSource?: string;
}

/** The shape of `notatio-out`'s `notatio-result` event detail this element reads. */
interface ResultDetail {
  json?: string;
  name?: string;
  plot?: { source: string; free: readonly string[] };
}

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
  side ? (collapsed ? "◂" : "▸") : collapsed ? "▾" : "▴";

const PROJECTION_GLYPH: Record<string, string> = {
  portrait: "▦",
  surface: "◳",
  curve: "∿",
  point: "•",
  image: "▣",
  curve3d: "◠",
};

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
    return html`<notatio-curve-3d
      .value=${d.source}
      .points=${d.points}
      azimuth=${v.azimuth}
      elevation=${v.elevation}
    ></notatio-curve-3d>`;
  }
  if (d.kind === "curve") {
    return html`<notatio-plot .value=${d.source} domain=${`${x[0]},${x[1]}`}></notatio-plot>`;
  }
  return html`<notatio-plot-3d
    .value=${d.source}
    x-domain=${`${x[0]},${x[1]}`}
    y-domain=${`${y[0]},${y[1]}`}
    azimuth=${v.azimuth}
    elevation=${v.elevation}
  ></notatio-plot-3d>`;
}

if (!customElements.get("notatio-worksheet")) {
  customElements.define("notatio-worksheet", NotatioWorksheet);
}
