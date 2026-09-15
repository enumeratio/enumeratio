# Polar Plot

A curve r(θ) on a polar grid (Wolfram's `PolarPlot`), rendered by
`<notatio-polarplot>`. The expression is compiled to a native function and
sampled at `n` angles across `trange`; a pole (a non-finite radius) breaks the
curve into subpaths rather than joining two branches with a spurious chord. A
negative radius points the opposite way, as in Wolfram.

The plot area is square and centred, so angles are never sheared: a circle
stays a circle regardless of the element's width.

## Function curves

<Story
  title="A cardioid">
<template #description>
r = 1 + cos θ over the default full turn.
</template>
<notatio-polarplot expr="1 + Cos(theta)" />
</Story>

<Story
  title="A four-petal rose">
<template #description>
<code>filled</code> shades the enclosed region under the stroked curve. The
petals that fall on a negative radius sweep out the opposite quadrants.
</template>
<notatio-polarplot expr="Cos(2 * theta)" filled label="r = cos 2θ" />
</Story>

<Story
  title="An Archimedean spiral">
<template #description>
<code>trange</code> takes θ well past a single turn; <code>n</code> raises the
angular sampling to keep the outer windings smooth.
</template>
<notatio-polarplot expr="theta" trange="0,18.85" n="600" />
</Story>

<Story
  title="A limaçon, without the grid">
<notatio-polarplot expr="1 + 2 * Cos(theta)" axes="false" />
</Story>

## List polar plots

`data` plots explicit points (Wolfram's `ListPolarPlot`) — either `[θ, r]`
pairs, or bare radii spread evenly over `trange`.

<Story
  title="Explicit (θ, r) pairs">
<template #description>
<code>closed</code> joins the last point back to the first.
</template>
<notatio-polarplot data="[[0,1],[1.57,2],[3.14,1],[4.71,2]]" closed />
</Story>

<Story
  title="Bare radii over a turn">
<notatio-polarplot data="[1,1.5,2,1.5,1,1.5,2,1.5,1]" />
</Story>

## Roadmap

- Angular tick labels (0, π/6, …) on the spokes.
- Several curves on one grid, à la `Plot`'s multi-expression form.
- `Manipulate`-style parameter sliders (`params`), matching `Plot`/`Plot3D`.
