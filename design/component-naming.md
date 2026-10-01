# Design: naming the components

Status: **landed** (2026-09-15). An audit of the component tags against the symbols they
represent, the rule that came out of it, and the renames it called for — all executed in
one pass, once the code was quiet enough: the package is `@enumeratio/components`, every
tag in §4 has its kebab-cased symbol name, the class names follow, and the multiplexing
question (§5) is answered in [components-and-symbols.md](./components-and-symbols.md) §4
— a family tag stays a family tag, mirrored by a family head. The audit is kept as the
record of why.

## 1. The problem

The tags grew one at a time and none of them was chosen against the symbol it stands for.
Three separate inconsistencies fell out.

**Compound symbols lost their word boundary.** `DensityPlot` became `notatio-densityplot`,
not `notatio-density-plot`. The tag reads as if the symbol were `Densityplot`, which is not
a thing. Same for `contourplot`, `polarplot`, `vectorplot`, `graphplot`, `plot3d`.

**Two components are named for the wrapper rather than the symbol.** `notatio-input` and
`notatio-output` describe what they are made of — a field, a rendering — where `In` and
`Out` are what they _are_, and are what the elements already print in their own row
labels.

**The package disagreed with the docs.** `@enumeratio/elements` shipped things the reference
called components, because _element_ is overloaded here — a group element, a basis element,
a matrix element. The docs were moved to "components" first; the package followed.

## 2. Prior art

Every name below is a real `System\`` symbol, checked against a kernel rather than
remembered:

`In`, `Out`, `Notebook`, `Manipulate`, `Plot`, `Plot3D`, `ContourPlot`, `DensityPlot`,
`PolarPlot`, `VectorPlot`, `StreamPlot`, `GraphPlot`, `TreeGraph`, `LayeredGraphPlot`,
`Dendrogram`, `ComplexPlot`, `MatrixPlot`, `ListPlot`, `DiscretePlot`, `BarChart`,
`Histogram`, `PieChart`, `BoxWhiskerChart`, `TeXForm`, `Grid`, `Row`, `Column`.

Worth noticing: `In` and `Out` are not an exception to a symbol-alignment rule, they are an
instance of it. So is `Notebook`. The components that look least like symbols today are
among the ones with the cleanest symbol to take.

## 3. The proposed rule

> A component that represents a symbol is named `notatio-` + that symbol in kebab-case.
> A component that represents no symbol keeps a descriptive name, and we say so out loud.

Kebab-casing a symbol needs one wrinkle spelled out: a digit and the letters attached to it
are one token, so `Plot3D` is `plot-3d`, not `plot3-d`.

## 4. The audit

### Renamed (all landed)

| Was                   | Symbol        | Now                    |
| --------------------- | ------------- | ---------------------- |
| `notatio-input`       | `In`          | `notatio-in`           |
| `notatio-output`      | `Out`         | `notatio-out`          |
| `notatio-plot3d`      | `Plot3D`      | `notatio-plot-3d`      |
| `notatio-listplot3d`  | `ListPlot3D`  | `notatio-list-plot-3d` |
| `notatio-barchart3d`  | `BarChart3D`  | `notatio-bar-chart-3d` |
| `notatio-contourplot` | `ContourPlot` | `notatio-contour-plot` |
| `notatio-densityplot` | `DensityPlot` | `notatio-density-plot` |
| `notatio-polarplot`   | `PolarPlot`   | `notatio-polar-plot`   |
| `notatio-vectorplot`  | `VectorPlot`  | `notatio-vector-plot`  |
| `notatio-graphplot`   | `GraphPlot`   | `notatio-graph-plot`   |
| `notatio-curve3d`     | —             | `notatio-curve-3d`     |

Class names went with them: `NotatioIn`, `NotatioOut`, `NotatioPlot3D`, `NotatioCurve3D`,
`NotatioListPlot3D`, `NotatioBarChart3D` (a digit-and-letters token is one token, so `3D`
not `3d`). Playground pages carry the tag's slug (`/playground/plot-3d`), and the reference
routes follow the tag as they always did.

### Already aligned

`notatio-plot` (`Plot`), `notatio-manipulate` (`Manipulate`), `notatio-notebook`
(`Notebook`), `notatio-complex-plot` (`ComplexPlot`).

`notatio-complex-plot` is the one rename that has happened. It was the clearest case —
the component domain-colours a complex-valued expression over the plane, which is what
`ComplexPlot` is, while "portrait" named the picture rather than the operation — and it
came with a reworking of that component rather than as a rename on its own, which is the
cheap way to do these: fold the new name into whatever work already touches the file.

### Represents no single symbol

| Component           | Why                                                                                                                                                      |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `notatio-cell`      | an In/Out pair — though `Cell` _is_ a Wolfram symbol (a notebook cell), so this row is closer to aligned than it looks; see components-and-symbols.md §7 |
| `notatio-worksheet` | ours; named expressions and a shared view                                                                                                                |
| `notatio-code`      | a source box; the language is an attribute                                                                                                               |
| `notatio-terminal`  | a REPL surface                                                                                                                                           |
| `notatio-figure`    | eleven glyph kinds behind one `kind` attribute (see below)                                                                                               |
| `notatio-tex`       | arguably `TeXForm`, but it renders inline math rather than printing a form                                                                               |

## 5. The glitches worth indexing

These are the reasons this is a design note and not a `sed` invocation.

**A component can multiplex several symbols.** Four do, and the symbol is chosen by an
attribute rather than by the tag:

| Component            | Attribute | Symbols behind it                                                                                |
| -------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| `notatio-chart`      | `type`    | `BarChart`, `Histogram`, `PieChart`, `BoxWhiskerChart`, `MatrixPlot`, `ListPlot`, `DiscretePlot` |
| `notatio-graphplot`  | `type`    | `GraphPlot`, `TreeGraph`, `LayeredGraphPlot`, `Dendrogram`                                       |
| `notatio-vectorplot` | `type`    | `VectorPlot`, `StreamPlot`                                                                       |
| `notatio-figure`     | `kind`    | eleven glyphs, most of which have no symbol at all                                               |

So "one component, one symbol" is already false, and renaming `notatio-graphplot` to
`notatio-graph-plot` picks one of its four symbols to be the name. Either that is fine —
the tag names the family and the attribute selects within it — or those components should
split, which is a much larger change than a rename. **This is the actual decision**; the
kebab-casing is the easy part.

**The tag is a URL in two places.** Reference pages are generated per tag
(`/reference/components/notatio-densityplot`), and the playground page is matched by
slug. Renames move both, and `notatio-plot-3d` would want `/playground/plot-3d`.

**Class names carry their own drift.** `NotatioPlot3d` (not `…3D`), `NotatioTex` (not
`…TeX`). Worth settling in the same pass as the tags.

**`notatio-curve3d` arrived after this note was started**, spelled the old way — which is
the argument for settling the rule rather than fixing tags one at a time. Wolfram's
nearest symbol is `ParametricPlot3D`, which is not what it does; the name is ours, and
`curve-3d` is the kebab rule applied to a name with no symbol behind it.

**`notatio-sheet` already became `notatio-worksheet`** without a note. Whatever rule comes
out of this should say what a component is called when it represents nothing in Wolfram —
otherwise the next one drifts the same way.

## 6. How it was done

One pass, 2026-09-15: the package rename (`@enumeratio/elements` →
`@enumeratio/components`, `packages/elements` → `packages/components`), the tags of §4,
the class names, the playground page slugs — a scripted textual rewrite over the repo
with the tag, class and route maps, plus `git mv` for the files, then a build and the
site. The multiplexing question was answered first (family tags stay; see
components-and-symbols.md §4), which is what made the rest mechanical. The one thing to
watch for in a rename like this is a CSS class that shares a tag's name — the In label's
class was `notatio-in`, and became `notatio-in-label` to match `notatio-out-label`.

The rule for what arrives next: a new component is named for its symbol on the day it is
written, kebab-cased, and a family component keeps the family's name with the member in
an attribute.
