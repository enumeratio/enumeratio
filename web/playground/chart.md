# Chart

Data-driven 2-D charts (Wolfram's [Data Visualization
guide](https://www.wolfram.com/language/elementary-introduction/2nd-ed/34-visualizing-data.html)),
rendered by one element, `<notatio-chart>`. `type` picks the chart kind — or is left
off, and the chart is chosen from the data's shape (the family head `Chart` does the
same; the named heads `Histogram`, `BarChart`, … are the members); `data` is JSON (a value list, a matrix, or a list of series — see each story
below); `labels` (also JSON) and `label` (a title, Wolfram's `PlotLabel`) are
optional. `list` and `listline` (ListPlot / ListLinePlot) reuse the same
sampled-point renderer as [Plot](/playground/plot) — a bare number list reads
as index vs value.

## ListPlot &amp; ListLinePlot

<Story
  title="ListPlot: index vs value">
<template #description>A bare number list plots as index (x) vs value (y).</template>
<notatio-chart type="list" data="[3,1,4,1,5,9,2,6]" />
</Story>

<Story
  title="ListLinePlot: connected">
<notatio-chart type="listline" data="[3,1,4,1,5,9,2,6]" />
</Story>

## BarChart

<Story
  title="Value list with category labels">
<notatio-chart type="bar" data="[12,19,7,15,10]" labels='["Mon","Tue","Wed","Thu","Fri"]' label="Daily commits" />
</Story>

<Story
  title="Negative values dip below the baseline">
<notatio-chart type="bar" data="[3,-2,5,-1,4]" />
</Story>

## Histogram

<Story
  title="Auto bin count (Sturges' rule)">
<template #description>The bin count defaults to Sturges' rule; pass <code>bins</code> to override.</template>
<notatio-chart type="histogram" data="[1,2,2,3,3,3,4,4,4,4,5,5,5,6,6,7]" />
</Story>

<Story
  title="Explicit bin count">
<notatio-chart type="histogram" data="[1,2,2,3,3,3,4,4,4,4,5,5,5,6,6,7]" bins="4" />
</Story>

## PieChart

<Story
  title="Proportions of a value list">
<notatio-chart type="pie" data="[35,25,20,20]" labels='["A","B","C","D"]' />
</Story>

## BoxWhiskerChart

<Story
  title="One box per series">
<template #description>
<code>data</code> is a list of raw value lists; each series is reduced to its
five-number summary (min, Q1, median, Q3, max).
</template>
<notatio-chart type="box" data="[[2,4,4,4,5,5,7,9],[1,2,3,3,3,4,4,10]]" labels='["A","B"]' />
</Story>

## ArrayPlot

<Story
  title="A matrix as a heatmap">
<template #description>Each cell's value maps to a colour ramp from blue (low) to accent (high). Cells are square: the frame's height follows rows/cols, up to a square.</template>
<notatio-chart type="array" data="[[0,1,2,3],[1,2,3,4],[2,3,4,5],[3,4,5,6]]" />
</Story>

<Story
  title="A 0/1 matrix is two-tone">
<template #description>Like Wolfram's white/black: 0 is the background, 1 the foreground, so it follows the theme.</template>
<notatio-chart type="array" data="[[1,0,0,0,0,0,0,0],[0,1,0,0,0,0,0,0],[1,0,1,0,0,0,0,0],[0,0,0,1,0,0,0,0],[1,1,0,0,1,0,0,0],[0,0,0,0,0,1,0,0],[1,0,1,0,0,0,1,0],[0,0,0,0,0,0,0,1]]" />
<notatio-chart type="array" data="[[0,1,0,1,0,1,0,1,0,1,0,1,0,1,0,1]]" />
</Story>

## DiscretePlot

<Story
  title="A stem plot">
<template #description>A vertical stem from the zero baseline to each value, with a dot on top.</template>
<notatio-chart type="discrete" data="[1,-2,3,4,-1,2]" />
</Story>

## Chosen from the data

<Story
  title="No type: the shape decides">
<template #description>A short number list is bars, a long one a histogram, pairs are points, a matrix is an array plot, ragged rows are boxes — <code>chooseChartType</code>, which is also the rule behind the <code>Chart</code> head.</template>
<notatio-chart data="[3,1,4,1,5]" />
<notatio-chart data="[5,3,8,1,9,2,7,4,6,3,5,8,2,9,1,4,7,3,6,5,2,8,4,1,9]" />
<notatio-chart data="[[0,1],[1,3],[2,2],[3,5]]" />
<notatio-chart data="[[1,0,2],[0,3,1],[2,1,0]]" />
</Story>

## Roadmap

- Series overlays for `bar` / `list` (several value lists sharing one frame).
- `ScalingFunctions` / gridlines / legends to match [Plot](/playground/plot)'s chrome options.
- Hover readouts, mirroring Plot's nearest-sample tooltip.
