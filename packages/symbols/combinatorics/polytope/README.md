# @enumeratio/polytope

Polytopes as face posets, not as vertex-coordinate lists: the permutahedron, simplex,
cross-polytope, hypercube and associahedron, each stated purely as its combinatorics
(enumerate a face, its dimension, its barycentre, vertex incidence), with the containment
order and a projection into scene space derived from that. It declares no CE heads — it is
a data layer other packages draw on to render or reason about these shapes.

## Usage

Each polytope is a `Polytope` value keyed in `POLYTOPES`, and the `polytope()` helper fills
in the derived face-poset `contains` order from the four primitives a shape states directly:

```ts
import { PERMUTAHEDRON, POLYTOPES, scene } from "@enumeratio/polytope";

PERMUTAHEDRON.enumerate(3); // every set composition of {1, 2, 3} — the hexagon's 13 faces
POLYTOPES["cross-polytope"]; // by the name a page or attribute would spell

const points = scene(PERMUTAHEDRON, 4); // cast into an orthonormal basis of what it spans
```

`scene.ts` casts a face poset into ambient 3-space (or fewer, for a polytope that fills a
proper subspace, or more — a higher-order shape scene-projects onto its leading axes), and
`render.ts` turns a scene into 2D rings a caller can draw, given its own `Project` function.

## Faces

Each polytope carries its faces as a distinct word shape:

- `PERMUTAHEDRON` — set compositions of `{1..n}` (surjective label words; Fubini-counted)
- `SIMPLEX` — nonempty subsets, as 0/1 words
- `CROSS_POLYTOPE` / `HYPERCUBE` — the same signed-subset word over `{−1, 0, +1}`, read as
  dual to each other (spanned axes vs. fixed axes)
- `ASSOCIAHEDRON` — noncrossing dissections of a convex polygon, as 0/1 words over its
  diagonals; Loday's coordinates
