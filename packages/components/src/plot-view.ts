// A 2-D plot in `<graphics-box>`: the element holds the plot's expression (`Plot(Sin(x), (x, 0,
// 2*Pi))`, options and all, as `Show` does), the kernel samples it, and the samples lower to a
// `GraphicsBox` (`plotBox`) that `svg()` draws. What the page adds is the pointer's hover readout
// and, for a plot in a Manipulate, the wildcards (`_a`) the controls fill. A plot's `Locator`
// reads its geometry through `frame`.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";
import { html } from "lit";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import type { Box, BoxNode } from "@enumeratio/boxes";
import {
  debug,
  plainJson,
  type PlotFrame,
  plotBoxOfSamples,
  plotDataSeries,
  type PlotSeries,
  type PolarPlotOptions,
  plotSeries,
  polarPlotBox,
  polarPlotBoxSvg,
  polarPointsOf,
  primitivesOf,
  type Primitive,
  renderPlot,
  samplePolar,
  spanOf,
} from "@enumeratio/frontend/core";
import { plotFunctions, readEpsil } from "./plot-kernel.ts";

const log = debug("plot");

/** The element a plot lives in: its expression, the wildcards its scope fills, and a way to redraw. */
export interface PlotHost extends HTMLElement {
  value: string;
  bindings: Readonly<Record<string, unknown>> | undefined;
  requestUpdate(): void;
}

const POLAR = new Set(["PolarPlot", "ListPolarPlot"]);
const on = (v: string | undefined): boolean => v !== undefined && v !== "" && v !== "false";

export class PlotView {
  #generation = 0;
  #series: PlotSeries[] = [];
  #polar: BoxNode | undefined;
  #box: BoxNode | undefined;
  #svg = "";
  #hover: number | undefined;
  #xAt: (px: number) => number = () => Number.NaN;
  #frame: PlotFrame | undefined;
  #settings: Readonly<Record<string, string>> = {};
  #marks = new Map<string, Primitive[] | undefined>();

  constructor(readonly host: PlotHost) {}

  /** The plot area's geometry after the last draw, for an overlay such as a locator. */
  get frame(): PlotFrame | undefined {
    return this.#frame;
  }

  /** Read the host's expression, sample it and draw. */
  async recompute(): Promise<void> {
    const generation = ++this.#generation;
    const text = this.host.value.trim();
    const { parseExpression } = await import("@enumeratio/formats/expression");
    const { json, errors } = parseExpression(text);
    const { plotSettingsOf } = await import("@enumeratio/frontend/symbols");
    const plain = plainJson(json as never) as unknown;
    const settings = errors.length > 0 ? undefined : plotSettingsOf(plain as never);
    if (generation !== this.#generation) return;
    if (settings === undefined) return this.#clear();
    this.#settings = settings;
    const head = Array.isArray(plain) ? plain[0] : undefined;
    try {
      if (typeof head === "string" && POLAR.has(head)) await this.#polarize(head, settings, generation);
      else await this.#sample(settings, generation);
    } catch (error) {
      log("could not plot", text, error);
      if (generation === this.#generation) this.#clear();
    }
  }

  #clear(): void {
    this.#series = [];
    this.#polar = this.#box = undefined;
    this.#svg = "";
    this.host.requestUpdate();
  }

  async #sample(settings: Readonly<Record<string, string>>, generation: number): Promise<void> {
    const marks = await this.#readMarks(settings);
    const data = plotDataSeries(settings);
    if (data === undefined) {
      const raw = settings["value"]?.trim();
      if (!raw) return this.#clear();
      const loaded = await plotFunctions(raw, { each: true });
      if (generation !== this.#generation) return;
      const { plot, samplers } = loaded;
      // The Manipulate parameters fill the wildcard slots (`_a`); the plot variable is whatever
      // free symbol remains.
      const scope = loaded.scope();
      Object.assign(scope, this.host.bindings);
      const variable = settings["var"] || plot.unknowns.find((u) => !u.startsWith("_")) || "x";
      // Each curve is code the kernel compiled, sampled per t: vastly faster than a subs()+N()
      // per sample, so a 1000-point sweep or an animated slider stays smooth.
      const at =
        (k: number) =>
        (t: number): number => {
          scope[variable] = t;
          return samplers[k]!(scope);
        };
      this.#series = plotSeries(plot.items, at, {
        domain: spanOf(settings["domain"]) ?? [-6.283185, 6.283185],
        samples: Number(settings["samples"]) || 160,
        mode: settings["mode"],
        adaptive: settings["adaptive"] !== "false",
        parametric: settings["parametric"] !== undefined && settings["parametric"] !== "false",
      });
    } else this.#series = data;
    this.#marked = marks;
    this.#polar = undefined;
    this.#rebuild();
  }

  #marked: { epilog?: Primitive[]; prolog?: Primitive[] } = {};

  /** The graphics primitives an `Epilog`/`Prolog` option carries, read once each. */
  async #readMarks(
    settings: Readonly<Record<string, string>>,
  ): Promise<{ epilog?: Primitive[]; prolog?: Primitive[] }> {
    const out: { epilog?: Primitive[]; prolog?: Primitive[] } = {};
    for (const name of ["epilog", "prolog"] as const) {
      const source = settings[name];
      if (!source?.trim()) continue;
      if (!this.#marks.has(source)) {
        const json = await readEpsil(source);
        this.#marks.set(source, json === undefined ? undefined : primitivesOf(json as MathJsonExpression));
      }
      const read = this.#marks.get(source);
      if (read) out[name] = read;
    }
    return out;
  }

  async #polarize(head: string, settings: Readonly<Record<string, string>>, generation: number): Promise<void> {
    const [t0, t1] = spanOf(settings["trange"]) ?? [0, 2 * Math.PI];
    const view: PolarPlotOptions = {
      axes: settings["axes"] !== "false",
      closed: on(settings["closed"]),
      filled: on(settings["filled"]),
      markers: on(settings["markers"]),
      max: Number(settings["max"]) > 0 ? Number(settings["max"]) : undefined,
      title: settings["label"] || undefined,
    };
    let points;
    if (head === "ListPolarPlot") {
      let data: unknown;
      try {
        data = JSON.parse(settings["data"] ?? "null");
      } catch {
        data = undefined;
      }
      points = polarPointsOf(data, t0, t1) ?? [];
      view.markers = settings["markers"] !== "false";
    } else {
      const raw = settings["expr"]?.trim();
      if (!raw) return this.#clear();
      const loaded = await plotFunctions(raw);
      if (generation !== this.#generation) return;
      const scope = loaded.scope();
      Object.assign(scope, this.host.bindings);
      const variable = settings["tvar"] || loaded.plot.unknowns.find((u) => !u.startsWith("_")) || "theta";
      const sample = (t: number): number => {
        scope[variable] = t;
        return loaded.samplers[0]!(scope);
      };
      points = samplePolar(sample, t0, t1, Math.max(2, Math.min(2000, Number(settings["n"]) || 240)));
    }
    this.#polar = polarPlotBox(points, view) as BoxNode;
    this.#box = undefined;
    this.#frame = undefined;
    this.#svg = polarPlotBoxSvg(this.#polar);
    this.#finish();
  }

  /** The box for the current samples and settings. */
  #rebuild(): void {
    this.#box = plotBoxOfSamples(this.#settings, this.#series, this.#marked) as BoxNode;
    this.#draw();
  }

  /** The box drawn, with the hover readout when the pointer is over it. */
  #draw(): void {
    if (this.#box === undefined) return;
    const rendered = renderPlot(this.#box, this.#hover);
    this.#svg = rendered.svg;
    this.#xAt = rendered.xAt;
    this.#frame = rendered.frame;
    this.#finish();
  }

  #finish(): void {
    // What the build drew for this plot gives way (`data-rendered`).
    this.host.toggleAttribute("data-rendered", true);
    this.host.requestUpdate();
    // Overlays reposition on the new geometry.
    this.host.dispatchEvent(new CustomEvent("graphics-box-render"));
  }

  /** The plot as a box, for an environment that draws boxes. */
  get box(): Box | undefined {
    return this.#polar ?? this.#box;
  }

  #onPointerMove = (e: PointerEvent): void => {
    if (this.#polar) return;
    const svg = this.host.querySelector("svg");
    if (!svg) return;
    // Map the pointer into viewBox units; the SVG scales to fit its box.
    const rect = svg.getBoundingClientRect();
    const [, , vw] = (svg.getAttribute("viewBox") ?? "0 0 340 200").split(" ").map(Number);
    this.#hover = this.#xAt(((e.clientX - rect.left) / (rect.width || 1)) * vw!);
    this.#draw();
  };

  #onPointerLeave = (): void => {
    if (this.#hover === undefined) return;
    this.#hover = undefined;
    this.#draw();
  };

  render(): unknown {
    return html`<span
      class="graphics-box-plot"
      @pointermove=${this.#onPointerMove}
      @pointerleave=${this.#onPointerLeave}
      >${unsafeHTML(this.#svg)}</span
    >`;
  }
}
