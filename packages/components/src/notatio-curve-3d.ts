import type { BoxedExpression } from "@cortex-js/compute-engine";
import { parseNotatio } from "@enumeratio/formats/notatio";
import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { loadEngine } from "./mathlive.ts";
import { type Clock, pageClock } from "./clock.ts";
import { Orbit, ORBIT_HINT, type OrbitView } from "./orbit.ts";
import { curve3dSvg, type Point3 } from "./plot3d.ts";
import { ensureStyles } from "./styles.ts";

/**
 * `<notatio-curve-3d value="KnotCurve(TorusKnot(2, 3))">` -- a curve in space, from an
 * expression that evaluates to a list of points.
 *
 * Driven by the expression, not by attributes: the figure on a page is then the same
 * thing a reader can retype and change, and the heads that produce it (`KnotCurve`,
 * `LorenzCurve`) are ordinary heads anyone can call.
 *
 * A knot is only legible if you can see which strand passes in front, so the curve is
 * drawn as depth-sorted arcs, each cased in the background colour: the nearer strand
 * erases the farther where they meet. Hue runs along the parameter, so a strand can be
 * followed through a crossing. Drag rotates, ctrl/⌘ + wheel zooms, double-click resets —
 * the same gestures `<notatio-plot-3d>` uses.
 */
export class NotatioCurve3D extends LitElement {
  static properties = {
    /** A notatio expression evaluating to a list of 3-D points. */
    value: { type: String },
    /**
     * Points to draw directly, skipping the expression. For a host that has already
     * evaluated the curve (a worksheet has), re-parsing and re-evaluating the same
     * expression here would double the cost of every frame. Set as a property.
     */
    points: { attribute: false },
    /** Rotation about the vertical, in degrees. Dragging changes this. */
    azimuth: { type: Number },
    /** Viewing angle above the plane, in degrees. Dragging changes this. */
    elevation: { type: Number },
    /** View scale; ctrl/cmd + wheel or a pinch changes this. */
    zoom: { type: Number },
    /** Leave the curve open, for a trajectory that is not a loop. */
    open: { type: Boolean },
    /** Draw the torus the curve lies on, faintly, behind it: "major,minor". */
    torus: { type: String },
    /** Caption drawn above the curve. */
    label: { type: String },
    at: { type: Number },
    clock: { type: String },
    _svg: { state: true },
    _error: { state: true },
  };

  declare value: string;
  declare points: readonly Point3[] | undefined;
  declare azimuth: number;
  declare elevation: number;
  declare zoom: number;
  declare open: boolean;
  declare torus: string;
  declare label: string;
  declare at: number;
  declare clock: string;
  declare _svg: string;
  declare _error: string;

  #orbit = new Orbit(this);
  #clock: Clock = pageClock();
  #unwatch: (() => void) | undefined;
  /** Where the travelling marker is, when this figure is following the page's clock. */
  #phase = 0;
  get #view(): OrbitView {
    return this.#orbit.view;
  }

  #points: Point3[] = [];

  constructor() {
    super();
    this.value = "";
    this.points = undefined;
    this.azimuth = 45;
    this.elevation = 25;
    this.zoom = 1;
    this.open = false;
    this.torus = "";
    this.label = "";
    this.at = Number.NaN;
    this.clock = "false";
    this._svg = "";
    this._error = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    // Only a figure that asked for a marker watches the clock — an animated dot on every knot
    // on the site is not what the pages that already use this element wanted.
    if (this.clock !== "false" && !Number.isFinite(Number(this.at)))
      this.#unwatch = this.#clock.watch((tick) => {
        this.#phase = tick.phase;
        this.#draw();
      });
  }

  override disconnectedCallback(): void {
    this.#unwatch?.();
    this.#unwatch = undefined;
    super.disconnectedCallback();
  }

  /** `clock`, not `animate`: every element inherits `Element.animate()` from the DOM, and a
   *  reactive property of that name shadows it. */
  get #marker(): number | undefined {
    const pinned = Number(this.at);
    if (Number.isFinite(pinned)) return pinned;
    return this.clock === "false" ? undefined : this.#phase;
  }

  protected override firstUpdated(): void {
    this.#orbit.remember();
  }

  protected override willUpdate(changed: PropertyValues): void {
    const given = this.points;
    if (changed.has("points") && given !== undefined) {
      if (given.length >= 2) {
        this.#points = [...given];
        this._error = "";
        this.#draw();
      }
      return;
    }
    if (changed.has("value") && given === undefined) {
      void this.#sample();
      return;
    }
    // A turn of the camera re-projects the points it already has; nothing is resampled.
    if (changed.has("azimuth") || changed.has("elevation") || changed.has("zoom")) this.#draw();
  }

  /** Evaluate the expression and read a list of points out of the result. */
  async #sample(): Promise<void> {
    if (!this.value.trim()) return;
    const engine = await loadEngine();
    let json: unknown;
    let errors: readonly unknown[];
    try {
      ({ json, errors } = parseNotatio(this.value, {
        parseLatex: (tex: string) => engine.parse(tex).json,
      }));
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      return;
    }
    if (errors.length) {
      this._error = `could not parse: ${this.value}`;
      return;
    }
    let value: BoxedExpression;
    try {
      value = engine.box(json as Parameters<typeof engine.box>[0]).evaluate();
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      return;
    }
    let points: Point3[];
    try {
      points = pointsOf(value);
    } catch (err) {
      this._error = err instanceof Error ? err.message : String(err);
      return;
    }
    if (points.length < 2) {
      this._error = `not a list of points: ${this.value}`;
      return;
    }
    this._error = "";
    this.#points = points;
    this.#draw();
  }

  #draw(): void {
    if (this.#points.length < 2) return;
    const view = this.#view;
    try {
      this.#render(view);
      this._error = "";
    } catch (err) {
      // A figure that cannot be drawn reports itself and leaves the page standing.
      this._error = err instanceof Error ? err.message : String(err);
    }
  }

  #render(view: { azimuth: number; elevation: number; zoom: number }): void {
    this._svg = curve3dSvg(this.#points, {
      azimuth: view.azimuth,
      elevation: view.elevation,
      zoom: view.zoom,
      // A trajectory is not a loop: joining its ends draws a chord no solution takes.
      closed: !this.open,
      torus: this.#torus(),
      marker: this.#marker,
    });
  }

  /** The surface to draw behind the curve, from `torus="major,minor"`. */
  #torus(): { major: number; minor: number } | undefined {
    const [major, minor] = String(this.torus)
      .split(",")
      .map((t) => Number(t.trim()));
    return Number.isFinite(major) && Number.isFinite(minor) && major > 0 && minor > 0
      ? { major, minor }
      : undefined;
  }

  protected override render(): unknown {
    return html`<figure class="notatio-curve-3d">
      <span
        class="notatio-plot-box"
        title=${ORBIT_HINT}
        @pointerdown=${this.#orbit.onPointerDown}
        @pointermove=${this.#orbit.onPointerMove}
        @pointerup=${this.#orbit.onPointerUp}
        @pointercancel=${this.#orbit.onPointerUp}
        @wheel=${this.#orbit.onWheel}
        @dblclick=${this.#orbit.onDblClick}
        >${
          this._error
            ? html`<span class="notatio-error">${this._error}</span>`
            : unsafeHTML(this._svg)
        }</span
      >
      ${this.label ? html`<figcaption>${this.label}</figcaption>` : ""}
    </figure>`;
  }
}

// `ops` lives on compute-engine's narrowed function interface; read it structurally.
const opsOf = (e: BoxedExpression): readonly BoxedExpression[] =>
  (e as unknown as { ops?: readonly BoxedExpression[] }).ops ?? [];

/**
 * Read `[[x,y,z], …]` out of an evaluated expression.
 *
 * Straight off the boxed operands where it can: `.json` materialises the whole tree
 * first, which for a 600-point curve is ~1800 throwaway nodes per frame on top of the
 * ~1800 boxed numbers the curve already allocated. Falls back to the JSON reading for
 * anything not shaped as a boxed list of boxed lists.
 */
export function pointsOf(value: BoxedExpression): Point3[] {
  if (value.operator === "List") {
    const rows = opsOf(value);
    const out: Point3[] = [];
    for (const row of rows) {
      if (row.operator !== "List") continue;
      const [a, b, c] = opsOf(row);
      const p: Point3 = [a?.re ?? Number.NaN, b?.re ?? Number.NaN, c?.re ?? Number.NaN];
      if (p.every((v) => Number.isFinite(v))) out.push(p);
    }
    if (out.length > 0) return out;
  }
  const json = value.json as unknown;
  if (!Array.isArray(json) || json[0] !== "List") return [];
  const out: Point3[] = [];
  for (const row of json.slice(1)) {
    if (!Array.isArray(row) || row[0] !== "List" || row.length !== 4) continue;
    const [x, y, z] = row.slice(1).map(numberOf);
    if (x === undefined || y === undefined || z === undefined) continue;
    out.push([x, y, z]);
  }
  return out;
}

function numberOf(node: unknown): number | undefined {
  if (typeof node === "number") return node;
  if (Array.isArray(node) && node.length === 3 && node[0] === "Rational") {
    const p = numberOf(node[1]);
    const q = numberOf(node[2]);
    return p !== undefined && q !== undefined && q !== 0 ? p / q : undefined;
  }
  if (typeof node === "object" && node !== null) {
    const num = (node as { num?: unknown }).num;
    if (typeof num === "string") {
      const v = Number(num.replace(/_/g, ""));
      return Number.isFinite(v) ? v : undefined;
    }
  }
  return undefined;
}

if (!customElements.get("notatio-curve-3d")) {
  customElements.define("notatio-curve-3d", NotatioCurve3D);
}
