# Design: components and symbols

Status: **proposal**, with one worked example. The idea: a symbol and its component are
the same thing seen from two ends. `<Cell>` in a markdown page is the symbol `Cell` as a
Vue component; `Histogram(data)` in a cell is the same symbol as an expression; the web
component is how either one gets drawn. Companion to
[component-naming.md](./component-naming.md), whose rule (a tag is `notatio-` + the
symbol, kebab-cased) is what makes the mapping mechanical, and which is agreed but
deliberately not executed while the components are in flux. Nothing here should execute
before that does — the most important piece of this note is that alignment, and it is
the part component-naming already owns.

## 1. What exists

- **`@enumeratio/elements`**: ~30 Lit custom elements, `notatio-*`. Every expression
  attribute is notatio; LaTeX lives only in `$…$` islands, and the editable elements
  (`notatio-cell`, `notatio-notebook`, `notatio-worksheet`) convert notatio to LaTeX
  for the MathLive field through one seam, `source.ts`. `in-form="latex"` is the escape
  hatch. `notatio-input` _is_ the field and keeps LaTeX; `notatio-output` renders a given
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
`notatio-output` of today) covers them. But for the ones that draw — the plots, the
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
- **Slots and children.** `notatio-manipulate` and `notatio-tangle` wrap light-DOM
  children whose attributes carry `_name` wildcards; a wrapper passes its default slot
  straight through. `captureTemplates` reads attributes _and_ properties, so a child
  written as `<Plot :value="…">` inside a `<Manipulate>` is captured the same as a raw
  element — that path is already exercised by VitePress's property-setting.

## 3. Symbols as expressions that draw

The other end. Today an expression renders through `<notatio-output>`, which typesets
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
| `TraditionalForm(e)`, `InputForm(e)`, … (`WRAPPER_HEADS`) | `<notatio-output form=…>` of `e`                               |
| anything else                                             | `<notatio-output>` — typeset                                   |

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
- **Other renderers.** A tree of `Cell`, `Plot`, `Manipulate`, `Histogram` is a small
  interface description, and nothing about it is the DOM's. The same tree could render
  in a terminal (the REPL already has `notatio-terminal`'s host side) or natively on
  mobile, with a different set of components behind the same symbols. An experiment, not
  a plan — but it only works if the symbols are the interface, which is the alignment
  argument again.
- **Fewer symbols.** Once a component is a symbol, every component that exists without
  one is a question: which symbol should it be? `notatio-worksheet`, `notatio-figure`,
  `notatio-code`, `notatio-terminal` (component-naming §4, "represents no single
  symbol") either take an existing symbol or justify a new one, and the pressure runs
  toward reuse — the same discipline `design/symbols.md` applies to heads.

## 4. Multiplexing: the same answer at both ends

Component-naming §5 flags four components that multiplex several symbols behind an
attribute: `notatio-chart` (`type`: `BarChart`, `Histogram`, `PieChart`, …),
`notatio-graphplot`, `notatio-vectorplot`, `notatio-figure`. The question there was
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

## 5. Renames recorded here

Two of component-naming §4's rows are **agreed** (2026-09-14) rather than proposed:
`notatio-output` → `notatio-out` and `notatio-input` → `notatio-in`, aligning with the
`Out` and `In` symbols the elements already print as their row labels. They go first when
§6 executes; the Vue mirrors are `<Out>` and `<In>`. Component-naming remains the queue
for tags (the census `RENAME_QUEUE` holds engine heads only, by its own rule).

## 6. What it would need

1. **The renames** (component-naming §6), so head→tag is a function.
2. **An argument map per visual head** — where argument positions land as attributes; the
   natural place to _declare_ the heads too (`Plot`, `Manipulate`, `Chart` are not
   declared today; a REPL cannot hold them). Inert declarations with signatures are a
   prerequisite and independent of everything else here.
3. **`notatio-output` deferring to the head's component** for a visual head, so an Out
   that evaluates to `Plot(…)` draws. This is a web-component concern, so it works
   everywhere the elements do; the cost is `output` depending on every plot element,
   which is the price of "evaluation returns a picture".
4. **The wrapper generator** in `components.ts` (Vue first, React the same loop),
   emitting into the build, registering in the theme; `Cell.vue` retires into it.
5. **The `Chart` family head** with its autochoosing rule, as the test case for §4.

## 7. Open questions

- **Argument conventions.** Wolfram's `{x, 0, 10}` iterator is our `(x, 0, 10)` tuple
  (InputForm already prints `Integrate` bounds that way); options (`PlotRange -> …`) have
  no notatio spelling yet — Epsil's `a -> b` is a `KeyValuePair`, not Wolfram's `Rule`,
  and the elements take attributes. Whether a `Plot` head takes options as trailing pairs
  or as a settings record is the same question the worksheet's `\mathsf{…}` settings
  namespace answered one way.
- **Which symbol for the symbol-less components.** `Cell` is Wolfram's (a notebook
  cell), so `notatio-cell` is aligned after all and the wrapper is rightly `<Cell>`.
  `notatio-worksheet` has no Wolfram name; `Notebook` is taken by our notebook.
  `notatio-figure`'s eleven glyphs are the hardest case — a `Figure(kind, …)` family
  head is the §4 answer, if the glyphs are worth a symbol at all.
- **Hints for the family heads.** What `Chart` can be told — a preferred type, an axis
  mapping — and whether that is the same hint slot `notatio-chart`'s attributes are.
