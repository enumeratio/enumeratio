// The terminal's drawer of laid-out boxes (https://github.com/enumeratio/enumeratio/wiki/Speculative-Box-Primitives, §4):
// `layout` with cell metrics gives positioned text, rules and frames, and slots for the leaves;
// this paints that onto character cells, frames and rules as box-drawing characters that join
// where they meet, and a `GraphicsBox` leaf drawn by the figure drawer. Pure: boxes in, text out.

import {
  type Box,
  DEFAULT_STYLE,
  type DisplayList,
  isNode,
  type Item,
  layout,
  type Metrics,
  type Size,
} from "@enumeratio/boxes";
import { stripAnsi } from "./ansi.ts";
import { type CellOptions, DOWN, drawGraphicsBox, JOINT, LEFT, RIGHT, UP } from "./cell-draw.ts";

const isDrawing = (box: Box): boolean => isNode(box) && box[0] === "GraphicsBox";

/** A leaf's rows: a figure drawn, else a placeholder. */
function leafLines(box: Box, options: CellOptions): string[] {
  return isDrawing(box) ? drawGraphicsBox(box, options).split("\n") : ["?"];
}

const visibleWidth = (line: string): number => Array.from(stripAnsi(line).replace(/\p{M}/gu, "")).length;

/** Integer character cells; a figure takes the room its drawing does. */
function cellMetrics(options: CellOptions): { metrics: Metrics; lines: (box: Box) => string[] } {
  const drawn = new Map<Box, string[]>();
  const lines = (box: Box): string[] => {
    let rows = drawn.get(box);
    if (rows === undefined) drawn.set(box, (rows = leafLines(box, options)));
    return rows;
  };
  const metrics: Metrics = {
    measure: (text) => ({ advance: visibleWidth(text), ascent: 1, descent: 0 }),
    leaf: (box): Size => {
      const rows = lines(box);
      const height = rows.length;
      return { width: Math.max(0, ...rows.map(visibleWidth)), height, baseline: Math.ceil(height / 2) };
    },
    em: 1,
    cell: true,
  };
  return { metrics, lines };
}

// ESC assembled from its code point, as ansi.ts does, so the source carries no control character.
const SGR = new RegExp(`^${String.fromCharCode(27)}\\[[0-9;]*m`);

/** One visible character, with whatever color was open where it stood. */
function cellsOf(line: string): string[] {
  const out: string[] = [];
  let open = "";
  for (let i = 0; i < line.length;) {
    const escape = SGR.exec(line.slice(i));
    if (escape) {
      open = escape[0] === "\x1b[0m" ? "" : escape[0];
      i += escape[0].length;
      continue;
    }
    const char = String.fromCodePoint(line.codePointAt(i)!);
    i += char.length;
    if (/^\p{M}$/u.test(char) && out.length > 0) out[out.length - 1] += char;
    else out.push(open === "" ? char : `${open}${char}\x1b[0m`);
  }
  return out;
}

class Canvas {
  readonly ink: (string | undefined)[];
  readonly masks: Uint8Array;
  constructor(
    readonly width: number,
    readonly height: number,
  ) {
    this.ink = new Array<string | undefined>(width * height).fill(undefined);
    this.masks = new Uint8Array(width * height);
  }
}

interface Clip {
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

function paint(
  canvas: Canvas,
  items: readonly Item[],
  ox: number,
  oy: number,
  clip: Clip,
  lines: (box: Box) => string[],
) {
  const inside = (x: number, y: number): boolean => x >= clip.x0 && x < clip.x1 && y >= clip.y0 && y < clip.y1;
  const mark = (x: number, y: number, mask: number): void => {
    if (inside(x, y)) canvas.masks[y * canvas.width + x]! |= mask;
  };
  const put = (x: number, y: number, char: string): void => {
    if (inside(x, y)) canvas.ink[y * canvas.width + x] = char;
  };
  for (const item of items) {
    const [x, y] = [item.x + ox, item.y + oy];
    switch (item.kind) {
      case "text":
        cellsOf(item.text).forEach((char, k) => put(x + k, y, char));
        break;
      case "rule":
        for (let k = 0; k < item.length; k++) {
          const along = (k > 0 ? 1 : 0) | (k < item.length - 1 ? 2 : 0);
          if (item.vertical) mark(x, y + k, (along & 1 ? UP : 0) | (along & 2 ? DOWN : 0));
          else mark(x + k, y, (along & 1 ? LEFT : 0) | (along & 2 ? RIGHT : 0));
        }
        break;
      case "rect":
        if (!item.stroke) break;
        for (let k = 0; k < item.width; k++) {
          const mask = (k > 0 ? LEFT : 0) | (k < item.width - 1 ? RIGHT : 0);
          mark(x + k, y, mask);
          mark(x + k, y + item.height - 1, mask);
        }
        for (let k = 0; k < item.height; k++) {
          const mask = (k > 0 ? UP : 0) | (k < item.height - 1 ? DOWN : 0);
          mark(x, y + k, mask);
          mark(x + item.width - 1, y + k, mask);
        }
        break;
      case "slot":
        lines(item.box).forEach((row, dy) =>
          cellsOf(row).forEach((char, dx) => char !== " " && put(x + dx, y + dy, char)),
        );
        break;
      case "group":
        paint(
          canvas,
          item.items,
          x,
          y,
          {
            x0: Math.max(clip.x0, x),
            y0: Math.max(clip.y0, y),
            x1: Math.min(clip.x1, x + item.width),
            y1: Math.min(clip.y1, y + item.height),
          },
          lines,
        );
        break;
    }
  }
}

/** A display list on cells, as rows of text with trailing blanks trimmed. */
function render(list: DisplayList, lines: (box: Box) => string[]): string {
  const canvas = new Canvas(list.width, list.height);
  paint(canvas, list.items, 0, 0, { x0: 0, y0: 0, x1: list.width, y1: list.height }, lines);
  const rows: string[] = [];
  for (let y = 0; y < canvas.height; y++) {
    let row = "";
    for (let x = 0; x < canvas.width; x++) {
      const i = y * canvas.width + x;
      const joint = canvas.masks[i] ? JOINT[canvas.masks[i]!] : undefined;
      row += canvas.ink[i] ?? joint ?? " ";
    }
    rows.push(row.replace(/ +$/, ""));
  }
  return rows.join("\n").replace(/^\n+|\n+$/g, "");
}

/** Boxes laid out on character cells and drawn: a grid ruled, a panel framed, a fraction stacked. */
export function drawBoxes(box: Box, options: CellOptions = {}): string {
  const { metrics, lines } = cellMetrics(options);
  return render(layout(box, DEFAULT_STYLE, metrics), lines);
}
