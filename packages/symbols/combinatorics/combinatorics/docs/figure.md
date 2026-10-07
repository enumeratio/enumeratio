# Glyphs

Pictorial representations of combinatorial elements, rendered by
`<notatio-figure>`. Each is requested explicitly by `kind` + a MathJSON integer
`value` (the shape a collection head yields at a given index).

A figure is shorthand for a `Show` of a **frame layer**, whose parts are addresses that
rules color and a click picks, so every kind takes `ColorRules`, `BoundaryStyle` and
`Selection` once written as a `Show`:

| kinds                                           | layer           | address                  | properties                                                          | values                                                            | relations to the pick                                      |
| ----------------------------------------------- | --------------- | ------------------------ | ------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------- |
| `permutation`, `set-partition`, `diagram`       | `StrandDiagram` | (slot, level)            | `In`, `Out`, `Through`, `Cap`, `Cup`, `Loop`, `Crossing`            | `Slot`, `Level`, `Block`, `Image`                                 | `SameBlock`, `Crosses`, `Adjacent`                         |
| `partition`, `tableau`, `composition`, `subset` | `CellDiagram`   | (row, column)            | `Filled`, `Corner`, `InFirstRow`, `InFirstColumn`, `Entry`          | `Row`, `Column`, `Content`, `Hook`, `Arm`, `Leg`, `Entry`, `Part` | `SameRow`, `SameColumn`, `SameContent`, `Hook`, `Adjacent` |
| `tree`, `binary-tree`                           | `TreeDiagram`   | (depth, order)           | `Leaf`, `Root`, `Internal`                                          | `Depth`, `Order`, `Children`, `SubtreeSize`                       | `Ancestor`, `Descendant`, `Subtree`, `Sibling`, `Adjacent` |
| `dyck`, `lattice`                               | `PathDiagram`   | (step, height) or (x, y) | `Peak`, `Valley`, `Return`, `Up`, `Down`; `East`, `North`, `Corner` | `Step`, `Height`, `X`, `Area`                                     | `SameHeight`, `SameColumn`, `Adjacent`, `Tunnel`           |

A figure's default look themes from `--notatio-accent` / `--notatio-border` /
`--notatio-fg`; the `svg` attribute still draws any SVG verbatim.

## The vocabulary

<GlyphGallery />

## Explicit request + options

<Story
  title="Permutation strand diagram">
<template #description>
Slot <code>i</code> on the in row is joined to slot <code>image[i]</code> on the out
row — the one-line word <code>3&nbsp;1&nbsp;2</code>. It is a <code>Show</code> of a
<code>StrandDiagram</code>; the true bracketed matrix is <code>MatrixForm</code>,
a TeX representation still to come.
</template>
<notatio-figure kind="permutation" value="[3,1,2]" />
</Story>

<Story
  title="Subset with an explicit ground-set size">
<template #description>
<code>n</code> sets how many cells to draw; members are filled (<code>Filled</code>),
the rest are cells too. Without it, <code>n</code> defaults to the largest member. A
<code>CellDiagram</code> of <code>Subset([1, 3], 6)</code>.
</template>
<notatio-figure kind="subset" value="[1,3]" n="6" />
</Story>

<Story
  title="Young tableau (from a partition shape)">
<template #description>
The Ferrers shape of the partition, its cells numbered <code>1…n</code> in
reading order — the superstandard filling, always a valid standard Young
tableau (rows increase rightward, columns downward). A <code>CellDiagram</code> of
<code>StandardTableau</code>; each cell's <code>Entry</code> is its number.
</template>
<notatio-figure kind="tableau" value="[3,2,1]" />
<notatio-figure kind="tableau" value="[4,2]" />
<notatio-figure kind="tableau" value="[2,2,2]" />
</Story>

<Story
  title="Set partition (restricted-growth string)">
<template #description>
<code>value[i]</code> is the block of element <code>i+1</code> (a restricted-growth
string). Each block draws as a pill (a chain of joined slots) over its elements —
<code>[0,0,1,0,2]</code> is <code>{1,2,4} {3} {5}</code>.
</template>
<notatio-figure kind="set-partition" value="[0,0,1,0,2]" />
</Story>

<Story
  title="Lattice path (east/north step word)">
<template #description>
A monotone staircase of unit steps east (<code>0</code>) and north
(<code>1</code>) across the grid it spans; counts <code>C(a+b, a)</code>. A
<code>PathDiagram</code> of <code>LatticePath</code>: its points are the addresses
<code>(x, y)</code>, its steps the links.
</template>
<notatio-figure kind="lattice" value="[0,1,1,0,1,0]" />
<notatio-figure kind="lattice" value="[1,0,1,0,0,1]" />
</Story>

<Story
  title="Binary tree (preorder shape word)">
<template #description>
<code>1</code> is an internal node (always two children), <code>0</code> a leaf,
listed in preorder. A <code>TreeDiagram</code> of its tidy layout: leaves take
sequential x, each internal node sits over the mean of its children, and a node's
address is its (depth, order). The five shapes of size 3 (Catalan again):
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

## Click a figure

Written as a `Show`, a cell, tree or path figure is picked and styled the way a lattice's
tiles are: a click selects an address (shift-click adds more), and a rule's test reads the
pick through a relation. `CellDiagram`, `TreeDiagram` and `PathDiagram` are the layers; with
no rules they draw the look of the figure they stand for. Their data is an `IntegerPartition`,
`StandardTableau`, `Composition`, `Subset`, `PlaneTree`, `BinaryTree`, `DyckPath` or
`LatticePath`. Cell addresses count from 1; tree and path addresses from 0.

<Story title="Click a cell: its hook">
<template #description>Hook(Selected) lights the cell and the cells right of it and below it; the tooltip gives its hook length. Corner marks the removable cells.</template>
<Show Variables="[_s -> Variable(Automatic, [])]" Selection="_s" ImageSize="[Automatic, 200]">
  <CellDiagram
    ColorRules='[Selected -> Gold, Hook(Selected) -> Red, Corner -> Green, Filled -> Opacity(0.2, Gray)]'
    BoundaryStyle='[Hook(Selected) -> Directive(Red, AbsoluteThickness(2)), True -> Directive(Gray, AbsoluteThickness(1))]'
  ><IntegerPartition><List>5 3 3 1</List></IntegerPartition></CellDiagram>
</Show>
</Story>

<Story title="Click a node: its subtree">
<template #description>Subtree(Selected) is the picked node and everything under it; Ancestor(Selected) the nodes above.</template>
<Show Variables="[_s -> Variable(Automatic, [])]" Selection="_s" ImageSize="[Automatic, 200]">
  <TreeDiagram
    ColorRules='[Selected -> Gold, Subtree(Selected) -> Orange, Ancestor(Selected) -> Gray, Leaf -> Opacity(0.5, Teal), True -> Opacity(0.16, Teal)]'
  ><PlaneTree><List>3 0 2 0 2 0 0 1 2 0 0</List></PlaneTree></TreeDiagram>
</Show>
</Story>

<Story title="Click a point: its height and tunnel">
<template #description>SameHeight(Selected) lights the points level with the pick; Tunnel(Selected) the ends of the matching up and down steps of the step arriving there. Peaks are gold, valleys teal.</template>
<Show Variables="[_s -> Variable(Automatic, [])]" Selection="_s" ImageSize="[Automatic, 150]">
  <PathDiagram
    ColorRules='[Selected -> White, Tunnel(Selected) -> Red, SameHeight(Selected) -> Orange, Peak -> Gold, Valley -> Teal, True -> Gray]'
  ><DyckPath><List>1 1 0 1 1 0 0 1 0 0</List></DyckPath></PathDiagram>
</Show>
</Story>

<Story
  title="Raw SVG passthrough">
<template #description>
The generic escape hatch: hand it a ready-made SVG string and it renders it
verbatim (for representations authored elsewhere).
</template>
<notatio-figure svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" role="img" aria-label="star"><polygon points="20,2 25,15 39,15 28,24 32,38 20,30 8,38 12,24 1,15 15,15" fill="var(--notatio-accent,#d97706)"/></svg>' />
</Story>
