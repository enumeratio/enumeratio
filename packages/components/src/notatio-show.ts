import { html, LitElement, nothing, type PropertyValues } from "lit";
import {
  BAND_MODES,
  type BandMode,
  type BoundaryRule,
  boundaryRuleOf,
  CANVAS_BLEND,
  type ColorMixing,
  type ColorRule,
  colorMixingOf,
  colorRuleOf,
  clampLatticeView,
  drawAxisLabels,
  drawLatticeLines,
  drawTiles,
  type GestureHandling,
  edgeOf,
  GRADIENTS,
  gestureHandlingOf,
  gradientCss,
  gradientNamed,
  type LatticeView,
  type LineStyle,
  maxExtentFor,
  nearestLatticePoint,
  paddingName,
  plainJson,
  resolvePalette,
  reverseGradient,
  rulesOf,
  type SchemeColor,
  splitOptions,
  type TileLayer,
  type Vec2,
  wheelZooms,
} from "@enumeratio/frontend/core";
import { GRAPHICS_OPTIONS } from "@enumeratio/formats";
import { emitControl } from "./define.ts";
import { type FramePlacement, figureFrame, isVertical, placementOf } from "./figure-frame.ts";
import { ensureStyles } from "./styles.ts";

type Json = unknown;

/** A layer of tiles as Show draws it: the tiles, plus its frame and how to label it. */
interface ShowLayer extends TileLayer {
  /** The grid `GridLines -> Automatic` draws, when the layer has one of its own. */
  readonly autoGrid?: readonly [number, number];
  /** Where its grid lines are anchored, in lattice coordinates: between a table's cells. */
  readonly gridOffset?: Vec2;
  readonly title: string;
  readonly grid: readonly [Vec2, Vec2];
  gridLabel(axis: 0 | 1, k: number): string;
  home?(): LatticeView;
  summary(): readonly (readonly [string, string])[];
  describe(i: number, j: number): { title: string; rows: readonly (readonly [string, string])[] };
}

/** Points a view may hold before zooming out stops. */
const MAX_POINTS = 120_000;
/** Milliseconds a frame spends classifying new points before it draws what it has. */
const FRAME_BUDGET = 12;
/** Pointer travel (CSS px) below which a press is a click, not a drag. */
const SLOP = 4;
const DEFAULT_GROUND = "dusk";

const headOf = (json: Json): string | undefined =>
  Array.isArray(json) && typeof json[0] === "string" ? json[0] : undefined;
/**
 * `text` (Epsil) as written, not canonicalized: a `Show`'s rules name layer properties
 * (`IsPrime -> Teal`) that the engine would read as its own `IsPrime`.
 */
async function readStructure(text: string): Promise<Json> {
  const { parseExpression } = await import("@enumeratio/formats/expression");
  const { json, errors } = parseExpression(text);
  return errors.length > 0 ? undefined : plainJson(json);
}

const argsOf = (json: Json): Json[] => (Array.isArray(json) ? json.slice(1) : []);
/** The options `head` declares, as a set. */
const declared = (head: string): ReadonlySet<string> => new Set(GRAPHICS_OPTIONS[head] ?? []);
const stringOf = (json: Json): string | undefined =>
  typeof json === "string" ? json.replace(/^'([\s\S]*)'$/, "$1") : (json as { str?: string } | undefined)?.str;
const numberOf = (json: Json, fallback: number): number => {
  const n = typeof json === "number" ? json : Number(stringOf(json));
  return Number.isFinite(n) ? n : fallback;
};

/** `json` with each parameter's wildcard (`_d`) replaced by its value, wherever it stands. */
function bind(json: Json, params: ReadonlyMap<string, Json>): Json {
  if (typeof json === "string" && json.startsWith("_") && params.has(json.slice(1))) return params.get(json.slice(1));
  return Array.isArray(json) ? json.map((node) => bind(node, params)) : json;
}

/** What a `Show` says, read once its parameters are bound. */
interface ShowSpec {
  /** The tiled layer: `LatticeTiles(ring)` or `ArrayPlot(table)`, its data. */
  readonly tiles?: { readonly head: "LatticeTiles" | "ArrayPlot"; readonly data: Json };
  readonly colorRules: readonly ColorRule[];
  readonly boundaryRules: readonly BoundaryRule[];
  readonly colorMixing: ColorMixing;
  /** Rules whose test or style didn't read. */
  readonly unread: number;
  /** `auto`: `GridLines -> Automatic`, whose step is the layer's own grid when it has one. */
  readonly grid?: { readonly step: readonly [number, number]; readonly auto: boolean; readonly style: LineStyle };
  readonly axes?: { readonly style: LineStyle; readonly ticks: boolean };
  readonly aspect: "Uniform" | "True";
}

/** Grid lines every this many units of the frame, for `GridLines -> Automatic`. */
const GRID_STEP = 10;

/** A line style from an edge directive (`Directive(White, AbsoluteThickness(1), Opacity(0.2))`). */
const lineStyleOf = (json: Json, fallback: LineStyle): LineStyle => {
  const edge = json === undefined ? undefined : edgeOf(json);
  return edge ? { color: edge.color, width: edge.width, opacity: edge.opacity } : fallback;
};

function specOf(json: Json): ShowSpec {
  const { positional, options } = splitOptions(json, declared("Show"));
  let tiles: ShowSpec["tiles"];
  let colorRules: ColorRule[] = [];
  let boundaryRules: BoundaryRule[] = [];
  let colorMixing: ColorMixing = "First";
  let unread = 0;
  for (const layer of positional) {
    const head = headOf(layer);
    if (head !== "LatticeTiles" && head !== "ArrayPlot") continue;
    const split = splitOptions(layer, declared(head));
    tiles = { head, data: split.positional[0] };
    const colors = rulesOf(split.options.get("ColorRules"), colorRuleOf);
    const edges = rulesOf(split.options.get("BoundaryStyle"), boundaryRuleOf);
    colorRules = colors.rules;
    boundaryRules = edges.rules;
    colorMixing = colorMixingOf(split.options.get("ColorMixing"));
    unread = colors.unread + edges.unread;
  }
  // `GridLines -> [x, y]`: a line every x units along the frame's first axis and every y along
  // its second (a lattice frame's are 1 and ω), `None` or 0 for none; `Automatic` every GRID_STEP.
  const gridLines = options.get("GridLines");
  const specs =
    headOf(gridLines) === "List" ? argsOf(gridLines) : gridLines === "Automatic" ? [gridLines, gridLines] : [];
  const step = specs.slice(0, 2).map((g) => (g === "Automatic" ? GRID_STEP : numberOf(g, 0))) as [number, number];
  const grid = step.some((k) => k > 0)
    ? {
        step,
        auto: gridLines === "Automatic",
        style: lineStyleOf(options.get("GridLinesStyle"), { color: "#ffffff", width: 1, opacity: 0.16 }),
      }
    : undefined;
  const axes =
    options.get("Axes") === "True"
      ? {
          style: lineStyleOf(options.get("AxesStyle"), { color: "", width: 1.5, opacity: 0.55 }),
          ticks: options.get("Ticks") !== "None",
        }
      : undefined;
  return {
    ...(tiles ? { tiles } : {}),
    colorRules,
    boundaryRules,
    colorMixing,
    unread,
    ...(grid ? { grid } : {}),
    ...(axes ? { axes } : {}),
    aspect: options.get("AspectRatio") === "Automatic" ? "True" : "Uniform",
  };
}

/** A reader's change to one color rule, made from the legend. */
interface Override {
  color?: string;
  gradient?: string;
  mode?: BandMode;
  reverse?: boolean;
}

/**
 * `<notatio-show value="Show(LatticeTiles(QuadraticIntegers(_d), ColorRules -> […]), …)">` —
 * Wolfram's `Show`: layers in one coordinate frame, sharing one view, each on its own canvas.
 * `LatticeTiles(ring, …)` draws a lattice's faces: `ColorRules -> [test -> color, …]` colors them
 * (a color, `Opacity(a, color)`, or `ColorData(scheme, value, Band -> w)`), `ColorMixing`
 * combines the colors of matching rules (Wolfram's first match by default; `"Normal"`, or the
 * order-free `"Screen"`, `"Add"` and `"Multiply"`), and `BoundaryStyle -> [test -> directive, …]`
 * draws their edges, nested in rule order.
 *
 * - `GridLines -> [10, 10]` (every 10 units along each axis of the frame: rhombic for a hexagonal ring),
 *   `GridLinesStyle`, `Axes -> True`, `AxesStyle`, `Ticks -> None`, and
 *   `AspectRatio -> Automatic` for true scale.
 * - Its wildcards (`_d`) are the variables of the scope it sits in: the nearest element declaring
 *   `Variables`, whose controls (a `StringTemplate` caption's holes, say) move them.
 * - The legend is made from the rules and is how their colors change: a swatch opens a color, a
 *   bar the color schemes, `↺` the scheme's padding past its ends, `⇄` reverses it.
 * - `Selection -> _s`: shift/⌘-click selects several; the element writes them to the variable
 *   `_s` (a list of lattice points), and showing them is up to the page.
 * - `GestureHandling -> "cooperative"` (the default), `"greedy"` or `"none"`: whether the wheel
 *   zooms when the plot isn't engaged.
 *
 * Drag to pan; Esc clears the selection; `0` resets the view.
 */
export class NotatioShow extends LitElement {
  static properties = {
    /** The `Show(…)` expression, in Epsil. */
    value: { type: String },
    /** Height of the plot, in CSS pixels. */
    height: { type: Number },
    /** Wolfram's `ImageSize`, as `Show` written in markup lowers it: `[Automatic, h]` sets the height. */
    imageSize: { type: String, attribute: "image-size" },
    /** The ground the layers draw on: one of the palettes' grounds. */
    ground: { type: String },
    /** Options as attributes, as `Show` written in markup lowers them; each one Epsil. */
    selection: { type: String },
    aspectRatio: { type: String, attribute: "aspect-ratio" },
    gestureHandling: { type: String, attribute: "gesture-handling" },
    /** Where the legend goes: `below`, `right`, a corner to overlay, `none`. */
    legendAt: { type: String, attribute: "legend-at", reflect: true },
    /** The values of the variables its wildcards name, by wildcard (`_d`), set by its scope. */
    bindings: { attribute: false },
    _spec: { state: true },
    _params: { state: true },
    _status: { state: true },
    _selection: { state: true },
    _overrides: { state: true },
    _drawn: { state: true },
    _tip: { state: true },
  };

  declare value: string;
  declare height: number;
  declare imageSize: string;
  declare ground: string;
  declare selection: string;
  declare aspectRatio: string;
  declare gestureHandling: string;
  declare legendAt: string;
  declare bindings: Readonly<Record<string, Json>> | undefined;
  declare _spec: ShowSpec | undefined;
  declare _params: ReadonlyMap<string, Json>;
  declare _status: string;
  declare _selection: readonly Vec2[];
  declare _overrides: ReadonlyMap<number, Override>;
  declare _drawn: number;
  /** What the layer says of the tile under the pointer, and where to show it. */
  declare _tip:
    | {
        x: number;
        y: number;
        flip: boolean;
        above: boolean;
        title: string;
        rows: readonly (readonly [string, string])[];
      }
    | undefined;

  #source: Json;
  /** The options: those written in `value`, then those given as attributes. */
  #showOptions = new Map<string, Json>();
  #layer: ShowLayer | undefined;
  #layerKey = "";
  #canvases: HTMLCanvasElement[] = [];
  #view: LatticeView = { center: [0, 0], extent: 20 };
  #framed = false;
  /** Whether the reader has panned or zoomed, so a resize keeps their view rather than refitting. */
  #moved = false;
  #w = 2;
  #h = 2;
  #queued = false;
  #ro: ResizeObserver | undefined;
  #build = 0;

  constructor() {
    super();
    this.value = "";
    this.height = 480;
    this.imageSize = "";
    this.ground = DEFAULT_GROUND;
    this.selection = "";
    this.aspectRatio = "";
    this.gestureHandling = "";
    this.legendAt = "right";
    this.bindings = undefined;
    this._spec = undefined;
    this._params = new Map();
    this._status = "";
    this._selection = [];
    this._overrides = new Map();
    this._drawn = 0;
    this._tip = undefined;
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = undefined;
  }

  protected override async updated(changed: PropertyValues): Promise<void> {
    this.#adoptCanvases();
    const options = ["value", "selection", "aspectRatio", "gestureHandling"];
    if (options.some((k) => changed.has(k))) await this.#read();
    else if (changed.has("bindings")) await this.#bind();
    this.#draw();
  }

  #adoptCanvases(): void {
    const canvases = [...this.querySelectorAll<HTMLCanvasElement>(".notatio-show-layers canvas")];
    if (canvases.length === this.#canvases.length && canvases.every((c, k) => c === this.#canvases[k])) return;
    this.#canvases = canvases;
    this.#ro?.disconnect();
    this.#ro = new ResizeObserver(() => this.#resize());
    if (canvases[0]) this.#ro.observe(canvases[0]);
    this.#resize();
  }

  get #options(): Map<string, Json> {
    return this.#showOptions;
  }

  get #gestures(): GestureHandling {
    return gestureHandlingOf(stringOf(this.#options.get("GestureHandling")));
  }

  /** The variable the selection is written to: `Selection -> _s` names `s`. */
  get #selectionName(): string | undefined {
    const s = this.#options.get("Selection");
    return typeof s === "string" && /^_?[A-Za-z]\w*$/.test(s) ? s.replace(/^_/, "") : undefined;
  }

  /** Read `value`, take the declared parameters' starting values, and build. */
  async #read(): Promise<void> {
    const build = ++this.#build;
    const json = this.value.trim() ? await readStructure(this.value) : undefined;
    if (build !== this.#build) return;
    if (headOf(json) !== "Show") {
      this._status = this.value.trim() ? "Not a Show(…) expression." : "";
      return;
    }
    this.#source = json;
    const options = splitOptions(json, declared("Show")).options;
    const attributes: [string, string][] = [
      ["Selection", this.selection],
      ["AspectRatio", this.aspectRatio],
      ["GestureHandling", this.gestureHandling],
    ];
    for (const [name, text] of attributes) {
      if (!text) continue;
      options.set(name, (await readStructure(text)) ?? text);
    }
    if (build !== this.#build) return;
    this.#showOptions = options;
    await this.#bind();
  }

  /** Take the scope's values for the wildcards, the selection's among them, and rebuild. */
  async #bind(): Promise<void> {
    const params = new Map<string, Json>();
    for (const [wildcard, value] of Object.entries(this.bindings ?? {})) params.set(wildcard.replace(/^_/, ""), value);
    this._params = params;
    this.#adoptBoundSelection();
    await this.#rebuild();
  }

  /** Select what the selection's variable holds, when it holds a list of points. */
  #adoptBoundSelection(): void {
    const selected = this.#selectionName === undefined ? undefined : this._params.get(this.#selectionName);
    if (!Array.isArray(selected) || selected[0] !== "List") return;
    const points = selected
      .slice(1)
      .flatMap((p) => (Array.isArray(p) && p.length === 3 ? [[Number(p[1]), Number(p[2])] as Vec2] : []));
    if (JSON.stringify(points) !== JSON.stringify(this._selection)) this._selection = points;
  }

  /** Bind the variables, read the spec, and load the ring's layer when the ring changed. */
  async #rebuild(): Promise<void> {
    if (this.#source === undefined) return;
    const bound = bind(this.#source, this._params);
    // A wildcard its scope hasn't filled yet: wait for it rather than report a missing ring.
    if (JSON.stringify(bound).includes('"_')) {
      this._status = "";
      return;
    }
    const spec = specOf(bound);
    const key = JSON.stringify([spec.tiles, spec.aspect]);
    if (key !== this.#layerKey) {
      const layer = await layerFor(spec.tiles, spec.aspect);
      if (typeof layer === "string") {
        this._status = layer;
        return;
      }
      this.#layer = layer;
      this.#layerKey = key;
      // A new layer's points are other points: start from what the variable holds, if anything.
      this._selection = [];
      this.#adoptBoundSelection();
      // A finite layer is framed whole whenever it changes (a new n is a new table); an
      // unbounded one once, so stepping the ring keeps the reader where they were.
      if (!this.#framed || layer.bounds) {
        this.#view = this.#home(layer);
        this.#framed = true;
        this.#moved = false;
      }
    }
    this._status = spec.unread > 0 ? `${spec.unread} of the layer's rules didn't read.` : "";
    this._spec = spec;
    this.#clamp();
    this.#draw();
  }

  /** The color rules with the legend's overrides applied. */
  get #colorRules(): ColorRule[] {
    return (this._spec?.colorRules ?? []).map((rule, k) => {
      const o = this._overrides.get(k);
      if (!o) return rule;
      const { paint } = rule;
      if (typeof paint === "string") return o.color ? { ...rule, paint: o.color } : rule;
      let gradient = o.gradient ? gradientNamed(o.gradient) : paint.gradient;
      if (o.reverse) gradient = reverseGradient(gradient);
      const next: SchemeColor = { ...paint, gradient, mode: o.mode ?? paint.mode };
      return { ...rule, paint: next };
    });
  }

  #clamp(): void {
    if (!this.#layer) return;
    const { bounds } = this.#layer;
    if (bounds) {
      this.#view = clampToBounds(this.#layer.basis, bounds, this.#view, this.#w / this.#h);
      return;
    }
    this.#view = clampLatticeView(
      { basis: this.#layer.basis, maxIndex: this.#layer.maxIndex },
      this.#view,
      this.#w / this.#h,
      MAX_POINTS,
    );
  }

  #resize(): void {
    const first = this.#canvases[0];
    if (!first) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.#w = Math.max(2, Math.round(first.clientWidth * dpr));
    this.#h = Math.max(2, Math.round(first.clientHeight * dpr));
    for (const c of this.#canvases) {
      c.width = this.#w;
      c.height = this.#h;
    }
    if (this.#layer?.bounds && !this.#moved) this.#view = this.#home(this.#layer);
    this.#clamp();
    this.#drawNow();
  }

  #draw = (): void => {
    if (this.#queued) return;
    this.#queued = true;
    requestAnimationFrame(() => {
      if (this.#queued) this.#drawNow();
    });
  };

  #drawNow = (): void => {
    this.#queued = false;
    const layer = this.#layer;
    const spec = this._spec;
    const [tiles, lines, axes] = this.#canvases.map((c) => c.getContext("2d"));
    if (!layer || !spec || !tiles || !lines || !axes) return;
    for (const ctx of [tiles, lines, axes]) ctx.clearRect(0, 0, this.#w, this.#h);
    tiles.canvas.style.mixBlendMode = CANVAS_BLEND[spec.colorMixing];
    const complete = drawTiles(tiles, this.#w, this.#h, layer, this.#view, {
      colorRules: this.#colorRules,
      boundaryRules: spec.boundaryRules,
      colorMixing: spec.colorMixing,
      selection: this._selection,
      fill: 0.86,
      phase: 0,
      budgetMs: FRAME_BUDGET,
    });
    const gridStep = spec.grid?.auto ? (layer.autoGrid ?? spec.grid.step) : spec.grid?.step;
    if (spec.grid && gridStep)
      drawLatticeLines(
        lines,
        this.#w,
        this.#h,
        layer.basis,
        layer.grid,
        this.#view,
        gridStep,
        spec.grid.style,
        false,
        layer.gridOffset,
      );
    if (spec.axes) {
      const ground = resolvePalette({ palette: this.ground });
      const style = { ...spec.axes.style, color: spec.axes.style.color || ground.foreground };
      drawLatticeLines(axes, this.#w, this.#h, layer.basis, layer.grid, this.#view, 1, style, true);
      if (spec.axes.ticks)
        drawAxisLabels(
          axes,
          this.#w,
          this.#h,
          layer.basis,
          layer.grid,
          this.#view,
          gridStep ?? [GRID_STEP, GRID_STEP],
          (axis, k) => layer.gridLabel(axis, k),
          { color: style.color, halo: ground.background, opacity: Math.min(1, style.opacity + 0.3) },
        );
    }
    if (!complete) this.#draw();
  };

  // ── Interaction ─────────────────────────────────────────────────────────────────────

  #planeAt(clientX: number, clientY: number): Vec2 {
    const r = this.#canvases[0]!.getBoundingClientRect();
    const ux = (clientX - r.left) / r.width - 0.5;
    const uy = 0.5 - (clientY - r.top) / r.height;
    return [
      this.#view.center[0] + 2 * ux * this.#view.extent * (this.#w / this.#h),
      this.#view.center[1] + 2 * uy * this.#view.extent,
    ];
  }

  #publishSelection(): void {
    const name = this.#selectionName;
    const points = ["List", ...this._selection.map(([i, j]) => ["Tuple", i, j])];
    if (name) emitControl(this, { name, value: points as never });
    this.dispatchEvent(
      new CustomEvent("notatio-show-select", { detail: { points: this._selection }, bubbles: true, composed: true }),
    );
  }

  /** Select a point: alone, or — with shift or ⌘ — added to (or taken from) the selection. */
  #select(point: Vec2, extend: boolean): void {
    const key = (p: Vec2) => `${p[0]},${p[1]}`;
    const has = this._selection.some((p) => key(p) === key(point));
    if (!this.#selectionName && !this.#options.has("Selection")) return;
    const bounds = this.#layer?.bounds;
    if (
      bounds &&
      (point[0] < bounds.i[0] || point[0] > bounds.i[1] || point[1] < bounds.j[0] || point[1] > bounds.j[1])
    )
      return;
    if (extend)
      this._selection = has ? this._selection.filter((p) => key(p) !== key(point)) : [...this._selection, point];
    else this._selection = has && this._selection.length === 1 ? [] : [point];
    // Selecting a point asks for it in full, whatever the frame's budget left undone.
    if (!this.#layer?.known(point[0], point[1])) this.#layer?.prepare(point[0], point[1]);
    this.#publishSelection();
    this.#draw();
  }

  #onPointerDown = (e: PointerEvent): void => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    if (!this.#layer) return;
    canvas.focus({ preventScroll: true });
    const r = canvas.getBoundingClientRect();
    const [x0, y0] = [e.clientX, e.clientY];
    let [px, py] = [x0, y0];
    let dragged = false;
    canvas.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent): void => {
      if (!dragged && Math.hypot(m.clientX - x0, m.clientY - y0) < SLOP) return;
      dragged = true;
      this.#moved = true;
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
      if (!dragged)
        this.#select(
          nearestLatticePoint(this.#layer!.basis, this.#planeAt(u.clientX, u.clientY)),
          u.shiftKey || u.metaKey || u.ctrlKey,
        );
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  };

  #tipKey = "";

  /** Wolfram's `Tooltip`, for every tile: what the layer says of the one under the pointer. */
  #onHover = (e: PointerEvent): void => {
    const layer = this.#layer;
    if (!layer || e.buttons !== 0) return;
    const [i, j] = nearestLatticePoint(layer.basis, this.#planeAt(e.clientX, e.clientY));
    const { bounds } = layer;
    const outside = bounds && (i < bounds.i[0] || i > bounds.i[1] || j < bounds.j[0] || j > bounds.j[1]);
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const [x, y] = [e.clientX - r.left, e.clientY - r.top];
    // On the side with room: left of the pointer in the plot's right half.
    const [flip, above] = [x > r.width / 2, y > r.height / 2];
    const key = `${i},${j}`;
    if (outside) {
      this._tip = undefined;
      this.#tipKey = "";
    } else if (key !== this.#tipKey) {
      this.#tipKey = key;
      if (!layer.known(i, j)) layer.prepare(i, j);
      this._tip = { x, y, flip, above, ...layer.describe(i, j) };
    } else if (this._tip) this._tip = { ...this._tip, x, y, flip, above };
  };

  #onLeave = (): void => {
    this._tip = undefined;
    this.#tipKey = "";
  };

  #onWheel = (e: WheelEvent): void => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    if (!wheelZooms(e, canvas, this.#gestures) || !this.#layer) return;
    e.preventDefault();
    this.#moved = true;
    const anchor = this.#planeAt(e.clientX, e.clientY);
    const before = this.#view.extent;
    const ceiling = maxExtentFor(this.#layer.basis, this.#w / this.#h, MAX_POINTS);
    const extent = Math.min(ceiling, before * Math.exp(e.deltaY * 0.0015));
    const k = extent / before;
    this.#view = {
      center: [anchor[0] + (this.#view.center[0] - anchor[0]) * k, anchor[1] + (this.#view.center[1] - anchor[1]) * k],
      extent,
    };
    this.#clamp();
    this.#drawNow();
  };

  #onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape" && this._selection.length > 0) {
      this._selection = [];
      this.#publishSelection();
      this.#draw();
    } else if (e.key === "0") {
      this.resetView();
    } else return;
    e.preventDefault();
  };

  /** Back to the frame the layer chose. */
  /** Where a layer starts: a finite one fitted whole to the canvas, else the layer's own home. */
  #home(layer: ShowLayer): LatticeView {
    if (!layer.bounds) return layer.home?.() ?? { center: [0, 0], extent: 20 };
    const { i, j } = layer.bounds;
    const [b0, b1] = layer.basis;
    const xs = [i[0], i[1]].flatMap((a) => [j[0], j[1]].map((b) => a * b0[0] + b * b1[0]));
    const ys = [i[0], i[1]].flatMap((a) => [j[0], j[1]].map((b) => a * b0[1] + b * b1[1]));
    const [w, h] = [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1];
    return {
      center: [(Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2],
      extent: (Math.max(h, w / (this.#w / this.#h)) / 2) * 1.02,
    };
  }

  resetView = (): void => {
    this.#moved = false;
    this.#view = this.#layer ? this.#home(this.#layer) : { center: [0, 0], extent: 20 };
    this.#clamp();
    this.#drawNow();
  };

  #setOverride(k: number, change: Override): void {
    const next = new Map(this._overrides);
    next.set(k, { ...next.get(k), ...change });
    this._overrides = next;
    this.#draw();
  }

  #legendTemplate(vertical: boolean): unknown {
    const colors = this.#colorRules;
    const edges = this._spec?.boundaryRules ?? [];
    if (colors.length + edges.length === 0) return undefined;
    return html`<ul class=${`notatio-legend notatio-show-legend ${vertical ? "is-vertical" : ""}`}>
      ${colors.map((rule, k) => (typeof rule.paint === "string" ? this.#swatch(rule, rule.paint, k) : this.#bar(rule, rule.paint, k)))}
      ${edges.map(
        (rule) => html`<li>
          <span class="notatio-show-swatch">
            <i
              style=${`box-shadow: inset 0 0 0 ${Math.max(1.5, rule.width)}px ${rule.color}; opacity:${rule.opacity}`}
            ></i>
          </span>
          <span class="notatio-legend-label">${rule.label}</span>
        </li>`,
      )}
    </ul>`;
  }

  /** A color rule's swatch, which opens a color picker. */
  #swatch(rule: ColorRule, color: string, k: number): unknown {
    return html`<li>
      <label class="notatio-show-swatch" data-tip="Choose the color">
        <i style=${`background:${color}; opacity:${rule.opacity}`}></i>
        <input
          type="color"
          .value=${color}
          aria-label=${`${rule.label} color`}
          @input=${(e: Event) => this.#setOverride(k, { color: (e.target as HTMLInputElement).value })}
        />
      </label>
      <span class="notatio-legend-label">${rule.label}</span>
    </li>`;
  }

  /** A scheme rule's bar, which opens the schemes, with its padding and a reverse. */
  #bar(rule: ColorRule, scheme: SchemeColor, k: number): unknown {
    const { mode, band, offset } = scheme;
    const at = (k: number): string => String(+(offset + k * band).toPrecision(6));
    const ticks =
      mode === "reflect"
        ? [`${at(0)}, ${at(2)}, …`, `${at(1)}, ${at(3)}, …`]
        : mode === "wrap"
          ? [`${at(0)}, ${at(1)}, …`, ""]
          : [`${at(0)} and below`, `${at(1)} and past`];
    const next = BAND_MODES[(BAND_MODES.indexOf(mode) + 1) % BAND_MODES.length]!;
    return html`<li class="notatio-legend-gradient">
      <span class="notatio-legend-label">${rule.label}</span>
      <label class="notatio-show-gradient" data-tip="Choose the color scheme">
        <span class="notatio-legend-bar" style=${`background:${gradientCss(scheme.gradient)}`}></span>
        <select
          aria-label="Color scheme"
          @change=${(e: Event) => this.#setOverride(k, { gradient: (e.target as HTMLSelectElement).value })}
        >
          ${GRADIENTS.map((g) => html`<option value=${g.name} ?selected=${g.name === scheme.gradient.name}>${g.label}</option>`)}
        </select>
      </label>
      <span class="notatio-legend-ticks">${ticks.map((t) => html`<span>${t}</span>`)}</span>
      <span class="notatio-show-ends">
        <button
          type="button"
          data-tip=${`Padding: ${paddingName(mode)} (click for ${paddingName(next)})`}
          @click=${() => this.#setOverride(k, { mode: next })}
        >
          ${mode === "reflect" ? "↺" : mode === "wrap" ? "⟳" : "⇥"}
        </button>
        <button
          type="button"
          data-tip="Reverse the scheme"
          @click=${() => this.#setOverride(k, { reverse: !this._overrides.get(k)?.reverse })}
        >
          ⇄
        </button>
      </span>
    </li>`;
  }

  /** `ImageSize -> [Automatic, h]` (or `[w, h]`), in the expression or as an attribute, gives the height. */
  get #height(): number {
    const size = this.#options.get("ImageSize");
    const h = Array.isArray(size) && size[0] === "List" ? Number(size[2]) : Number.NaN;
    const sized = /^\[\s*[^,\]]+,\s*(\d+(?:\.\d+)?)\s*\]$/.exec(this.imageSize.trim());
    return (Number.isFinite(h) && h > 0 ? h : 0) || Number(sized?.[1]) || Number(this.height) || 480;
  }

  protected override render(): unknown {
    const ground = resolvePalette({ palette: this.ground });
    const legendAt: FramePlacement = placementOf(this.legendAt, "right");
    const stage = html`<div class="notatio-show-layers" style=${`background:${ground.background}`}>
        ${["tiles", "lines", "axes"].map(
          (name) =>
            html`<canvas
              class=${`notatio-show-${name}`}
              tabindex=${name === "axes" ? "0" : "-1"}
              aria-label=${name === "axes" ? `Plot: ${this.#layer?.title ?? ""}` : nothing}
              @pointerdown=${name === "axes" ? this.#onPointerDown : nothing}
              @pointermove=${name === "axes" ? this.#onHover : nothing}
              @pointerleave=${name === "axes" ? this.#onLeave : nothing}
              @wheel=${name === "axes" ? this.#onWheel : nothing}
              @keydown=${name === "axes" ? this.#onKey : nothing}
            ></canvas>`,
        )}
        ${
          this._tip
            ? html`<div
                class=${`notatio-show-tip${this._tip.flip ? " is-flipped" : ""}${this._tip.above ? " is-above" : ""}`}
                style=${`left:${this._tip.x}px;top:${this._tip.y}px`}
              >
                <strong>${this._tip.title}</strong>
                ${
                  this._tip.rows.length
                    ? html`<dl>
                        ${this._tip.rows.map(
                          ([k, v]) =>
                            html`<dt>${k}</dt>
                              <dd>${v}</dd>`,
                        )}
                      </dl>`
                    : nothing
                }
              </div>`
            : nothing
        }
      </div>
      ${this._status ? html`<p class="notatio-show-status">${this._status}</p>` : nothing}`;
    return html`<div class="notatio-show">
      ${figureFrame({
        stage,
        stageStyle: `min-height:${this.#height}px`,
        legend: this.#legendTemplate(isVertical(legendAt)),
        captionAt: "none",
        legendAt,
      })}
    </div>`;
  }
}

/**
 * Keep a view on a finite layer: no wider than the whole layer with a margin (nor than the point
 * budget), its center within the layer's rectangle.
 */
function clampToBounds(
  basis: readonly [Vec2, Vec2],
  bounds: { readonly i: Vec2; readonly j: Vec2 },
  view: LatticeView,
  aspect: number,
): LatticeView {
  const corners = [bounds.i[0], bounds.i[1]].flatMap((i) =>
    [bounds.j[0], bounds.j[1]].map((j) => [i * basis[0][0] + j * basis[1][0], i * basis[0][1] + j * basis[1][1]]),
  );
  const [xs, ys] = [corners.map((c) => c[0]!), corners.map((c) => c[1]!)];
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const whole = Math.max((y1 - y0) / 2, (x1 - x0) / (2 * aspect)) * 1.1 + 1;
  const unit = Math.sqrt(Math.abs(basis[0][0] * basis[1][1] - basis[0][1] * basis[1][0]));
  const extent = Math.min(Math.max(view.extent, 1.5 * unit), whole, maxExtentFor(basis, aspect, MAX_POINTS));
  const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
  return { center: [clamp(view.center[0], x0, x1), clamp(view.center[1], y0, y1)], extent };
}

/** The modulus of `QuotientRing(Integers, n)` (or its old spelling `IntegerModRing(n)`). */
function modulusOf(ring: Json): number {
  if (headOf(ring) === "QuotientRing" && argsOf(ring)[0] === "Integers") return numberOf(argsOf(ring)[1], Number.NaN);
  if (headOf(ring) === "IntegerModRing") return numberOf(argsOf(ring)[0], Number.NaN);
  return Number.NaN;
}

/**
 * A tiled layer's tiles, loaded on first use: `LatticeTiles` of `QuadraticIntegers(d)`,
 * `GaussianIntegers` or `EisensteinIntegers`; `ArrayPlot` of `MultiplicationTable(QuotientRing(Integers, n))`.
 */
async function layerFor(tiles: ShowSpec["tiles"], aspect: "Uniform" | "True"): Promise<ShowLayer | string> {
  if (tiles === undefined) return "Show needs a layer: LatticeTiles(ring, …) or ArrayPlot(table, …).";
  if (tiles.head === "ArrayPlot") {
    // `MultiplicationTable(ring, ElementOrder -> ChineseRemainder)`: how rows and columns list the ring.
    const table = splitOptions(tiles.data, new Set(["ElementOrder"]));
    const n = headOf(tiles.data) === "MultiplicationTable" ? modulusOf(table.positional[0]) : Number.NaN;
    if (!Number.isInteger(n)) return "ArrayPlot needs a table: MultiplicationTable(QuotientRing(Integers, n)).";
    const order = stringOf(table.options.get("ElementOrder")) === "ChineseRemainder" ? "ChineseRemainder" : "Natural";
    const { multiplicationTable } = await import("@enumeratio/residues/table");
    return multiplicationTable(n, order) ?? `ℤ/${n} is too large to tabulate, or not a ring with a table.`;
  }
  const ring = tiles.data;
  const d =
    ring === "GaussianIntegers"
      ? -1
      : ring === "EisensteinIntegers"
        ? -3
        : headOf(ring) === "QuadraticIntegers"
          ? numberOf(argsOf(ring)[0], Number.NaN)
          : Number.NaN;
  if (!Number.isInteger(d))
    return "LatticeTiles needs a ring: QuadraticIntegers(d), GaussianIntegers or EisensteinIntegers.";
  const { quadraticLattice } = await import("@enumeratio/number-theory/lattice");
  const layer = quadraticLattice(d, { scale: aspect === "True" ? "geometric" : "uniform" });
  return layer ?? `ℚ(√${d}) is not a quadratic field: ${d} is a square.`;
}

if (!customElements.get("notatio-show")) customElements.define("notatio-show", NotatioShow);
