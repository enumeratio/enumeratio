# Glyphs

Pictorial representations of combinatorial elements, rendered by
`<notatio-figure>`. Each is requested explicitly by `kind` + a MathJSON integer
`value` (the shape a collection head yields at a given index). Colours theme from
`--notatio-accent` / `--notatio-border` / `--notatio-fg`.

## The vocabulary

<GlyphGallery />

## Explicit request + options

<Story
  title="Permutation matrix glyph">
<template #description>
One filled dot per row <code>i</code> at column <code>image[i]</code> — the
one-line word <code>3&nbsp;1&nbsp;2</code>. A pictorial glyph (à la
<code>MatrixPlot</code>); the true bracketed matrix is <code>MatrixForm</code>,
a TeX representation still to come.
</template>
<notatio-figure kind="permutation" value="[3,1,2]" />
</Story>

<Story
  title="Subset with an explicit ground-set size">
<template #description>
<code>n</code> sets how many cells to draw; members are filled. Without it,
<code>n</code> defaults to the largest member.
</template>
<notatio-figure kind="subset" value="[1,3]" n="6" />
</Story>

<Story
  title="Young tableau (from a partition shape)">
<template #description>
The Ferrers shape of the partition, its cells numbered <code>1…n</code> in
reading order — the superstandard filling, always a valid standard Young
tableau (rows increase rightward, columns downward).
</template>
<notatio-figure kind="tableau" value="[3,2,1]" />
<notatio-figure kind="tableau" value="[4,2]" />
<notatio-figure kind="tableau" value="[2,2,2]" />
</Story>

<Story
  title="Set partition (restricted-growth string)">
<template #description>
<code>value[i]</code> is the block of element <code>i+1</code> (a restricted-growth
string). Each block draws as a pill of its elements —
<code>[0,0,1,0,2]</code> is <code>{1,2,4} {3} {5}</code>.
</template>
<notatio-figure kind="set-partition" value="[0,0,1,0,2]" />
</Story>

<Story
  title="Lattice path (east/north step word)">
<template #description>
A monotone staircase of unit steps east (<code>0</code>) and north
(<code>1</code>) across the grid it spans; counts <code>C(a+b, a)</code>.
</template>
<notatio-figure kind="lattice" value="[0,1,1,0,1,0]" />
<notatio-figure kind="lattice" value="[1,0,1,0,0,1]" />
</Story>

<Story
  title="Binary tree (preorder shape word)">
<template #description>
<code>1</code> is an internal node (always two children), <code>0</code> a leaf,
listed in preorder. Tidy layout: leaves take sequential x, each internal node
sits over the mean of its children. The five shapes of size 3 (Catalan again):
</template>
<notatio-figure kind="binary-tree" value="[1,1,0,0,1,0,0]" />
<notatio-figure kind="binary-tree" value="[1,1,1,0,0,0,0]" />
<notatio-figure kind="binary-tree" value="[1,1,0,1,0,0,0]" />
<notatio-figure kind="binary-tree" value="[1,0,1,1,0,0,0]" />
<notatio-figure kind="binary-tree" value="[1,0,1,0,1,0,0]" />
</Story>

<Story
  title="Plane tree (preorder child-count word)">
<template #description>
<code>tree</code> reads each entry as that node's number of children, so any
rooted ordered tree draws: here a root with three children, the middle one a
cherry, the last a chain.
</template>
<notatio-figure kind="tree" value="[3,0,2,0,0,1,0]" />
</Story>

<Story
  title="Raw SVG passthrough">
<template #description>
The generic escape hatch: hand it a ready-made SVG string and it renders it
verbatim (for representations authored elsewhere).
</template>
<notatio-figure svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" role="img" aria-label="star"><polygon points="20,2 25,15 39,15 28,24 32,38 20,30 8,38 12,24 1,15 15,15" fill="var(--notatio-accent,#d97706)"/></svg>' />
</Story>
