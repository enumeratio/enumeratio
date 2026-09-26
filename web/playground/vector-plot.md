# Vector & Stream Plot

Planar vector fields, rendered by `<notatio-vector-plot>`. The two components
`u(x, y)` and `v(x, y)` are given in Epsil (or both at once via `field`), each
compiled to a native function and sampled on an `n`×`n` grid of cell centres.

Two modes share the element:

- **`type="vector"`** (the default) — Wolfram's `VectorPlot`: one arrow per
  sample, its length and colour scaling with |F|. Arrows are capped at 90% of
  a cell, so neighbours never collide.
- **`type="stream"`** — Wolfram's `StreamPlot`: streamlines traced from the
  same grid by fixed-step **RK4 on the normalised field**, so the step is arc
  length and a fast region doesn't outrun a slow one. Integration runs both
  ways from each seed and stops at the frame, at a singularity, or at a
  stagnation point. No random seeding — the same field always draws the same
  picture.

## Vector fields

<Story
  title="Rigid rotation">
<template #description>
F = (−y, x): the arrows circulate, and their length grows with the distance
from the origin.
</template>
<notatio-vector-plot u="-y" v="x" xrange="-2,2" yrange="-2,2" />
</Story>

<Story
  title="A saddle">
<template #description>
<code>field</code> gives both components at once — a comma-separated pair,
optionally wrapped in <code>\{…\}</code>.
</template>
<notatio-vector-plot field="x, -y" xrange="-2,2" yrange="-2,2" label="(x, −y)" />
</Story>

<Story
  title="A trigonometric field">
<template #description>
<code>n</code> sets the arrow grid's resolution.
</template>
<notatio-vector-plot u="Sin(y)" v="Cos(x)" xrange="-3.14,3.14" yrange="-3.14,3.14" n="16" />
</Story>

## Streamlines

<Story
  title="Rotation, as streamlines">
<template #description>
The circular orbits of F = (−y, x). Each line carries one mid-line arrowhead
showing the flow direction.
</template>
<notatio-vector-plot type="stream" u="-y" v="x" xrange="-2,2" yrange="-2,2" />
</Story>

<Story
  title="A dipole-like flow">
<template #description>
<code>steps</code> caps the RK4 steps taken in each direction from a seed —
longer lines at the cost of more integration.
</template>
<notatio-vector-plot type="stream" u="x^2 - y^2" v="2 * x * y" xrange="-2,2" yrange="-2,2" n="11" steps="80" />
</Story>

<Story
  title="Shear flow">
<notatio-vector-plot type="stream" u="y" v="Sin(x)" xrange="-3.14,3.14" yrange="-2,2" n="10" x-label="x" y-label="y" />
</Story>

## Roadmap

- Per-streamline arrowheads at a fixed arc-length spacing, not just mid-line.
- Seed thinning, so streamlines don't crowd where the field converges.
- `Manipulate`-style parameter sliders (`params`), matching `Plot`/`Plot3D`.
