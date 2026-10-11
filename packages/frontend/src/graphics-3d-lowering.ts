// The figures in space as `makeBoxes` rules (the wiki's Speculative-Box-Primitives, §6 slice 7).
// `ListPlot3D` and `BarChart3D` hold their data, so they lower whole; `Plot3D` of an expression is
// a producer, like a 2-D plot: sampling needs a compiled kernel (the page's, or a session's), so the
// box holds the expression it came from and `Producer -> head`, and an environment that can sample
// asks for the grid (`surfaceBox`). A curve in space is `Graphics3D(Line(points))`, its points the
// value of an expression the page evaluates.

import type { Box } from "@enumeratio/boxes";
import type { Triple } from "./plot3d.ts";
import {
  barChart3dBox,
  type BarOptions,
  curveBox,
  type CurveOptions,
  type Graphics3dOptions,
  meshBox,
  scatterBox,
} from "./graphics-3d-box.ts";

/** The heads whose figures are `Graphics3DBox`es, drawn by `<graphics-3d-box>`. */
export const GRAPHICS_3D_HEADS: readonly string[] = ["Plot3D", "ListPlot3D", "BarChart3D", "Graphics3D"];

const spellings = (heads: readonly string[]): string =>
  heads.flatMap((h) => [h, h.charAt(0).toLowerCase() + h.slice(1)]).join("|");
const SPACE_VALUE = new RegExp(`^\\s*(?:${spellings(GRAPHICS_3D_HEADS)})\\s*\\(`);

/** Whether `value` is a figure in space (`Plot3D(…)`, `BarChart3D([…])`), which `<graphics-3d-box>` draws. */
export const holdsGraphics3d = (value: string | undefined): boolean => SPACE_VALUE.test(value ?? "");

/** A figure's settings, the attributes its expression's options lower to (`graphics3dSettingsOf`). */
export type Graphics3dSettings = Readonly<Record<string, string>>;

const on = (v: string | undefined): boolean => v !== undefined && v !== "" && v !== "false";
const isNumber = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function jsonOf(text: string | undefined): unknown {
  const t = text?.trim();
  if (!t) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    return undefined;
  }
}

/** `lo,hi` as a pair of finite numbers, else undefined. */
function pairOf(text: string | undefined): [number, number] | undefined {
  const [a, b] = (text ?? "").split(",").map((s) => Number(s.trim()));
  return Number.isFinite(a) && Number.isFinite(b) ? [a!, b!] : undefined;
}

/** `[[x, y, z], …]` as points. */
export function triplesOf(data: unknown): Triple[] | undefined {
  if (!Array.isArray(data) || data.length === 0) return undefined;
  if (!data.every((p) => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every(isNumber))) return undefined;
  return (data as number[][]).map(([x, y, z]) => [x!, y!, z!] as const);
}

/** A rectangular matrix of heights; a non-number reads as a hole, so rows keep their length. */
export function matrixOf(data: unknown, flatIsARow = false): number[][] | undefined {
  if (!Array.isArray(data) || data.length === 0) return undefined;
  if (flatIsARow && data.every(isNumber)) return [data as number[]];
  if (!data.every((r) => Array.isArray(r))) return undefined;
  const rows = (data as unknown[][]).map((r) => r.map((v) => (isNumber(v) ? v : Number.NaN)));
  return rows.every((r) => r.length === rows[0]!.length && r.length > 0) ? rows : undefined;
}

/** Labels as a JSON list, or comma-separated; empty reads as undefined. */
function labelsOf(text: string | undefined): string[] | undefined {
  const listed = jsonOf(text);
  const parts = Array.isArray(listed)
    ? listed.map(String)
    : (text ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
  return parts.length > 0 ? parts : undefined;
}

/**
 * Bin scattered `points` onto an `nx` by `ny` grid, each cell holding the mean z of the points that
 * fall in it (`NaN` where none do). Binning by position, rather than fitting an interpolant, keeps
 * the result an exact function of the input.
 */
export function gridFromPoints(
  points: readonly Triple[],
  nx: number,
  ny: number,
): { grid: number[][]; xs: number[]; ys: number[] } {
  const cols = Math.max(1, Math.round(nx));
  const rows = Math.max(1, Math.round(ny));
  const usable = points.filter((p) => p.every(Number.isFinite));
  const span = (k: number): [number, number] => {
    const values = usable.map((p) => p[k]!);
    if (values.length === 0) return [0, 1];
    const [lo, hi] = [Math.min(...values), Math.max(...values)];
    return lo === hi ? [lo - 1, hi + 1] : [lo, hi];
  };
  const [xlo, xhi] = span(0);
  const [ylo, yhi] = span(1);
  const sums = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const hits = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));
  const bin = (v: number, lo: number, hi: number, count: number): number =>
    Math.max(0, Math.min(count - 1, Math.floor(((v - lo) / (hi - lo || 1)) * count)));
  for (const p of usable) {
    const i = bin(p[0], xlo, xhi, cols);
    const j = bin(p[1], ylo, yhi, rows);
    sums[j]![i]! += p[2];
    hits[j]![i]! += 1;
  }
  return {
    grid: sums.map((r, j) => r.map((s, i) => (hits[j]![i]! > 0 ? s / hits[j]![i]! : Number.NaN))),
    xs: Array.from({ length: cols }, (_, i) => (cols > 1 ? xlo + ((xhi - xlo) * i) / (cols - 1) : xlo)),
    ys: Array.from({ length: rows }, (_, j) => (rows > 1 ? ylo + ((yhi - ylo) * j) / (rows - 1) : ylo)),
  };
}

const number = (v: string | undefined): number | undefined => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isFinite(n) ? n : undefined;
};

/** `count` evenly spaced values from `lo` to `hi`. */
export const gridAxis = (lo: number, hi: number, count: number): number[] =>
  Array.from({ length: count }, (_, i) => lo + ((hi - lo) * i) / (count - 1));

/**
 * The grids of `items` surfaces over `xs` by `ys`: `at(k, x, y)` is surface `k` at a point, `NaN`
 * where it has no real value.
 */
export const sampleGrids = (
  items: number,
  xs: readonly number[],
  ys: readonly number[],
  at: (k: number, x: number, y: number) => number,
): number[][][] => Array.from({ length: items }, (_, k) => ys.map((y) => xs.map((x) => at(k, x, y))));

/** A Plot3D's grid per side, from its `N` setting: 2 to 60, 26 by default. */
export const gridSide = (settings: Graphics3dSettings): number =>
  Math.max(2, Math.min(60, Number(settings["n"]) || 26));

/** The ranges a Plot3D samples over, from its settings: -3 to 3 for an axis that names none. */
export const surfaceDomains = (settings: Graphics3dSettings): [[number, number], [number, number]] => [
  pairOf(settings["x-domain"]) ?? [-3, 3],
  pairOf(settings["y-domain"]) ?? [-3, 3],
];

/** A curve whose points are written out (`Graphics3D(Line([[0, 0, 0], …]))`), lowered whole; undefined when they are an expression to evaluate. */
export function literalCurveBox(settings: Graphics3dSettings): Box | undefined {
  const points = triplesOf(jsonOf(settings["value"]));
  return points && curveBox(points, { ...curveOptionsOf(settings), marker: number(settings["phase"]) });
}

/** What a figure's settings say about how it is drawn: the chrome, the view, the colors. */
export function graphics3dOptionsOf(settings: Graphics3dSettings): Graphics3dOptions {
  return {
    axes: settings["axes"] !== "false",
    azimuth: number(settings["azimuth"]),
    elevation: number(settings["elevation"]),
    zoom: number(settings["zoom"]),
    title: settings["label"] || undefined,
    xScale: settings["x-scale"],
    yScale: settings["y-scale"],
    zScale: settings["z-scale"],
    colorLegend: on(settings["color-legend"]),
    gradient: settings["gradient"],
    discrete: settings["discrete"],
    reverse: on(settings["reverse"]),
  };
}

/** `ListPlot3D`: a height grid (or scattered triples, binned onto one) as a mesh, or `Type -> "points"` as a scatter. */
export function listBoxOfSettings(settings: Graphics3dSettings): Box | undefined {
  const parsed = jsonOf(settings["data"]);
  const points = triplesOf(parsed);
  const view = graphics3dOptionsOf(settings);
  const zRange = pairOf(settings["z-range"] ?? settings["zrange"]);
  if (settings["type"] === "points")
    return points
      ? scatterBox(points, {
          ...view,
          zRange,
          size: number(settings["size"]) && Number(settings["size"]) > 0 ? Number(settings["size"]) : undefined,
          depthCue:
            number(settings["depth-cue"]) !== undefined && Number(settings["depth-cue"]) >= 0
              ? Number(settings["depth-cue"])
              : undefined,
        })
      : undefined;
  const size = Math.max(2, Math.min(120, number(settings["n"]) ?? 12));
  const grid = matrixOf(parsed) ?? (points ? gridFromPoints(points, size, size).grid : undefined);
  return grid && meshBox(grid, { ...view, zRange, wireframe: on(settings["wireframe"]) });
}

/** `BarChart3D`: a matrix of heights (a flat list is one row) as bars. */
export function barBoxOfSettings(settings: Graphics3dSettings): Box | undefined {
  const matrix = matrixOf(jsonOf(settings["data"]), true);
  const gap = number(settings["gap"]);
  const options: BarOptions = {
    ...graphics3dOptionsOf(settings),
    gap: gap !== undefined && gap >= 0 ? gap : undefined,
    zRange: pairOf(settings["z-range"] ?? settings["zrange"]),
    rowLabels: labelsOf(settings["row-labels"]),
    colLabels: labelsOf(settings["col-labels"]),
  };
  return matrix && barChart3dBox(matrix, options);
}

/** A curve's settings: the torus it lies on, whether it closes, and its default view. */
export function curveOptionsOf(settings: Graphics3dSettings): CurveOptions {
  const torus = (settings["torus"] ?? "").split(",").map((t) => Number(t.trim()));
  const [major, minor] = torus;
  return {
    ...graphics3dOptionsOf(settings),
    axes: false,
    closed: on(settings["closed"]),
    torus: isNumber(major) && isNumber(minor) && major > 0 && minor > 0 ? { major, minor } : undefined,
  };
}
