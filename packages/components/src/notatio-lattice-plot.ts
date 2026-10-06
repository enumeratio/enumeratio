import { html, LitElement, nothing, type PropertyValues } from "lit";
import {
  type BandMode,
  clampLatticeView,
  coloringOf,
  drawLattice,
  gradientCss,
  handleAt,
  type LatticeCaptionPart,
  type LatticeControl,
  type LatticeDescription,
  type LatticeLayer,
  type LatticeView,
  latticeCategoryColors,
  maxExtentFor,
  nearestLatticePoint,
  type Palette,
  parseNumeric,
  resolvePalette,
  type Vec2,
  wheelZooms,
} from "@enumeratio/frontend/core";
import {
  type FramePlacement,
  figureFrame,
  isVertical,
  type LegendEntry,
  legendTemplate,
  placementOf,
} from "./figure-frame.ts";
import "./notatio-palette.ts";
import type { PaletteSetting } from "./notatio-palette.ts";
import { ensureStyles } from "./styles.ts";

/** Points a view may hold before zooming out stops; `max-cells` raises it, up to HARD_MAX_CELLS. */
const DEFAULT_MAX_CELLS = 120_000;
/** The ceiling "show more" can reach: past it a frame's tiles outgrow a canvas path. */
const HARD_MAX_CELLS = 2_000_000;
/** Milliseconds a frame spends computing new points before it draws what it has. */
const FRAME_BUDGET = 12;
/** Pointer travel (CSS px) below which a press is a click, not a drag. */
const SLOP = 4;
/** Legend entries shown before the rest are counted. */
const LEGEND_LIMIT = 16;
/** Fields the random button picks from: |d| up to this. */
const RANDOM_RANGE = 400;
/** The band when neither `band` nor the grid sets one. */
const DEFAULT_BAND = 10;

type Layer = LatticeLayer;

/** The layers a plot can draw, each loaded when first asked for. */
const LAYERS: Record<string, () => Promise<(plot: NotatioLatticePlot) => Layer | string>> = {
  primes: async () => {
    const { quadraticLattice } = await import("@enumeratio/number-theory/lattice");
    return (plot) => {
      const d = plot.d;
      if (d === undefined) return `Not a quadratic field: ${plot.ring}`;
      return (
        quadraticLattice(d, { scale: plot.scale === "geometric" ? "geometric" : "uniform" }) ??
        `ℚ(√${d}) is not a quadratic field: ${d} is a square.`
      );
    };
  },
  radix: async () => {
    const { radixLattice } = await import("@enumeratio/complex-numerals/lattice");
    return (plot) =>
      radixLattice({
        ...(plot.example ? { example: plot.example } : {}),
        ...(plot.code ? { code: plot.code } : {}),
        ...(plot.system === "i" || plot.system === "ω" ? { system: plot.system } : {}),
        ...(plot.base ? { base: plot.base } : {}),
        ...(plot.digits ? { digits: plot.digits } : {}),
        ...(Number(plot.maxLength) > 0 ? { maxLength: Number(plot.maxLength) } : {}),
        ...(plot.colorBy ? { colorBy: plot.colorBy } : {}),
        ...(plot.unlocked ? { locked: false } : {}),
      });
  },
};

/** `-5`, `QuadraticIntegers(-5)`, `GaussianIntegers` or `EisensteinIntegers` to d. */
export function ringParameter(ring: string): number | undefined {
  const text = ring.trim().replace(/−/g, "-");
  if (/^GaussianIntegers$/.test(text)) return -1;
  if (/^EisensteinIntegers$/.test(text)) return -3;
  const match = /^(?:QuadraticIntegers\(\s*)?(-?\d+)\s*\)?$/.exec(text);
  return match ? Number(match[1]) : undefined;
}

const pair = (text: string | undefined): Vec2 | undefined => {
  if (!text) return undefined;
  const [a, b] = text
    .replace(/^\s*[[({]|[\])}]\s*$/g, "")
    .split(",")
    .map(parseNumeric);
  return Number.isFinite(a) && Number.isFinite(b) ? [a!, b!] : undefined;
};

const trimNumber = (x: number): string => String(Math.round(x * 1000) / 1000);

/**
 * `<notatio-lattice-plot ring="-5">` -- a lattice of tiles, one per point, painted by a layer:
 *
 * - `layer="primes"` (the default): the ring of integers of ℚ(√d), squares for ℤ[√d] and
 *   hexagons when d ≡ 1 (mod 4). Primes take the gradient by √|N|; irreducibles that are not
 *   prime, units and zero take discrete colors chosen far from the gradient.
 * - `layer="radix"`: numbers written in a complex base, from `@enumeratio/complex-numerals` —
 *   `example`, `code`, or `system`, `base`, `digits`, `max-length`, `unlocked`; the base and
 *   digits are handles to drag.
 *
 * Color comes in three parts: `palette` names a ground, a gradient and a discrete scheme, and
 * `gradient`, `reverse`, `ground` and `discrete` override them one at a time. A value meets the
 * gradient through its band: the gradient runs from its first stop at 0 to its last at `band`
 * (default: the grid step), then back, by `band-mode` (`reflect`, the default; `wrap`; `clamp`).
 *
 * The caption and legend each take a placement — `below`, `above`, `left`, `right`, a corner
 * (`top-left` …) to overlay the plot, or `none`. Drag to pan; scroll to zoom once clicked, or
 * ⌘/Ctrl+scroll; zooming out stops
 * at `max-cells` points, with an offer of more up to a hard ceiling.
 *
 * ```html
 * <notatio-lattice-plot ring="QuadraticIntegers(-5)" palette="dusk" grid="10" />
 * <notatio-lattice-plot layer="radix" example="twindragon" legend="right" />
 * ```
 */
export class NotatioLatticePlot extends LitElement {
  static properties = {
    /** The field, for `primes`: d, `QuadraticIntegers(d)`, `GaussianIntegers` or `EisensteinIntegers`. */
    ring: { type: String, reflect: true },
    /** `primes` (the default) or `radix`. */
    layer: { type: String },
    /** Radix: a notable system by id (`twindragon`, `gosper-island` …), or a favorite. */
    example: { type: String },
    /** Radix: a settings sentence, `base -1+i with digits 0, and 1 color by 1st`. */
    code: { type: String },
    /** Radix: `i` or `ω`. */
    system: { type: String },
    /** Radix: the base, `-1+i`. */
    base: { type: String },
    /** Radix: the digits, comma-separated. */
    digits: { type: String },
    maxLength: { type: Number, attribute: "max-length" },
    /** Radix: base and digits anywhere in the plane, not only on lattice points. */
    unlocked: { type: Boolean },
    /** A ground, gradient and discrete scheme by one name. */
    palette: { type: String, reflect: true },
    gradient: { type: String, reflect: true },
    reverse: { type: Boolean, reflect: true },
    ground: { type: String },
    discrete: { type: String },
    /** The value between the gradient's two ends; default the grid step. */
    band: { type: Number, reflect: true },
    bandMode: { type: String, attribute: "band-mode", reflect: true },
    /** Which of the layer's colorings paints the tiles. */
    colorBy: { type: String, attribute: "color-by", reflect: true },
    /** What to highlight about the selected point: one of the layer's modes, or `off`. */
    highlight: { type: String, reflect: true },
    /** Grid spacing, in multiples of the grid's generators; 0 hides the grid lines. */
    grid: { type: Number, reflect: true },
    /** Draw the axes and their labels; on by default, whether or not the grid is. */
    axes: { type: Boolean, reflect: true },
    /** `uniform` (square or regular-hexagon tiles) or `geometric` (the true embedding). */
    scale: { type: String, reflect: true },
    /** Fraction of each cell its tile fills. */
    fill: { type: Number },
    transparent: { type: Boolean },
    /** Cycle the gradient. */
    flow: { type: Boolean },
    center: { type: String },
    /** Half-height of the view, in the plane's units; absent, the layer's own framing. */
    extent: { type: Number },
    height: { type: Number },
    maxCells: { type: Number, attribute: "max-cells" },
    /** Where the caption goes: `below` (default), `above`, `left`, `right`, a corner, `none`. */
    caption: { type: String, reflect: true },
    /** Where the legend goes; default `below`, or `right` for a coloring with many categories. */
    legend: { type: String, reflect: true },
    /** Hide the toolbar, for a figure that only shows. */
    bare: { type: Boolean },
    /** Show the field stepper and random button. */
    sweep: { type: Boolean },
    /** The selected point, `i,j`. */
    selected: { type: String, reflect: true },
    _layer: { state: true },
    _info: { state: true },
    _limited: { state: true },
    _status: { state: true },
    _drawn: { state: true },
    _revision: { state: true },
  };

  declare ring: string;
  declare layer: string;
  declare example: string;
  declare code: string;
  declare system: string;
  declare base: string;
  declare digits: string;
  declare maxLength: number;
  declare unlocked: boolean;
  declare palette: string;
  declare gradient: string;
  declare reverse: boolean;
  declare ground: string;
  declare discrete: string;
  declare band: number;
  declare bandMode: string;
  declare colorBy: string;
  declare highlight: string;
  declare grid: number;
  declare axes: boolean;
  declare scale: string;
  declare fill: number;
  declare transparent: boolean;
  declare flow: boolean;
  declare center: string;
  declare extent: number;
  declare height: number;
  declare maxCells: number;
  declare caption: string;
  declare legend: string;
  declare bare: boolean;
  declare sweep: boolean;
  declare selected: string;
  declare _layer: Layer | undefined;
  declare _info: LatticeDescription | undefined;
  declare _limited: boolean;
  declare _status: string;
  /** The category codes on screen, sorted and joined, so the legend redraws only when they change. */
  declare _drawn: string;
  /** Bumped when the layer changes itself (a control, a handle), so the frame re-renders. */
  declare _revision: number;

  #canvas: HTMLCanvasElement | undefined;
  #ctx: CanvasRenderingContext2D | null = null;
  #view: LatticeView = { center: [0, 0], extent: 24 };
  #w = 2;
  #h = 2;
  #queued = false;
  #phase = 0;
  #lastFrame = 0;
  #ro: ResizeObserver | undefined;
  #build = 0;
  /** Whether the first layer has framed the view; later rebuilds (a new field) keep it. */
  #framed = false;

  constructor() {
    super();
    this.ring = "-1";
    this.layer = "primes";
    this.example = "";
    this.code = "";
    this.system = "";
    this.base = "";
    this.digits = "";
    this.maxLength = 0;
    this.unlocked = false;
    this.palette = "dusk";
    this.gradient = "";
    this.reverse = false;
    this.ground = "";
    this.discrete = "";
    this.band = Number.NaN;
    this.bandMode = "";
    this.colorBy = "";
    this.highlight = "";
    this.grid = 10;
    this.axes = true;
    this.scale = "uniform";
    this.fill = 0.86;
    this.transparent = false;
    this.flow = false;
    this.center = "";
    this.extent = Number.NaN;
    this.height = 480;
    this.maxCells = DEFAULT_MAX_CELLS;
    this.caption = "below";
    this.legend = "";
    this.bare = false;
    this.sweep = false;
    this.selected = "";
    this._layer = undefined;
    this._info = undefined;
    this._limited = false;
    this._status = "";
    this._drawn = "";
    this._revision = 0;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override firstUpdated(): void {
    this.#ro = new ResizeObserver(() => this.#resize());
    this.#adoptCanvas();
    this.#readView();
    void this.#rebuild();
  }

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("click", this.#onPageClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener("click", this.#onPageClick);
    this.#ro?.disconnect();
    this.#ro = undefined;
  }

  /**
   * Prose can drive the plot: a click on `[data-lattice-target="<this id>"]` applies its
   * `data-lattice-control` = `data-lattice-value` (`example` = `gosper-island`), or sets the
   * attribute `data-lattice-attribute` to the value, and brings the plot into view.
   */
  #onPageClick = (e: MouseEvent): void => {
    const link = (e.target as Element | null)?.closest?.("[data-lattice-target]");
    if (!link || !this.id || link.getAttribute("data-lattice-target") !== this.id) return;
    e.preventDefault();
    const value = link.getAttribute("data-lattice-value") ?? "";
    const control = link.getAttribute("data-lattice-control");
    const attribute = link.getAttribute("data-lattice-attribute");
    if (control) this.#setControl(control, value);
    else if (attribute) this.setAttribute(attribute, value);
    this.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  /** The frame re-renders its canvas when its layout changes: pick up whichever is current. */
  #adoptCanvas(): void {
    const canvas = this.querySelector<HTMLCanvasElement>(".notatio-frame-stage canvas") ?? undefined;
    if (!canvas || canvas === this.#canvas) return;
    this.#ro?.disconnect();
    this.#canvas = canvas;
    this.#ctx = canvas.getContext("2d");
    this.#ro?.observe(canvas);
    this.#resize();
  }

  protected override updated(changed: PropertyValues): void {
    this.#adoptCanvas();
    const rebuild = [
      "ring",
      "layer",
      "example",
      "code",
      "system",
      "base",
      "digits",
      "maxLength",
      "unlocked",
      "scale",
    ].some((k) => changed.has(k));
    if (changed.has("center") || changed.has("extent")) this.#readView();
    if (rebuild && this.#canvas && changed.size > 0 && this.#framed) {
      void this.#rebuild();
      return;
    }
    if (changed.has("selected")) this.#describe();
    if (changed.has("flow") && this.flow) this.#lastFrame = performance.now();
    this.#draw();
  }

  /** The field this plot draws, d. */
  get d(): number | undefined {
    return ringParameter(this.ring);
  }

  get #palette(): Palette {
    return resolvePalette({
      palette: this.palette,
      gradient: this.gradient || undefined,
      ground: this.ground || undefined,
      discrete: this.discrete || undefined,
      reverse: this.reverse,
    });
  }

  /** The band in use: the attribute, else the grid step, else DEFAULT_BAND. */
  get #band(): number {
    const band = Number(this.band);
    if (Number.isFinite(band) && band > 0) return band;
    const grid = Number(this.grid);
    return Number.isFinite(grid) && grid > 0 ? grid : DEFAULT_BAND;
  }

  get #bandMode(): BandMode | undefined {
    return this.bandMode === "reflect" || this.bandMode === "wrap" || this.bandMode === "clamp"
      ? this.bandMode
      : undefined;
  }

  async #rebuild(): Promise<void> {
    const build = ++this.#build;
    const loader = LAYERS[this.layer || "primes"];
    if (!loader) {
      this._status = `No lattice layer called ${this.layer}`;
      return;
    }
    const make = await loader();
    if (build !== this.#build) return;
    const layer = make(this);
    if (typeof layer === "string") {
      this._status = layer;
      this._layer = undefined;
      return;
    }
    this._status = "";
    this._layer = layer;
    if (!layer.colorings.some((c) => c.id === this.colorBy)) {
      // A layer may prefer a coloring of its own: a radix example names one in its settings.
      const preferred = (layer as { settings?: { colorBy?: string } }).settings?.colorBy;
      this.colorBy = layer.colorings.some((c) => c.id === preferred) ? preferred! : layer.colorings[0]!.id;
    }
    if (!this.highlight || (this.highlight !== "off" && !layer.highlightModes.some((m) => m.id === this.highlight))) {
      this.highlight = layer.highlightModes[0]?.id ?? "off";
    }
    if (!this.#framed) this.#readView();
    this.#framed = true;
    this.#clamp();
    this.#describe();
    this.#draw();
  }

  #readView(): void {
    // A framework may set the property from markup as a string ("40"), not through the attribute.
    const extent = Number(this.extent);
    const home = this._layer?.home?.();
    this.#view = {
      center: pair(String(this.center)) ?? home?.center ?? [0, 0],
      extent: Number.isFinite(extent) && extent > 0 ? extent : (home?.extent ?? 24),
    };
    this.#clamp();
  }

  #budget(): number {
    return Math.min(HARD_MAX_CELLS, Math.max(1_000, Number(this.maxCells) || DEFAULT_MAX_CELLS));
  }

  /** Hold the view to the layer's range and the cell budget; note when the budget is what stopped it. */
  #clamp(wanted?: number): void {
    const layer = this._layer;
    if (!layer) return;
    if (layer.kind === "points") {
      this._limited = false;
      return;
    }
    const aspect = this.#w / this.#h;
    this.#view = clampLatticeView(layer, this.#view, aspect, this.#budget());
    const ceiling = maxExtentFor(layer.basis, aspect, this.#budget());
    this._limited = (wanted ?? this.#view.extent) >= ceiling * 0.999;
  }

  #resize(): void {
    const canvas = this.#canvas;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.#w = Math.max(2, Math.round(canvas.clientWidth * dpr));
    this.#h = Math.max(2, Math.round(canvas.clientHeight * dpr));
    canvas.width = this.#w;
    canvas.height = this.#h;
    this.#clamp();
    this.#drawNow();
  }

  #selectedPoint(): Vec2 | undefined {
    return pair(this.selected);
  }

  #drawNow = (): void => {
    this.#queued = false;
    const layer = this._layer;
    const ctx = this.#ctx;
    if (!layer || !ctx) return;
    if (this.flow) {
      const now = performance.now();
      this.#phase = (this.#phase + (now - this.#lastFrame) / 9000) % 2;
      this.#lastFrame = now;
    }
    const selected = this.#selectedPoint();
    const { complete, codes } = drawLattice(ctx, this.#w, this.#h, layer, this.#view, {
      palette: this.#palette,
      coloring: this.colorBy,
      gridStep: Math.max(0, Number(this.grid) || 0),
      axes: this.axes !== false && String(this.axes) !== "false",
      fill: Math.min(1, Math.max(0.2, Number(this.fill) || 0.86)),
      transparent: this.transparent,
      band: this.#band,
      ...(this.#bandMode ? { bandMode: this.#bandMode } : {}),
      phase: this.#phase,
      ...(selected ? { selected } : {}),
      ...(this.highlight && this.highlight !== "off" ? { highlight: this.highlight } : {}),
      handles: layer.handles !== undefined,
      budgetMs: FRAME_BUDGET,
    });
    if (complete) {
      const drawn = [...codes].toSorted((a, b) => a - b).join();
      if (drawn !== this._drawn) this._drawn = drawn;
    }
    if (!complete || this.flow) this.#draw();
  };

  #draw = (): void => {
    if (this.#queued) return;
    this.#queued = true;
    requestAnimationFrame(() => {
      if (this.#queued) this.#drawNow();
    });
  };

  #emit(name: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
  }

  #emitView(): void {
    this.#emit("notatio-view-change", { center: this.#view.center, extent: this.#view.extent });
  }

  #describe(): void {
    const layer = this._layer;
    const point = this.#selectedPoint();
    this._info = layer && point ? layer.describe(point[0], point[1]) : undefined;
  }

  /** The layer changed itself: redraw, and re-render what describes it. */
  #changed(): void {
    this.#describe();
    this._revision++;
    this.#drawNow();
  }

  /** The plane point under a client position. */
  #planeAt(clientX: number, clientY: number): Vec2 {
    const r = this.#canvas!.getBoundingClientRect();
    const ux = (clientX - r.left) / r.width - 0.5;
    const uy = 0.5 - (clientY - r.top) / r.height;
    const aspect = this.#w / this.#h;
    return [
      this.#view.center[0] + 2 * ux * this.#view.extent * aspect,
      this.#view.center[1] + 2 * uy * this.#view.extent,
    ];
  }

  /** The point a plane position picks: the nearest lattice point, or the nearest of a point layer's. */
  #pick(layer: Layer, p: Vec2): Vec2 | undefined {
    if (layer.kind !== "points") return nearestLatticePoint(layer.basis, p);
    const points = layer.points?.() ?? [];
    let [best, distance] = [-1, Infinity];
    for (let k = 0; k < points.length; k++) {
      const d = Math.hypot(points[k]![0] - p[0], points[k]![1] - p[1]);
      if (d < distance) [best, distance] = [k, d];
    }
    return best < 0 ? undefined : [best, 0];
  }

  #select(point: Vec2 | undefined): void {
    const same = point && this.selected === `${point[0]},${point[1]}`;
    this.selected = point && !same ? `${point[0]},${point[1]}` : "";
    const detail = this.selected
      ? { point, description: this._layer?.describe(point![0], point![1]) }
      : { point: undefined };
    this.#emit("notatio-lattice-select", detail);
  }

  #onPointerDown = (e: PointerEvent): void => {
    const canvas = this.#canvas;
    const layer = this._layer;
    if (!canvas || !layer) return;
    canvas.focus({ preventScroll: true });
    const r = canvas.getBoundingClientRect();
    const dpr = this.#w / r.width;
    const screen: Vec2 = [(e.clientX - r.left) * dpr, (e.clientY - r.top) * dpr];
    const handle = handleAt(layer, this.#view, this.#w, this.#h, screen, 14 * dpr);
    const [x0, y0] = [e.clientX, e.clientY];
    let [px, py] = [x0, y0];
    let dragged = false;
    canvas.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent): void => {
      if (!dragged && Math.hypot(m.clientX - x0, m.clientY - y0) < SLOP) return;
      dragged = true;
      if (handle) {
        const plane = this.#planeAt(m.clientX, m.clientY);
        const to = layer.kind === "points" ? plane : nearestLatticePoint(layer.basis, plane);
        if (layer.moveHandle?.(handle.id, to)) {
          this.#changed();
          this.#emit("notatio-lattice-handle", { id: handle.id, at: to });
        }
        return;
      }
      const scale = (2 * this.#view.extent) / r.height;
      this.#view = {
        center: [this.#view.center[0] - (m.clientX - px) * scale, this.#view.center[1] + (m.clientY - py) * scale],
        extent: this.#view.extent,
      };
      [px, py] = [m.clientX, m.clientY];
      this.#clamp();
      this.#drawNow();
    };
    const up = (u: PointerEvent): void => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      if (dragged) {
        if (!handle) this.#emitView();
        return;
      }
      this.#select(this.#pick(layer, this.#planeAt(u.clientX, u.clientY)));
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  };

  /** Zoom about the pointer: the point under it stays under it. */
  #zoom(factor: number, clientX?: number, clientY?: number): void {
    const r = this.#canvas!.getBoundingClientRect();
    const [cx, cy] = [clientX ?? r.left + r.width / 2, clientY ?? r.top + r.height / 2];
    const anchor = this.#planeAt(cx, cy);
    const wanted = this.#view.extent * factor;
    const before = this.#view.extent;
    this.#view = { center: this.#view.center, extent: wanted };
    this.#clamp(wanted);
    const k = this.#view.extent / before;
    this.#view = {
      center: [anchor[0] + (this.#view.center[0] - anchor[0]) * k, anchor[1] + (this.#view.center[1] - anchor[1]) * k],
      extent: this.#view.extent,
    };
    this.#clamp(wanted);
    this.#drawNow();
    this.#emitView();
  }

  #onWheel = (e: WheelEvent): void => {
    if (!this.#canvas || !wheelZooms(e, this.#canvas)) return;
    e.preventDefault();
    this.#zoom(Math.exp(e.deltaY * 0.0015), e.clientX, e.clientY);
  };

  #onKey = (e: KeyboardEvent): void => {
    const step = this.#view.extent * 0.2;
    const pan = (dx: number, dy: number): void => {
      this.#view = { center: [this.#view.center[0] + dx, this.#view.center[1] + dy], extent: this.#view.extent };
      this.#clamp();
      this.#drawNow();
      this.#emitView();
    };
    const keys: Record<string, () => void> = {
      ArrowLeft: () => pan(-step, 0),
      ArrowRight: () => pan(step, 0),
      ArrowUp: () => pan(0, step),
      ArrowDown: () => pan(0, -step),
      "+": () => this.#zoom(1 / 1.25),
      "=": () => this.#zoom(1 / 1.25),
      "-": () => this.#zoom(1.25),
      "0": () => this.resetView(),
      Escape: () => this.#select(undefined),
      "[": () => void this.stepField(-1),
      "]": () => void this.stepField(1),
    };
    const action = keys[e.key];
    if (!action) return;
    e.preventDefault();
    action();
  };

  /** Put the framing back to the attributes' (or the layer's own). */
  resetView = (): void => {
    this.#readView();
    this.#drawNow();
    this.#emitView();
  };

  /** Move to the next (or previous) squarefree d. */
  async stepField(direction: 1 | -1): Promise<void> {
    const d = this.d;
    if (d === undefined || (this.layer && this.layer !== "primes")) return;
    const { stepField } = await import("@enumeratio/number-theory/lattice");
    this.#setField(stepField(d, direction));
  }

  randomField = (): void => {
    let d = 0;
    // Squarefree d are 6/π² of integers: a few draws suffice.
    for (let tries = 0; tries < 50; tries++) {
      d = Math.round((Math.random() * 2 - 1) * RANDOM_RANGE);
      const squarefree = Array.from({ length: Math.floor(Math.sqrt(Math.abs(d))) }, (_, k) => k + 2).every(
        (k) => d % (k * k) !== 0,
      );
      if (d !== 0 && d !== 1 && squarefree) break;
    }
    this.#setField(d);
  };

  #setField(d: number): void {
    this.selected = "";
    this.ring = String(d);
    this.#emit("notatio-lattice-ring", { d });
  }

  #showMore = (): void => {
    this.maxCells = Math.min(HARD_MAX_CELLS, this.#budget() * 4);
    this.#zoom(2);
  };

  /** Apply a layer control's value; the layer redraws itself. */
  #setControl(id: string, value: string): void {
    const layer = this._layer;
    if (!layer?.setControl?.(id, value)) return;
    this.selected = "";
    if (!layer.colorings.some((c) => c.id === this.colorBy)) this.colorBy = layer.colorings[0]!.id;
    // A new system brings its own coloring, say `color by 12th`, with it.
    const chosen = (layer as { settings?: { colorBy?: string } }).settings?.colorBy;
    if (
      (id === "example" || id === "code" || id === "random") &&
      chosen &&
      layer.colorings.some((c) => c.id === chosen)
    ) {
      this.colorBy = chosen;
    }
    this.#changed();
    if (id === "example" || id === "random" || id === "code" || id === "system") this.resetView();
  }

  // ── Frame parts ─────────────────────────────────────────────────────────────────────────

  #legendEntries(): [LegendEntry[], number] {
    const layer = this._layer;
    if (!layer) return [[], 0];
    const palette = this.#palette;
    const coloring = coloringOf(layer, this.colorBy);
    const fixed = latticeCategoryColors(coloring, palette);
    const drawn = new Set(this._drawn.split(",").map(Number));
    const shown = coloring.categories.filter((c) => c.paint !== "none" && c.label && drawn.has(c.code));
    const band = this.#band;
    const mode = this.#bandMode ?? coloring.bandMode ?? "reflect";
    const unit = coloring.valueLabel ? `${coloring.valueLabel} = ` : "";
    // Where the gradient's two ends fall, so the band is stated, not guessed.
    const ticks =
      mode === "reflect"
        ? [`${unit}0, ${trimNumber(2 * band)}, …`, `${trimNumber(band)}, ${trimNumber(3 * band)}, …`]
        : mode === "wrap"
          ? [`${unit}0, ${trimNumber(band)}, …`, "↺"]
          : [`${unit}0`, `${trimNumber(band)} and past`];
    const entries = shown.slice(0, LEGEND_LIMIT).map((c): LegendEntry => {
      if (c.paint === "gradient") return { label: c.label, gradient: { css: gradientCss(palette.gradient), ticks } };
      const color = c.paint === "muted" ? palette.muted : (fixed.get(c.code) ?? palette.muted);
      return { label: c.label, color, ...(c.style ? { style: c.style } : {}) };
    });
    return [entries, shown.length - entries.length];
  }

  #captionContent(): unknown {
    const info = this._info;
    const layer = this._layer;
    if (!layer) return undefined;
    const at = placementOf(this.caption, "below");
    const toggle = html`<button
      type="button"
      class="notatio-frame-toggle"
      title=${at === "below" ? "Place the caption over the plot" : "Place the caption below the plot"}
      @click=${() => (this.caption = at === "below" ? "bottom-left" : "below")}
    >
      ${at === "below" ? "⇱" : "⇲"}
    </button>`;
    if (info) {
      return html`<div class="notatio-caption-head">
          <strong>${info.title}</strong>
          <span>
            ${toggle}
            <button type="button" title="Clear selection (Esc)" @click=${() => this.#select(undefined)}>×</button>
          </span>
        </div>
        <dl>
          ${info.rows.map(
            ([k, v]) =>
              html`<dt>${k}</dt>
                <dd>${v}</dd>`,
          )}
        </dl>`;
    }
    const parts = layer.caption?.() ?? [];
    const rows = layer.summary?.() ?? [];
    return html`<div class="notatio-caption-head">
        <span class="notatio-caption-prose"
          >${parts.length > 0 ? parts.map((p) => this.#captionPart(p)) : layer.title}</span
        >
        ${toggle}
      </div>
      ${
        rows.length > 0
          ? html`<dl>
              ${rows.map(
                ([k, v]) =>
                  html`<dt>${k}</dt>
                    <dd>${v}</dd>`,
              )}
            </dl>`
          : nothing
      }`;
  }

  #captionPart(part: LatticeCaptionPart): unknown {
    if (typeof part === "string") return part;
    if ("strong" in part) return html`<strong>${part.strong}</strong>`;
    return html`<select
      class="notatio-inline-choice"
      aria-label=${part.choice}
      @change=${(e: Event) => this.#setControl(part.choice, (e.target as HTMLSelectElement).value)}
    >
      ${part.options.map((o) => html`<option value=${o.id} ?selected=${o.id === part.value}>${o.label}</option>`)}
    </select>`;
  }

  #control(c: LatticeControl): unknown {
    const set = (value: string) => this.#setControl(c.id, value);
    switch (c.kind) {
      case "button":
        return html`<button type="button" data-tip=${c.title ?? c.label} @click=${() => set("")}>${c.label}</button>`;
      case "toggle":
        return html`<label class="notatio-lattice-field" title=${c.title ?? ""}
          ><input
            type="checkbox"
            .checked=${c.value === "true"}
            @change=${(e: Event) => set(String((e.target as HTMLInputElement).checked))}
          /><span>${c.label}</span></label
        >`;
      case "select":
        return html`<label class="notatio-lattice-field"
          ><span>${c.label}</span
          ><select @change=${(e: Event) => set((e.target as HTMLSelectElement).value)}>
            ${(c.options ?? []).map((o) => html`<option value=${o.id} ?selected=${o.id === c.value}>${o.label}</option>`)}
          </select></label
        >`;
      case "number":
        return html`<label class="notatio-lattice-field"
          ><span>${c.label}</span
          ><input
            type="number"
            .value=${c.value ?? ""}
            min=${c.min ?? nothing}
            max=${c.max ?? nothing}
            @change=${(e: Event) => set((e.target as HTMLInputElement).value)}
        /></label>`;
      case "text":
        return html`<span class="notatio-lattice-field notatio-lattice-code" title=${c.title ?? ""}>
          <span>${c.label}</span>
          <input
            type="text"
            .value=${c.value ?? ""}
            spellcheck="false"
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === "Enter") set((e.target as HTMLInputElement).value);
            }}
          />
          <button type="button" title="Copy" @click=${() => void navigator.clipboard?.writeText(c.value ?? "")}>
            copy
          </button>
          <button
            type="button"
            title="Apply what is typed or pasted"
            @click=${(e: Event) => set(((e.target as HTMLElement).parentElement!.querySelector("input") as HTMLInputElement).value)}
          >
            apply
          </button>
        </span>`;
    }
    return nothing;
  }

  #toolbar(): unknown {
    const layer = this._layer;
    if (this.bare) return undefined;
    const select = (
      label: string,
      value: string,
      options: readonly { id: string; label: string }[],
      set: (v: string) => void,
    ) =>
      html`<label class="notatio-lattice-field"
        ><span>${label}</span
        ><select @change=${(e: Event) => set((e.target as HTMLSelectElement).value)}>
          ${options.map((o) => html`<option value=${o.id} ?selected=${o.id === value}>${o.label}</option>`)}
        </select></label
      >`;
    const coloring = layer ? coloringOf(layer, this.colorBy) : undefined;
    const usesGradient = coloring?.categories.some((c) => c.paint === "gradient") ?? false;
    const usesDiscrete = coloring?.categories.some((c) => c.paint === "discrete" || c.paint === "own") ?? false;
    const primes = (this.layer || "primes") === "primes";
    const toggle = (label: string, checked: boolean, set: (on: boolean) => void, tip?: string) =>
      html`<label class="notatio-lattice-field" data-tip=${tip ?? nothing}
        ><input
          type="checkbox"
          .checked=${checked}
          @change=${(e: Event) => set((e.target as HTMLInputElement).checked)}
        /><span>${label}</span></label
      >`;
    return html`<div class="notatio-lattice-toolbar">
      <div class="notatio-lattice-row">
        ${
          this.sweep && primes
            ? html`<span class="notatio-lattice-sweep">
                <button
                  type="button"
                  aria-label="Previous field"
                  data-tip="Previous field  ["
                  @click=${() => void this.stepField(-1)}
                >
                  ◀
                </button>
                <strong>${layer?.title ?? this.ring}</strong>
                <button
                  type="button"
                  aria-label="Next field"
                  data-tip="Next field  ]"
                  @click=${() => void this.stepField(1)}
                >
                  ▶
                </button>
                <button
                  type="button"
                  aria-label="Random field"
                  data-tip="A random field ℚ(√d), |d| ≤ 400"
                  @click=${this.randomField}
                >
                  ⚄
                </button>
              </span>`
            : html`<strong class="notatio-lattice-title">${layer?.title ?? ""}</strong>`
        }
        ${layer ? select("color by", this.colorBy, layer.colorings, (v) => (this.colorBy = v)) : nothing}
        <notatio-palette
          .palette=${this.palette}
          .gradient=${this.gradient}
          .discrete=${this.discrete}
          .reverse=${this.reverse}
          .band=${usesGradient ? this.#band : undefined}
          .mode=${this.#bandMode ?? coloring?.bandMode ?? "reflect"}
          .unit=${coloring?.valueLabel ?? ""}
          .withGradient=${usesGradient}
          .withDiscrete=${usesDiscrete}
          @notatio-palette-change=${(e: CustomEvent<PaletteSetting>) => {
            const s = e.detail;
            this.palette = s.palette;
            this.gradient = s.gradient;
            this.discrete = s.discrete;
            this.reverse = s.reverse;
            if (s.band) this.band = s.band;
            if (s.mode) this.bandMode = s.mode;
          }}
        ></notatio-palette>
        ${
          layer && layer.highlightModes.length > 0
            ? select(
                "highlight",
                this.highlight,
                [...layer.highlightModes, { id: "off", label: "nothing" }],
                (v) => (this.highlight = v),
              )
            : nothing
        }
        ${toggle("grid", Number(this.grid) > 0, (on) => (this.grid = on ? 10 : 0), "Grid lines every 10 steps")}
        ${toggle("axes", this.axes !== false, (on) => (this.axes = on), "The axes and their labels")}
        ${
          primes
            ? toggle(
                "true scale",
                this.scale === "geometric",
                (on) => (this.scale = on ? "geometric" : "uniform"),
                "Tiles of one shape in every field, or each field's true geometry",
              )
            : nothing
        }
        <button type="button" aria-label="Reset view" data-tip="Reset the view  0" @click=${this.resetView}>⟲</button>
      </div>
      ${layer?.controls ? html`<div class="notatio-lattice-row">${layer.controls().map((c) => this.#control(c))}</div>` : nothing}
    </div>`;
  }

  protected override render(): unknown {
    const many = (this._layer ? coloringOf(this._layer, this.colorBy).categories.length : 0) > 8;
    const legendAt: FramePlacement = placementOf(
      this.legend,
      placementOf(this._layer?.legendPlacement, many ? "right" : "below"),
    );
    const captionAt: FramePlacement = placementOf(this.caption, "below");
    const [entries, more] = this.#legendEntries();
    const stage = html`<canvas
        tabindex="0"
        aria-label=${`Lattice: ${this._layer?.title ?? ""}`}
        @pointerdown=${this.#onPointerDown}
        @wheel=${this.#onWheel}
        @keydown=${this.#onKey}
      ></canvas>
      ${
        this._limited
          ? html`<div class="notatio-lattice-limit">
              at most ${this.#budget().toLocaleString()} points
              ${this.#budget() < HARD_MAX_CELLS ? html`<button type="button" data-tip="Allow four times as many points, and zoom out" @click=${this.#showMore}>show more</button>` : nothing}
            </div>`
          : nothing
      }
      ${this._status ? html`<p class="notatio-lattice-status">${this._status}</p>` : nothing}`;
    return html`<div class="notatio-lattice">
      ${figureFrame({
        toolbar: this.#toolbar(),
        stage,
        stageStyle: `min-height:${Number(this.height) || 480}px`,
        caption: this.#captionContent(),
        legend: entries.length > 0 ? legendTemplate(entries, isVertical(legendAt), more) : undefined,
        captionAt,
        legendAt,
      })}
    </div>`;
  }
}

if (!customElements.get("notatio-lattice-plot")) {
  customElements.define("notatio-lattice-plot", NotatioLatticePlot);
}
