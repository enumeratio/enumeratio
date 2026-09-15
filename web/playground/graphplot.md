# Graph

Graph and hierarchical layouts (Wolfram's [Data Visualization
guide](https://www.wolfram.com/language/elementary-introduction/2nd-ed/34-visualizing-data.html)),
rendered by one element, `<notatio-graphplot>`. `type` picks the layout; `data` is
JSON (a nested tree, or `{ nodes?, edges }` — see each story below); `label`
is an optional title. Every layout is a pure, deterministic function of its
input — no randomness, so the same data always renders the same picture.

## TreePlot

<Story
  title="A rooted tree, laid out tidily by depth">
<template #description>Leaves take sequential x left-to-right; each internal node sits at the mean x of its children.</template>
<notatio-graphplot type="tree" data='{"label":"root","children":[{"label":"a","children":[{"label":"a1"},{"label":"a2"}]},{"label":"b"}]}' />
</Story>

## GraphPlot

<Story
  title="Undirected graph on a deterministic circular layout">
<template #description>Node order (and so position) comes from first appearance in <code>edges</code> when <code>nodes</code> is omitted.</template>
<notatio-graphplot type="graph" data='{"edges":[["a","b"],["b","c"],["c","d"],["d","a"],["a","c"]]}' />
</Story>

<Story
  title="Directed: arrowheads on each edge">
<notatio-graphplot type="graph" directed data='{"edges":[["a","b"],["b","c"],["c","a"]]}' />
</Story>

## LayeredGraphPlot

<Story
  title="A DAG laid out top-to-bottom by longest-path layer">
<template #description>Layer(v) = 1 + the longest path from any source into v; nodes within a layer keep a deterministic (first-seen) order.</template>
<notatio-graphplot type="layered" data='{"edges":[["a","b"],["a","c"],["b","d"],["c","d"],["d","e"]]}' />
</Story>

## Dendrogram

<Story
  title="A merge tree, brackets drawn at each merge height">
<template #description>Leaves sit along the x axis; each internal node's <code>height</code> sets where its bracket is drawn (inferred as one more than its tallest child when omitted).</template>
<notatio-graphplot type="dendrogram" data='{"height":3,"children":[{"height":1,"children":[{"label":"x"},{"label":"y"}]},{"height":2,"children":[{"label":"z"},{"label":"w"}]}]}' />
</Story>

## Roadmap

- `TreePlot`/`Dendrogram` support only single-parent trees; DAG-shaped
  hierarchies (shared descendants) aren't modeled.
- A spring/force-directed `GraphPlot` variant, still seeded deterministically
  (fixed initial positions, fixed iteration count) rather than the current
  circular layout.
- Edge weights/labels, and a `ClusteringComponents`-style palette per
  connected component.
