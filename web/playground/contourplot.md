# Contour Plot

The contour lines of a bivariate function (Wolfram's `ContourPlot`), rendered
by `<notatio-contourplot>`. The element samples an `n`×`n` grid of the
expression over `xrange`/`yrange` — substituting the two free variables — and
extracts iso-lines via **marching squares** at ~8 evenly spaced levels by
default, or an explicit set via `levels`. `filled` shades the bands between
levels with a sequential ramp instead of drawing lines. A pre-sampled grid can
be plotted directly with `data` (`ListContourPlot`), skipping expression
evaluation entirely. The whole pipeline — grid sampling, marching squares, SVG
— is a pure, deterministic function of its inputs.

## Function contours

<Story
  title="A saddle">
<template #description>
The classic hyperbolic-paraboloid saddle — contours open along both diagonals.
</template>
<notatio-contourplot expr="x^2 - y^2" xrange="-3,3" yrange="-3,3" />
</Story>

<Story
  title="A trig field">
<notatio-contourplot expr="Sin(x) + Cos(y)" xrange="-6.283,6.283" yrange="-6.283,6.283" />
</Story>

<Story
  title="Concentric circles (radial field)">
<template #description>
<code>levels</code> as a JSON array picks explicit contour values instead of
the automatic ~8 evenly spaced ones.
</template>
<notatio-contourplot expr="x^2 + y^2" xrange="-3,3" yrange="-3,3" levels="[1,2,4,6,8]" />
</Story>

<Story
  title="A level count">
<template #description>
A bare number for <code>levels</code> sets the auto level count; <code>n</code>
controls the sampling grid's resolution.
</template>
<notatio-contourplot expr="Sin(x * y)" xrange="-3,3" yrange="-3,3" levels="12" n="60" label="sin(xy)" />
</Story>

## Filled bands

<Story
  title="Filled saddle">
<template #description>
<code>filled</code> shades the bands between levels with a sequential ramp
instead of drawing lines.
</template>
<notatio-contourplot expr="x^2 - y^2" xrange="-3,3" yrange="-3,3" filled />
</Story>

<Story
  title="Filled radial field with labels">
<notatio-contourplot expr="x^2 + y^2" xrange="-3,3" yrange="-3,3" filled x-label="x" y-label="y" label="x² + y²" />
</Story>

## List contours

`data` (a JSON 2-D array) contours a pre-sampled grid directly — no expression
evaluation, so it's the natural fit for numerical data (Wolfram's
`ListContourPlot`).

<Story
  title="A pre-sampled grid">
<notatio-contourplot data="[[0,1,2,3],[1,2,3,4],[2,3,4,5],[3,4,5,6]]" />
</Story>

## Roadmap

- Hover readout of the nearest sample's `(x, y, z)`, à la `Plot`/`Plot3D`.
- `Manipulate`-style parameter sliders (`params`), matching `Plot`/`Plot3D`.
- Surfaces live on their own page: [Plot 3D](/playground/plot3d).
