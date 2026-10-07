// The geometry of a 2-D lattice: the point i·e₁ + j·e₂ of the plane, the Voronoi cell it owns (a
// rectangle or a hexagon depending on the basis), which indices a view covers, and how far a view
// may zoom out. What the points mean and how they are drawn is a layer's (`tiles-canvas.ts`).

export type Vec2 = readonly [number, number];

export interface LatticeView {
  readonly center: Vec2;
  readonly extent: number;
}

const dot = (a: Vec2, b: Vec2): number => a[0] * b[0] + a[1] * b[1];
const scale = (a: Vec2, k: number): Vec2 => [a[0] * k, a[1] * k];
const plus = (a: Vec2, b: Vec2): Vec2 => [a[0] + b[0], a[1] + b[1]];
const minus = (a: Vec2, b: Vec2): Vec2 => [a[0] - b[0], a[1] - b[1]];

export const latticePoint = (basis: readonly [Vec2, Vec2], i: number, j: number): Vec2 =>
  plus(scale(basis[0], i), scale(basis[1], j));

/** (i, j) with i·e₁ + j·e₂ = p, as reals. */
export function latticeCoordinates(basis: readonly [Vec2, Vec2], p: Vec2): Vec2 {
  const [[a, c], [b, d]] = basis;
  const det = a * d - b * c;
  return [(p[0] * d - p[1] * b) / det, (p[1] * a - p[0] * c) / det];
}

export const cellArea = (basis: readonly [Vec2, Vec2]): number =>
  Math.abs(basis[0][0] * basis[1][1] - basis[0][1] * basis[1][0]);

/**
 * The Voronoi cell of the origin: the polygon of points nearer 0 than any other lattice point.
 * After Lagrange reduction the neighbors that matter are ±b₁, ±b₂ and ±(b₁ ∓ b₂), so clipping a
 * box by their bisectors gives a rectangle for an orthogonal basis and a hexagon otherwise.
 */
export function voronoiCell(basis: readonly [Vec2, Vec2]): Vec2[] {
  let [u, v] = basis;
  for (let steps = 0; steps < 64; steps++) {
    if (dot(u, u) > dot(v, v)) [u, v] = [v, u];
    const k = Math.round(dot(u, v) / dot(u, u));
    if (k === 0) break;
    v = minus(v, scale(u, k));
  }
  const neighbors = [u, v, minus(v, u), plus(u, v)].flatMap((w) => [w, scale(w, -1)]);
  const r = Math.sqrt(dot(u, u) + dot(v, v)) * 2;
  let polygon: Vec2[] = [
    [-r, -r],
    [r, -r],
    [r, r],
    [-r, r],
  ];
  for (const w of neighbors) {
    const limit = dot(w, w) / 2;
    const next: Vec2[] = [];
    for (let k = 0; k < polygon.length; k++) {
      const p = polygon[k]!;
      const q = polygon[(k + 1) % polygon.length]!;
      const [fp, fq] = [dot(p, w) - limit, dot(q, w) - limit];
      if (fp <= 0) next.push(p);
      if (fp < 0 !== fq < 0 && fp !== fq) next.push(plus(p, scale(minus(q, p), fp / (fp - fq))));
    }
    polygon = next;
  }
  return polygon;
}

/** The index box covering a view of `width`×`height` pixels, one cell of margin. */
export function visibleRange(basis: readonly [Vec2, Vec2], view: LatticeView, aspect: number): { i: Vec2; j: Vec2 } {
  const [cx, cy] = view.center;
  const [hw, hh] = [view.extent * aspect, view.extent];
  const corners = [
    [cx - hw, cy - hh],
    [cx + hw, cy - hh],
    [cx + hw, cy + hh],
    [cx - hw, cy + hh],
  ].map((p) => latticeCoordinates(basis, p as unknown as Vec2));
  const is = corners.map((c) => c[0]);
  const js = corners.map((c) => c[1]);
  return {
    i: [Math.floor(Math.min(...is)) - 1, Math.ceil(Math.max(...is)) + 1],
    j: [Math.floor(Math.min(...js)) - 1, Math.ceil(Math.max(...js)) + 1],
  };
}

/** The largest half-height whose view holds at most `maxCells` lattice points. */
export const maxExtentFor = (basis: readonly [Vec2, Vec2], aspect: number, maxCells: number): number =>
  Math.sqrt((maxCells * cellArea(basis)) / (4 * aspect));

/**
 * Keep a view inside what a layer can answer and a cell budget: the extent between a few cells
 * and the budget's, the center within the layer's exact index range.
 */
export function clampLatticeView(
  layer: { readonly basis: readonly [Vec2, Vec2]; readonly maxIndex: number },
  view: LatticeView,
  aspect: number,
  maxCells: number,
): LatticeView {
  const unit = Math.sqrt(cellArea(layer.basis));
  const extent = Math.min(Math.max(view.extent, 1.5 * unit), maxExtentFor(layer.basis, aspect, maxCells));
  const shortest = Math.min(Math.hypot(...layer.basis[0]), Math.hypot(...layer.basis[1]));
  const radius = Math.max(0, layer.maxIndex * shortest * 0.5 - extent * Math.max(aspect, 1));
  const [cx, cy] = view.center;
  const r = Math.hypot(cx, cy);
  const center: Vec2 = r > radius ? [(cx * radius) / r, (cy * radius) / r] : [cx, cy];
  return { center, extent };
}

/** The lattice point nearest a plane point. */
export function nearestLatticePoint(basis: readonly [Vec2, Vec2], p: Vec2): Vec2 {
  const [fi, fj] = latticeCoordinates(basis, p);
  let best: Vec2 = [Math.round(fi), Math.round(fj)];
  let bestDistance = Infinity;
  for (const di of [-1, 0, 1]) {
    for (const dj of [-1, 0, 1]) {
      const candidate: Vec2 = [Math.round(fi) + di, Math.round(fj) + dj];
      const q = minus(latticePoint(basis, candidate[0], candidate[1]), p);
      const distance = dot(q, q);
      if (distance < bestDistance) [best, bestDistance] = [candidate, distance];
    }
  }
  return best;
}
