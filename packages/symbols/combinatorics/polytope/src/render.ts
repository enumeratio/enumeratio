// Drawing a face poset.
//
// The picture is derived from the POSET, not from geometry. A face's polygon is the set of
// vertices incident to it; an edge is a dimension-1 face with its two. The only geometric
// step is ordering a face's vertices into a ring, and that is done by angle about the face's
// own barycentre — which is exact data, not a fitted centre.
//
// Faces are compared by VALUE throughout. Two faces that project to the same place are still
// different faces, and selection has to survive that.

import type { Face, Polytope } from "./face.ts";
import { centredOn, orientedTo, type Point3, scene, type ScenePoint, skeleton, stratum } from "./scene.ts";

/** A projected point: page coordinates plus view depth (larger = nearer). */
export interface Projected {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

/** Supplied by the caller, so this module needs no camera of its own —
 *  `@enumeratio/notatio` has one that fits the unit cube. */
export type Project = (point: Point3) => Projected;

/** Two faces are the same when their DATA is. */
export const sameFace = (a: Face, b: Face): boolean => a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * Scale a scene into the unit cube, which is what a camera expects.
 *
 * `origin` is the point held at the middle of the cube — the body's own centre by default, or
 * whatever the caller has chosen to settle the view on. HOLDING it is the point: normalising to
 * the bounding box instead would recompute the middle from the scaled result and quietly undo
 * any recentring the caller had just done.
 *
 * The scale comes from the farthest point's DISTANCE from that origin rather than from a
 * per-axis extent, so the content fills the cube's inscribed sphere. That is what makes the
 * figure's size independent of which way it is facing: a bounding box grows and shrinks as the
 * solid turns, and a figure that breathed while being dragged would be unusable.
 */
export function toUnitCube(points: readonly ScenePoint[], origin: Point3 = [0, 0, 0]): ScenePoint[] {
  if (points.length === 0) return [];
  const radius = Math.max(
    ...points.map((p) => Math.hypot(p.at[0] - origin[0], p.at[1] - origin[1], p.at[2] - origin[2])),
    1e-9,
  );
  return points.map((point) => ({
    ...point,
    at: [
      (point.at[0] - origin[0]) / (2 * radius) + 0.5,
      (point.at[1] - origin[1]) / (2 * radius) + 0.5,
      (point.at[2] - origin[2]) / (2 * radius) + 0.5,
    ] as const,
  }));
}

/** The vertices of `face`, ordered around it — a ring ready to draw as a polygon.
 *
 *  An angular sort about the projected barycentre is exactly right here and needs no hull
 *  algorithm, because every face of a polytope is convex. */
export function ring(
  polytope: Polytope,
  face: ScenePoint,
  vertices: readonly ScenePoint[],
  project: Project,
): Projected[] {
  const centre = project(face.at);
  return vertices
    .filter((vertex) => polytope.hasVertex(face.face, vertex.face))
    .map((vertex) => project(vertex.at))
    .sort((a, b) => Math.atan2(a.y - centre.y, a.x - centre.x) - Math.atan2(b.y - centre.y, b.x - centre.x));
}

export interface DrawOptions {
  /** Faces to highlight, and — with `recentre` / `reorient` — to settle the view on. */
  readonly selected?: readonly Face[];
  /** Translate the selection's centroid to the middle of the figure. */
  readonly recentre?: boolean;
  /** Turn the figure until the selection looks along this direction — the viewer's, if the
   *  chosen face is to be seen flat on. The caller supplies it because the camera, not the
   *  polytope, knows which way the viewer is. */
  readonly reorient?: Point3;
}

/** Every drawn mark carries `at`: where a label for it belongs. For a polygon that is the
 *  face's own projected barycentre, not the centre of its drawn ring — the barycentre is exact
 *  data, and on a face seen at a sharp angle the two are visibly different points. */
export interface Drawn {
  readonly shaded: {
    readonly face: Face;
    readonly ring: Projected[];
    readonly at: Projected;
    readonly depth: number;
    readonly selected: boolean;
  }[];
  readonly edges: {
    readonly face: Face;
    readonly from: Projected;
    readonly to: Projected;
    readonly at: Projected;
    readonly selected: boolean;
  }[];
  readonly vertices: { readonly face: Face; readonly at: Projected; readonly selected: boolean }[];
}

/** Everything to draw, with the shaded faces sorted back to front. */
export function drawn(polytope: Polytope, n: number, project: Project, options: DrawOptions = {}): Drawn {
  const chosen = options.selected ?? [];
  const isChosen = (face: Face): boolean => chosen.some((other) => sameFace(other, face));

  // Turn first, then move: the rotation is about the body's own centre, which is where the cast
  // put the origin, so reorienting before recentring keeps the figure from swinging out of frame.
  const placed = scene(polytope, n);
  const chosenPoints = placed.filter((p) => isChosen(p.face));
  const turned = options.reorient === undefined ? placed : orientedTo(polytope, placed, chosenPoints, options.reorient);
  const centred =
    options.recentre === true
      ? centredOn(
          turned,
          turned.filter((p) => isChosen(p.face)),
        )
      : turned;
  // `centredOn` has already put the selection at the origin when recentring was asked for, so
  // the origin is what the cube holds either way.
  const points = toUnitCube(centred);
  const vertices = stratum(points, 0);

  const shaded = stratum(points, 2)
    .map((face) => ({
      face: face.face,
      ring: ring(polytope, face, vertices, project),
      at: project(face.at),
      depth: project(face.at).depth,
      selected: isChosen(face.face),
    }))
    .sort((a, b) => a.depth - b.depth);

  const edges = skeleton(polytope, points).map(({ face, ends: [from, to] }) => ({
    face: face.face,
    from: project(from.at),
    to: project(to.at),
    at: project(face.at),
    selected: isChosen(face.face),
  }));

  return {
    shaded,
    edges,
    vertices: vertices.map((vertex) => ({
      face: vertex.face,
      at: project(vertex.at),
      selected: isChosen(vertex.face),
    })),
  };
}
