// Quivers and their path algebras.
//
// A quiver is a directed multigraph: vertices, and arrows between them (loops and
// parallel arrows allowed). The path algebra kQ has a basis of all directed PATHS,
// including one trivial path e_v per vertex, and the product is concatenation — or zero
// when the paths do not meet end to end.
//
// What makes this family exercise a new edge: kQ is finite-dimensional exactly when the
// quiver is ACYCLIC. One loop gives infinitely many paths, so the algebra has no finite
// basis and no dimension, and the code has to say so rather than enumerate forever.
// Every other family here was finite by construction.
//
// The A_n linear quiver 1→2→…→n is worth noticing: its paths are the pairs i ≤ j, so its
// path algebra is the incidence algebra of a chain. Two of these libraries describe the
// same object from different directions.

/** A quiver: a vertex count, and arrows as (from, to) pairs indexed by position. */
export interface Quiver {
  readonly name: string;
  readonly vertices: number;
  readonly arrows: readonly { from: number; to: number }[];
}

export const quiver = (
  name: string,
  vertices: number,
  arrows: readonly { from: number; to: number }[],
): Quiver | undefined => {
  if (!Number.isSafeInteger(vertices) || vertices < 1) return undefined;
  if (arrows.some((a) => a.from < 1 || a.from > vertices || a.to < 1 || a.to > vertices)) {
    return undefined;
  }
  return { name, vertices, arrows };
};

/** A_n: 1→2→…→n. Acyclic, and the path algebra of a chain. */
export const linearQuiver = (n: number): Quiver | undefined =>
  quiver(
    `LinearQuiver(${n})`,
    n,
    Array.from({ length: Math.max(0, n - 1) }, (_, i) => ({ from: i + 1, to: i + 2 })),
  );

/** One vertex, one loop. kQ is the polynomial ring k[x] — infinite-dimensional. */
export const jordanQuiver = (): Quiver => ({
  name: "JordanQuiver",
  vertices: 1,
  arrows: [{ from: 1, to: 1 }],
});

/** Two vertices, two parallel arrows — the smallest quiver with multiple arrows. */
export const kroneckerQuiver = (): Quiver => ({
  name: "KroneckerQuiver",
  vertices: 2,
  arrows: [
    { from: 1, to: 2 },
    { from: 1, to: 2 },
  ],
});

/** The adjacency matrix: entry (i,j) counts arrows from i+1 to j+1. */
export function adjacency(q: Quiver): number[][] {
  const matrix = Array.from({ length: q.vertices }, () => Array.from({ length: q.vertices }, () => 0));
  for (const arrow of q.arrows) matrix[arrow.from - 1]![arrow.to - 1]! += 1;
  return matrix;
}

/**
 * Whether the quiver has a directed cycle — which decides whether kQ is
 * finite-dimensional. Depth-first search with a colouring; a loop counts as a cycle.
 */
export function hasCycle(q: Quiver): boolean {
  const state = Array.from({ length: q.vertices + 1 }, () => 0); // 0 unseen, 1 open, 2 done
  const out = (v: number) => q.arrows.filter((a) => a.from === v).map((a) => a.to);
  const walk = (v: number): boolean => {
    if (state[v] === 1) return true; // back edge
    if (state[v] === 2) return false;
    state[v] = 1;
    for (const next of out(v)) if (walk(next)) return true;
    state[v] = 2;
    return false;
  };
  for (let v = 1; v <= q.vertices; v++) if (walk(v)) return true;
  return false;
}

/** A path: where it starts, and the arrows it follows (empty for a trivial path). */
export interface Path {
  readonly start: number;
  readonly arrows: readonly number[];
}

export const pathKey = (p: Path): string => `${p.start}:${p.arrows.join(",")}`;

/** Where a path ends. */
export function pathEnd(q: Quiver, p: Path): number {
  return p.arrows.length === 0 ? p.start : q.arrows[p.arrows[p.arrows.length - 1]!]!.to;
}

/** Whether a path is actually a path of this quiver. */
export function isPath(q: Quiver, p: Path): boolean {
  if (p.start < 1 || p.start > q.vertices) return false;
  let at = p.start;
  for (const index of p.arrows) {
    const arrow = q.arrows[index];
    if (arrow === undefined || arrow.from !== at) return false;
    at = arrow.to;
  }
  return true;
}

/**
 * Every path of the quiver — the basis of kQ. `undefined` when the quiver has a cycle,
 * because then there are infinitely many and no finite basis exists.
 */
export function allPaths(q: Quiver): Path[] | undefined {
  if (hasCycle(q)) return undefined;
  const found: Path[] = [];
  const walk = (p: Path): void => {
    found.push(p);
    const at = pathEnd(q, p);
    for (const [index, arrow] of q.arrows.entries()) {
      if (arrow.from === at) walk({ start: p.start, arrows: [...p.arrows, index] });
    }
  };
  for (let v = 1; v <= q.vertices; v++) walk({ start: v, arrows: [] });
  return found;
}

/** The dimension of kQ, or `undefined` when the quiver is not acyclic. */
export const pathAlgebraDimension = (q: Quiver): number | undefined => allPaths(q)?.length;

/**
 * Concatenate: first `a`, then `b`. Zero — represented as `undefined` — when b does not
 * start where a ends, which is most of the time and is the defining feature of a path
 * algebra.
 */
export function concatenate(q: Quiver, a: Path, b: Path): Path | undefined {
  return pathEnd(q, a) === b.start ? { start: a.start, arrows: [...a.arrows, ...b.arrows] } : undefined;
}
