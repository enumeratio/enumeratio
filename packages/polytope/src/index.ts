export { ASSOCIAHEDRON } from "./associahedron.ts";
export { CROSS_POLYTOPE } from "./crosspolytope.ts";
export { type Face, factorial, polytope, type Polytope, type PolytopeSpec } from "./face.ts";
export { PERMUTAHEDRON } from "./permutahedron.ts";
export {
  type DrawOptions,
  type Drawn,
  drawn,
  type Project,
  type Projected,
  ring,
  sameFace,
  toUnitCube,
} from "./render.ts";
export {
  cast,
  type Cast,
  centredOn,
  type Edge,
  faceNormal,
  hyperplaneBasis,
  orientedTo,
  type Point3,
  rotated,
  scene,
  type ScenePoint,
  skeleton,
  spanBasis,
  stratum,
} from "./scene.ts";
export { SIMPLEX } from "./simplex.ts";

import { ASSOCIAHEDRON } from "./associahedron.ts";
import { CROSS_POLYTOPE } from "./crosspolytope.ts";
import type { Polytope } from "./face.ts";
import { PERMUTAHEDRON } from "./permutahedron.ts";
import { SIMPLEX } from "./simplex.ts";

/** Every polytope, by the name a page or an attribute would spell. */
export const POLYTOPES: Record<string, Polytope> = {
  permutahedron: PERMUTAHEDRON,
  simplex: SIMPLEX,
  "cross-polytope": CROSS_POLYTOPE,
  associahedron: ASSOCIAHEDRON,
};
