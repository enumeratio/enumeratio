import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { barChart3dSvg } from "./barchart3d.ts";
import { ensureStyles } from "./styles.ts";

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

/** A rectangular matrix of heights; a flat list reads as a single row. */
function toMatrix(data: unknown): number[][] | undefined {
  if (!Array.isArray(data) || data.length === 0) return undefined;
  if (data.every(isNumber)) return [data as number[]];
  if (!data.every((r) => Array.isArray(r))) return undefined;
  // A `null` (or any non-number) reads as a hole, not as a dropped cell, so
  // rows keep their length and the grid stays rectangular.
  const rows = (data as unknown[][]).map((r) => r.map((v) => (isNumber(v) ? v : Number.NaN)));
  return rows.every((r) => r.length === rows[0].length && r.length > 0) ? rows : undefined;
}

/** A comma-separated label list; empty reads as undefined. */
function toLabels(raw: string): string[] | undefined {
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : undefined;
}

/**
 * `<notatio-barchart3d data="[[1,2],[3,4]]">` -- a matrix of heights as 3-D
 * bars (Wolfram's `BarChart3D`), orthographically projected. `data[j][i]` is
 * the bar in row `j`, column `i`; a flat list reads as a single row. Each bar
 * shows its top face and the two sides that turn toward the viewer, shaded by
 * height, painted back-to-front. `row-labels` / `col-labels` take
 * comma-separated categories drawn at the near floor edges.
 *
 * The view is fixed by `azimuth` / `elevation`, so the figure is a pure
 * function of its attributes and renders identically under SSR.
 */
export class NotatioBarChart3d extends LitElement {
  static properties = {
    data: { type: String },
    azimuth: { type: Number },
    elevation: { type: Number },
    zoom: { type: Number },
    gap: { type: Number },
    axes: { type: String },
    zrange: { type: String },
    rowLabels: { type: String, attribute: "row-labels" },
    colLabels: { type: String, attribute: "col-labels" },
    label: { type: String },
    _svg: { state: true },
  };

  declare data: string;
  declare azimuth: number;
  declare elevation: number;
  declare zoom: number;
  declare gap: number;
  declare axes: string;
  declare zrange: string;
  declare rowLabels: string;
  declare colLabels: string;
  declare label: string;
  declare _svg: string;

  constructor() {
    super();
    this.data = "";
    this.azimuth = 30;
    this.elevation = 25;
    this.zoom = 1;
    this.gap = -1;
    this.axes = "true";
    this.zrange = "";
    this.rowLabels = "";
    this.colLabels = "";
    this.label = "";
    this._svg = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override willUpdate(changed: PropertyValues): void {
    if (
      changed.has("data") ||
      changed.has("azimuth") ||
      changed.has("elevation") ||
      changed.has("zoom") ||
      changed.has("gap") ||
      changed.has("axes") ||
      changed.has("zrange") ||
      changed.has("rowLabels") ||
      changed.has("colLabels") ||
      changed.has("label")
    ) {
      this.#recompute();
    }
  }

  #zRange(): [number, number] | undefined {
    const [a, b] = this.zrange.split(",").map((s) => Number(s.trim()));
    return Number.isFinite(a) && Number.isFinite(b) ? [a, b] : undefined;
  }

  #recompute(): void {
    const matrix = toMatrix(parseJson(this.data));
    if (!matrix) {
      this._svg = "";
      return;
    }
    this._svg = barChart3dSvg(matrix, {
      azimuth: this.azimuth,
      elevation: this.elevation,
      zoom: this.zoom,
      gap: this.gap >= 0 ? this.gap : undefined,
      axes: this.axes !== "false",
      zRange: this.#zRange(),
      rowLabels: toLabels(this.rowLabels),
      colLabels: toLabels(this.colLabels),
      title: this.label || undefined,
    });
  }

  protected override render(): unknown {
    return html`<span class="notatio-barchart3d-box">${unsafeHTML(this._svg)}</span>`;
  }
}

if (!customElements.get("notatio-barchart3d")) {
  customElements.define("notatio-barchart3d", NotatioBarChart3d);
}
