---
order: 1
title: Components, one at a time
---

# Components, one at a time

notatio, one piece at a time: a storybook for the `@enumeratio/frontend` web
components — the notebook, the input and output, the plots, glyphs, tables and prose
controls that make up the interface. One page per component, each a focused, shared
place to look at the behaviour and talk about how to improve it. Some pages are
experimental and move fast.

These are demos of the parts. To use the whole thing, open a [worksheet](/worksheet/).

## Components

- [Notebook](/docs/components/notebook) — `<notatio-notebook>`, a scoped session
- [Input](/docs/components/in) — `<notatio-in>`, the live math editor (and its read-only mode)
- [Output](/docs/components/out) — `<notatio-out>`, typeset read-only rendering + display forms
- [Cell](/docs/components/cell) — `<notatio-cell>`, a notebook In/Out pair
- [Verification](/docs/components/verification) — `<notatio-test-result-object>`, `VerificationTest`'s outcome as a badge over an In/Out pair
- [Glyph](/docs/combinatorics/glyph) — `<notatio-glyph>`, combinatorial pictorial forms
- [Plot](/reference/component/Plot) — function plots of one variable; stories moved to its component reference page
- [Plot 3D](/reference/component/Plot3D) — bivariate surfaces, projected and shaded in plain SVG; stories moved to its component reference page
- [Contour Plot](/reference/component/ContourPlot) — contour lines / filled bands of a bivariate function (or a pre-sampled grid) via marching squares; stories moved to its component reference page
- [Density Plot](/reference/component/DensityPlot) — a bivariate function (or a pre-sampled grid) as a heatmap on a sequential ramp; stories moved to its component reference page
- [Vector & Stream Plot](/reference/component/VectorPlot) — a planar vector field as arrows, or as streamlines by fixed-step RK4; stories moved to its component reference page
- [Polar Plot](/reference/component/PolarPlot) — r(θ) curves (and explicit point lists) on a polar grid; stories moved to its component reference page
- [List Plot 3D](/reference/component/ListPlot3D) — 3-D scatters and height-grid surfaces, orthographically projected; stories moved to its component reference page
- [Bar Chart 3D](/reference/component/BarChart3D) — a matrix of heights as depth-sorted 3-D bars; stories moved to its component reference page
- [Chart](/reference/component/Chart) — data-driven 2-D charts (bar, histogram, pie, box-whisker, array, discrete, list); stories moved to its component reference page
- [GraphPlot](/reference/component/GraphPlot) — graph & hierarchical layouts (tree, graph, layered graph, dendrogram); stories moved to its component reference page
- [Complex Plot](/reference/component/ComplexPlot) — domain-colouring of a complex expression, one WebGPU invocation per pixel; stories moved to its component reference page
- [Complex Plot 3D](/reference/component/ComplexPlot3D) — |f(z)| as a surface over the plane, faces coloured by arg f(z); stories moved to its component reference page
- [Collection table](/reference/component/CollectionTable) — a paged table over a lazy indexed collection, with statistics as columns; stories moved to its component reference page
- [Worksheet](/docs/components/worksheet) — `<notatio-worksheet>`, named expressions whose knobs and plots fall out of the cells
- [Manipulate](/docs/components/manipulate) — `<notatio-manipulate>`, Wolfram-style controls bound to named wildcards in any slotted content
- [Terminal](/docs/components/terminal) — `<notatio-terminal>`, the real CLI eval core in a browser terminal, as a session or one `notatio <expr>` at a time
- [Polytope](/docs/polytope/polytope) — `<notatio-polytope>`, a polytope's face poset, where every mark is a clickable face (no symbol head yet)
- [Tangle](/playground/inspirations/tangle) — `<notatio-dynamic-module>` and the inline controls (`<notatio-knob>`, `<notatio-toggler>`, `<notatio-dynamic>`, `<notatio-when>`): reactive prose

## Inspirations

Somebody else's idea, taken seriously enough to build — see
[Inspirations](/playground/inspirations/).

## Symbols that draw

The other direction: a head that draws _is_ its component. `Plot`, `Histogram`,
`Manipulate` and the rest are declared on the engine and held rather than evaluated, so
`Plot(Sin(x), (x, 0, 10))` is an expression a cell can hold — and its Out draws it, the
way a notebook does, instead of printing the word. The map from a head's arguments to
the component's attributes is `@enumeratio/frontend/symbols`; the family head `Chart`
leaves `type` unset and lets the data decide.

<Story
  title="An Out that evaluates to a picture">
<notatio-cell value="Plot(Sin(x), (x, 0, 10))" />
<notatio-cell value="Chart([3, 1, 4, 1, 5])" />
<notatio-cell value="Manipulate(Plot(Sin(a * x), (x, 0, 10)), (a, 1, 5))" />
</Story>

## Input syntax

Every expression attribute takes **an expression**, written in **Epsil**:
`Sin(x) * Cos(y)` rather than `\sin(x)\cos(y)`, and products need an explicit
`*`. LaTeX is read only inside a `$…$` island (`value="$x\sin(x)$"`) — Epsil's own
LaTeX hook — where implicit multiplication works as usual. That holds for the editable
components too — a notebook's or worksheet's `seed` is Epsil, converted to LaTeX only
for the MathLive field that edits it; `in-form="latex"` hands the field LaTeX as
written, for the rare thing Epsil cannot yet say. A cell's `value` is written in the
syntax its own `format` names (`epsil` by default, or `latex`, `mathjson`, `wolfram`);
its `in-form` is a different thing again — which editor shows it (see
[Cell](/docs/components/cell)). Two components keep LaTeX as their own form: `<notatio-in>`
_is_ the math field, so its `value` is the field's LaTeX, and `<notatio-out>` renders a
given encoding rather than taking authored input, so it keeps its `format` attribute
(`latex` by default; `mathjson` and `epsil` too).

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
`<notatio-glyph>` and the plot components.

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
