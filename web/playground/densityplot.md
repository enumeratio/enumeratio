# Density Plot

A bivariate function as a heatmap (Wolfram's `DensityPlot`), rendered by
`<notatio-densityplot>`. The expression is sampled on an `n`×`n` grid — the
same sampling `<notatio-contourplot>` uses — and each sample is shaded on a
sequential ramp running from a cool low end to the theme's accent. Cells
overlap by a hairline so no seams show between them; a non-finite sample
leaves its cell unpainted.

Where a contour plot shows _where_ the level sets are, a density plot shows
_how much_ there is everywhere — the two pair naturally over the same field.

## Function densities

<Story
  title="A trig field">
<notatio-densityplot expr="Sin(x) * Cos(y)" xrange="-3.14,3.14" yrange="-3.14,3.14" />
</Story>

<Story
  title="A saddle, with a colour bar">
<template #description>
<code>legend</code> adds a colour bar labelled with the sampled extremes.
</template>
<notatio-densityplot expr="x^2 - y^2" xrange="-3,3" yrange="-3,3" legend label="x² − y²" />
</Story>

<Story
  title="Interference">
<template #description>
<code>n</code> raises the sampling resolution — the ramp is quantised by the
cell grid, so a finer grid reads as a smoother image.
</template>
<notatio-densityplot expr="Sin(x * y)" xrange="-4,4" yrange="-4,4" n="80" legend />
</Story>

<Story
  title="A pinned colour scale">
<template #description>
<code>zrange</code> pins the colour scale instead of using the sampled min and
max, so several plots can be compared on one scale.
</template>
<notatio-densityplot expr="x^2 + y^2" xrange="-3,3" yrange="-3,3" zrange="0,30" legend x-label="x" y-label="y" />
</Story>

## List densities

`data` (a JSON 2-D array) shades a pre-sampled grid directly — no expression
evaluation (Wolfram's `ListDensityPlot`). Row 0 is the smallest y, so it sits
at the bottom of the frame.

<Story
  title="A pre-sampled grid">
<notatio-densityplot data="[[0,1,2,3],[1,2,3,4],[2,3,4,5],[3,4,5,6]]" legend />
</Story>

## Roadmap

- Bilinear interpolation between samples, for a genuinely continuous ramp.
- A diverging ramp for signed fields, keyed on zero.
- Contour lines overlaid on the density, as `ContourPlot` and `DensityPlot`
  combine in Wolfram.
