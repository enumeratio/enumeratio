// The path frame: a layer for `Show` whose addresses are the points a path visits and whose links
// are its steps. A Dyck path (`DyckPath`, 1 = up, 0 = down) puts its points at (step, height); a
// lattice path (`LatticePath`, 1 = north, 0 = east) at (x, y) on the grid it crosses.
//
// Properties: IsUp, IsDown, IsPeak, IsValley, IsReturn (on the axis) for a Dyck path; IsEast,
// IsNorth, IsCorner (the path turns) for a lattice path. A step's direction is that of the step
// arriving at the point. Values: Step, Height (y), X, Area (under the path, up to the point).
// Relations to the selection: SameHeight, SameColumn, Adjacent, and for a Dyck path Tunnel (the
// ends of the matching up and down steps of the step arriving at the selected point).

import { argsOf, type FigureLayer, headOf, intsOf, type Json, normal, UNIT_BASIS } from "./frame-json.ts";
import type { Address, GraphicsPrimitive } from "./tiles-canvas.ts";

export interface PathModel {
  readonly kind: "dyck" | "lattice";
  /** The 0/1 steps: up or north is 1. */
  readonly steps: readonly number[];
}

/** The model an expression names: `DyckPath(steps)` or `LatticePath(steps)`. */
export function pathModelOf(json: Json): PathModel | string {
  const head = headOf(json);
  const steps = intsOf(argsOf(json)[0]);
  const kind = head === "DyckPath" ? "dyck" : head === "LatticePath" ? "lattice" : undefined;
  if (kind && steps && steps.every((s) => s === 0 || s === 1)) return { kind, steps };
  return "PathDiagram needs DyckPath([1, 0, …]) or LatticePath([0, 1, …]) with steps 0 and 1.";
}

const RADIUS = 0.1;

/** A path as a layer for `Show`: its points as addresses, its steps as links. */
export function pathLayer(model: PathModel): FigureLayer {
  const { kind, steps } = model;
  const n = steps.length;
  const dyck = kind === "dyck";
  // Point k is where step k ends; point 0 is the start.
  const points: [number, number][] = [[0, 0]];
  for (const s of steps) {
    const [x, y] = points.at(-1)!;
    points.push(dyck ? [x + 1, y + (s ? 1 : -1)] : s ? [x, y + 1] : [x + 1, y]);
  }
  const area: number[] = [0];
  for (let k = 1; k <= n; k++) {
    const [y0, y1] = [points[k - 1]![1], points[k]![1]];
    area.push(area[k - 1]! + (dyck ? (y0 + y1) / 2 : steps[k - 1] ? 0 : y1));
  }
  // Each up step's matching down step, and back: the stack a parenthesis word is read with.
  const mate = new Map<number, number>();
  if (dyck) {
    const open: number[] = [];
    steps.forEach((s, k) => {
      if (s) open.push(k + 1);
      else if (open.length > 0) {
        const u = open.pop()!;
        mate.set(u, k + 1).set(k + 1, u);
      }
    });
  }
  const byAddress = new Map(points.map(([x, y], k) => [`${x},${y}`, k] as const));
  const pointAt = (i: number, j: number): number | undefined => byAddress.get(`${i},${j}`);
  const address = (k: number): Address => points[k]!;
  const links = steps.map((_, k) => [address(k), address(k + 1)] as const);
  const bounds = {
    i: [Math.min(...points.map((p) => p[0])), Math.max(...points.map((p) => p[0]))] as const,
    j: [Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[1]))] as const,
  };
  const arriving = (k: number): number | undefined => (k > 0 ? steps[k - 1] : undefined);
  const leaving = (k: number): number | undefined => steps[k];
  // A peak of a Dyck path, a corner of a lattice path: where the direction changes (up-down, or either).
  const turns = (k: number): boolean =>
    arriving(k) !== undefined &&
    leaving(k) !== undefined &&
    (dyck ? arriving(k) === 1 && leaving(k) === 0 : arriving(k) !== leaving(k));

  return {
    title: dyck ? `Dyck path of ${n} steps` : `Lattice path of ${n} steps`,
    view: "fixed",
    basis: UNIT_BASIS,
    maxIndex: Math.max(n, 1),
    bounds: { i: bounds.i, j: bounds.j },
    grid: UNIT_BASIS,
    gridLabel: (_axis, k) => String(k),
    addresses: () => points.map((_, k) => address(k)),
    place: (i, j) => [i, j],
    mark: (): GraphicsPrimitive => ({ head: "Disk", radius: RADIUS }),
    links: () => links,
    known: () => true,
    prepare: () => {},
    has: (i, j, name) => {
      const k = pointAt(i, j);
      if (k === undefined) return undefined;
      const [a, l] = [arriving(k), leaving(k)];
      switch (normal(name)) {
        case "up":
          return dyck ? a === 1 : undefined;
        case "down":
          return dyck ? a === 0 : undefined;
        case "peak":
          return dyck ? a === 1 && l === 0 : undefined;
        case "valley":
          return dyck ? a === 0 && l === 1 : undefined;
        case "return":
          return dyck ? points[k]![1] === 0 : undefined;
        case "north":
          return dyck ? undefined : a === 1;
        case "east":
          return dyck ? undefined : a === 0;
        case "corner":
          return dyck ? undefined : a !== undefined && l !== undefined && a !== l;
        case "unknown":
          return false;
      }
      return undefined;
    },
    value: (i, j, name) => {
      const k = pointAt(i, j);
      if (k === undefined) return undefined;
      switch (normal(name)) {
        case "step":
          return k;
        case "height":
        case "y":
          return points[k]![1];
        case "x":
          return points[k]![0];
        case "area":
          return area[k];
      }
      return undefined;
    },
    relatedTo: (relation, [ti, tj], i, j) => {
      const [k, s] = [pointAt(i, j), pointAt(ti, tj)];
      if (k === undefined || s === undefined) return false;
      switch (relation) {
        case "SameHeight":
          return points[k]![1] === points[s]![1];
        case "SameColumn":
          return points[k]![0] === points[s]![0];
        case "Adjacent":
          return Math.abs(k - s) === 1;
        case "Tunnel": {
          const partner = mate.get(s);
          return partner !== undefined && [s, partner].some((step) => k === step || k === step - 1);
        }
      }
      return false;
    },
    summary: () => [
      ["steps", String(n)],
      [dyck ? "peaks" : "corners", String(points.filter((_, k) => turns(k)).length)],
    ],
    describe: (i, j) => {
      const k = pointAt(i, j);
      if (k === undefined) return { title: `(${i}, ${j})`, rows: [] };
      const rows: [string, string][] = [
        ["step", String(k)],
        [dyck ? "height" : "y", String(points[k]![1])],
        ["area", String(area[k])],
      ];
      return { title: `(${i}, ${j})`, rows };
    },
  };
}
