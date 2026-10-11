import type { Box } from "@enumeratio/boxes";
import {
  barBoxOfSettings,
  type Clock,
  curveBox,
  curveOptionsOf,
  debug,
  evalGridGPU,
  listBoxOfSettings,
  Orbit,
  ORBIT_HINT,
  pageClock,
  graphics3dHome,
  graphics3dOptionsOf,
  graphics3dSvg,
  gridAxis,
  gridSide,
  sampleGrids,
  surfaceDomains,
  surfaceBox,
  type Triple,
} from "@enumeratio/frontend/core";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { pointsOfJson } from "./curve-points.ts";
import { compilePlotText, numericValueOf, plotFunctions } from "./plot-kernel.ts";
import { ensureStyles } from "./styles.ts";

const log = debug("graphics-3d-box");

/** Degrees the view turns per tick of the spin. */
const SPIN_STEP = 1.5;
const SPIN_INTERVAL_MS = 50;

type Settings = Readonly<Record<string, string>>;

const on = (v: string | undefined): boolean => v !== undefined && v !== "" && v !== "false";

/**
 * `<graphics-3d-box value="Plot3D(Sin(x) * Cos(y), (x, -3, 3), (y, -3, 3))">` -- a figure in space, the
 * `Graphics3DBox` its expression lowers to. The element holds the expression (options and all, as a
 * 2-D plot does), the page's kernel samples it, and the samples lower to boxes that `graphics3dSvg` draws.
 * Drag rotates (`Azimuth`, `Elevation`), ⌘/Ctrl + wheel or a pinch zooms (`Zoom`), double-click returns to
 * the first view. Its wildcards (`_k`) are a surrounding Manipulate's controls, and moving one
 * samples the compiled code again.
 *
 * - `Plot3D(f, (x, a, b), (y, c, d))`: a surface, `f` a list for several on one scale. Hover reads
 *   out a sample. `Gpu -> True` (or a grid size) evaluates the grid in a WebGPU shader, falling back
 *   to the CPU; `Spin -> True` turns the view on its own; `N` is the grid per side (2 to 60).
 *   `PlotLegends -> True` draws a height key; `PlotLabel` titles it.
 * - `ListPlot3D(grid)` is a mesh of a height grid (or of `[x, y, z]` points, binned onto one),
 *   `Type -> "points"` a scatter, `Wireframe -> True` outlines only.
 * - `BarChart3D(matrix)` is bars, one row of a flat list; `Gap`, `ZRange`, `RowLabels`, `ColLabels`.
 * - `Graphics3D(Line(points), Closed -> True)` is a curve in space, `points` an expression the page
 *   evaluates (`KnotCurve(TorusKnot(2, 3))`). The nearer strand passes in front of the farther,
 *   color runs along the parameter, `Torus -> (2, 1)` draws the tube it lies on, `Clock -> True`
 *   sends a marker along it with the page's clock (`Phase -> 0.3` pins it), `Caption` sets a caption.
 *
 * Color is a gradient (`ColorFunction -> "Magma"`, default `viridis`; `sinebow` for a curve); several
 * surfaces are told apart by color instead.
 */
export class Graphics3DBoxElement extends LitElement {
  static properties = {
    /** The expression, in Epsil. */
    value: { type: String },
    /** A curve's points, already evaluated, in place of the expression's. */
    points: { attribute: false },
    /** A box to draw as it stands, in place of the expression. */
    box: { attribute: false },
    /** Values for the wildcards in `value`, set by a surrounding Manipulate. */
    bindings: { attribute: false },
    /** The view, which dragging changes; the expression's `Azimuth`, `Elevation` and `Zoom` start it. */
    azimuth: { type: Number },
    elevation: { type: Number },
    zoom: { type: Number },
    _svg: { state: true },
    _caption: { state: true },
    _hover: { state: true },
    _error: { state: true },
  };

  declare value: string;
  declare points: readonly Triple[] | undefined;
  declare box: Box | undefined;
  declare bindings: Readonly<Record<string, number>> | undefined;
  declare azimuth: number;
  declare elevation: number;
  declare zoom: number;
  declare _svg: string;
  declare _caption: string;
  declare _hover: [number, number] | undefined;
  declare _error: string;

  #orbit = new Orbit(this);
  #generation = 0;
  #figure: Box | undefined;
  #settings: Settings = {};
  #head = "";
  #usedGpu = false;
  #spinTimer: ReturnType<typeof setInterval> | undefined;
  #clock: Clock = pageClock();
  #unwatch: (() => void) | undefined;
  #phase = 0;
  #curve: readonly Triple[] = [];
  #homed = false;

  constructor() {
    super();
    this.value = "";
    this.points = undefined;
    this.box = undefined;
    this.bindings = undefined;
    this.azimuth = 45;
    this.elevation = 15;
    this.zoom = 1;
    this._svg = "";
    this._caption = "";
    this._hover = undefined;
    this._error = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#spin(false);
    this.#unwatch?.();
    this.#unwatch = undefined;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (changed.has("value") || changed.has("points") || changed.has("box") || changed.has("bindings")) {
      // A new expression has a new first view; a Manipulate moving a control keeps the one the reader turned to.
      if (changed.has("value") || changed.has("points") || changed.has("box")) this.#homed = false;
      void this.#recompute();
    } else if (changed.has("azimuth") || changed.has("elevation") || changed.has("zoom") || changed.has("_hover")) {
      this.#draw();
    }
  }

  /** The box the expression lowers to: sampled where it must be, lowered whole where it holds its data. */
  async #build(generation: number): Promise<Box | undefined> {
    if (this.box !== undefined) return this.box;
    const text = this.value.trim();
    if (!text) return undefined;
    const { graphics3dOfText } = await import("@enumeratio/frontend/symbols");
    const figure = graphics3dOfText(text);
    if (generation !== this.#generation || figure === undefined) return undefined;
    this.#settings = figure.settings;
    const head = Array.isArray(figure.json) ? String(figure.json[0]) : "";
    this.#head = head;
    // A host that has evaluated the curve already hands over its points, so they are not evaluated twice.
    if (this.points !== undefined && this.points.length >= 2) {
      this.#curve = this.points;
      return this.#curveBox();
    }
    switch (head) {
      case "ListPlot3D":
        return listBoxOfSettings(figure.settings);
      case "BarChart3D":
        return barBoxOfSettings(figure.settings);
      case "Graphics3D":
        return this.#evaluateCurve(figure.settings, generation);
      default:
        return this.#sample(figure.settings, generation);
    }
  }

  async #recompute(): Promise<void> {
    const generation = ++this.#generation;
    try {
      const figure = await this.#build(generation);
      if (generation !== this.#generation) return;
      this._error = "";
      this.#figure = figure;
      if (figure !== undefined && !this.#homed) {
        // The expression's own view is where the view starts, and where a double-click returns to.
        const home = graphics3dHome(figure);
        this.azimuth = home.azimuth;
        this.elevation = home.elevation;
        this.zoom = home.zoom;
        this.#orbit.rehome();
        this.#homed = true;
        if (on(this.#settings["spin"])) this.#spin(true);
      }
      this._caption = this.#settings["caption"] ?? "";
      this.#draw();
    } catch (error) {
      if (generation !== this.#generation) return;
      log("could not draw", this.value, error);
      this.#figure = undefined;
      this._svg = "";
      this._error = error instanceof Error ? error.message : String(error);
    }
  }

  /** A surface: the grid sampled on the CPU by compiled code, or on the GPU where asked and available. */
  async #sample(settings: Settings, generation: number): Promise<Box | undefined> {
    const raw = settings["value"]?.trim();
    if (!raw) return undefined;
    // A list of expressions overlays several surfaces on a shared scale.
    const loaded = await plotFunctions(raw, { each: true });
    if (generation !== this.#generation) return undefined;
    const { plot, samplers } = loaded;
    // A Manipulate's controls fill the wildcard slots (`_k`); the surface variables are the two free
    // symbols that remain.
    const scope = loaded.scope();
    Object.assign(scope, this.bindings);
    const free = plot.unknowns.filter((u) => !u.startsWith("_"));
    const vx = settings["xvar"] || free[0] || "x";
    const vy = settings["yvar"] || free.find((u) => u !== vx) || "y";
    const [[xlo, xhi], [ylo, yhi]] = surfaceDomains(settings);
    const size = gridSide(settings);
    let xs = gridAxis(xlo, xhi, size);
    let ys = gridAxis(ylo, yhi, size);
    let grids: number[][][] | undefined;
    // The GPU path compiles every surface to WGSL and evaluates the grid in parallel; WGSL has no
    // scope, so the wildcards' values are compiled in. It takes a denser grid (`Gpu -> 120`).
    if (on(settings["gpu"])) {
      const dense = Math.max(2, Math.min(400, Number(settings["gpu"]) || size));
      const gxs = gridAxis(xlo, xhi, dense);
      const gys = gridAxis(ylo, yhi, dense);
      const bound: Record<string, number> = {};
      for (const u of plot.unknowns) if (u.startsWith("_") && typeof scope[u] === "number") bound[u] = scope[u];
      const wgsl = await compilePlotText(raw, { target: "wgsl", vars: [vx, vy], each: true, bindings: bound });
      if (generation !== this.#generation) return undefined;
      const results = await Promise.all(
        wgsl.items.map((item) => (item.code ? evalGridGPU(item.code, gxs, gys) : Promise.resolve(undefined))),
      );
      if (results.length > 0 && results.every((g): g is number[][] => g !== undefined)) {
        grids = results;
        [xs, ys] = [gxs, gys];
      }
    }
    this.#usedGpu = grids !== undefined;
    // Each surface is code the kernel compiled, sampled per grid point: orders of magnitude faster
    // than a substitution and an evaluation each, which keeps a Manipulate's slider smooth.
    grids ??= sampleGrids(plot.items.length, xs, ys, (k, x, y) => {
      scope[vx] = x;
      scope[vy] = y;
      return samplers[k]!(scope);
    });
    return surfaceBox(grids, xs, ys, graphics3dOptionsOf(settings));
  }

  /** A curve: its expression evaluated to a list of points. */
  async #evaluateCurve(settings: Settings, generation: number): Promise<Box | undefined> {
    const source = settings["value"]?.trim();
    if (!source) return undefined;
    const points = pointsOfJson(await numericValueOf(source));
    if (generation !== this.#generation) return undefined;
    if (points.length < 2) throw new Error(`not a list of points: ${source}`);
    this.#curve = points;
    // Only a figure that asked for a marker watches the clock: an animated dot on every knot on a
    // site is not what a page that wanted none asked for.
    this.#unwatch?.();
    this.#unwatch = undefined;
    if (on(settings["clock"]) && !Number.isFinite(Number(settings["phase"])))
      this.#unwatch = this.#clock.watch((tick) => {
        this.#phase = tick.phase;
        this.#figure = this.#curveBox();
        this.#draw();
      });
    return this.#curveBox();
  }

  #curveBox(): Box {
    const pinned = Number(this.#settings["phase"]);
    return curveBox(this.#curve, {
      ...curveOptionsOf(this.#settings),
      marker:
        Number.isFinite(pinned) && this.#settings["phase"] !== undefined
          ? pinned
          : on(this.#settings["clock"])
            ? this.#phase
            : undefined,
    });
  }

  #draw(): void {
    if (this.#figure === undefined) return;
    this._svg = graphics3dSvg(this.#figure, {
      azimuth: Number(this.azimuth),
      elevation: Number(this.elevation),
      zoom: Number(this.zoom),
      ...(this._hover && { hover: this._hover }),
    });
  }

  #spin(running: boolean): void {
    if (running && !this.#spinTimer) {
      this.#spinTimer = setInterval(() => {
        this.azimuth = (Number(this.azimuth) + SPIN_STEP) % 360;
      }, SPIN_INTERVAL_MS);
    } else if (!running && this.#spinTimer) {
      clearInterval(this.#spinTimer);
      this.#spinTimer = undefined;
    }
    this.requestUpdate();
  }

  // Map a pointer event to the viewBox coordinates of the figure's SVG.
  #toViewBox(e: PointerEvent): [number, number] | undefined {
    const svg = this.querySelector("svg");
    if (!svg) return undefined;
    const rect = svg.getBoundingClientRect();
    const [, , vw, vh] = (svg.getAttribute("viewBox") ?? "0 0 360 260").split(" ").map(Number);
    return [((e.clientX - rect.left) / (rect.width || 1)) * vw!, ((e.clientY - rect.top) / (rect.height || 1)) * vh!];
  }

  #onPointerMove = (e: PointerEvent): void => {
    this.#orbit.onPointerMove(e);
    // Not dragging: read out the nearest sample under the pointer.
    if (!this.#orbit.dragging) this._hover = this.#toViewBox(e);
  };

  #toolbar(): unknown {
    if (this.#head !== "Plot3D") return nothing;
    return html`<div class="notatio-toolbar">
      <button
        type="button"
        class="notatio-spin ${this.#spinTimer ? "is-on" : ""}"
        aria-pressed=${this.#spinTimer ? "true" : "false"}
        title="auto-rotate"
        aria-label="auto-rotate"
        @click=${() => this.#spin(!this.#spinTimer)}
      >
        ⟳
      </button>
      ${this.#usedGpu ? html`<span class="graphics-3d-box-badge" title="grid evaluated on the GPU">GPU</span>` : nothing}
    </div>`;
  }

  protected override render(): unknown {
    const view = html`<span
      class="graphics-3d-box-view"
      @pointerdown=${this.#orbit.onPointerDown}
      @pointermove=${this.#onPointerMove}
      @pointerup=${this.#orbit.onPointerUp}
      @pointercancel=${this.#orbit.onPointerUp}
      @pointerleave=${() => (this._hover = undefined)}
      @dblclick=${this.#orbit.onDblClick}
      @wheel=${this.#orbit.onWheel}
      tabindex="0"
      title=${ORBIT_HINT}
      >${this._error ? html`<span class="notatio-error">${this._error}</span>` : unsafeHTML(this._svg)}</span
    >`;
    if (this._caption)
      return html`<figure class="graphics-3d-box-figure">
        ${view}
        <figcaption>${this._caption}</figcaption>
      </figure>`;
    return html`${view}${this.#toolbar()}`;
  }
}

if (!customElements.get("graphics-3d-box")) {
  customElements.define("graphics-3d-box", Graphics3DBoxElement);
}
