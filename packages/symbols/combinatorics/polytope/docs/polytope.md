# Polytope

A polytope's **face poset**, drawn and clickable, by `PolytopeFaces` in a
`Show`. A polytope displays as its faces, so a cell that evaluates
`Permutahedron(4)` draws it.

The thing worth knowing about this picture is that every mark _is_ a face. A polygon is a
2-face, a line a 1-face, a dot a 0-face, and each is an address `(k, index)`: the face's
dimension and its position among the faces of that dimension, in the collection's own order.
Clicking recovers which face was hit without consulting geometry, and two faces that land on
the same pixels stay distinguishable. Selection follows face identity, never screen position.

Nothing here is drawn geometrically. A face's polygon is the set of vertices incident to it and
an edge is a 1-face with its two, both read straight off the containment relation. The only
geometric step is ordering a face's vertices into a ring, which needs no hull algorithm, because
every face of a polytope is convex.

| Head               | Faces are                     | Order _n_ is                 |
| ------------------ | ----------------------------- | ---------------------------- |
| `Permutahedron(n)` | set compositions of {1.._n_}  | a truncated octahedron at 4  |
| `Simplex(n)`       | nonempty subsets of {1.._n_}  | a tetrahedron at 4           |
| `CrossPolytope(n)` | signed subsets                | an octahedron at 3           |
| `Hypercube(n)`     | signed subsets, dual reading  | a cube at 3                  |
| `Associahedron(n)` | dissections of an (_n_+2)-gon | 3 squares + 6 pentagons at 4 |

## The five

<Story
  title="The permutahedron">
<template #description>
Faces are set <em>compositions</em>, not set partitions: block order is kept, so
the counts are the Fubini numbers and the 24 vertices are the 24 orderings. The
6 squares and 8 hexagons fall out of vertex incidence — nothing tells the
renderer this is a truncated octahedron. Drag to orbit; ⌘/Ctrl + scroll or pinch to zoom.
</template>
<notatio-show value='Show(PolytopeFaces(Permutahedron(4)), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 320])' legend-at="none" />
</Story>

<Story
  title="The associahedron">
<template #description>
The ways to bracket a product. Vertices are the 14 triangulations of a hexagon,
placed by Loday's coordinates; the 9 facets come out as three squares and six
pentagons, which is the check that those coordinates are right.
</template>
<notatio-show value='Show(PolytopeFaces(Associahedron(4)), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 320])' legend-at="none" />
</Story>

<Story
  title="The simplex and the cross-polytope">
<template #description>
The Boolean lattice and the signed subsets — the two simplest face posets, and
so the sharpest check on the machinery. The cross-polytope is also the one that
does <em>not</em> lie in a hyperplane, which is why the projection reads a
polytope's span off its vertices rather than assuming one.
</template>
<notatio-show value='Show(PolytopeFaces(Simplex(4)), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 280])' legend-at="none" />
<notatio-show value='Show(PolytopeFaces(CrossPolytope(3)), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 280])' legend-at="none" />
</Story>

<Story
  title="The hypercube">
<template #description>
The dual reading of the cross-polytope's signed subsets: a face now fixes some
axes to ±1 and leaves the rest free, so dim = <em>n</em> − |fixed axes| and
containment runs the other way. Order 3 is an ordinary cube — 8 vertices, 12
edges, 6 square facets.
</template>
<notatio-show value='Show(PolytopeFaces(Hypercube(3)), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 280])' legend-at="none" />
</Story>

## Click a facet: its closure and its star

Clicking **replaces** the selection and shift-clicking extends it, as anywhere else a list can
be selected from; the click that ends a drag is not a selection. The rules read the pick through
a relation: `FaceOf(Selected)` is the faces the picked face contains (its closure, itself
included) and `Cofaces(Selected)` the faces that contain it (its star). The camera is `Show`'s,
in Wolfram's words: `ViewPoint` says where the viewer is, `ViewAngle` gives a lens (without it
the projection is parallel) and `SphericalRegion -> True` fits the circumscribed sphere so the
figure keeps its size as it turns.

<Story
  title="Closure and star of a facet">
<template #description>
Pick a hexagon on the left: gold is the face, orange everything it is made of — six vertices
and six edges. Pick a vertex on the right: orange is everything that contains it, its edges,
its three faces and the body. The tooltip strip below each lists the pick's vertices and the
faces incident to it.
</template>
<notatio-show value='Show(PolytopeFaces(Permutahedron(4), ColorRules -> [Selected -> Opacity(0.7, Gold), FaceOf(Selected) -> Orange, Dimension2 -> Opacity(0.1, Gray), Not(Interior) -> Opacity(0.55, Gray)]), Selection -> [], ViewPoint -> [1.3, -2.4, 2], ViewAngle -> 40, ImageSize -> [Automatic, 320])' legend-at="none" />
<notatio-show value='Show(PolytopeFaces(Permutahedron(4), ColorRules -> [Selected -> White, Cofaces(Selected) -> Orange, Dimension2 -> Opacity(0.1, Gray), Not(Interior) -> Opacity(0.55, Gray)]), Selection -> [Tuple(0, 0)], ViewPoint -> [1.3, -2.4, 2], ViewAngle -> 40, ImageSize -> [Automatic, 320])' legend-at="none" />
</Story>

## Several polytopes in one frame

Polytopes in one `Show` share a frame and a camera, as `Graphics3D` overlays do; each is scaled
to the same circumscribed sphere, and its faces are numbered on after the earlier ones in each
dimension. A relation never crosses from one polytope to another.

<Story
  title="A permutahedron and an associahedron">
<template #description>
Both at order 4, one camera. Orbit the pair.
</template>
<notatio-show value='Show(PolytopeFaces(Permutahedron(4)), PolytopeFaces(Associahedron(4)), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 320])' legend-at="none" />
</Story>

## Labels

Wolfram's `MeshCellLabel` is the model: labels are specified per **cell dimension**, not per
cell, so "number the vertices" and "name the facets" are the same option with a different key.
`MeshCellLabel -> [which -> form, …]` captions each face by the first rule it matches. `which`
is `Selected`, `All`, a dimension or a list of them; `form` is `"Data"` (the carrier's element),
`"Name"` (a set composition as `{ {1, 2}, {3} }`), `"Index"`, `"Dimension"` or `"Vertices"`.

The default is `[Selected -> "Data"]`, because a picture with 45 labels on it is not a picture —
the label anyone wants is the one for the face they just clicked.

<Story
  title="Naming what you click">
<template #description>
The default. Click any mark and it says what it is: a set composition for the
permutahedron, so <code>1,1,2,2</code> is the square where {1,2} precedes {3,4}.
</template>
<notatio-show value='Show(PolytopeFaces(Permutahedron(4)), Selection -> [Tuple(2, 2)], SphericalRegion -> True, ImageSize -> [Automatic, 320])' legend-at="none" />
</Story>

<Story
  title="A stratum at a time">
<template #description>
<code>0 -> "Index"</code> names one stratum — here the associahedron's 14
triangulations, numbered rather than spelled, since a dissection's data is a long
word. <code>All -> "Data"</code> is only readable on a small figure.
</template>
<notatio-show value='Show(PolytopeFaces(Associahedron(4), MeshCellLabel -> [0 -> "Index"]), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 280])' legend-at="none" />
<notatio-show value='Show(PolytopeFaces(Permutahedron(3), MeshCellLabel -> [All -> "Data"]), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 280])' legend-at="none" />
</Story>

<Story
  title="Counting instead of naming">
<template #description>
<code>2 -> "Vertices"</code> writes how many vertices each 2-face has — and
that is the truncated octahedron reading itself out: six 4s and eight 6s.
</template>
<notatio-show value='Show(PolytopeFaces(Permutahedron(4), MeshCellLabel -> [2 -> "Vertices"]), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 320])' legend-at="none" />
</Story>

## One stratum at a time

Rules do what an emphasis option would: `Edge` and `Dimension1` name the 1-faces, and everything
else drops back.

<Story
  title="The 1-skeleton">
<template #description>
The edges at full strength, the rest a quarter of it.
</template>
<notatio-show value='Show(PolytopeFaces(Permutahedron(4), ColorRules -> [Selected -> Gold, Edge -> "#c4c4d0", True -> Opacity(0.12, Gray)]), Selection -> [], SphericalRegion -> True, ImageSize -> [Automatic, 320])' legend-at="none" />
</Story>

## Aiming the camera

`ViewPoint` (a direction and a distance in radii of the figure, or `Front`, `Above`, …),
`ViewVertical`, `ViewAngle`, `ViewCenter` and `Magnification` aim it; a 2-D frame ignores them.
To settle on a face, look at its middle from the way it faces.

<Story
  title="Settling on a hexagon">
<template #description>
The chosen hexagon is looked at head on: <code>ViewCenter</code> is its middle and
<code>ViewPoint</code> its outward normal.
</template>
<notatio-show value='Show(PolytopeFaces(Permutahedron(4)), Selection -> [Tuple(2, 0)], ViewCenter -> [0.6, -0.467, -0.149], ViewPoint -> [2.324, -1.807, -0.577], SphericalRegion -> True, ImageSize -> [Automatic, 320])' legend-at="none" />
</Story>

## Reference

An address is `(k, index)`, with vertices at `k = 0`.

| Kind          | Names                                                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Properties    | `Vertex`, `Edge`, `Ridge` (_k_ = _d_ − 2), `Facet` (_k_ = _d_ − 1), `Interior` (_k_ ≥ 2), `Top` (the polytope), `Dimension2` … |
| Values        | `Dimension`, `VertexCount`, `Valence` (the faces that contain it), `Index`, `Depth` (the camera's: 0 nearest, 1 farthest)      |
| Relations     | `FaceOf`, `HasFace` / `Cofaces`, `Incident`, `Adjacent` (a cover in the face poset), `SameDimension`                           |
| `Show` camera | `ViewPoint`, `ViewVertical`, `ViewAngle`, `ViewCenter`, `SphericalRegion`, `Magnification`, `ProjectionMatrix`                 |

A polytope that spans more than three dimensions, the 16-cell at order 4 say, is taken to 3-D by
one linear step before the camera sees it. By default it is the polytope's own: the leading three
axes of what its vertices span. `ProjectionMatrix -> [[…], […], […]]` (a 3 × d matrix; Wolfram's
`ViewMatrix` is a 4 × 4 projective transformation of 3-D, so it is not the name) replaces it (a 3-D polytope takes a 3 × 3 one), and a
2-D frame ignores it. The face counts stay right under any map, but distinct
faces can land on top of each other; face identity is what keeps them apart.

`ColorRules -> [Dimension2 -> ColorData("Dusk", Depth)]` shades faces by their distance from the
viewer.
