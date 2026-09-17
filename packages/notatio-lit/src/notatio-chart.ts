import { html, LitElement, type PropertyValues } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { ensureStyles } from "./styles.ts";
import {
  arrayPlotSvg,
  barChartSvg,
  boxWhiskerChartSvg,
  type ChartType,
  chooseChartType,
  discretePlotSvg,
  histogramSvg,
  isNumber,
  linePlotSvg,
  pieChartSvg,
  type PlotPoint,
} from "@enumeratio/notatio";

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

/**
 * Normalize `data` into {x,y} points for ListPlot / ListLinePlot: a bare
 * number list reads as index vs value (Wolfram's `ListPlot[{y1,y2,…}]`); a
 * list of `[x,y]` pairs or `{x,y}` objects is read as given.
 */
function toPoints(data: unknown): PlotPoint[] {
  if (!Array.isArray(data)) return [];
  if (data.every(isNumber)) return data.map((y, x) => ({ x, y }));
  if (data.every((e) => Array.isArray(e) && e.length === 2 && e.every(isNumber)))
    return (data as [number, number][]).map(([x, y]) => ({ x, y }));
  if (
    data.every(
      (e) =>
        e && typeof e === "object" && isNumber((e as PlotPoint).x) && isNumber((e as PlotPoint).y),
    )
  )
    return data as PlotPoint[];
  return [];
}

/** A number list, dropping anything non-numeric. */
function toValues(data: unknown): number[] {
  if (!Array.isArray(data)) return [];
  return data.filter(isNumber);
}

/** One series per row for BoxWhiskerChart: a flat number list is a single series. */
function toSeries(data: unknown): number[][] {
  if (!Array.isArray(data)) return [];
  if (data.every((e) => Array.isArray(e))) return (data as unknown[][]).map(toValues);
  const values = toValues(data);
  return values.length ? [values] : [];
}

/** A 2-D numeric matrix for ArrayPlot. */
function toMatrix(data: unknown): number[][] {
  if (!Array.isArray(data) || !data.every((e) => Array.isArray(e))) return [];
  return (data as unknown[][]).map(toValues);
}

/**
 * `<notatio-chart type="bar" data="[3,1,4,1,5]">` -- a data-driven 2-D chart,
 * one element covering several Wolfram `*Chart`/`*Plot` forms via `type`:
 *
 * - `list` / `listline` -- ListPlot / ListLinePlot: a bare number list reads
 *   as index vs value; a list of `[x,y]` pairs or `{x,y}` objects plots as data.
 * - `bar` -- BarChart: a value list, optional `labels` (ChartLabels).
 * - `histogram` -- Histogram: bins a number list (`bins` overrides the
 *   automatic Sturges'-rule count).
 * - `pie` -- PieChart: proportions of a value list, optional `labels`.
 * - `box` -- BoxWhiskerChart: a five-number summary per series (`data` is
 *   either one flat number list, or a list of lists -- one box per series);
 *   optional `labels`.
 * - `array` -- ArrayPlot: a 2-D numeric matrix as a heatmap.
 * - `discrete` -- DiscretePlot: a stem plot (vertical stems + dots).
 *
 * With no `type` (or `type="auto"`) the chart is chosen from the data's shape -- see
 * `chooseChartType` -- which is what the `Chart` head does too: this component is the
 * family, `type` names the member.
 *
 * `data` (and `labels`) are JSON, parsed defensively -- an empty/invalid value
 * renders nothing rather than throwing. `label` is a title (Wolfram's
 * `PlotLabel`); `bins` overrides the histogram's automatic bin count.
 */
export class NotatioChart extends LitElement {
  static properties = {
    /**
     * Which chart: `bar`, `histogram`, `pie`, `box`, `array`, `discrete`, `list` or
     * `listline` -- or `auto` (the default), chosen from the data's shape (`chooseChartType`).
     */
    type: { type: String, reflect: true },
    /** The values, as JSON — a number list, or `[x,y]` pairs where the chart takes points. */
    data: { type: String },
    /** A JSON list of category labels, where the chart shows them. */
    labels: { type: String },
    /** Histogram bin count; empty chooses one from the data. */
    bins: { type: Number },
    /** Caption drawn above the chart. */
    label: { type: String },
  };

  declare type: ChartType | "auto";
  declare data: string;
  declare labels: string;
  declare bins: number | undefined;
  declare label: string;

  constructor() {
    super();
    this.type = "auto";
    this.data = "";
    this.labels = "";
    this.bins = undefined;
    this.label = "";
    ensureStyles();
  }

  protected override createRenderRoot(): HTMLElement {
    return this;
  }

  protected override shouldUpdate(changed: PropertyValues): boolean {
    return (
      changed.has("type") ||
      changed.has("data") ||
      changed.has("labels") ||
      changed.has("bins") ||
      changed.has("label")
    );
  }

  #markup(): string {
    const data = parseJson(this.data);
    const labelsList = parseJson(this.labels);
    const labels = Array.isArray(labelsList) ? labelsList.map(String) : undefined;
    const title = this.label || undefined;
    const points = toPoints(data);
    const type =
      this.type && this.type !== "auto"
        ? this.type
        : chooseChartType(data, { labels: labels !== undefined });
    switch (type) {
      case "list":
        return linePlotSvg([{ points, style: "points" }], { title });
      case "listline":
        return linePlotSvg([{ points, style: "line" }], { title });
      case "bar":
        return barChartSvg(toValues(data), { labels, title });
      case "histogram":
        return histogramSvg(toValues(data), { bins: this.bins, title });
      case "pie":
        return pieChartSvg(toValues(data), { labels, title });
      case "box":
        return boxWhiskerChartSvg(toSeries(data), { labels, title });
      case "array":
        return arrayPlotSvg(toMatrix(data), { title });
      case "discrete":
        return discretePlotSvg(toValues(data), { title });
      default:
        return "";
    }
  }

  protected override render(): unknown {
    return html`<span class="notatio-chart-box">${unsafeHTML(this.#markup())}</span>`;
  }
}

if (!customElements.get("notatio-chart")) {
  customElements.define("notatio-chart", NotatioChart);
}
