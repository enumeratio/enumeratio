# Design: components and symbols

Status: **landed** (renames, heads, argument map, wrapper generator, `Chart` family head,
controls — all shipped 2026-09-15; §5–§6a below). Open questions moved to
speculative/components-and-symbols.md. The idea: a symbol and its component are
the same thing seen from two ends. `<Cell>` in a markdown page is the symbol `Cell` as a
Vue component; `Histogram(data)` in a cell is the same symbol as an expression; the web
component is how either one gets drawn. Companion to
[component-naming.md](./component-naming.md), whose rule (a tag is `notatio-` + the
symbol, kebab-cased) is what makes the mapping mechanical, and which is agreed but
deliberately not executed while the components are in flux. Nothing here should execute
before that does — the most important piece of this note is that alignment, and it is
the part component-naming already owns.

## 1. What exists

- **`@enumeratio/notatio`**: ~30 Lit custom elements, `notatio-*`. Every expression
  attribute is notatio; LaTeX lives only in `$…$` islands, and the editable elements
  (`notatio-cell`, `notatio-notebook`, `notatio-worksheet`) convert notatio to LaTeX
  for the MathLive field through one seam, `source.ts`. `in-form="latex"` is the escape
  hatch. `notatio-in` _is_ the field and keeps LaTeX; `notatio-out` renders a given
  encoding and keeps `format`.
- **`/reference/components`** is generated at build time from the element sources
  (`web/.vitepress/data/components.ts`): `static properties` is the attribute surface,
  the JSDoc above an entry is its prose. Nothing is written into the repo.
- **Markdown authors write the elements directly.** VitePress compiles the page to a Vue
  render function; `isCustomElement` keeps `notatio-*` out of component resolution, so the
  tags reach the DOM as written and Vue sets string bindings as _properties_ (the
  `captureTemplates` note in `bindings.ts` is where that matters).
- **`<Story>`** prints its source from its own body — the default slot's vnodes written
  back out as markup — so an example is authored once. A component in the body prints
  under its registered name (`<Cell …>`), an element under its tag.
- **One wrapper**: `web/.vitepress/theme/components/Cell.vue`, registered as `Cell` —
  the symbol's name, not the tag's — used on `/playground/cell`. Its props are the
  element's attributes, typed (`inForm: InForm`, exported from the elements package),
  rendered inside `<ClientOnly>` with everything undeclared falling through as attributes.

## 2. Symbols as Vue components

The wrappers are named for the **symbols**: `<Cell>`, `<Plot>`, `<Histogram>`,
`<Manipulate>` — not `<NotatioPlot>`. Each is a thin convenience over the web component
of the same symbol: typed props (the SFC compiler checks the spelling, an editor
completes it), `<ClientOnly>` handled once, the element underneath unchanged. What that
buys beyond convenience is a **mirror of the symbol library in the template language**:
the vdom syntax reads as the expression does, inline in markdown, and the same mirror is
one file away in React, since a wrapper is nothing but props → attributes.

Not every symbol needs a component. Most are mathematics to typeset, and `<Out>` (the
`notatio-out` of today) covers them. But for the ones that draw — the plots, the
tables, the controls, the notebook structures — having the symbol available as a tag
does not hurt and is what lets an author compose an interface out of the same names the
engine knows.

The wrappers should not be hand-written past `Cell`. The element source already carries
everything a wrapper needs — property names, `declare`d types, constructor defaults,
JSDoc — and `components.ts` already parses it for the reference. The same parse can emit
`Plot.vue`, `Manipulate.vue`, … into a build directory (not the repo), each the shape of
`Cell.vue`; registration is a loop over the emitted list; a React emitter is the same
loop with a different template. The reference page and the wrappers then come from one
reading of one source, and an attribute added to an element appears in both.

Two wrinkles the generator has to know about:

- **Booleans.** A Lit `{ type: Boolean }` attribute is present-or-absent; a Vue boolean
  prop bound as `:box="box"` sets the _property_, which Lit handles. Fine for
  `notatio-*` (all boolean attributes are Lit properties), wrong for a plain HTML
  element — the generator is only for ours.
- **Slots and children.** `notatio-manipulate` and `notatio-dynamic-module` wrap light-DOM
  children whose attributes carry `_name` wildcards; a wrapper passes its default slot
  straight through. `captureTemplates` reads attributes _and_ properties, so a child
  written as `<Plot :value="…">` inside a `<Manipulate>` is captured the same as a raw
  element — that path is already exercised by VitePress's property-setting.

## 3. Symbols as expressions that draw

The other end. Today an expression renders through `<notatio-out>`, which typesets
anything as mathematics. Some heads are not mathematics to typeset; they are instructions
to draw. Wolfram's `Plot[Sin[x], {x, 0, 10}]` prints as a picture, and so do
`Manipulate`, `Graphics`, `Image`. We have `Image` as a value (`formats/src/graphics.ts`)
and the plot elements as tags; what is missing is that a head **is** its component:

| head                                                      | renders as                                                     |
| --------------------------------------------------------- | -------------------------------------------------------------- |
| `Plot(f, (x, a, b))`                                      | `<notatio-plot value=f domain="a,b">`                          |
| `Plot3D`, `ContourPlot`, `DensityPlot`, `PolarPlot`, …    | the element of the same name, per component-naming §4          |
| `Manipulate(body, (a, 0, 1), …)`                          | `<notatio-manipulate>` with a control per bound, `body` inside |
| `CollectionTable(coll)`                                   | `<notatio-collection-table>`                                   |
| `Image(uri)`                                              | `<img>`                                                        |
| `TraditionalForm(e)`, `InputForm(e)`, … (`WRAPPER_HEADS`) | `<notatio-out form=…>` of `e`                                  |
| anything else                                             | `<notatio-out>` — typeset                                      |

Against component-naming §3 this is the naming rule run backwards: kebab-case the head,
prefix `notatio-`, and the tag falls out, so once the renames land the map needs no table
for the aligned components — only the per-head argument mapping (`Plot`'s second argument
is a domain tuple and becomes two attributes; `Manipulate`'s trailing tuples become
controls). What it gives:

- **Evaluation can return a picture.** A cell whose Out is `Plot(Sin(x), (x, 0, 10))`
  draws it, as a Wolfram notebook does. The worksheet already infers a drawing from a
  cell's free variables; this is the explicit form, and would let that inference be a
  rewrite to a `Plot` head rather than component-internal logic.
- **A `Manipulate` written as an expression** — a value the REPL can hold, the CLI can
  print, a page can render, with the element as its rendering.
- **Fewer symbols.** Once a component is a symbol, every component that exists without
  one is a question: which symbol should it be? `notatio-worksheet`, `notatio-figure`,
  `notatio-code`, `notatio-terminal` (component-naming §4, "represents no single
  symbol") either take an existing symbol or justify a new one, and the pressure runs
  toward reuse — the same discipline `design/symbols.md` applies to heads.

## 4. Multiplexing: the same answer at both ends

Component-naming §5 flags four components that multiplex several symbols behind an
attribute: `notatio-chart` (`type`: `BarChart`, `Histogram`, `PieChart`, …),
`notatio-graph-plot`, `notatio-vector-plot`, `notatio-figure`. The question there was
whether to split them per symbol or keep the family tag.

The answer this note proposes is to **multiplex the heads the same way**. A `Chart` head
that looks at its inputs — a list of numbers, a list of pairs, a matrix, a labelled
association — plus whatever hints it is given, and chooses the chart, is exactly what
`notatio-chart` does with `type` today; the component is already the head's behaviour
without the head. Wolfram has no `Chart`, but it has the pattern (`Plot` over a list of
functions, `ListPlot` over several shapes of data, `Graphics` over primitives), and the
reasons are the same at both ends: the author often does not want to name the chart, and
the specific heads (`Histogram`, `BarChart`) stay as the explicit spelling when they do.
So: a family head with an autochoosing rule and a hint slot, mirrored by the family
component with the same rule and a `type` attribute; the specific heads exist and map to
the family component with the attribute set. The table in §3 then has family rows, not
per-symbol rows, and the split-versus-family question in component-naming closes the
same way for tags and heads at once.

## 5. The renames

Landed 2026-09-15, all of component-naming §4 at once: `notatio-input` /
`notatio-output` became `notatio-in` / `notatio-out` (the `In` and `Out` symbols the
elements already print as their row labels), the compound names are kebab-cased.
head→tag is now a function of the symbol. The package went to `@enumeratio/components`
that day and on to **`@enumeratio/notatio`** the next: the tags are `notatio-*`, and the
enumeratio/notatio split -- the mathematics and its notation -- is what the repo is
named for, so the package is named for the thing rather than the shape of it. The same
day it split in two: `@enumeratio/notatio` is the base with no framework in it, and the
elements are `@enumeratio/notatio-lit` ([vdom.md](./vdom.md) has the layout).

## 6. What it took

All five landed 2026-09-15, in this order:

1. **The renames** — §5.
2. **The heads, declared** — `GRAPHICS_HEADS` in `formats/src/graphics.ts`, inert (a
   signature, no `evaluate`), so `Plot(Sin(x), (x, 0, 10))` is an expression the engine
   holds with its arguments canonicalised (`(x, 0, 10)` is a `Tuple` however it was
   typed). The engine's own `Histogram(data, bins)` is redeclared with the second slot
   optional: one argument holds as the picture, two compute as before.
3. **The argument map** — `components/src/symbols.ts`, pure: `VISUAL_SYMBOLS` (head, tag,
   fixed attributes, operands → attributes, operands → children), `renderingOf(expr)`
   and `markupOf(rendering)`. A `Manipulate` body becomes a child with its parameters
   as `_name` wildcards, which is how the component already binds a slot. `<notatio-out>`
   asks it after evaluating, and on the standard form draws the rendering instead of the
   typeset expression. It does not import the elements — the package entry registers
   them — so a host that registers only `notatio-out` sees the typeset fallback.
4. **The wrapper generator** — `web/.vitepress/data/wrappers.ts`, run when the site config
   loads: one `.vue` per component named for its tag (`Plot3D`), one per family member
   in `VISUAL_SYMBOLS` (`Histogram` is `<Chart>` with `type` fixed), into
   `theme/generated/` (gitignored) and registered by the theme from a glob. Props are
   the attribute table `components.ts` already reads; an absent prop is not bound, so
   the element keeps its own default. `Cell.vue` is gone; `<Cell>` is generated now.
5. **The `Chart` family head** — `chooseChartType` in `notatio-chart.ts`: matrix → array,
   ragged rows → box, pairs → list, a short number list → bar, a long one → histogram,
   `labels` pulling to bar. The component's `type` defaults to `auto` and applies the
   same rule, so `Chart(data)` and `<notatio-chart data>` agree by construction.

## 6a. The controls, and an interface as an expression

Landed 2026-09-15, on top of §6. Wolfram's `Control` family is now a component per
symbol -- `Slider`, `VerticalSlider`, `Animator`, `Slider2D`, `IntervalSlider`,
`SetterBar`, `RadioButtonBar`, `TogglerBar`, `Toggler`, `PopupMenu`, `ListPicker`,
`Checkbox`, `ColorSlider`, `Locator`, `InputField` -- plus the layout heads `Row`,
`Column`, `Grid`, `Panel`, `Labeled`, and `Dynamic`. Three things hold it together:

- **One contract** (`components/src/controls.ts`). Every control has a `name`, a
  MathJSON `binding` (a number, `True`, a `List`, an expression) and dispatches
  `notatio-control-change`; its tag is in `CONTROL_TAGS`. A scope (`<notatio-dynamic-module>`,
  `<notatio-manipulate>`) binds any of them without knowing which it has, and a
  template gets a `List` from a toggler bar as readily as a number from a slider.
- **The strip picks like Wolfram.** Manipulate's `params` draw these components: a
  range is a slider, a short list a setter bar, a long one a popup menu, and a trailing
  symbol in the tuple (`{k, {1, 2, 3}, PopupMenu}`) is `ControlType`.
- **An expression with controls is a scope.** `renderingOf` collects the variables the
  controls declare (a control's first argument, alone or as `(k, init)`), rewrites every
  other occurrence to the wildcard `_k`, and wraps the rendering in a dynamic module. So
  `Row([Slider(k, (0, 5)), Dynamic(k^2)])` evaluates in a cell and draws as a live
  interface, and a `Grid` of controls and readouts is a small application. Labelled
  entries are `Labeled(value, "label")`, since Epsil's `->` is a `KeyValuePair` that
  wants a string key.

The Vue wrappers follow for free: `<Slider>`, `<SetterBar>`, `<Row>`, … are generated
from the element sources like the rest, and the reference follows a class's attributes
up its parents (`NotatioAnimator extends NotatioSlider`).
