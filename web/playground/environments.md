# Environments

An environment is a record of what the place a rendering lands can do — whether an
engine is there when the reader looks, what it can draw, how it can be touched. Where an
expression asks for more than that, `reduce(expr, env)` rewrites the _expression_ before
anything renders: a control with nothing to drive it is **pinned** (its variable takes its
start, and the declaration becomes a caption) or **sampled** (the body at a few values —
small multiples, the print-native reading of a slider); a `Dynamic` is read once; a GPU
plot on paper is rasterized; a `Row` in a narrow column stacks. The web and a terminal
have an engine and a way in, so there the expression is left alone. See
`design/rendering-environments.md`.

Every card below renders the reduced expression with the ordinary components, so a
print of this page is the same reduction done for real: print it (or open the print
preview) and the sliders become grids.

<Story
  title="A Manipulate, sampled or pinned">
<template #description>
On the web the slider is live. For <code>print</code> the first control is sampled on
its step grid (six values, three to a row) and the rest are pinned into a caption; a
<code>pipe</code> pins everything. <code>Static -> "Pin"</code>, <code>"Sample"</code>
or a count on the expression overrides the environment's policy.
</template>
<EnvironmentPreview expr='Manipulate(Plot(Sin(a * x) + b, (x, 0, 10)), (a, 1, 5), ((b, 1), 0, 3, 0.5))' />
</Story>

<Story
  title="Controls in a layout">
<template #description>
A control inside a <code>Row</code> or <code>Grid</code> is taken out of it, and the
readouts that read its variable are evaluated at the pinned value. A row with one thing
left is that thing.
</template>
<EnvironmentPreview expr='Row([Slider((k, 2), (0, 5)), "squared is", Dynamic(k^2)])' env="pipe" />
</Story>

<Story
  title="A choice, enumerated">
<template #description>
A toggler's entries are the sample: one cell per choice, labelled.
</template>
<EnvironmentPreview expr='Row([Toggler((size, "several"), ["a few", "several", "many"]), size])' />
</Story>

<Story
  title="An Animator becomes a filmstrip">
<template #description>
Frames in a row, on the step grid; a print of a sweep.
</template>
<EnvironmentPreview expr='Row([Animator(t, (0, 1, 0.25)), Sin(Pi * t)])' />
</Story>

<Story
  title="A narrow column">
<template #description>
<code>compact</code> keeps the engine and the controls — a phone can drive them — and
only stacks the layout.
</template>
<EnvironmentPreview expr='Row([Plot(Sin(k * x), (x, 0, 10)), Slider((k, 1), (1, 5))])' env="compact" />
</Story>
