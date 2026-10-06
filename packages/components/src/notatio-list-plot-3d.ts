import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { ensureStyles } from "./styles.ts";
import { gridFromPoints, mesh3dSvg, type Point3, scatter3dSvg } from "@enumeratio/frontend/core";

/** Parse a JSON attribute defensively -- an empty/invalid value reads as `undefined`. */
function parseJson(value: string): unknown {
  const text = value.trim();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** `[[x, y, z], ...]` triples. */
function toPoints(data: unknown): Point3[] | undefined {
  if (!Array.isArray(data) || data.length === 0) return undefined;
  if (!data.every((p) => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(isNumber))) return undefined;
  return (data as number[][]).map(([x, y, z]) => ({ x, y, z }));
}

/** A rectangular 2-D matrix of heights. */
function toMatrix(data: unknown): number[][] | undefined {
  if (!Array.isArray(data) || data.length === 0 || !data.every((r) => Array.isArray(r))) return undefined;
  // A `null` (or any non-number) reads as a hole, not as a dropped cell, so
  // rows keep their length and the grid stays rectangular.
  const rows = (data as unknown[][]).map((r) => r.map((v) => (isNumber(v) ? v : Number.NaN)));
  return rows.every((r) => r.length === rows[0].length && r.length > 0) ? rows : undefined;
}

/**
 * `<ListPlot3D data="[[0,1],[2,3]]">` -- 3-D data, orthographically
 * projected. `type="surface"` (the default) reads `data` as a height grid and
 * draws it as a quad mesh (Wolfram's `ListPlot3D` / `ListSurfacePlot3D`);
 * `type="points"` reads `data` as `[x, y, z]` triples and draws a scatter
 * (`ListPointPlot3D`). Triples given to the surface form are binned onto an
 * `n`×`n` grid first, so scattered samples still surface.
 *
 * The view is fixed by `azimuth` / `elevation` (no interaction), keeping the
 * whole pipeline a pure function of the attributes -- it renders identically
 * under SSR and in the browser.
 *
 * Height is colored on the `gradient` (default `viridis`; `reverse` runs it the other way).
 */
export class NotatioListPlot3D extends LitElement {
  static properties = {
    data: { type: String },
    type: { type: String },
    azimuth: { type: Number },
    elevation: { type: Number },
    zoom: { type: Number },
    n: { type: Number },
    size: { type: Number },
    depthCue: { type: Number, attribute: "depth-cue" },
    wireframe: { type: String },
    axes: { type: String },
    zrange: { type: String },
    label: { type: String },
    /** The gradient the points or cells take by height (`viridis`, `magma`, `turbo`, …). */
    gradient: { type: String },
    /** Run the gradient from its last color to its first. */
    reverse: { type: Boolean },
    _svg: { state: true },
  };

  declare data: string;
  declare type: "surface" | "points";
  declare azimuth: number;
  declare elevation: number;
  declare zoom: number;
  declare n: number;
  declare size: number;
  declare depthCue: number;
  declare wireframe: string;
  declare axes: string;
  declare zrange: string;
  declare label: string;
  declare gradient: string;
  declare reverse: boolean;
  declare _svg: string;

  constructor() {
    super();
    this.data = "";
    this.type = "surface";
    this.azimuth = 30;
    this.elevation = 25;
    this.zoom = 1;
    this.n = 12;
    this.size = 0;
    this.depthCue = -1;
    this.wireframe = "false";
    this.axes = "true";
    this.zrange = "";
    this.label = "";
    this.gradient = "viridis";
    this.reverse = false;
    this._svg = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (
      changed.has("data") ||
      changed.has("type") ||
      changed.has("azimuth") ||
      changed.has("elevation") ||
      changed.has("zoom") ||
      changed.has("n") ||
      changed.has("size") ||
      changed.has("depthCue") ||
      changed.has("wireframe") ||
      changed.has("axes") ||
      changed.has("zrange") ||
      changed.has("label") ||
      changed.has("gradient") ||
      changed.has("reverse")
    ) {
      this.#recompute();
    }
  }

  #zRange(): [number, number] | undefined {
    const [a, b] = this.zrange.split(",").map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : undefined;
  }

  #recompute(): void {
    const view = {
      azimuth: this.azimuth,
      elevation: this.elevation,
      zoom: this.zoom,
      axes: this.axes !== "false",
      zRange: this.#zRange(),
      title: this.label || undefined,
      gradient: this.gradient,
      reverse: this.reverse,
    };
    const parsed = parseJson(this.data);
    const points = toPoints(parsed);

    if (this.type === "points") {
      this._svg = points
        ? scatter3dSvg(points, {
            ...view,
            size: this.size > 0 ? this.size : undefined,
            depthCue: this.depthCue >= 0 ? this.depthCue : undefined,
          })
        : "";
      return;
    }

    // Surface: a height matrix directly, or scattered triples binned onto one.
    const grid = toMatrix(parsed);
    const size = Math.max(2, Math.min(120, this.n));
    const mesh = grid ?? (points ? gridFromPoints(points, size, size).grid : undefined);
    this._svg = mesh ? mesh3dSvg(mesh, { ...view, wireframe: this.wireframe !== "false" }) : "";
  }

  protected override render(): unknown {
    return html`<span class="notatio-list-plot-3d-box">${unsafeHTML(this._svg)}</span>`;
  }
}

if (!customElements.get("notatio-list-plot-3d")) {
  customElements.define("notatio-list-plot-3d", NotatioListPlot3D);
}
