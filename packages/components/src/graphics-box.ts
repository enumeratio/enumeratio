import { html, LitElement, nothing, type PropertyValues } from "lit";
import {
  BAND_MODES,
  type BandMode,
  type BoundaryRule,
  bind,
  CANVAS_BLEND,
  type CameraState,
  cameraSpecOf,
  type ColorRule,
  clampView,
  declared,
  drawAxisLabels,
  drawLatticeLines,
  evaluatedShow,
  FIGURE_NOTATION,
  type GestureHandling,
  GRID_STEP,
  GRADIENTS,
  gestureHandlingOf,
  gradientCss,
  gradientNamed,
  hitAt,
  homeView,
  latticeCoordinates,
  type LatticeView,
  loadLatticeModules,
  MAX_POINTS,
  maxExtentFor,
  nearestLatticePoint,
  orbited,
  paddingName,
  holdsPlot,
  paint,
  plainJson,
  type Producer,
  producerOf,
  radixSettingsOf,
  RADIX_OPTIONS,
  RADIX_SYSTEMS,
  prefetchLayers,
  resolvePalette,
  reverseGradient,
  type SchemeColor,
  type ShowLayer,
  type ShowSpec,
  showBox,
  specOf,
  splitOptions,
  stringOf,
  throughCamera,
  TILE_FILL,
  tuple,
  type Vec2,
  wheelZooms,
  wildcardOf,
  zoomed,
} from "@enumeratio/frontend/core";
import { isNode, makeBoxes } from "@enumeratio/boxes";
import { emitControl } from "./define.ts";
import { scopeOf } from "./scope.ts";
import { type FramePlacement, figureFrame, isVertical, placementOf } from "./figure-frame.ts";
import { ensureStyles } from "./styles.ts";
import type { PlotView } from "./plot-view.ts";

type Json = unknown;

/** Milliseconds a frame spends classifying new points before it draws what it has. */
const FRAME_BUDGET = 12;
/** Colors of an indexed scheme the legend shows: the first few values, enough to read it by. */
const INDEXED_SHOWN = 8;
/** A locator's radius, in CSS pixels. */
const LOCATOR_RADIUS = 7;
/** How near (CSS px) a pointer must be to pick a figure's mark or link. */
const HIT_REACH = 12;
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
/** The variables a Show writes: each Locator's, and a `RadixExpansions`' arguments and example. */
interface Writes {
  readonly locators: readonly (string | undefined)[];
  readonly radix?: {
    readonly ring?: string;
    readonly base?: string;
    readonly digits?: string;
    readonly places?: string;
    readonly example?: string;
    readonly onLattice?: string;
  };
}

/** What a Show's expression, unbound, writes back to its variables. */
function writesOf(json: Json): Writes {
  const locators: (string | undefined)[] = [];
  let radix: Writes["radix"];
  for (const layer of splitOptions(json, declared("Show")).positional) {
    if (headOf(layer) === "Locator") locators.push(wildcardOf(argsOf(layer)[0]));
    const data =
      headOf(layer) === "LatticeTiles" ? splitOptions(layer, declared("LatticeTiles")).positional[0] : undefined;
    if (headOf(data) === "RadixExpansions") {
      const { positional, options } = splitOptions(data, RADIX_OPTIONS);
      const [ring, base, digits, places] = positional.map(wildcardOf);
      radix = {
        ring,
        base,
        digits,
        places,
        example: wildcardOf(options.get("Example")),
        onLattice: wildcardOf(options.get("OnLattice")),
      };
    }
  }
  return { locators, ...(radix ? { radix } : {}) };
}

/** A reader's change to one color rule, made from the legend. */
interface Override {
  color?: string;
  gradient?: string;
  mode?: BandMode;
  reverse?: boolean;
}

/**
 * `<graphics-box value="Show(LatticeTiles(QuadraticIntegers(_d), ColorRules -> […]), …)">` —
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
 * - `PolytopeFaces(Permutahedron(4))` is a polytope's faces under a camera, several sharing one
 *   frame; `ViewPoint`, `ViewVertical`, `ViewAngle`, `ViewCenter`, `SphericalRegion -> True` and
 *   `Magnification` aim it (only a camera frame reads them). Drag to orbit; ⌘/Ctrl + wheel or pinch
 *   to zoom.
 * - `GestureHandling -> "cooperative"` (the default), `"greedy"` or `"none"`: `greedy` makes every
 *   wheel zoom, `none` none; the default leaves a plain wheel to the page, except on a full-window
 *   figure.
 *
 * Drag to pan; Esc clears the selection; `0` resets the view.
 *
 * A graph or tree (`GraphPlot`, `TreeGraph`, `LayeredGraphPlot`, `Dendrogram`) and `TorusSquare(2, 3)`
 * are diagram boxes: `DiskBox` vertices, `LineBox` or `ArrowBox` edges and `InsetBox` labels in a frame
 * of their own. The torus square's point follows the page's clock unless `Phase -> 0.32` pins it.
 *
 * A 2-D plot is a `GraphicsBox` too: `<graphics-box value="Plot(Sin(x), (x, 0, 2*Pi), GridLines -> True)">`,
 * and `ParametricPlot`, `PolarPlot`, `ListPlot`, `ListLinePlot` and `ListPolarPlot` likewise, with
 * their Wolfram options (`PlotRange`, `PlotLabel`, `Filling`, `ColorFunction`, `Epilog`, …). The page's kernel
 * samples the expression, the samples lower to a curve (`LineBox`), dots (`PointBox`) or a filled
 * region (`PolygonBox`) in data coordinates, and hovering reads out the nearest sample of each
 * series. Inside a `Manipulate`, its wildcards (`_a`) follow the controls.
 *
 * So is a chart of data: `<graphics-box value="BarChart([3, 1, 4], Labels -> ["a", "b", "c"])">`, and
 * `Histogram`, `PieChart`, `BoxWhiskerChart`, `ArrayPlot` of a matrix and `DiscretePlot` likewise. A bar
 * or a cell is a `RectangleBox`, a pie's wedge a `DiskBox` sector, a stem a `LineBox` and its dot a
 * `PointBox`. `Chart(data)` chooses the member from the data's shape (`Chart(data, "pie")` names it).
 * An option is the attribute its name kebab-cases to: `Labels`, `Label` (the title), `Bins`, `Discrete`
 * (the scheme that colors categories, default `tableau10`), `Gradient` (what an array plot's cells take
 * by value, default `viridis`) and `Reverse`.
 */
export class GraphicsBoxElement extends LitElement {
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
    /** Where the info strip (what is under the pointer, or the layer as a whole) goes: `below`, a side, `none`. */
    captionAt: { type: String, attribute: "caption-at", reflect: true },
    /** The values of the variables its wildcards name, by wildcard (`_d`), set by its scope. */
    bindings: { attribute: false },
    _spec: { state: true },
    _params: { state: true },
    _status: { state: true },
    _selection: { state: true },
    _overrides: { state: true },
    _drawn: { state: true },
    _info: { state: true },
    _edgeColors: { state: true },
  };

  declare value: string;
  declare height: number;
  declare imageSize: string;
  declare ground: string;
  declare selection: string;
  declare aspectRatio: string;
  declare gestureHandling: string;
  declare legendAt: string;
  declare captionAt: string;
  declare bindings: Readonly<Record<string, Json>> | undefined;
  declare _spec: ShowSpec | undefined;
  declare _params: ReadonlyMap<string, Json>;
  declare _status: string;
  declare _selection: readonly Vec2[];
  declare _overrides: ReadonlyMap<number, Override>;
  declare _drawn: number;
  /** What the layer says of the tile under the pointer, for the strip under the plot. */
  declare _info: { title: string; rows: readonly (readonly [string, string])[] } | undefined;
  /** The legend's changes to the edges' colors, by rule. */
  declare _edgeColors: ReadonlyMap<number, string>;

  #source: Json;
  /** The options: those written in `value`, then those given as attributes. */
  #showOptions = new Map<string, Json>();
  #layer: ShowLayer | undefined;
  /** What the lowered box holds to ask for the marks in a view. */
  #producer: Producer | undefined;
  #writes: Writes = { locators: [] };
  /** The example the radix layer last followed, so a new one is told from an edit. */
  #example: string | undefined;
  /** Frame the next layer afresh: a newly chosen example is somewhere else entirely. */
  #reframe = false;
  #layerKey = "";
  /** A camera frame: where the reader has moved the viewer to, until the camera options change. */
  #writtenSelection = "";
  #camera: CameraState | undefined;
  #cameraKey = "";
  /** The layer as drawn: a camera frame's, projected through the camera. */
  #shown: ShowLayer | undefined;
  #touches = new Map<number, Vec2>();
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
  #rebuilds = 0;

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
    this.captionAt = "below";
    this.bindings = undefined;
    this._spec = undefined;
    this._params = new Map();
    this._status = "";
    this._selection = [];
    this._overrides = new Map();
    this._drawn = 0;
    this._info = undefined;
    this._edgeColors = new Map();
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // A diagram that follows the page's clock lets go of it when removed; back on the page, it resumes.
    if (this.#plot) void this.#plot.recompute();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#ro?.disconnect();
    this.#ro = undefined;
    this.#plot?.dispose();
  }

  #plot: PlotView | undefined;

  /** Whether `value` is a 2-D plot, which lowers to a box of data coordinates rather than a figure frame. */
  get #isPlot(): boolean {
    return holdsPlot(this.value);
  }

  /** A plot's area, for an overlay such as a locator: its geometry in px and both ways to data. */
  get frame(): PlotView["frame"] {
    return this.#plot?.frame;
  }

  protected override async updated(changed: PropertyValues): Promise<void> {
    if (this.#isPlot) {
      this.toggleAttribute("data-plot", true);
      if (changed.has("value") || changed.has("bindings") || this.#plot === undefined) {
        this.#plot ??= new (await import("./plot-view.ts")).PlotView(this);
        await this.#plot.recompute();
      }
      return;
    }
    this.toggleAttribute("data-plot", false);
    this.#adoptCanvases();
    const options = ["value", "selection", "aspectRatio", "gestureHandling"];
    if (options.some((k) => changed.has(k))) await this.#read();
    else if (changed.has("bindings")) await this.#bind();
    this.#draw();
  }

  #adoptCanvases(): void {
    const canvases = [...this.querySelectorAll<HTMLCanvasElement>(".graphics-box-layers canvas")];
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

  /** A fixed frame is fitted to its layer: no pan, no zoom. A camera frame is too, in the plane. */
  get #fixed(): boolean {
    return this.#layer?.view === "fixed" || this.#isCamera;
  }

  get #isCamera(): boolean {
    return this.#layer?.view === "camera";
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
    prefetchLayers(json);
    this.#writes = writesOf(json);
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
    const cameraKey = JSON.stringify(
      ["ViewPoint", "ViewVertical", "ViewAngle", "ViewCenter", "Magnification"].map((k) => options.get(k)),
    );
    if (cameraKey !== this.#cameraKey) [this.#cameraKey, this.#camera] = [cameraKey, undefined];
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
    let selected = this.#selectionName === undefined ? undefined : this._params.get(this.#selectionName);
    // A list written out is the starting selection, taken once per reading.
    const written = this.#options.get("Selection");
    if (this.#selectionName === undefined && headOf(written) === "List") {
      const key = JSON.stringify(written);
      if (key === this.#writtenSelection) return;
      [this.#writtenSelection, selected] = [key, written];
    }
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
    const rebuild = ++this.#rebuilds;
    const shown = await evaluatedShow(this.#source, bound);
    const spec = specOf(shown);
    await loadLatticeModules(spec.tiles);
    // A later binding started its own rebuild while this one evaluated: that one draws.
    if (rebuild !== this.#rebuilds) return;
    if (await this.#followExample(spec)) return;
    // The one lowering: what a terminal or an SVG draws is what this draws.
    const box = makeBoxes(shown as never, FIGURE_NOTATION);
    if (!isNode(box) || box[0] !== "GraphicsBox") {
      const why = showBox(shown);
      this._status = typeof why === "string" ? why : "Not a Show(…) expression.";
      return;
    }
    const key = JSON.stringify([spec.tiles, spec.aspect]);
    if (key !== this.#layerKey) {
      const producer = producerOf(box);
      if (typeof producer === "string") {
        this._status = producer;
        return;
      }
      const layer = producer.layer;
      this.#producer = producer;
      this.#layer = layer;
      this.#layerKey = key;
      // A new layer's points are other points: start from what the variable holds, if anything.
      this._selection = [];
      this.#writtenSelection = "";
      this.#adoptBoundSelection();
      // A finite layer is framed whole whenever it changes (a new n is a new table); an
      // unbounded one once, so stepping the ring keeps the reader where they were.
      if (!this.#framed || layer.bounds || this.#reframe) {
        this.#reframe = false;
        this.#view = this.#home(layer);
        this.#framed = true;
        this.#moved = false;
      }
    }
    this._status = spec.unread > 0 ? `${spec.unread} of the layer's rules didn't read.` : "";
    this._spec = spec;
    this.#aim();
    this.#clamp();
    this.#draw();
  }

  /**
   * Keep a radix layer and its `Example -> _e` in step: a newly chosen example writes its ring,
   * base, digits and places; an edit to those writes the example they now are (`Custom` when
   * none). True when it wrote, so the rebuild waits for the variables to come back.
   */
  async #followExample(spec: ShowSpec): Promise<boolean> {
    const names = this.#writes.radix;
    const settings =
      spec.tiles && headOf(spec.tiles.data) === "RadixExpansions" ? radixSettingsOf(spec.tiles.data) : undefined;
    if (!names?.example || !settings) return false;
    const { exampleOf, exampleSettings } = await import("@enumeratio/complex-numerals/lattice");
    const chosen = stringOf(this._params.get(names.example));
    const scope = scopeOf(this);
    // Back onto the lattice: the base and digits go to their nearest lattice points, 0 and
    // repeats dropped.
    const round = ([a, b]: Vec2): Vec2 => [Math.round(a), Math.round(b)];
    const offGrid = (v: Vec2): boolean => !Number.isInteger(v[0]) || !Number.isInteger(v[1]);
    if (settings.onLattice && (offGrid(settings.base) || settings.digits.some(offGrid))) {
      const digits = settings.digits
        .map(round)
        .filter(
          (d, k, all) => (d[0] !== 0 || d[1] !== 0) && all.findIndex((e) => e[0] === d[0] && e[1] === d[1]) === k,
        );
      const writes: [string, Json][] = [];
      if (names.base) writes.push([names.base, tuple(round(settings.base))]);
      if (names.digits) writes.push([names.digits, ["List", ...digits.map(tuple)]]);
      scope?.setMany(writes as never);
      return writes.length > 0;
    }
    if (chosen !== this.#example) {
      this.#example = chosen;
      const target = chosen && chosen !== "Custom" ? exampleSettings(chosen) : undefined;
      if (!target || JSON.stringify(target) === JSON.stringify({ ...settings, onLattice: true })) return false;
      const ring = Object.keys(RADIX_SYSTEMS).find((r) => RADIX_SYSTEMS[r] === target.system)!;
      const writes: [string, Json][] = [];
      if (names.ring) writes.push([names.ring, ring]);
      if (names.base) writes.push([names.base, tuple(target.base)]);
      if (names.digits) writes.push([names.digits, ["List", ...target.digits.map(tuple)]]);
      if (names.places) writes.push([names.places, target.places]);
      // Every example is a lattice's.
      if (names.onLattice && !settings.onLattice) writes.push([names.onLattice, "True"]);
      this.#reframe = writes.length > 0;
      scope?.setMany(writes as never);
      return writes.length > 0;
    }
    const now = exampleOf(settings);
    if (now !== chosen) {
      this.#example = now;
      scope?.set(names.example, `'${now}'` as never);
    }
    return false;
  }

  /** The edge rules with the legend's colors applied. */
  get #boundaryRules(): BoundaryRule[] {
    return (this._spec?.boundaryRules ?? []).map((rule, k) => {
      const color = this._edgeColors.get(k);
      return color ? { ...rule, color } : rule;
    });
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
    if (!this.#layer || this.#fixed) return;
    this.#view = clampView(this.#layer, this.#view, this.#w / this.#h);
  }

  /** The camera frame's state, from its options until the reader moves it. */
  #cameraState(): CameraState {
    return (this.#camera ??= { viewPoint: cameraSpecOf(this.#options).viewPoint, zoom: 1 });
  }

  /** Project a camera frame's layer through the camera, and fit the view to it. */
  #aim(): void {
    const layer = this.#layer;
    if (layer?.view !== "camera") {
      this.#shown = undefined;
      return;
    }
    const { layer: shown, view } = throughCamera(
      layer,
      cameraSpecOf(this.#options),
      this.#cameraState(),
      this.#w / this.#h,
    );
    this.#shown = shown as ShowLayer;
    this.#view = view;
  }

  /** Move the viewer by a drag of dx, dy CSS pixels, or by a zoom factor. */
  #moveCamera(change: { drag?: Vec2; zoom?: number }): void {
    const state = this.#cameraState();
    const spec = cameraSpecOf(this.#options);
    this.#camera = {
      viewPoint: change.drag
        ? orbited(state.viewPoint, spec.viewVertical, change.drag[0], change.drag[1])
        : state.viewPoint,
      zoom: change.zoom ? zoomed(state.zoom * change.zoom) : state.zoom,
    };
    this.#moved = true;
    this.#aim();
    this.#drawNow();
  }

  /** A press on a camera frame: a drag orbits, two fingers pinch, a click picks. */
  #pressCamera(e: PointerEvent, canvas: HTMLCanvasElement): void {
    this.#touches.set(e.pointerId, [e.clientX, e.clientY]);
    canvas.setPointerCapture(e.pointerId);
    const [x0, y0] = [e.clientX, e.clientY];
    let dragged = false;
    const move = (m: PointerEvent): void => {
      const before = this.#touches.get(m.pointerId);
      if (!before) return;
      const other = [...this.#touches].find(([id]) => id !== m.pointerId)?.[1];
      if (other) {
        const [was, now] = [
          Math.hypot(before[0] - other[0], before[1] - other[1]),
          Math.hypot(m.clientX - other[0], m.clientY - other[1]),
        ];
        dragged = true;
        this.#touches.set(m.pointerId, [m.clientX, m.clientY]);
        if (was > 0) this.#moveCamera({ zoom: now / was });
        return;
      }
      if (!dragged && Math.hypot(m.clientX - x0, m.clientY - y0) < SLOP) return;
      dragged = true;
      this.#touches.set(m.pointerId, [m.clientX, m.clientY]);
      this.#moveCamera({ drag: [m.clientX - before[0], m.clientY - before[1]] });
    };
    const up = (u: PointerEvent): void => {
      this.#touches.delete(u.pointerId);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      if (!dragged && this.#touches.size === 0)
        this.#select(this.#hitsAt(this.#planeAt(u.clientX, u.clientY)), u.shiftKey || u.metaKey || u.ctrlKey);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
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
    if (this.#layer && (this.#fixed || (this.#layer.bounds && !this.#moved))) this.#view = this.#home(this.#layer);
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
    const layer = this.#shown ?? this.#layer;
    const spec = this._spec;
    const producer = this.#producer;
    const [tiles, lines, axes] = this.#canvases.map((c) => c.getContext("2d"));
    if (!layer || !spec || !producer || !tiles || !lines || !axes) return;
    for (const ctx of [tiles, lines, axes]) ctx.clearRect(0, 0, this.#w, this.#h);
    tiles.canvas.style.mixBlendMode = CANVAS_BLEND[spec.colorMixing];
    const ink = resolvePalette({ palette: this.ground }).foreground;
    // The producer answers with the marks in this view, as many as the frame's budget classifies.
    const list = producer.list(
      this.#view,
      this.#w,
      this.#h,
      {
        colorRules: this.#colorRules,
        boundaryRules: this.#boundaryRules,
        colorMixing: spec.colorMixing,
        selection: this._selection,
        ink,
        fill: TILE_FILL,
        phase: 0,
        budgetMs: FRAME_BUDGET,
      },
      layer,
    );
    paint(tiles, this.#w, this.#h, list, this.#view, { fill: TILE_FILL, ink });
    const complete = list.complete;
    const gridStep = spec.grid?.auto ? (layer.autoGrid ?? spec.grid.step) : spec.grid?.step;
    // A camera frame has no lattice to ruled lines or axes over.
    const flat = layer.view !== "camera";
    if (flat && spec.grid && gridStep)
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
    if (flat && spec.axes) {
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
    this.#drawLocators(axes, spec);
    if (!complete) this.#draw();
  };

  /**
   * The element under a plane point: the nearest lattice point, or for a layer of points the
   * nearest of them, (n, 0).
   */
  #elementAt(plane: Vec2): Vec2 {
    const layer = this.#layer!;
    const points = layer.points?.();
    if (!points) return nearestLatticePoint(layer.basis, plane);
    let [best, at] = [Infinity, 0];
    for (let n = 0; n < points.length; n++) {
      const d = Math.hypot(points[n]![0] - plane[0], points[n]![1] - plane[1]);
      if (d < best) [best, at] = [d, n];
    }
    return [at, 0];
  }

  /**
   * What a plane point picks: one element, as above; for a figure layer, the address or link
   * within a finger's reach of it (a link picks all its members), or nothing.
   */
  #hitsAt(plane: Vec2): readonly Vec2[] {
    const layer = this.#shown ?? this.#layer!;
    if (!layer.place) return [this.#elementAt(plane)];
    const dpr = this.#w / (this.#canvases[0]?.clientWidth || this.#w);
    return hitAt(layer, plane, (HIT_REACH * dpr * 2 * this.#view.extent) / this.#h);
  }

  /** A locator's place for a plane point: the nearest lattice point, or anywhere off the lattice. */
  #locatorPlace(plane: Vec2): Vec2 {
    const layer = this.#layer!;
    if (!layer.points) return nearestLatticePoint(layer.basis, plane);
    const [a, b] = latticeCoordinates(layer.basis, plane);
    return [Math.round(a * 100) / 100, Math.round(b * 100) / 100];
  }

  /** Where a point in the frame's coordinates falls on the canvas, in device pixels. */
  #screenOf([i, j]: Vec2): Vec2 {
    const [b0, b1] = this.#layer!.basis;
    const [x, y] = [i * b0[0] + j * b1[0], i * b0[1] + j * b1[1]];
    const pixels = this.#h / (2 * this.#view.extent);
    return [(x - this.#view.center[0]) * pixels + this.#w / 2, this.#h / 2 - (y - this.#view.center[1]) * pixels];
  }

  #drawLocators(ctx: CanvasRenderingContext2D, spec: ShowSpec): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    ctx.save();
    ctx.lineWidth = 2 * dpr;
    ctx.font = `${Math.round(12 * dpr)}px system-ui, sans-serif`;
    for (const locator of spec.locators)
      for (const p of locator.points) {
        const [x, y] = this.#screenOf(p);
        ctx.beginPath();
        ctx.arc(x, y, LOCATOR_RADIUS * dpr, 0, 2 * Math.PI);
        ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        if (locator.label) {
          ctx.fillStyle = "#ffffff";
          ctx.fillText(locator.label, x + (LOCATOR_RADIUS + 3) * dpr, y - (LOCATOR_RADIUS + 3) * dpr);
        }
      }
    ctx.restore();
  }

  /** The locator point under a pointer, within reach of a finger: [locator, point]. */
  #locatorAt(clientX: number, clientY: number): [number, number] | undefined {
    const spec = this._spec;
    const canvas = this.#canvases[0];
    if (!spec || !canvas || !this.#layer) return undefined;
    const r = canvas.getBoundingClientRect();
    const dpr = this.#w / r.width;
    const [px, py] = [(clientX - r.left) * dpr, (clientY - r.top) * dpr];
    for (let k = spec.locators.length - 1; k >= 0; k--)
      for (let n = spec.locators[k]!.points.length - 1; n >= 0; n--) {
        const [x, y] = this.#screenOf(spec.locators[k]!.points[n]!);
        if (Math.hypot(x - px, y - py) <= (LOCATOR_RADIUS + 4) * dpr) return [k, n];
      }
    return undefined;
  }

  /** Write a locator's points to its variable. */
  #moveLocator(k: number, points: readonly Vec2[]): void {
    const name = this.#writes.locators[k];
    const locator = this._spec?.locators[k];
    if (!name || !locator) return;
    scopeOf(this)?.set(name, (locator.list ? ["List", ...points.map(tuple)] : tuple(points[0]!)) as never);
  }

  /**
   * A press on a locator drags it, snapped to the lattice; with ⌥ and `LocatorAutoCreate` it
   * takes the point away, or on empty ground adds one. True when the press was the locators'.
   */
  #pressLocator(e: PointerEvent, canvas: HTMLCanvasElement): boolean {
    const spec = this._spec;
    const layer = this.#layer;
    if (!spec || !layer) return false;
    const hit = this.#locatorAt(e.clientX, e.clientY);
    if (e.altKey) {
      const k = hit?.[0] ?? spec.locators.findIndex((l) => l.autoCreate);
      const locator = spec.locators[k];
      if (!locator?.autoCreate) return false;
      const points = hit
        ? locator.points.filter((_, n) => n !== hit[1])
        : [...locator.points, this.#locatorPlace(this.#planeAt(e.clientX, e.clientY))];
      this.#moveLocator(k, points);
      return true;
    }
    if (!hit) return false;
    const [k, n] = hit;
    canvas.setPointerCapture(e.pointerId);
    let last = spec.locators[k]!.points[n]!;
    const move = (m: PointerEvent): void => {
      const to = this.#locatorPlace(this.#planeAt(m.clientX, m.clientY));
      if (to[0] === last[0] && to[1] === last[1]) return;
      last = to;
      const points = [...(this._spec?.locators[k]?.points ?? [])];
      points[n] = to;
      this.#moveLocator(k, points);
    };
    const up = (): void => {
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    return true;
  }

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
      new CustomEvent("graphics-box-select", { detail: { points: this._selection }, bubbles: true, composed: true }),
    );
  }

  /**
   * Select what a click picked: alone, or — with shift or ⌘ — added to (or taken from) the
   * selection. A link picks all its members, which toggle together.
   */
  #select(points: readonly Vec2[], extend: boolean): void {
    if (!this.#selectionName && !this.#options.has("Selection")) return;
    const bounds = this.#layer?.bounds;
    const picked = points.filter(
      (p) =>
        p.every(Number.isFinite) &&
        !(bounds && (p[0] < bounds.i[0] || p[0] > bounds.i[1] || p[1] < bounds.j[0] || p[1] > bounds.j[1])),
    );
    const key = (p: Vec2) => `${p[0]},${p[1]}`;
    if (picked.length === 0) {
      // A click on nothing clears a figure's selection.
      if (!extend && this.#layer?.place && this._selection.length > 0) {
        this._selection = [];
        this.#publishSelection();
        this.#draw();
      }
      return;
    }
    const chosen = new Set(this._selection.map(key));
    const all = picked.every((p) => chosen.has(key(p)));
    if (extend)
      this._selection = all
        ? this._selection.filter((p) => !picked.some((q) => key(q) === key(p)))
        : [...this._selection, ...picked.filter((p) => !chosen.has(key(p)))];
    else this._selection = all && this._selection.length === picked.length ? [] : [...picked];
    // Selecting a point asks for it in full, whatever the frame's budget left undone.
    for (const [i, j] of picked) if (!this.#layer?.known(i, j)) this.#layer?.prepare(i, j);
    this.#publishSelection();
    this.#draw();
  }

  #onPointerDown = (e: PointerEvent): void => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    if (!this.#layer) return;
    canvas.focus({ preventScroll: true });
    if (this.#pressLocator(e, canvas)) return;
    if (this.#isCamera) {
      this.#pressCamera(e, canvas);
      return;
    }
    const r = canvas.getBoundingClientRect();
    const [x0, y0] = [e.clientX, e.clientY];
    let [px, py] = [x0, y0];
    let dragged = false;
    canvas.setPointerCapture(e.pointerId);
    const move = (m: PointerEvent): void => {
      if (this.#fixed || (!dragged && Math.hypot(m.clientX - x0, m.clientY - y0) < SLOP)) return;
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
        this.#select(this.#hitsAt(this.#planeAt(u.clientX, u.clientY)), u.shiftKey || u.metaKey || u.ctrlKey);
    };
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
  };

  #infoKey = "";

  /** What the layer says of the tile under the pointer, in the strip under the plot. */
  #onHover = (e: PointerEvent): void => {
    const layer = this.#layer;
    if (!layer || e.buttons !== 0) return;
    const [i, j] = this.#hitsAt(this.#planeAt(e.clientX, e.clientY))[0] ?? [Number.NaN, Number.NaN];
    const { bounds } = layer;
    const outside =
      !Number.isFinite(i) ||
      !Number.isFinite(j) ||
      (bounds && (i < bounds.i[0] || i > bounds.i[1] || j < bounds.j[0] || j > bounds.j[1]));
    if (outside) {
      this.#onLeave();
      return;
    }
    const key = `${i},${j}`;
    if (key === this.#infoKey) return;
    this.#infoKey = key;
    if (!layer.known(i, j)) layer.prepare(i, j);
    this._info = layer.describe(i, j);
  };

  #onLeave = (): void => {
    this._info = undefined;
    this.#infoKey = "";
  };

  #onWheel = (e: WheelEvent): void => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    if (this.#isCamera) {
      if (!wheelZooms(e, canvas, this.#gestures)) return;
      e.preventDefault();
      this.#moveCamera({ zoom: Math.exp(-e.deltaY * 0.005) });
      return;
    }
    if (this.#fixed || !wheelZooms(e, canvas, this.#gestures) || !this.#layer) return;
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

  /** Where a layer starts: a finite one fitted whole to the canvas, else the layer's own home. */
  #home(layer: ShowLayer): LatticeView {
    if (layer.view === "camera") {
      this.#aim();
      return this.#view;
    }
    return homeView(layer, this.#w / this.#h);
  }

  resetView = (): void => {
    this.#moved = false;
    this.#camera = undefined;
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
    const colors = this._spec?.defaulted.colors ? [] : this.#colorRules;
    const edges = this._spec?.defaulted.edges ? [] : this.#boundaryRules;
    if (colors.length + edges.length === 0) return undefined;
    return html`<ul class=${`graphics-box-legend graphics-box-legend ${vertical ? "is-vertical" : ""}`}>
      ${colors.map((rule, k) => (typeof rule.paint === "string" ? this.#swatch(rule, rule.paint, k) : this.#scheme(rule, rule.paint, k)))}
      ${edges.map((rule, k) => this.#edge(rule, k))}
    </ul>`;
  }

  /** A color rule's swatch, which opens a color picker. */
  #swatch(rule: ColorRule, color: string, k: number): unknown {
    return html`<li>
      <label class="graphics-box-swatch" data-tip="Choose the color">
        <i style=${`background:${color}; opacity:${rule.opacity}`}></i>
        <input
          type="color"
          .value=${color}
          aria-label=${`${rule.label} color`}
          @input=${(e: Event) => this.#setOverride(k, { color: (e.target as HTMLInputElement).value })}
        />
      </label>
      <span class="graphics-box-legend-label">${rule.label}</span>
    </li>`;
  }

  /** An edge rule's swatch, its outline the edge's color, which opens a color picker. */
  #edge(rule: BoundaryRule, k: number): unknown {
    return html`<li>
      <label class="graphics-box-swatch" data-tip="Choose the edge color">
        <i style=${`box-shadow: inset 0 0 0 ${Math.max(1.5, rule.width)}px ${rule.color}; opacity:${rule.opacity}`}></i>
        <input
          type="color"
          .value=${rule.color}
          aria-label=${`${rule.label} edge color`}
          @input=${(e: Event) => {
            this._edgeColors = new Map(this._edgeColors).set(k, (e.target as HTMLInputElement).value);
            this.#draw();
          }}
        />
      </label>
      <span class="graphics-box-legend-label">${rule.label}</span>
    </li>`;
  }

  /** An indexed scheme's first colors, numbered: what value k paints. */
  #indexed(rule: ColorRule, colors: readonly string[]): unknown {
    return html`<li class="graphics-box-indexed">
      <span class="graphics-box-legend-label">${rule.label}</span>
      ${colors.slice(0, INDEXED_SHOWN).map((c, n) => html`<span><i style=${`background:${c}`}></i>${n}</span>`)}
    </li>`;
  }

  /**
   * A scheme rule: a swatch like a color's, the gradient drawn across it at an angle, which opens
   * the schemes; where the band falls, and the padding and reverse, beside it on hover.
   */
  #scheme(rule: ColorRule, scheme: SchemeColor, k: number): unknown {
    if (scheme.indexed) return this.#indexed(rule, scheme.indexed);
    const { mode, band, offset } = scheme;
    const at = (k: number): string => String(+(offset + k * band).toPrecision(6));
    const ends =
      mode === "reflect"
        ? `${at(0)}, ${at(2)}, … to ${at(1)}, ${at(3)}, …`
        : mode === "wrap"
          ? `from ${at(0)}, again every ${at(1)}`
          : `${at(0)} and below to ${at(1)} and past`;
    const next = BAND_MODES[(BAND_MODES.indexOf(mode) + 1) % BAND_MODES.length]!;
    return html`<li class="graphics-box-scheme">
      <label class="graphics-box-swatch" data-tip=${`${scheme.gradient.label}: ${ends}`}>
        <i style=${`background:${gradientCss(scheme.gradient, "135deg")}`}></i>
        <select
          aria-label=${`${rule.label} color scheme`}
          @change=${(e: Event) => this.#setOverride(k, { gradient: (e.target as HTMLSelectElement).value })}
        >
          ${GRADIENTS.map((g) => html`<option value=${g.name} ?selected=${g.name === scheme.gradient.name}>${g.label}</option>`)}
        </select>
      </label>
      <span class="graphics-box-legend-label">${rule.label}</span>
      <span class="graphics-box-ends">
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

  /**
   * The strip under the plot: what the layer says of the tile under the pointer, else of the one
   * selected, else of the layer as a whole.
   */
  #infoTemplate(): unknown {
    const layer = this.#layer;
    if (!layer) return undefined;
    const [only] = this._selection.length === 1 ? this._selection : [];
    const info =
      this._info ?? (only ? layer.describe(only[0], only[1]) : { title: layer.title, rows: layer.summary() });
    return html`<p class="graphics-box-info" aria-live="polite">
      <strong>${info.title}</strong>
      ${info.rows.map(([k, v]) => html`<span><span class="graphics-box-info-key">${k}</span> ${v}</span>`)}
    </p>`;
  }

  /** `ImageSize -> [Automatic, h]` (or `[w, h]`), in the expression or as an attribute, gives the height. */
  get #height(): number {
    const size = this.#options.get("ImageSize");
    const h = Array.isArray(size) && size[0] === "List" ? Number(size[2]) : Number.NaN;
    const sized = /^\[\s*[^,\]]+,\s*(\d+(?:\.\d+)?)\s*\]$/.exec(this.imageSize.trim());
    return (Number.isFinite(h) && h > 0 ? h : 0) || Number(sized?.[1]) || Number(this.height) || 480;
  }

  protected override render(): unknown {
    if (this.#isPlot) return this.#plot?.render() ?? nothing;
    const ground = resolvePalette({ palette: this.ground });
    const legendAt: FramePlacement = placementOf(this.legendAt, "right");
    const stage = html`<div
        class=${`graphics-box-layers${this.#fixed ? " is-fixed" : ""}${this.#isCamera ? " is-camera" : ""}`}
        style=${`background:${ground.background}`}
      >
        ${["tiles", "lines", "axes"].map(
          (name) =>
            html`<canvas
              class=${`graphics-box-${name}`}
              tabindex=${name === "axes" ? "0" : "-1"}
              aria-label=${name === "axes" ? `Plot: ${this.#layer?.title ?? ""}` : nothing}
              @pointerdown=${name === "axes" ? this.#onPointerDown : nothing}
              @pointermove=${name === "axes" ? this.#onHover : nothing}
              @pointerleave=${name === "axes" ? this.#onLeave : nothing}
              @wheel=${name === "axes" ? this.#onWheel : nothing}
              @keydown=${name === "axes" ? this.#onKey : nothing}
            ></canvas>`,
        )}
      </div>
      ${this._status ? html`<p class="graphics-box-status">${this._status}</p>` : nothing}`;
    return html`<div class="graphics-box-figure">
      ${figureFrame({
        stage,
        stageStyle: `min-height:${this.#height}px`,
        legend: this.#legendTemplate(isVertical(legendAt)),
        caption: this.#infoTemplate(),
        captionAt: placementOf(this.captionAt, "below"),
        legendAt,
      })}
    </div>`;
  }
}

if (!customElements.get("graphics-box")) customElements.define("graphics-box", GraphicsBoxElement);
