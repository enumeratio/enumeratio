// Polytopes as FACE POSETS.
//
// The model is enumeratio's `base_polytope`, and its framing is the useful part: a polytope
// declaration is a cast of element data into SCENE space, exactly as `base_glyph` casts into
// page space and `base_repr` into line space. Same data, three spaces. So a polytope is not a
// new kind of object — it is a third representation.
//
// Four functions define one — enumerate, dimension, point, hasVertex — and the fifth, the
// face-poset order, is derived from the fourth. Every polytope here is stated as its
// combinatorics; the geometry follows.

/** A face of some polytope, as the element data of the collection whose faces it is. */
export type Face = readonly number[];

export interface Polytope {
  readonly name: string;
  /** The carrier whose elements ARE the faces. */
  readonly faces: string;
  readonly title: string;
  /** Faces of the order-n polytope, in the collection's own order. */
  readonly enumerate: (n: number) => Face[];
  readonly dimension: (face: Face) => number;
  /**
   * The face's barycentre in ambient coordinates, up to one fixed positive scale shared by
   * every face of the polytope.
   *
   * The scale is free because `toUnitCube` normalises it away — which is exactly what lets each
   * polytope pick whatever multiple makes its coordinates exact integers. The permutahedron
   * doubles (a block of even size otherwise gives a half-integer); the simplex and
   * cross-polytope multiply by a factorial to clear a block-size denominator. Exact arithmetic
   * all the way to the screen is what makes coincident-looking faces stay distinguishable.
   */
  readonly point: (face: Face) => number[];
  /** Is `vertex` (a dimension-0 face) one of `big`'s vertices? The primitive relation —
   *  enumeratio's `contains_fn` is exactly this, and its comment says so. */
  readonly hasVertex: (big: Face, vertex: Face) => boolean;
  /** The face-poset order, DERIVED: `big` contains `small` when every vertex of `small` is a
   *  vertex of `big`. Vertex incidence alone is not an order — it is not even reflexive on
   *  faces of positive dimension, since a face is not one of its own vertices. */
  readonly contains: (big: Face, small: Face, n: number) => boolean;
  /** The polytope's own dimension at order n — what it spans, not what it is embedded in. */
  readonly dimensionAt: (n: number) => number;
}

/** A polytope as stated: the order comes free. */
export type PolytopeSpec = Omit<Polytope, "contains">;

/** Fill in the derived face-poset order, so no polytope has to restate it. */
export function polytope(spec: PolytopeSpec): Polytope {
  const verticesOf = (n: number): Face[] =>
    spec.enumerate(n).filter((face) => spec.dimension(face) === 0);
  return {
    ...spec,
    contains: (big, small, n) =>
      verticesOf(n)
        .filter((vertex) => spec.hasVertex(small, vertex))
        .every((vertex) => spec.hasVertex(big, vertex)),
  };
}

/** n!, the common denominator that clears a block-size division. */
export const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1));
