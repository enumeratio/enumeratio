import katex from "katex";
import { html, LitElement, nothing, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
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
  type ControlChange,
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
  parseProse,
  type ProsePart,
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
import "./notatio-stepper.ts";
import "./notatio-toggler.ts";
import { ensureStyles } from "./styles.ts";

type Json = unknown;

/** A ring's lattice as `LatticeTiles` draws it: the tiles' layer, plus its frame and how to label it. */
interface RingLayer extends TileLayer {
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
const isRule = (json: Json): boolean =>
  ["Rule", "KeyValuePair", "Tuple"].includes(headOf(json) ?? "") && argsOf(json).length === 2;
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
  readonly ring?: Json;
  readonly colorRules: readonly ColorRule[];
  readonly boundaryRules: readonly BoundaryRule[];
  readonly colorMixing: ColorMixing;
  /** Rules whose test or style didn't read. */
  readonly unread: number;
  readonly grid?: { readonly step: number; readonly style: LineStyle };
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
  let ring: Json;
  let colorRules: ColorRule[] = [];
  let boundaryRules: BoundaryRule[] = [];
  let colorMixing: ColorMixing = "First";
  let unread = 0;
  for (const layer of positional) {
    if (headOf(layer) !== "LatticeTiles") continue;
    const tiles = splitOptions(layer, declared("LatticeTiles"));
    ring = tiles.positional[0];
    const colors = rulesOf(tiles.options.get("ColorRules"), colorRuleOf);
    const edges = rulesOf(tiles.options.get("BoundaryStyle"), boundaryRuleOf);
    colorRules = colors.rules;
    boundaryRules = edges.rules;
    colorMixing = colorMixingOf(tiles.options.get("ColorMixing"));
    unread = colors.unread + edges.unread;
  }
  // `GridLines -> n` (ours) draws a line every n units of the frame; `Automatic` every GRID_STEP.
  const gridLines = options.get("GridLines");
  const step = gridLines === "Automatic" ? GRID_STEP : numberOf(gridLines, 0);
  const grid =
    step > 0
      ? { step, style: lineStyleOf(options.get("GridLinesStyle"), { color: "#ffffff", width: 1, opacity: 0.16 }) }
      : undefined;
  const axes =
    options.get("Axes") === "True"
      ? {
          style: lineStyleOf(options.get("AxesStyle"), { color: "", width: 1.5, opacity: 0.55 }),
          ticks: options.get("Ticks") !== "None",
        }
      : undefined;
  return {
    ring,
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
 * - `GridLines -> 10` (every 10 units of the frame, which for a hexagonal ring is rhombic),
 *   `GridLinesStyle`, `Axes -> True`, `AxesStyle`, `Ticks -> None`, and
 *   `AspectRatio -> Automatic` for true scale.
 * - `Parameters -> [d -> -5, highlight -> Associates]` declares what the caption's holes bind;
 *   the expression reads each as `_d`.
 * - `Caption -> "Primes of $\mathbb{Q}(\sqrt{d})$ {d | stepper skip=squarefree random=400} …"`:
 *   prose whose holes are controls (`stepper`, or `choices='A -> a|B -> b'` for a word that cycles).
 * - The legend is made from the rules and is how their colors change: a swatch opens a color, a
 *   bar the color schemes, `↺` the scheme's padding past its ends, `⇄` reverses it.
 * - `Selection -> s`: shift/⌘-click selects several; the element publishes them as the binding
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
    /** The ground the layers draw on: one of the palettes' grounds. */
    ground: { type: String },
    /** Options as attributes, as `Show` written in markup lowers them; each one Epsil. */
    caption: { type: String },
    parameters: { type: String },
    selection: { type: String },
    aspectRatio: { type: String, attribute: "aspect-ratio" },
    gestureHandling: { type: String, attribute: "gesture-handling" },
    /** Where the caption and legend go: `below`, `right`, a corner to overlay, `none`. */
    captionAt: { type: String, attribute: "caption-at", reflect: true },
    legendAt: { type: String, attribute: "legend-at", reflect: true },
    _spec: { state: true },
    _params: { state: true },
    _status: { state: true },
    _selection: { state: true },
    _overrides: { state: true },
    _drawn: { state: true },
  };

  declare value: string;
  declare height: number;
  declare ground: string;
  declare caption: string;
  declare parameters: string;
  declare selection: string;
  declare aspectRatio: string;
  declare gestureHandling: string;
  declare captionAt: string;
  declare legendAt: string;
  declare _spec: ShowSpec | undefined;
  declare _params: ReadonlyMap<string, Json>;
  declare _status: string;
  declare _selection: readonly Vec2[];
  declare _overrides: ReadonlyMap<number, Override>;
  declare _drawn: number;

  #source: Json;
  /** The options: those written in `value`, then those given as attributes. */
  #showOptions = new Map<string, Json>();
  #layer: RingLayer | undefined;
  #layerKey = "";
  #canvases: HTMLCanvasElement[] = [];
  #view: LatticeView = { center: [0, 0], extent: 20 };
  #framed = false;
  #w = 2;
  #h = 2;
  #queued = false;
  #ro: ResizeObserver | undefined;
  #build = 0;
  #tex = new Map<string, string>();

  constructor() {
    super();
    this.value = "";
    this.height = 480;
    this.ground = DEFAULT_GROUND;
    this.caption = "";
    this.parameters = "";
    this.selection = "";
    this.aspectRatio = "";
    this.gestureHandling = "";
    this.captionAt = "below";
    this.legendAt = "right";
    this._spec = undefined;
    this._params = new Map();
    this._status = "";
    this._selection = [];
    this._overrides = new Map();
    this._drawn = 0;
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
    const options = ["value", "caption", "parameters", "selection", "aspectRatio", "gestureHandling"];
    if (options.some((k) => changed.has(k))) await this.#read();
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

  get #selectionName(): string | undefined {
    const s = this.#options.get("Selection");
    return typeof s === "string" && !s.startsWith("'") ? s : undefined;
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
      ["Caption", this.caption],
      ["Parameters", this.parameters],
      ["Selection", this.selection],
      ["AspectRatio", this.aspectRatio],
      ["GestureHandling", this.gestureHandling],
    ];
    for (const [name, text] of attributes) {
      if (!text) continue;
      // A caption is prose; the others are expressions.
      options.set(
        name,
        name === "Caption" ? `'${text.replace(/^"([\s\S]*)"$/, "$1")}'` : ((await readStructure(text)) ?? text),
      );
    }
    if (build !== this.#build) return;
    this.#showOptions = options;
    // A parameter keeps the value its control moved it to while it stays declared; re-reading
    // for another attribute (the aspect ratio, say) must not put `d` back to its start.
    const params = new Map<string, Json>();
    for (const rule of argsOf(this.#options.get("Parameters"))) {
      if (!isRule(rule)) continue;
      const name = String(argsOf(rule)[0]);
      params.set(name, this._params.has(name) ? this._params.get(name) : argsOf(rule)[1]);
    }
    this._params = params;
    await this.#rebuild();
  }

  /** Bind the parameters, read the spec, and load the ring's layer when the ring changed. */
  async #rebuild(): Promise<void> {
    const spec = specOf(bind(this.#source, this._params));
    const ring = spec.ring;
    const key = JSON.stringify([ring, spec.aspect]);
    if (key !== this.#layerKey) {
      const layer = await layerFor(ring, spec.aspect);
      if (typeof layer === "string") {
        this._status = layer;
        return;
      }
      this.#layer = layer;
      this.#layerKey = key;
      this._selection = [];
      if (!this.#framed) {
        this.#view = layer.home?.() ?? { center: [0, 0], extent: 20 };
        this.#framed = true;
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
    if (spec.grid)
      drawLatticeLines(lines, this.#w, this.#h, layer.basis, layer.grid, this.#view, spec.grid.step, spec.grid.style);
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
          spec.grid?.step ?? GRID_STEP,
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

  #onWheel = (e: WheelEvent): void => {
    const canvas = e.currentTarget as HTMLCanvasElement;
    if (!wheelZooms(e, canvas, this.#gestures) || !this.#layer) return;
    e.preventDefault();
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
  resetView = (): void => {
    this.#view = this.#layer?.home?.() ?? { center: [0, 0], extent: 20 };
    this.#clamp();
    this.#drawNow();
  };

  /** A caption control moved: rebind its parameter and rebuild, keeping the change here. */
  #onControl = (e: Event): void => {
    const detail = (e as CustomEvent<ControlChange>).detail;
    if (!detail || !this._params.has(detail.name)) return;
    e.stopPropagation();
    const params = new Map(this._params);
    params.set(detail.name, detail.value);
    this._params = params;
    void this.#rebuild();
  };

  // ── Caption and legend ──────────────────────────────────────────────────────────────

  #texOf(latex: string): unknown {
    let markup = this.#tex.get(latex);
    if (markup === undefined) {
      markup = katex.renderToString(latex, { throwOnError: false });
      this.#tex.set(latex, markup);
    }
    return unsafeHTML(markup);
  }

  #captionPart(part: ProsePart): unknown {
    switch (part.kind) {
      case "text":
        return part.text;
      case "tex":
        return this.#texOf(this.#substitute(part.latex));
      case "dynamic":
        return this.#substitute(part.value);
      case "knob": {
        const o = part.options;
        const value = this._params.get(part.name);
        if ("stepper" in o) {
          return html`<notatio-stepper
            name=${part.name}
            .value=${numberOf(value, 0)}
            skip=${o.skip ?? ""}
            random=${o.random ?? "0"}
          ></notatio-stepper>`;
        }
        if (o.choices) {
          return html`<notatio-toggler
            name=${part.name}
            values=${o.choices}
            .value=${String(stringOf(value) ?? value)}
          ></notatio-toggler>`;
        }
        return String(stringOf(value) ?? value);
      }
    }
    return nothing;
  }

  /** Parameters read inside a `$…$` island or a readout: `d` → its value. */
  #substitute(text: string): string {
    let out = text;
    for (const [name, value] of this._params)
      out = out.replace(new RegExp(`(?<![\\\\\\w])${name}(?!\\w)`, "g"), String(stringOf(value) ?? value));
    return out;
  }

  #captionTemplate(): unknown {
    const text = stringOf(this.#options.get("Caption"));
    if (!text) return undefined;
    const parts = parseProse(text, new Set(this._params.keys()));
    return html`<p class="notatio-show-caption" @notatio-control-change=${this.#onControl}>
      ${parts.map((p) => this.#captionPart(p))}
    </p>`;
  }

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
    const { mode, band } = scheme;
    const ticks =
      mode === "reflect"
        ? [`0, ${2 * band}, …`, `${band}, ${3 * band}, …`]
        : mode === "wrap"
          ? [`0, ${band}, …`, ""]
          : ["0", `${band} and past`];
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

  protected override render(): unknown {
    const ground = resolvePalette({ palette: this.ground });
    const legendAt: FramePlacement = placementOf(this.legendAt, "right");
    const captionAt: FramePlacement = placementOf(this.captionAt, "below");
    const stage = html`<div class="notatio-show-layers" style=${`background:${ground.background}`}>
        ${["tiles", "lines", "axes"].map(
          (name) =>
            html`<canvas
              class=${`notatio-show-${name}`}
              tabindex=${name === "axes" ? "0" : "-1"}
              aria-label=${name === "axes" ? `Plot: ${this.#layer?.title ?? ""}` : nothing}
              @pointerdown=${name === "axes" ? this.#onPointerDown : nothing}
              @wheel=${name === "axes" ? this.#onWheel : nothing}
              @keydown=${name === "axes" ? this.#onKey : nothing}
            ></canvas>`,
        )}
      </div>
      ${this._status ? html`<p class="notatio-lattice-status">${this._status}</p>` : nothing}`;
    return html`<div class="notatio-show">
      ${figureFrame({
        stage,
        stageStyle: `min-height:${Number(this.height) || 480}px`,
        caption: this.#captionTemplate(),
        legend: this.#legendTemplate(isVertical(legendAt)),
        captionAt,
        legendAt,
      })}
    </div>`;
  }
}

/** The layer for a ring, loaded on first use: `QuadraticIntegers(d)`, `GaussianIntegers`. */
async function layerFor(ring: Json, aspect: "Uniform" | "True"): Promise<RingLayer | string> {
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
