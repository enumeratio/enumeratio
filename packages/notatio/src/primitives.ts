// Graphics primitives -- Wolfram's `Point`, `Line`, `Circle`, `Disk`, `Arrow`, `Text`,
// `Polygon`, `Rectangle` -- read off MathJSON into a shape a plot can draw in its own
// coordinates. This is what a `Epilog -> …` (or `Prolog -> …`) option carries: not a
// picture of its own, but marks on somebody else's.

import type { MathJsonExpression } from "@cortex-js/compute-engine/epsil";

type Json = MathJsonExpression;
export type Point = readonly [number, number];

export type Primitive =
  | { kind: "point"; points: Point[] }
  | { kind: "line"; points: Point[] }
  | { kind: "arrow"; points: Point[] }
  | { kind: "circle"; center: Point; r: number; filled: boolean }
  | { kind: "polygon"; points: Point[] }
  | { kind: "rectangle"; min: Point; max: Point }
  | { kind: "text"; text: string; at: Point };

const headOf = (node: unknown): string | undefined => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) && typeof fn[0] === "string" ? fn[0] : undefined;
};

const opsOf = (node: unknown): Json[] => {
  const fn = Array.isArray(node) ? node : (node as { fn?: unknown[] })?.fn;
  return Array.isArray(fn) ? (fn.slice(1) as Json[]) : [];
};

const numOf = (node: unknown): number | undefined => {
  if (typeof node === "number") return node;
  const num = (node as { num?: unknown })?.num;
  if (typeof num === "string" || typeof num === "number") return Number(num);
  // `-1` arrives as `Negate(1)` from a raw parse.
  if (headOf(node) === "Negate") {
    const inner = numOf(opsOf(node)[0]);
    return inner === undefined ? undefined : -inner;
  }
  return undefined;
};

const strOf = (node: unknown): string | undefined => {
  if (typeof node === "string" && node.length >= 2 && node.startsWith("'") && node.endsWith("'")) {
    return node.slice(1, -1);
  }
  const str = (node as { str?: unknown })?.str;
  return typeof str === "string" ? str : undefined;
};

const entriesOf = (node: Json): Json[] | undefined => {
  const head = headOf(node);
  if (head === "Tuple" || head === "List") return opsOf(node);
  if (head === "Delimiter") {
    const inner = opsOf(node)[0];
    return headOf(inner) === "Sequence" ? opsOf(inner) : inner === undefined ? [] : [inner];
  }
  return undefined;
};

/** `(x, y)` as a point, or undefined. */
export function pointOf(node: Json): Point | undefined {
  const parts = entriesOf(node);
  if (parts === undefined || parts.length !== 2) return undefined;
  const x = numOf(parts[0]);
  const y = numOf(parts[1]);
  return x === undefined || y === undefined ? undefined : [x, y];
}

/** One point, or a list of them, as a list. */
function pointsOf(node: Json): Point[] {
  const one = pointOf(node);
  if (one !== undefined) return [one];
  return (entriesOf(node) ?? []).map(pointOf).filter((p): p is Point => p !== undefined);
}

/** The primitives in an expression: one, or a list of them, nested lists flattened. */
export function primitivesOf(node: Json): Primitive[] {
  const head = headOf(node);
  const ops = opsOf(node);
  switch (head) {
    case "Point":
      return ops[0] === undefined ? [] : [{ kind: "point", points: pointsOf(ops[0]) }];
    case "Line":
      return ops[0] === undefined ? [] : [{ kind: "line", points: pointsOf(ops[0]) }];
    case "Arrow":
      return ops[0] === undefined ? [] : [{ kind: "arrow", points: pointsOf(ops[0]) }];
    case "Polygon":
      return ops[0] === undefined ? [] : [{ kind: "polygon", points: pointsOf(ops[0]) }];
    case "Circle":
    case "Disk": {
      const center: Point = ops[0] === undefined ? [0, 0] : (pointOf(ops[0]) ?? [0, 0]);
      const r = ops[1] === undefined ? 1 : (numOf(ops[1]) ?? 1);
      return [{ kind: "circle", center, r, filled: head === "Disk" }];
    }
    case "Rectangle": {
      const min: Point = ops[0] === undefined ? [0, 0] : (pointOf(ops[0]) ?? [0, 0]);
      const max: Point = ops[1] === undefined ? [1, 1] : (pointOf(ops[1]) ?? [1, 1]);
      return [{ kind: "rectangle", min, max }];
    }
    case "Text": {
      const text = strOf(ops[0]) ?? "";
      const at: Point = ops[1] === undefined ? [0, 0] : (pointOf(ops[1]) ?? [0, 0]);
      return [{ kind: "text", text, at }];
    }
    case "List":
    case "Tuple":
      return ops.flatMap(primitivesOf);
    default:
      return [];
  }
}

const n2 = (x: number): string => String(Math.round(x * 100) / 100);
const esc = (s: string): string => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * The primitives as SVG, through a plot's own data-to-pixel mapping. `stroke` is the
 * colour they take; a text is set small and centred on its point.
 */
export function primitivesSvg(
  primitives: readonly Primitive[],
  toPixel: (x: number, y: number) => [number, number],
  stroke = "currentColor",
): string {
  const px = (p: Point): string => toPixel(p[0], p[1]).map(n2).join(",");
  let out = "";
  for (const p of primitives) {
    switch (p.kind) {
      case "point":
        for (const q of p.points) {
          const [x, y] = toPixel(q[0], q[1]);
          out += `<circle cx="${n2(x)}" cy="${n2(y)}" r="3" fill="${stroke}"/>`;
        }
        break;
      case "line":
      case "arrow":
        if (p.points.length >= 2) {
          out += `<polyline points="${p.points.map(px).join(" ")}" fill="none" stroke="${stroke}" stroke-width="1.5"${p.kind === "arrow" ? ' marker-end="url(#notatio-arrow)"' : ""}/>`;
        }
        break;
      case "polygon":
        if (p.points.length >= 3) {
          out += `<polygon points="${p.points.map(px).join(" ")}" fill="${stroke}" fill-opacity="0.25" stroke="${stroke}" stroke-width="1"/>`;
        }
        break;
      case "circle": {
        const [cx, cy] = toPixel(p.center[0], p.center[1]);
        const [rx] = toPixel(p.center[0] + p.r, p.center[1]);
        const [, ry] = toPixel(p.center[0], p.center[1] + p.r);
        out += `<ellipse cx="${n2(cx)}" cy="${n2(cy)}" rx="${n2(Math.abs(rx - cx))}" ry="${n2(Math.abs(ry - cy))}" fill="${p.filled ? stroke : "none"}" fill-opacity="${p.filled ? 0.35 : 0}" stroke="${stroke}" stroke-width="1.5"/>`;
        break;
      }
      case "rectangle": {
        const [x0, y0] = toPixel(p.min[0], p.min[1]);
        const [x1, y1] = toPixel(p.max[0], p.max[1]);
        out += `<rect x="${n2(Math.min(x0, x1))}" y="${n2(Math.min(y0, y1))}" width="${n2(Math.abs(x1 - x0))}" height="${n2(Math.abs(y1 - y0))}" fill="${stroke}" fill-opacity="0.2" stroke="${stroke}" stroke-width="1"/>`;
        break;
      }
      case "text": {
        const [x, y] = toPixel(p.at[0], p.at[1]);
        out += `<text x="${n2(x)}" y="${n2(y)}" font-size="10" text-anchor="middle" dominant-baseline="middle" fill="${stroke}">${esc(p.text)}</text>`;
        break;
      }
    }
  }
  return out;
}
