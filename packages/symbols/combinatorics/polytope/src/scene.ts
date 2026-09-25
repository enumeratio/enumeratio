// Casting a face poset into scene space.
//
// A polytope's ambient coordinates are not what gets drawn. The order-4 permutahedron has
// points in R^4 but SPANS only three dimensions, so drawing it means choosing an orthonormal
// basis of what it actually occupies and expressing every face's barycentre in that basis.
//
// Both halves of that cast are READ OFF the polytope rather than assumed: the centre is the
// centroid of its vertices, and the basis spans what its vertices span. That is what lets one
// cast serve a permutahedron (a hyperplane slice of R^n), a cross-polytope (all of R^n) and a
// simplex alike, with no per-polytope constant anywhere in this file.
//
// The overall SCALE is deliberately left alone here — `toUnitCube` normalises it, and a uniform
// factor cannot change the picture. That is why `point` is free to return whatever integer
// multiple of the barycentre happens to be exact for a given polytope.
//
// Face identity is decided by the face data, never by comparing projected coordinates, so the
// projection only has to be faithful enough to look right.

import type { Face, Polytope } from "./face.ts";

export type Point3 = readonly [number, number, number];

const dot = (a: readonly number[], b: readonly number[]): number =>
  a.reduce((sum, value, i) => sum + value * (b[i] ?? 0), 0);
const norm = (a: readonly number[]): number => Math.sqrt(dot(a, a));

/**
 * An orthonormal basis of the span of `vectors`, by Gram-Schmidt in the order given.
 *
 * Vectors that add nothing are dropped rather than producing a near-zero axis, so the result's
 * LENGTH is the dimension of the span — which is how the cast learns how many dimensions the
 * polytope occupies without being told.
 */
export function spanBasis(vectors: readonly (readonly number[])[]): number[][] {
  const basis: number[][] = [];
  for (const vector of vectors) {
    const candidate = [...vector];
    for (const already of basis) {
      const overlap = dot(candidate, already);
      for (let k = 0; k < candidate.length; k++) candidate[k]! -= overlap * already[k]!;
    }
    const length = norm(candidate);
    if (length > 1e-9) basis.push(candidate.map((v) => v / length));
  }
  return basis;
}

/**
 * An orthonormal basis of the hyperplane orthogonal to (1, 1, …, 1) in R^n — the space a
 * permutahedron occupies. The differences e_i − e_{i+1} span it by construction.
 */
export const hyperplaneBasis = (n: number): number[][] =>
  spanBasis(
    Array.from({ length: Math.max(n - 1, 0) }, (_, i) =>
      Array.from({ length: n }, (_, k) => (k === i ? 1 : k === i + 1 ? -1 : 0)),
    ),
  );

export interface Cast {
  /** Orthonormal, in the ambient space; its length is what the polytope spans. */
  readonly basis: readonly number[][];
  /** The vertex centroid, in ambient coordinates. */
  readonly centre: readonly number[];
  readonly at: (point: readonly number[]) => Point3;
}

/** How `polytope` at order `n` sits in scene space: where its centre is and which directions
 *  it occupies. Only the first three basis directions are drawn, so a polytope spanning more
 *  than three dimensions is shown by its leading three — a projection, not a lie about rank. */
export function cast(polytope: Polytope, n: number): Cast {
  const faces = polytope.enumerate(n);
  const ambient = faces.map((face) => polytope.point(face));
  const vertices = ambient.filter((_, i) => polytope.dimension(faces[i]!) === 0);
  const sample = vertices.length > 0 ? vertices : ambient;
  const width = sample[0]?.length ?? 0;
  const centre =
    sample.length === 0
      ? []
      : Array.from(
          { length: width },
          (_, k) => sample.reduce((sum, point) => sum + (point[k] ?? 0), 0) / sample.length,
        );
  const centred = (point: readonly number[]): number[] => point.map((v, k) => v - (centre[k] ?? 0));
  const basis = spanBasis(sample.map(centred));
  return {
    basis,
    centre,
    at: (point) => {
      const coords = basis.map((axis) => dot(centred(point), axis));
      return [coords[0] ?? 0, coords[1] ?? 0, coords[2] ?? 0];
    },
  };
}

export interface ScenePoint {
  readonly face: Face;
  readonly dimension: number;
  readonly at: Point3;
}

/** Every face of `polytope` at order `n`, placed in scene space. */
export function scene(polytope: Polytope, n: number): ScenePoint[] {
  const { at } = cast(polytope, n);
  return polytope.enumerate(n).map((face) => ({
    face,
    dimension: polytope.dimension(face),
    at: at(polytope.point(face)),
  }));
}

/** The faces of a given dimension — the stratum a viewer selects. */
export const stratum = (points: readonly ScenePoint[], dimension: number): ScenePoint[] =>
  points.filter((point) => point.dimension === dimension);

/** An edge of the 1-skeleton: the 1-face itself, and the two vertices it joins.
 *
 *  The edge carries its own face so a drawn line can name what it is — pairing lines with
 *  1-faces by position would drift the moment a polytope had an edge the poset did not give
 *  exactly two vertices for. */
export interface Edge {
  readonly face: ScenePoint;
  readonly ends: readonly [ScenePoint, ScenePoint];
}

/** The 1-skeleton, read off the poset: every 1-face with the two vertices incident to it.
 *
 *  Drawing a polytope means drawing this, and this is pure containment — so the picture comes
 *  out of the poset rather than out of any geometric reasoning. A 1-face that does not have
 *  exactly two vertices is dropped, because that means the containment relation and the
 *  dimension function disagree and there is no honest line to draw. */
export function skeleton(polytope: Polytope, points: readonly ScenePoint[]): Edge[] {
  const vertices = stratum(points, 0);
  const edges: Edge[] = [];
  for (const face of stratum(points, 1)) {
    const ends = vertices.filter((vertex) => polytope.hasVertex(face.face, vertex.face));
    if (ends.length === 2) edges.push({ face, ends: [ends[0]!, ends[1]!] });
  }
  return edges;
}

// ── recentre and reorient ────────────────────────────────────────────────────────────────
//
// Selecting a face and having the view settle on it is the interaction that makes a face poset
// explorable rather than merely drawn. It is two motions: bring the face to the middle
// (`centredOn`) and turn it to face the viewer (`orientedTo`).

/** Recentre on a chosen set of faces: translate their centroid to the origin. */
export function centredOn(points: readonly ScenePoint[], selected: readonly ScenePoint[]): ScenePoint[] {
  if (selected.length === 0) return [...points];
  const centre = [0, 1, 2].map((axis) => selected.reduce((sum, point) => sum + point.at[axis]!, 0) / selected.length);
  return points.map((point) => ({
    ...point,
    at: [point.at[0] - centre[0]!, point.at[1] - centre[1]!, point.at[2] - centre[2]!] as Point3,
  }));
}

const cross = (a: Point3, b: Point3): Point3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

const unit = (v: Point3): Point3 | undefined => {
  const length = norm(v);
  return length > 1e-9 ? [v[0] / length, v[1] / length, v[2] / length] : undefined;
};

/**
 * Which way a face looks: its unit outward normal in scene space.
 *
 * Computed without needing the vertices in ring order — take the face's own tangent space (the
 * span of its vertices' offsets from its barycentre) and strip it out of the radial direction,
 * which is the barycentre itself since the cast puts the body's centre at the origin. What
 * survives is orthogonal to the face and points away from the body, which is the definition.
 *
 * Falls out correctly at every dimension: a vertex has no tangent space, so its normal is
 * simply radial; an edge loses only its own direction; a 2-face in 3-space is left with the
 * true plane normal. The BODY has no normal at all — its tangent space is everything — and it
 * reports `undefined` rather than a fabricated direction.
 */
export function faceNormal(polytope: Polytope, points: readonly ScenePoint[], face: ScenePoint): Point3 | undefined {
  const tangent = spanBasis(
    stratum(points, 0)
      .filter((vertex) => polytope.hasVertex(face.face, vertex.face))
      .map((vertex) => [0, 1, 2].map((axis) => vertex.at[axis]! - face.at[axis]!)),
  );
  const radial = [...face.at];
  for (const axis of tangent) {
    const overlap = dot(radial, axis);
    for (let k = 0; k < 3; k++) radial[k]! -= overlap * axis[k]!;
  }
  return unit(radial as unknown as Point3);
}

/** Rotate every point so that `from` ends up pointing along `to`.
 *
 *  The MINIMAL such rotation (Rodrigues about `from × to`), so the figure turns as little as it
 *  can and a viewer keeps their bearings; an exactly opposed pair has no minimal rotation, so
 *  any perpendicular axis will do and one is chosen. */
export function rotated(points: readonly ScenePoint[], from: Point3, to: Point3): ScenePoint[] {
  const f = unit(from);
  const t = unit(to);
  if (!f || !t) return [...points];
  const perpendicular = cross(f, t);
  const sine = norm(perpendicular);
  const cosine = dot(f, t);
  const axis =
    unit(perpendicular) ?? unit(cross(f, Math.abs(f[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])) ?? ([0, 0, 1] as Point3);
  const angle = sine > 1e-9 ? Math.atan2(sine, cosine) : cosine > 0 ? 0 : Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return points.map((point) => {
    const v = point.at;
    const kv = cross(axis, v);
    const kdot = dot(axis, v) * (1 - cos);
    return {
      ...point,
      at: [0, 1, 2].map((i) => v[i]! * cos + kv[i]! * sin + axis[i]! * kdot) as unknown as Point3,
    };
  });
}

/** Turn the scene until the selected faces look along `towards` — the reorient half.
 *
 *  Several faces at once average their normals, which is the right answer for a selection that
 *  shares an edge (the view settles between them) and a harmless one otherwise. Faces with no
 *  normal — the body — contribute nothing, and a selection of only those leaves the view alone. */
export function orientedTo(
  polytope: Polytope,
  points: readonly ScenePoint[],
  selected: readonly ScenePoint[],
  towards: Point3,
): ScenePoint[] {
  const normals = selected
    .map((face) => faceNormal(polytope, points, face))
    .filter((normal): normal is Point3 => normal !== undefined);
  if (normals.length === 0) return [...points];
  const mean = [0, 1, 2].map(
    (axis) => normals.reduce((sum, normal) => sum + normal[axis]!, 0) / normals.length,
  ) as unknown as Point3;
  return rotated(points, mean, towards);
}
