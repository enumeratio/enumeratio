# Bar Chart 3D

A matrix of heights as 3-D bars (Wolfram's `BarChart3D`), rendered by
`<notatio-barchart3d>`. `data[j][i]` is the bar in row `j`, column `i`; a flat
list reads as a single row.

Each bar is a box drawn as its top face plus the two side faces that turn
toward the viewer — the back pair is always hidden, so it is never emitted.
Bars are painted back-to-front on the depth of their base centre, and shaded by
height on the same ramp the other 3-D figures use. The projection is the shared
orthographic camera (`azimuth` / `elevation`, no perspective), so the whole
figure is a pure function of its attributes.

## Bars

<Story
  title="A 3×3 matrix">
<notatio-barchart3d data="[[1,2,3],[2,4,3],[3,1,5]]" />
</Story>

<Story
  title="A single row">
<template #description>
A flat list is one row of bars — the 3-D counterpart of a plain
<code>BarChart</code>.
</template>
<notatio-barchart3d data="[3,1,4,1,5,9,2,6]" label="digits of π" />
</Story>

<Story
  title="Labelled categories">
<template #description>
<code>col-labels</code> and <code>row-labels</code> take comma-separated
categories, drawn just outside the near floor edges.
</template>
<notatio-barchart3d data="[[4,2,3],[1,5,2]]" col-labels="a,b,c" row-labels="x,y" />
</Story>

<Story
  title="Tighter packing, steeper view">
<template #description>
<code>gap</code> is the space between neighbouring bars as a fraction of a
cell; at <code>0</code> the bars touch.
</template>
<notatio-barchart3d data="[[1,2,3,4],[2,3,4,5],[3,4,5,6],[4,5,6,7]]" gap="0.05" elevation="45" azimuth="40" />
</Story>

<Story
  title="Negative values">
<template #description>
When the data straddles zero, the zero plane sits inside the cube and negative
bars hang beneath it.
</template>
<notatio-barchart3d data="[[-2,1,3],[2,-1,1]]" />
</Story>

<Story
  title="A pinned height scale">
<template #description>
<code>zrange</code> pins the height scale so several charts can be compared;
<code>axes="false"</code> drops the projected axis box.
</template>
<notatio-barchart3d data="[[1,2],[2,3]]" zrange="0,10" axes="false" />
</Story>

## Roadmap

- Per-row colouring, à la `ChartStyle`, for grouped comparisons.
- Value labels floating above each bar.
- Drag-to-rotate, shared with the other 3-D figures.
