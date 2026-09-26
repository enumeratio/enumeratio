# Plot

A 2-D function plot representation (`Plot`), rendered by `<notatio-plot>`. The
element samples a univariate expression across a domain — substituting the free
variable and taking the numeric value — and draws the curve as pure SVG. `value`
is an expression written in **Epsil**; LaTeX goes in a `$…$` island.
Poles (non-finite samples) break the line rather
than drawing a spurious jump. Axes default on (`axes="false"` to hide, à la
Wolfram's `Axes`); either axis takes a scaling function via `x-scale` / `y-scale`
(`linear`, `log`, `log10`, `log2`, `sqrt` — Wolfram's `ScalingFunctions`). A list
of expressions overlays several series; `parametric` traces `(x(t), y(t))`;
`mode="points"` draws dots; a list of numeric pairs plots as data. Hover any plot
to read off the nearest sample. Function curves are sampled adaptively (à la
`Plot`'s refinement) — dense where the curve bends, sparse where it's straight
(`adaptive="false"` for a plain uniform grid). Chrome options mirror `Plot`'s:
`grid` (`GridLines`), `fill` (`Filling`), `legend` (`PlotLegends`),
`plot-range="lo,hi"` (`PlotRange`), `x-label` / `y-label` (`AxesLabel`), `label`
(`PlotLabel`), and `color-by="x|y"` to recolour the curve along a ramp
(`ColorFunction`). `params` adds interactive `Manipulate` sliders — see
[Manipulate](#manipulate) below. Surfaces live on the separate
[Plot 3D](/playground/plot-3d) page.

## Curves

<Story
  title="Sine over one period">
<notatio-plot value="Sin(x)" domain="-6.283,6.283" />
</Story>

<Story
  title="A cubic">
<template #description>The free variable is inferred when <code>var</code> is omitted.</template>
<notatio-plot value="x^3 - 3x" domain="-3,3" />
</Story>

<Story
  title="A pole (1/x)">
<template #description>
The sample straddling <code>0</code> is non-finite, so the curve splits into
two segments instead of streaking across the asymptote.
</template>
<notatio-plot value="1 / x" domain="-3,3" />
</Story>

<Story
  title="A LaTeX island + custom domain">
<template #description>A <code>$…$</code> island is parsed as LaTeX, implicit multiplication and all; <code>samples</code> controls resolution.</template>
<notatio-plot value="$x\sin(x)$" domain="-12.566,12.566" samples="240" />
</Story>

<Story
  title="Log y-scale (exponential ⇒ straight line)">
<template #description>
A <code>log</code> y-axis renders <code>eˣ</code> as a straight line; the range
labels still read the raw values. Non-positive samples fall outside the log
domain and gap out.
</template>
<notatio-plot value="Exp(x)" domain="0,5" y-scale="log" />
</Story>

<Story
  title="Several series">
<template #description>
A set (or comma list) of expressions overlays one curve per entry, each in
its own colour. Hover to read every series at the pointer's <code>x</code>.
</template>
<notatio-plot value="{Sin(x), Cos(x), Sin(x) * Cos(x)}" domain="-6.283,6.283" />
</Story>

<Story
  title="Parametric curve (a Lissajous figure)">
<template #description>
<code>parametric</code> reads the pair as <code>(x(t), y(t))</code> and traces it
over <code>domain</code> in <code>var</code>.
</template>
<notatio-plot value="(Sin(3t), Sin(4t))" var="t" domain="0,6.283" parametric samples="400" />
</Story>

<Story
  title="Points mode">
<notatio-plot value="Sin(x)" domain="0,6.283" mode="points" samples="40" />
</Story>

<Story
  title="Data points (ListPlot)">
<template #description>
A list of numeric pairs is data, drawn as dots; add <code>mode="line"</code> to
join them.
</template>
<notatio-plot value="{(1,1),(2,4),(3,9),(4,16),(5,25)}" />
</Story>

## Chrome &amp; colour

<Story
  title="Grid, fill, legend, labels">
<template #description>
The <code>Plot</code>-style chrome, all opt-in: light gridlines, a filled area
to the zero axis, a legend keyed to the series, an axis label, a forced
<code>plot-range</code>, and a <code>label</code> (<code>PlotLabel</code>) title.
</template>
<notatio-plot value="{Sin(x), Cos(x)}" domain="-6.283,6.283" grid fill legend x-label="x" plot-range="-1.2,1.2" label="sin &amp; cos" />
</Story>

<Story
  title="Colour by value (ColorFunction)">
<template #description>
<code>color-by="y"</code> ramps the stroke from blue (low) to accent (high) by
height; <code>"x"</code> ramps left-to-right.
</template>
<notatio-plot value="Sin(x)" domain="-6.283,6.283" color-by="y" />
</Story>

<Story
  title="Axes off (bare curve)">
<notatio-plot value="Sin(x)" domain="-6.283,6.283" axes="false" />
</Story>

## Manipulate

`params` binds `Manipulate`'s own control tuples into the expression and renders
a slider (or setter) per parameter, re-sampling live as it moves. Each control
fills the matching **named wildcard** in `value` — control `a` fills `_a`,
compute-engine's own slot notation. The tuple forms are Wolfram's:
`{a, min, max}`, `{a, min, max, step}`, `{ {a, init}, min, max }`, and a discrete
`{k, {1, 2, 3}}`; separate several with `;`. Every slider carries a **play button
(▶)** that animates it on a loop (⏸ to stop).

<Story
  title="Two parameters">
<template #description>
<code>a</code> scales the frequency, <code>b</code> shifts the phase — each free
parameter becomes its own slider and fills its wildcard.
</template>
<notatio-plot value="Sin(_a * x + _b)" domain="-6.283,6.283" params="{a, 1, 5}; {b, 0, 6.283}" />
</Story>

<Story
  title="Amplitude · frequency · phase">
<template #description>
Three sliders with explicit initial values — the classic sinusoid knobs.
</template>
<notatio-plot value="_A * Sin(_w * x + _p)" domain="-6.283,6.283" params="&#123;{A, 1}, 0, 2}; &#123;{w, 2}, 0.5, 6}; {p, 0, 6.283}" plot-range="-2,2" />
</Story>

<Story
  title="Animate the phase (press ▶)">
<template #description>
Press ▶ on <code>t</code> to watch the wave travel; ⏸ to stop.
</template>
<notatio-plot value="Sin(x - _t)" domain="-6.283,6.283" params="{t, 0, 6.283}" />
</Story>

<Story
  title="A movable, resizable bump">
<template #description>
<code>c</code> slides a Gaussian bump left/right, <code>s</code> widens it.
</template>
<notatio-plot value="Exp(-(x - _c)^2 / _s)" domain="-6.283,6.283" params="&#123;{c, 0}, -5, 5}; &#123;{s, 1}, 0.2, 4}" plot-range="0,1.1" fill />
</Story>

<Story
  title="A stepped, integer harmonic">
<template #description>
A step of <code>1</code> makes <code>n</code> an integer knob — sweep the
harmonics with ▶.
</template>
<notatio-plot value="Sin(_n * x)" domain="-6.283,6.283" params="&#123;{n, 1}, 1, 8, 1}" grid />
</Story>

<Story
  title="A discrete choice">
<template #description>A brace list becomes a setter over discrete values.</template>
<notatio-plot value="Sin(_k * x)" domain="-6.283,6.283" params="{k, {1, 2, 3, 5}}" grid />
</Story>

## Roadmap

- More `Manipulate` control kinds (checkbox, 2-D locator), and a shared play-all.
- Image export — a REPL requests a plot and gets back a link to a rendered file.
- Surfaces have their own page: [Plot 3D](/playground/plot-3d).
