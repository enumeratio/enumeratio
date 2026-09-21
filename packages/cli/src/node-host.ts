// The Node host: wraps the core Repl with the things only a Node process can do
// — file-backed :export / :import, writing graphics to temp files, and inline
// images on a capable terminal. It keeps the interactive loop (repl.ts) and the
// bin (main.ts) thin.

import {
  fileFormat,
  isImageFormat,
  isImageValue,
  readFormat,
  writeFormat,
} from "@enumeratio/formats/node";
import { type CommandHandler, type Graphic, type LineOutput, Repl } from "./core.ts";
import type { SessionDefaults } from "./engine.ts";
import { graphicLabel, graphicToSvg, inlineImage, writeSvg } from "./node-graphics.ts";
import { samplePlot } from "./textual.ts";
import { textPlot } from "../../notatio/src/textplot.ts";

export interface HostOutput {
  text: string;
  /** An inline-image escape sequence to write raw, if the terminal supports it. */
  inline?: string;
  exit?: boolean;
  clear?: boolean;
}

export class NodeHost {
  readonly repl: Repl;
  private lastSvg?: string;

  constructor(color: boolean, defaults: SessionDefaults = {}) {
    this.repl = new Repl({ color, defaults, commands: this.commands() });
  }

  /** Evaluate a line and fold in Node-side graphic handling. */
  eval(line: string): HostOutput {
    const out = this.repl.eval(line);
    const graphic = out.graphic ?? this.plotResult(out);
    if (!graphic) return { text: out.text, exit: out.exit, clear: out.clear };
    const svg = graphicToSvg(graphic);
    this.lastSvg = svg;
    const label = graphicLabel(graphic);
    const file = writeSvg(label, svg);
    const inline = inlineImage(`${label}.png`, svg) ?? undefined;
    // No image protocol: the plot on braille cells, which any terminal or pipe can show.
    const text =
      inline === undefined && graphic.kind === "plot"
        ? `${out.text}\n${textPlot(graphic.points, { width: 60, height: 12 })}`
        : `${out.text} -> file://${file}`;
    return { text, inline, exit: out.exit, clear: out.clear };
  }

  /** An evaluated `Plot(f, (x, a, b))` is a picture, like `:plot` makes. */
  private plotResult(out: LineOutput): Graphic | undefined {
    if (out.exit || out.clear) return undefined;
    const last = this.repl.session.history.at(-1);
    if (!last || !out.text.includes(`Out[${last.n}]`)) return undefined;
    const points = samplePlot(this.repl.session, last.expr.json as never);
    return points === undefined ? undefined : { kind: "plot", expr: last.input, points };
  }

  private commands(): Record<string, CommandHandler> {
    return {
      export: (repl, arg) => this.exportCmd(repl, arg),
      import: (repl, arg) => this.importCmd(repl, arg),
    };
  }

  private exportCmd(repl: Repl, arg: string): LineOutput {
    if (!arg) throw new Error("usage: :export <path>");
    const format = fileFormat(arg);
    if (!format) throw new Error(`cannot infer a format from ${arg}`);
    let value: unknown;
    if (isImageFormat(format)) {
      if (!this.lastSvg) throw new Error("no graphic yet -- run :plot or :glyph first");
      value = this.lastSvg;
    } else {
      const last = repl.session.history.at(-1);
      if (!last) throw new Error("no result yet to export");
      value = last.expr;
    }
    writeFormat(arg, value, format, { ce: repl.session.ce });
    return { text: `  wrote ${arg} (${format.name})` };
  }

  private importCmd(repl: Repl, arg: string): LineOutput {
    if (!arg) throw new Error("usage: :import <path>");
    const value = readFormat(arg, undefined, { ce: repl.session.ce });
    if (isImageValue(value)) {
      if (value.text) this.lastSvg = value.text; // an SVG can be re-exported / rasterized
      const note = value.text ? " (now the current graphic)" : "";
      return { text: `  imported ${value.mimeType}, ${value.data.length} bytes${note}` };
    }
    const res = repl.session.evaluateJson(value, `:import ${arg}`);
    return { text: repl.formatOut(res.n, repl.session.render(res.expr)) };
  }
}
