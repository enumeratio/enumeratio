# Playground

notatio, one piece at a time: a storybook for the `@enumeratio/components` web
components — the notebook, the input and output, the plots, glyphs, tables and prose
controls that make up the interface. One page per component, each a focused, shared
place to look at the behaviour and talk about how to improve it. Some pages are
experimental and move fast.

## Components

- [Notebook](/playground/notebook) — `<notatio-notebook>`, a scoped session
- [Input](/playground/in) — `<notatio-in>`, the live math editor (and its read-only mode)
- [Output](/playground/out) — `<notatio-out>`, typeset read-only rendering + display forms
- [Cell](/playground/cell) — `<notatio-cell>`, a notebook In/Out pair
- [Figure (glyphs)](/playground/figure) — `<notatio-figure>`, combinatorial pictorial forms
- [Plot](/playground/plot) — `<notatio-plot>`, function plots of one variable
- [Plot 3D](/playground/plot-3d) — `<notatio-plot-3d>`, bivariate surfaces, projected and shaded in plain SVG
- [Contour Plot](/playground/contour-plot) — `<notatio-contour-plot>`, contour lines / filled bands of a bivariate function (or a pre-sampled grid) via marching squares
- [Density Plot](/playground/density-plot) — `<notatio-density-plot>`, a bivariate function (or a pre-sampled grid) as a heatmap on a sequential ramp
- [Vector & Stream Plot](/playground/vector-plot) — `<notatio-vector-plot>`, a planar vector field as arrows, or as streamlines by fixed-step RK4
- [Polar Plot](/playground/polar-plot) — `<notatio-polar-plot>`, r(θ) curves (and explicit point lists) on a polar grid
- [List Plot 3D](/playground/list-plot-3d) — `<notatio-list-plot-3d>`, 3-D scatters and height-grid surfaces, orthographically projected
- [Bar Chart 3D](/playground/bar-chart-3d) — `<notatio-bar-chart-3d>`, a matrix of heights as depth-sorted 3-D bars
- [Chart](/playground/chart) — `<notatio-chart>`, data-driven 2-D charts (bar, histogram, pie, box-whisker, array, discrete, list)
- [GraphPlot](/playground/graph-plot) — `<notatio-graph-plot>`, graph & hierarchical layouts (tree, graph, layered graph, dendrogram)
- [Complex Plot](/playground/complex-plot) — `<notatio-complex-plot>`, domain-colouring of a complex expression, one WebGPU invocation per pixel
- [Collection table](/playground/collection-table) — `<notatio-collection-table>`, a paged table over a lazy indexed collection, with statistics as columns
- [Worksheet](/playground/worksheet) — `<notatio-worksheet>`, named expressions whose knobs and plots fall out of the cells
- [Manipulate](/playground/manipulate) — `<notatio-manipulate>`, Wolfram-style controls bound to named wildcards in any slotted content
- [REPL (terminal)](/playground/repl) — `<notatio-terminal>`, the real CLI eval core in a browser terminal
- [Command line](/playground/cli) — the same terminal in one-shot `notatio <expr>` mode
- [Polytope](/playground/polytope) — `<notatio-polytope>`, a polytope's face poset, where every mark is a clickable face
- [Tangle](/playground/inspirations/tangle) — `<notatio-tangle>` and the inline controls (`<notatio-knob>`, `<notatio-toggler>`, `<notatio-dynamic>`, `<notatio-when>`): reactive prose

## Inspirations

Somebody else's idea, taken seriously enough to build — see
[Inspirations](/playground/inspirations/).

## As Vue components

Every component is also a Vue component named for its **symbol** — `<Plot>`, `<Plot3D>`,
`<Cell>`, `<Manipulate>` — with the element's attributes as typed props, so a page gets a
compile-time check on the spelling and never writes `<ClientOnly>` itself. The family
components come with one wrapper per member too: `<Histogram>`, `<BarChart>`, `<PieChart>`
are `<Chart>` with `type` fixed, `<StreamPlot>` is `<VectorPlot>`, `<TreeGraph>` is
`<GraphPlot>`. They are generated from the element sources when the site builds
(`web/.vitepress/data/wrappers.ts`), so an attribute added to an element is a prop the
same day.

<Story
  title="The symbols, as tags">
<Plot value="Sin(x)" domain="0,10" />
<Histogram data="[1,2,2,3,3,3,4,4,5]" />
</Story>

## Symbols that draw

The other direction: a head that draws _is_ its component. `Plot`, `Histogram`,
`Manipulate` and the rest are declared on the engine and held rather than evaluated, so
`Plot(Sin(x), (x, 0, 10))` is an expression a cell can hold — and its Out draws it, the
way a notebook does, instead of printing the word. The map from a head's arguments to
the component's attributes is `@enumeratio/components/symbols`; the family head `Chart`
leaves `type` unset and lets the data decide.

<Story
  title="An Out that evaluates to a picture">
<notatio-cell value="Plot(Sin(x), (x, 0, 10))" />
<notatio-cell value="Chart([3, 1, 4, 1, 5])" />
<notatio-cell value="Manipulate(Plot(Sin(a * x), (x, 0, 10)), (a, 1, 5))" />
</Story>

## Input syntax

Every expression attribute is **notatio** — the restricted-Epsil subset, so
`Sin(x) * Cos(y)` rather than `\sin(x)\cos(y)`, and products need an explicit
`*`. LaTeX is read only inside a `$…$` island (`value="$x\sin(x)$"`), where
implicit multiplication works as usual. That holds for the editable components too — a
cell's `value` and a notebook's or worksheet's `seed` are notatio, converted to LaTeX
only for the MathLive field that edits them; `in-form="latex"` hands the field LaTeX as
written, for the rare thing notatio cannot yet say. Two components keep LaTeX as their
own form: `<notatio-in>` _is_ the math field, so its `value` is the field's LaTeX,
and `<notatio-out>` renders a given encoding rather than taking authored input, so
it keeps its `format` attribute (`latex` by default; `mathjson` and `notatio` too).

## Debugging

The elements fail quietly — a value that doesn't parse renders nothing rather
than an error. To see why, turn on the namespace for the element and reload:

```js
localStorage["notatio:debug"] = "plot3d"; // or "plot*", or "*"
```

## Representations are Form symbols

A single expression can be shown many ways. Following Wolfram's `*Form` symbols,
each way is a named **representation** you can request explicitly. The textual
forms ship on `<notatio-out>` (the In/Out menu); the visual forms live in
`<notatio-figure>` and the plot components.

| Representation           | Kind       | Status  | Wolfram analogue                                                                                                                |
| ------------------------ | ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| StandardForm             | textual    | shipped | <Symbol type="wolfram">StandardForm</Symbol>                                                                                    |
| TraditionalForm          | textual    | shipped | <Symbol type="wolfram">TraditionalForm</Symbol>                                                                                 |
| FullForm                 | textual    | shipped | <Symbol type="wolfram">FullForm</Symbol>                                                                                        |
| TeXForm                  | textual    | shipped | <Symbol type="wolfram">TeXForm</Symbol>                                                                                         |
| MathMLForm               | textual    | shipped | <Symbol type="wolfram">MathMLForm</Symbol>                                                                                      |
| Permutation matrix       | picture    | shipped | <Symbol type="wolfram">MatrixPlot</Symbol>                                                                                      |
| Ferrers / Young          | picture    | shipped | —                                                                                                                               |
| Composition bar          | picture    | shipped | —                                                                                                                               |
| Subset cells             | picture    | shipped | —                                                                                                                               |
| Dyck path                | picture    | shipped | —                                                                                                                               |
| Function plot            | plot       | shipped | <Symbol type="wolfram">Plot</Symbol>                                                                                            |
| Surface / 3-D plot       | plot       | shipped | <Symbol type="wolfram">Plot3D</Symbol>                                                                                          |
| MatrixForm (true matrix) | textual    | roadmap | <Symbol type="wolfram">MatrixForm</Symbol> (via TeX)                                                                            |
| Interactive markup       | structured | shipped | <Symbol type="wolfram">Manipulate</Symbol> as a head that draws (above); <Symbol type="wolfram">Graphics</Symbol> still roadmap |

## Two problems, kept separate

1. **Explicit request** — ask for a specific representation, with options
   (domain, scaling, ground-set size, …). This is what's built first, and what
   the stories exercise. It's the stable contract.
2. **Default selection / fallback** — given an expression and the graphics
   capabilities available, _choose_ a good representation (a permutation might
   default to a matrix; a univariate function to a plot; progressively enhancing
   from plain text up). One case of it is shipped: a head that draws is drawn by its
   component, and the `Chart` family chooses its member from the data's shape. The
   general rule — what a bare permutation or a bare function defaults to — is still
   deferred until enough real examples accumulate here.

A future REPL will call the same representation layer to _request an image_ and
hand back a link (local file or hosted), rather than only rendering inline.
