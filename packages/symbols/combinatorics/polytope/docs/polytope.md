# Polytope

A polytope's **face poset**, drawn and clickable, by `<notatio-polytope>`.

The thing worth knowing about this picture is that every mark on it _is_ a
face. A polygon is a 2-face, a line a 1-face, a dot a 0-face, and each carries
its own face data in `data-face` — so clicking recovers which face was hit
without consulting geometry, and two faces that land on the same pixels stay
distinguishable. Selection follows face identity, never screen position.

Nothing here is drawn geometrically. A face's polygon is the set of vertices
incident to it and an edge is a 1-face with its two, both read straight off the
containment relation. The only geometric step is ordering a face's vertices into
a ring, by angle about its own exact barycentre — and that needs no hull
algorithm, because every face of a polytope is convex.

| `which`          | Faces are                     | Order _n_ is                 |
| ---------------- | ----------------------------- | ---------------------------- |
| `permutahedron`  | set compositions of {1.._n_}  | a truncated octahedron at 4  |
| `simplex`        | nonempty subsets of {1.._n_}  | a tetrahedron at 4           |
| `cross-polytope` | signed subsets                | an octahedron at 3           |
| `hypercube`      | signed subsets, dual reading  | a cube at 3                  |
| `associahedron`  | dissections of an (_n_+2)-gon | 3 squares + 6 pentagons at 4 |

## The five

<Story
  title="The permutahedron">
<template #description>
Faces are set <em>compositions</em>, not set partitions: block order is kept, so
the counts are the Fubini numbers and the 24 vertices are the 24 orderings. The
6 squares and 8 hexagons fall out of vertex incidence — nothing tells the
renderer this is a truncated octahedron.
</template>
<notatio-polytope which="permutahedron" n="4" />
</Story>

<Story
  title="The associahedron">
<template #description>
The ways to bracket a product. Vertices are the 14 triangulations of a hexagon,
placed by Loday's coordinates; the 9 facets come out as three squares and six
pentagons, which is the check that those coordinates are right.
</template>
<notatio-polytope which="associahedron" n="4" />
</Story>

<Story
  title="The simplex and the cross-polytope">
<template #description>
The Boolean lattice and the signed subsets — the two simplest face posets, and
so the sharpest check on the machinery. The cross-polytope is also the one that
does <em>not</em> lie in a hyperplane, which is why the projection reads a
polytope's span off its vertices rather than assuming one.
</template>
<notatio-polytope which="simplex" n="4" />
<notatio-polytope which="cross-polytope" n="3" />
</Story>

<Story
  title="The hypercube">
<template #description>
The dual reading of the cross-polytope's signed subsets: a face now fixes some
axes to ±1 and leaves the rest free, so dim = <em>n</em> − |fixed axes| and
containment runs the other way. Order 3 is an ordinary cube — 8 vertices, 12
edges, 6 square facets.
</template>
<notatio-polytope which="hypercube" n="3" />
</Story>

## Selecting a face

Click any mark. Clicking **replaces** the selection and **shift-clicking extends**
it, as anywhere else a list can be selected from. `selected` is written back as
the face data, joined with `;`, and a `select` event carries the face, its
dimension and the new selection.

The click that ends a drag is not a selection — rotating the figure and landing
the pointer on whatever came under it is nobody's intent, so a pointer that
travelled more than a few pixels is read as a turn rather than a click.

<Story
  title="Click to select">
<template #description>
Click a polygon, line or dot to toggle it. The selection is the attribute, so it
can be set from markup too — here one square of the truncated octahedron.
</template>
<notatio-polytope which="permutahedron" n="4" selected="1,1,2,2" />
</Story>

## Labels

Wolfram's `MeshCellLabel` is the model: labels are specified per **cell
dimension**, not per cell, so "number the vertices" and "name the facets" are the
same option with a different key. Two attributes carry it — `labels` says which
faces speak, `label-form` says what they say.

`labels` defaults to `selected`, because a picture with 45 labels on it is not a
picture — the label anyone wants is the one for the face they just clicked.

<Story
  title="Naming what you click">
<template #description>
The default. Click any mark and it says what it is: a set composition for the
permutahedron, so <code>1,1,2,2</code> is the square where {1,2} precedes {3,4}.
</template>
<notatio-polytope which="permutahedron" n="4" />
</Story>

<Story
  title="A stratum at a time">
<template #description>
<code>labels="0"</code> names one stratum — here the associahedron's 14
triangulations, numbered rather than spelled, since a dissection's data is a long
word. <code>labels="all"</code> is only readable on a small figure.
</template>
<notatio-polytope which="associahedron" n="4" labels="0" label-form="index" />
<notatio-polytope which="permutahedron" n="3" labels="all" />
</Story>

<Story
  title="Counting instead of naming">
<template #description>
<code>label-form="vertices"</code> writes how many vertices each facet has — and
that is the truncated octahedron reading itself out: six 4s and eight 6s.
</template>
<notatio-polytope which="permutahedron" n="4" labels="2" label-form="vertices" />
</Story>

<Story
  title="One stratum at a time">
<template #description>
<code>dimension</code> emphasises one stratum and dims the rest — the 1-skeleton
here.
</template>
<notatio-polytope which="permutahedron" n="4" dimension="1" />
</Story>

## Recentre and reorient

The two motions that make a face poset explorable rather than merely drawn:
`recentre` translates the selection to the middle, `reorient` turns it to look
at the viewer.

A face's normal is computed without needing its vertices in any order — take the
face's own tangent space and strip it out of the radial direction. That falls
out correctly at every dimension: a vertex has no tangent space so its normal is
radial, an edge loses only its own direction, and a 2-face is left with the true
plane normal. The body has no normal at all, and says so rather than inventing
one.

<Story
  title="Settling on a hexagon">
<template #description>
The chosen hexagon is brought to the middle and turned flat towards the viewer.
The turn is the <em>minimal</em> rotation that does it, so the figure keeps its
bearings instead of tumbling.
</template>
<notatio-polytope which="permutahedron" n="4" selected="1,1,1,2" recentre reorient />
</Story>

<Story
  title="A pentagon of the associahedron, face on">
<template #description>
The same two motions on a polytope that is not vertex-transitive — the facets
sit at different distances from the centre, and settling on one is how you get a
look at it.
</template>
<notatio-polytope which="associahedron" n="4" selected="0,0,1,0,0,0,0,0,0" recentre reorient />
</Story>

## Attributes

| Attribute                        | Default              | What it does                                     |
| -------------------------------- | -------------------- | ------------------------------------------------ |
| `which`                          | `permutahedron`      | which polytope                                   |
| `n`                              | `4`                  | the order                                        |
| `selected`                       | —                    | faces to highlight, as face data joined with `;` |
| `dimension`                      | —                    | emphasise this stratum, dim the rest             |
| `recentre`                       | off                  | bring the selection to the middle                |
| `reorient`                       | off                  | turn the selection towards the viewer            |
| `shade`                          | on                   | shade the 2-faces                                |
| `azimuth` / `elevation` / `zoom` | `30` / `25` / `1`    | the camera, shared with the other 3-D figures    |
| `label`                          | the polytope's title | the figure's caption                             |

A polytope of order _n_ that spans more than three dimensions — the 16-cell at
order 4, say — is shown by its leading three scene axes. That is a projection,
and the picture is honest about being one: the face counts stay right, but
distinct faces can land on top of each other. Face identity is what keeps them
apart.
