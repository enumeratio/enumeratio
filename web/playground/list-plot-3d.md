# List Plot 3D

3-D data, orthographically projected by `<notatio-list-plot-3d>`. Two shapes share
the element:

- **`type="surface"`** (the default) — a height grid `[[…], […]]` drawn as a
  projected quad mesh (Wolfram's `ListPlot3D` / `ListSurfacePlot3D`), shaded by
  height. Scattered `[x, y, z]` triples are binned onto an `n`×`n` grid first.
- **`type="points"`** — `[x, y, z]` triples as a 3-D scatter
  (`ListPointPlot3D`).

The camera is a plain orthographic projection: the data is normalised into the
unit cube, rotated by `azimuth` about the vertical axis, tilted by `elevation`,
and scaled to fit the frame. There is no perspective — depth serves only to
order the drawing back-to-front (the painter's algorithm) and, for points, to
shrink and fade what's far away. The view is fixed by its attributes, so the
figure is a pure function of the markup and renders identically under SSR.

Function surfaces — sampled from an expression, with an interactive
drag-to-rotate view — live on [Plot 3D](/playground/plot-3d).

## Surfaces

<Story
  title="A height grid">
<template #description>
<code>data[j][i]</code> is the height at the <em>i</em>-th x and <em>j</em>-th y
sample; each cell becomes one projected quad, shaded by its mean height.
</template>
<notatio-list-plot-3d data="[[0,1,2,3],[1,3,4,3],[2,4,6,4],[1,2,3,2]]" />
</Story>

<Story
  title="A ridge, from a different angle">
<template #description>
<code>azimuth</code> rotates about the vertical axis; <code>elevation</code>
tilts the view above the floor.
</template>
<notatio-list-plot-3d data="[[0,0,0,0,0],[0,1,2,1,0],[0,2,5,2,0],[0,1,2,1,0],[0,0,0,0,0]]" azimuth="55" elevation="35" label="a ridge" />
</Story>

<Story
  title="Wireframe">
<template #description>
<code>wireframe</code> draws the quad outlines unfilled — useful when the mesh
matters more than the shading.
</template>
<notatio-list-plot-3d data="[[0,1,2,3],[1,3,4,3],[2,4,6,4],[1,2,3,2]]" wireframe />
</Story>

<Story
  title="A hole in the surface">
<template #description>
A missing sample (<code>null</code>) is a hole: the four quads that touch it
are skipped, rather than drawing a spike through zero.
</template>
<notatio-list-plot-3d data="[[0,0,0,0,0],[0,1,2,1,0],[0,2,null,2,0],[0,1,2,1,0],[0,0,0,0,0]]" />
</Story>

## Point clouds

<Story
  title="A 3-D scatter">
<template #description>
Markers are drawn back-to-front, shrinking and fading with distance — the only
depth cue an orthographic view has.
</template>
<notatio-list-plot-3d type="points" data="[[0,0,0],[1,0,1],[0,1,1],[1,1,0],[0.5,0.5,2],[0.2,0.8,0.4],[0.8,0.2,1.6]]" />
</Story>

<Story
  title="Without depth cueing">
<template #description>
<code>depth-cue="0"</code> draws every marker at the same size and opacity;
<code>size</code> sets the near-marker radius.
</template>
<notatio-list-plot-3d type="points" data="[[0,0,0],[1,0,1],[0,1,1],[1,1,0],[0.5,0.5,2],[0.2,0.8,0.4],[0.8,0.2,1.6]]" depth-cue="0" size="5" />
</Story>

<Story
  title="Scattered triples, surfaced">
<template #description>
Given triples, the surface form bins them onto an <code>n</code>×<code>n</code>
grid — each cell the mean z of the points that land in it, a cell with no
points a hole — and meshes that.
</template>
<notatio-list-plot-3d data="[[0,0,1],[1,0,2],[2,0,1],[0,1,2],[1,1,4],[2,1,2],[0,2,1],[1,2,2],[2,2,1],[0.4,0.4,1.5],[1.6,1.4,3]]" n="3" />
</Story>

## Roadmap

- Drag-to-rotate and wheel-zoom, as `<notatio-plot-3d>` has.
- Bilinear subdivision, so a coarse grid reads as a smooth surface.
- A hover readout of the nearest sample's `(x, y, z)`.
