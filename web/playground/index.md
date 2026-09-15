# Playground

notatio, one piece at a time: a storybook for the `@enumeratio/elements` web
components — the notebook, the input and output, the plots, glyphs, tables and prose
controls that make up the interface. One page per component, each a focused, shared
place to look at the behaviour and talk about how to improve it. Some pages are
experimental and move fast.

## Components

- [Notebook](/playground/notebook) — `<notatio-notebook>`, a scoped session
- [Input](/playground/input) — `<notatio-input>`, the live math editor (and its read-only mode)
- [Output](/playground/output) — `<notatio-output>`, typeset read-only rendering + display forms
- [Cell](/playground/cell) — `<notatio-cell>`, a notebook In/Out pair
- [Figure (glyphs)](/playground/figure) — `<notatio-figure>`, combinatorial pictorial forms
- [Plot](/playground/plot) — `<notatio-plot>`, function plots of one variable
- [Plot 3D](/playground/plot3d) — `<notatio-plot3d>`, bivariate surfaces, projected and shaded in plain SVG
- [Contour Plot](/playground/contourplot) — `<notatio-contourplot>`, contour lines / filled bands of a bivariate function (or a pre-sampled grid) via marching squares
- [Density Plot](/playground/densityplot) — `<notatio-densityplot>`, a bivariate function (or a pre-sampled grid) as a heatmap on a sequential ramp
- [Vector & Stream Plot](/playground/vectorplot) — `<notatio-vectorplot>`, a planar vector field as arrows, or as streamlines by fixed-step RK4
- [Polar Plot](/playground/polarplot) — `<notatio-polarplot>`, r(θ) curves (and explicit point lists) on a polar grid
- [List Plot 3D](/playground/listplot3d) — `<notatio-listplot3d>`, 3-D scatters and height-grid surfaces, orthographically projected
- [Bar Chart 3D](/playground/barchart3d) — `<notatio-barchart3d>`, a matrix of heights as depth-sorted 3-D bars
- [Chart](/playground/chart) — `<notatio-chart>`, data-driven 2-D charts (bar, histogram, pie, box-whisker, array, discrete, list)
- [GraphPlot](/playground/graphplot) — `<notatio-graphplot>`, graph & hierarchical layouts (tree, graph, layered graph, dendrogram)
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

## Input syntax

Every expression attribute is **notatio** — the restricted-Epsil subset, so
`Sin(x) * Cos(y)` rather than `\sin(x)\cos(y)`, and products need an explicit
`*`. LaTeX is read only inside a `$…$` island (`value="$x\sin(x)$"`), where
implicit multiplication works as usual. That holds for the editable components too — a
cell's `value` and a notebook's or worksheet's `seed` are notatio, converted to LaTeX
only for the MathLive field that edits them; `in-form="latex"` hands the field LaTeX as
written, for the rare thing notatio cannot yet say. Two components keep LaTeX as their
own form: `<notatio-input>` _is_ the math field, so its `value` is the field's LaTeX,
and `<notatio-output>` renders a given encoding rather than taking authored input, so
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
forms ship on `<notatio-output>` (the In/Out menu); the visual forms live in
`<notatio-figure>` and the plot components.

| Representation           | Kind       | Status  | Wolfram analogue                                                                     |
| ------------------------ | ---------- | ------- | ------------------------------------------------------------------------------------ |
| StandardForm             | textual    | shipped | <Symbol type="wolfram">StandardForm</Symbol>                                         |
| TraditionalForm          | textual    | shipped | <Symbol type="wolfram">TraditionalForm</Symbol>                                      |
| FullForm                 | textual    | shipped | <Symbol type="wolfram">FullForm</Symbol>                                             |
| TeXForm                  | textual    | shipped | <Symbol type="wolfram">TeXForm</Symbol>                                              |
| MathMLForm               | textual    | shipped | <Symbol type="wolfram">MathMLForm</Symbol>                                           |
| Permutation matrix       | picture    | shipped | <Symbol type="wolfram">MatrixPlot</Symbol>                                           |
| Ferrers / Young          | picture    | shipped | —                                                                                    |
| Composition bar          | picture    | shipped | —                                                                                    |
| Subset cells             | picture    | shipped | —                                                                                    |
| Dyck path                | picture    | shipped | —                                                                                    |
| Function plot            | plot       | shipped | <Symbol type="wolfram">Plot</Symbol>                                                 |
| Surface / 3-D plot       | plot       | shipped | <Symbol type="wolfram">Plot3D</Symbol>                                               |
| MatrixForm (true matrix) | textual    | roadmap | <Symbol type="wolfram">MatrixForm</Symbol> (via TeX)                                 |
| Interactive markup       | structured | roadmap | <Symbol type="wolfram">Manipulate</Symbol>, <Symbol type="wolfram">Graphics</Symbol> |

## Two problems, kept separate

1. **Explicit request** — ask for a specific representation, with options
   (domain, scaling, ground-set size, …). This is what's built first, and what
   the stories exercise. It's the stable contract.
2. **Default selection / fallback** — given an expression and the graphics
   capabilities available, _choose_ a good representation (a permutation might
   default to a matrix; a univariate function to a plot; progressively enhancing
   from plain text up). Deliberately deferred — we'll design the fallback logic
   once enough real examples accumulate here.

A future REPL will call the same representation layer to _request an image_ and
hand back a link (local file or hosted), rather than only rendering inline.
