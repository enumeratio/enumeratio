// The torus as a square with its opposite edges glued, and a torus knot as a straight line on
// it.
//
// A torus is two circles multiplied together, and the whole of T(p, q) is visible in that: the
// knot is the path that goes p times round one circle while it goes q times round the other. On
// the square that path is a STRAIGHT LINE of slope q/p, and everything about the knot — that
// T(p,q) and T(q,p) are the same knot, that a winding number of 1 unknots it, that gcd > 1 is
// not a knot but a link — is a fact about that line.
//
// So the figure draws three things that share one parameter: the square with the line on it,
// and the two circles themselves, each with the same travelling point shown as an angle. Watch
// the point and the two windings come apart — one dial turns p times while the other turns q.

import { ACCENT, GROUND, INK, Sketch } from "./diagram.ts";
import type { Box } from "@enumeratio/boxes";
import { categoryColors, type ColorOptions, plotPalette } from "./plot-color.ts";

const FAINT = "var(--vp-c-divider, #ddd)";

/** A segment of the line, in square coordinates — both ends within `[0, 1]`. */
export interface Strand {
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
}

/**
 * The line of slope q/p on the glued square, cut into the segments that fit inside it.
 *
 * The cuts are exactly where a coordinate reaches a whole number — `t = k/p` or `t = k/q` — so
 * they are computed rather than found by watching for a jump. Between two consecutive cuts the
 * path is straight and stays inside the square, and subtracting the whole turn taken at the
 * segment's MIDPOINT is what brings it back into `[0, 1]` without ever having to test which
 * edge was crossed.
 */
export function strands(p: number, q: number): Strand[] {
  if (!Number.isInteger(p) || !Number.isInteger(q) || p < 1 || q < 1) return [];
  const cuts = new Set<number>([0, 1]);
  for (let k = 1; k < p; k++) cuts.add(k / p);
  for (let k = 1; k < q; k++) cuts.add(k / q);
  const ordered = [...cuts].toSorted((a, b) => a - b);
  const out: Strand[] = [];
  for (let i = 0; i + 1 < ordered.length; i++) {
    const a = ordered[i]!;
    const b = ordered[i + 1]!;
    const middle = (a + b) / 2;
    const turnsU = Math.floor(p * middle);
    const turnsV = Math.floor(q * middle);
    out.push({
      from: [p * a - turnsU, q * a - turnsV],
      to: [p * b - turnsU, q * b - turnsV],
    });
  }
  return out;
}

/** Where the travelling point is on the square at a given phase. */
export const atPhase = (p: number, q: number, phase: number): [number, number] => {
  const t = ((phase % 1) + 1) % 1;
  return [p * t - Math.floor(p * t), q * t - Math.floor(q * t)];
};

/**
 * The two circle factors are categories: the first two colors of the discrete scheme
 * (`tableau10` unless `discrete` says otherwise), the same two everywhere in the figure --
 * the square's axes, the dials, and the edge arrows. The colors ARE the argument.
 */
export interface TorusSquareOptions extends Pick<ColorOptions, "discrete"> {
  readonly width?: number;
  readonly height?: number;
  /** Where the travelling point sits, in `[0, 1)`. Omit for a figure with no point on it. */
  readonly phase?: number;
  /** Draw the two circle factors beside the square (default true). */
  readonly dials?: boolean;
  readonly title?: string;
}

type Point = [number, number];

/** One circle factor, with the travelling point shown as an angle on it. */
function dial(
  sketch: Sketch,
  [cx, cy]: Point,
  r: number,
  turns: number,
  phase: number | undefined,
  color: string,
  caption: string,
): void {
  sketch.disk([cx, cy], r, { stroke: { color, width: 1.5, opacity: 0.55 } }, "Dial");
  if (phase !== undefined) {
    // `turns` full revolutions over one cycle -- this is where the winding number becomes
    // something you can watch rather than something you are told.
    const angle = 2 * Math.PI * turns * phase - Math.PI / 2;
    const at: Point = [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
    sketch.line([[cx, cy], at], { stroke: { color, width: 1.2, opacity: 0.5 } }, "Dial");
    sketch.disk(at, 4, { fill: color }, "Dial");
  }
  sketch.text([cx, cy + r + 14], caption, { size: 9, color, anchor: "middle" });
}

/** The gluing's arrowhead on an edge: a chevron opening back from `at`, `turn` degrees about it. */
function chevron(sketch: Sketch, [x, y]: Point, turn: number, color: string, twice: boolean): void {
  const t = (turn * Math.PI) / 180;
  const about = ([px, py]: Point): Point => [
    x + px * Math.cos(t) - py * Math.sin(t),
    y + px * Math.sin(t) + py * Math.cos(t),
  ];
  const look = { stroke: { color, width: 1.6 } };
  sketch.line([about([-4, -4]), about([0, 0]), about([-4, 4])], look, "Gluing");
  if (twice) sketch.line([about([-9, -4]), about([-5, 0]), about([-9, 4])], look, "Gluing");
}

/** The square picture for T(p, q), as a `GraphicsBox`. */
export function torusSquareBox(p: number, q: number, options: TorusSquareOptions = {}): Box {
  const W = options.width ?? 360;
  const H = options.height ?? 260;
  const showDials = options.dials !== false;
  const colors = categoryColors(plotPalette(options), 2);
  const hole = colors[0]!;
  const tube = colors[1]!;
  const side = Math.min(H - 74, showDials ? W - 150 : W - 60);
  const left = showDials ? 34 : (W - side) / 2;
  const top = 34;
  // Square coordinates run bottom-to-top, as a reader expects of an axis, so the page's
  // downward y is flipped here rather than in every caller.
  const sx = (u: number): number => left + u * side;
  const sy = (v: number): number => top + (1 - v) * side;

  const title = options.title ?? `T(${p}, ${q}) on the glued square`;
  const sketch = new Sketch(W, H, { label: "torus square", title });
  sketch.polygon(
    [
      [left, top],
      [left + side, top],
      [left + side, top + side],
      [left, top + side],
    ],
    { stroke: { color: FAINT, width: 1 } },
  );

  // The gluing, as arrowheads on the edges: a single chevron on the pair that is identified one
  // way and a double one on the other, which is how this square is drawn everywhere.
  const mid = left + side / 2;
  const middleY = top + side / 2;
  chevron(sketch, [mid, top], 0, hole, false);
  chevron(sketch, [mid, top + side], 0, hole, false);
  chevron(sketch, [left, middleY], 90, tube, true);
  chevron(sketch, [left + side, middleY], 90, tube, true);

  for (const strand of strands(p, q))
    sketch.line(
      [
        [sx(strand.from[0]), sy(strand.from[1])],
        [sx(strand.to[0]), sy(strand.to[1])],
      ],
      { stroke: { color: INK, width: 1.8, opacity: 0.75 } },
      "Strand",
    );

  if (options.phase !== undefined) {
    const [u, v] = atPhase(p, q, options.phase);
    // Guide lines down to the axes: they are what ties the point on the square to the two
    // angles beside it.
    sketch.line(
      [
        [sx(u), sy(v)],
        [sx(u), sy(0)],
      ],
      { stroke: { color: hole, width: 1, opacity: 0.7, dashing: [2, 2] } },
      "Guide",
    );
    sketch.line(
      [
        [sx(u), sy(v)],
        [sx(0), sy(v)],
      ],
      { stroke: { color: tube, width: 1, opacity: 0.7, dashing: [2, 2] } },
      "Guide",
    );
    sketch.disk([sx(u), sy(v)], 5.5, { fill: GROUND }, "Marker");
    sketch.disk([sx(u), sy(v)], 4, { fill: ACCENT }, "Marker");
  }

  sketch.text([mid, top + side + 20], `round the hole ×${p}`, { size: 9, color: hole, anchor: "middle" });
  // Read upward, along the left edge.
  sketch.text([left - 8, middleY], `round the tube ×${q}`, { size: 9, color: tube, anchor: "middle", angle: 90 });

  if (showDials) {
    const cx = W - 56;
    dial(sketch, [cx, top + 34], 28, p, options.phase, hole, `×${p}`);
    dial(sketch, [cx, top + 120], 28, q, options.phase, tube, `×${q}`);
  }
  return sketch.box();
}
