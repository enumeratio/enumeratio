# Design: the AST as a vdom

Status: **landed** (structural tree, frameworks, generics, options; 2026-09-16). Companion to
[components-and-symbols.md](./components-and-symbols.md): that note says a symbol and its
component are the same thing seen from two ends; this one writes out what the tree
looks like from the component end, so the shape can be judged before anything is built.

A vdom node is `{ tag, props, children }`. A MathJSON node is `[head, ...args]`. The
claim is that these are the same tree under a renaming -- `tag` is `notatio-` + the
head, kebab-cased; `children` are the arguments -- and that the interesting part is not
the renaming but the **lowering**: where a component has an API of its own (a plot's
`domain`), some arguments become props, and where a variable is declared by a control,
the rest of the tree reads it as a wildcard.

Two trees appear below for each example:

- **structural** -- the AST verbatim as a vdom. Every head is a tag, every argument a
  child, atoms are the leaf tags Wolfram uses (`Integer`, `Real`, `String`, `Symbol`).
  Nothing is lost; nothing is interpreted.
- **realized** -- what actually draws: `renderingOf` today. A head with a component of its
  own has its arguments lowered into that component's props; a head without one wraps
  itself in `<notatio-out>` and typesets; a tree with controls in it gets a scope.

`h(tag, props, children)` below is any framework's: Vue's `h`, React's `createElement`,
Lit's `html` by way of `unsafeStatic`.

## 1. A plain application: `Binomial(n, 2)`

MathJSON: `["Binomial", "n", 2]`

Structural:

```js
h("notatio-binomial", {}, [h("notatio-symbol", {}, "n"), h("notatio-integer", {}, "2")]);
```

Realized -- there is no component for `Binomial`, so the root typesets the whole and the
inner tags are structure (`display: contents`):

```js
h("notatio-binomial", {}, [h("notatio-symbol", {}, "n"), h("notatio-integer", {}, "2")]);
// which renders, inside itself, the equivalent of
h("notatio-out", { format: "mathjson", value: '["Binomial","n",2]' });
```

The rule for a **generic** element (one generated per symbol, no hand-written class):
its `expression` is its head over its children's `expression`s; a text child is notatio
(so `<notatio-binomial>n, 2</notatio-binomial>` is the short spelling of the same); only
the outermost generic element typesets. Pseudo-Vue:

```vue
<Binomial><Symbol>n</Symbol><Integer>2</Integer></Binomial>
<!-- or -->
<Binomial>n, 2</Binomial>
```

## 2. Nesting: `Sin(x)^2 + 1`

MathJSON: `["Add", ["Power", ["Sin", "x"], 2], 1]`

Structural:

```js
h("notatio-add", {}, [
  h("notatio-power", {}, [
    h("notatio-sin", {}, [h("notatio-symbol", {}, "x")]),
    h("notatio-integer", {}, "2"),
  ]),
  h("notatio-integer", {}, "1"),
]);
```

Realized: identical -- none of these heads draws. The `notatio-add` at the root typesets
`\sin^2 x + 1`; the tree under it is the expression's own shape, addressable (a hover
on the `notatio-sin` could highlight the `\sin x` in the typeset output, which is the
TreeForm folding `<notatio-out>` does today, but from the other end).

## 3. A head with a component: `Plot(Sin(k x), (x, 0, 10))`

MathJSON: `["Plot", ["Multiply", "k", ["Sin", "x"]]…, ["Tuple", "x", 0, 10]]`

Structural:

```js
h("notatio-plot", {}, [
  h("notatio-sin", {}, [
    h("notatio-multiply", {}, [h("notatio-symbol", {}, "k"), h("notatio-symbol", {}, "x")]),
  ]),
  h("notatio-tuple", {}, [
    h("notatio-symbol", {}, "x"),
    h("notatio-integer", {}, "0"),
    h("notatio-integer", {}, "10"),
  ]),
]);
```

Realized -- `Plot` has a component whose API is attributes, so its arguments are
**lowered** into props (this is `VISUAL_SYMBOLS` in `symbols.ts`):

```js
h("notatio-plot", { value: "Sin(k * x)", var: "x", domain: "0,10" });
```

Pseudo-Vue, both spellings:

```vue
<Plot value="Sin(k * x)" var="x" domain="0,10" />
<!-- or, structurally -->
<Plot><Sin><Multiply>k, x</Multiply></Sin><Tuple>x, 0, 10</Tuple></Plot>
```

The second spelling is the one every generic element already has; a built component
supports it because the element adopts its structural children (`structure.ts` in
`notatio-lit`) -- the same lowering, applied by the element to its own children instead
of by `renderingOf` to the AST. One map, used from both sides. A head with a fixed
signature also takes its arguments by name, from the reference entry's parameters:
`<Binomial n="5" k="2" />`.

### Options

Options are Wolfram's rules, and the rules are Wolfram's: `PlotRange -> (-1, 1)` after
the positional arguments, singly or in (nested) lists, flattened, the **leftmost**
setting of a name winning (`OptionsPattern`). The expression is never rewritten to
hold them -- no dictionary form; a `[K -> v]` list stays a list of `KeyValuePair` (or
the `Tuple` the engine canonicalises a symbol-keyed pair to). `optionsOf` in `formats`
reads them off; `withOptions` writes them back.

In the vdom an option is a prop, kebab-cased: `PlotRange -> (-1, 1)` is
`h("notatio-plot", { "plot-range": "-1,1" })`. An option whose value has a rendering of
its own is a slotted child instead, `slot` naming the option; one whose value is a
graphics primitive (`Epilog -> Point((1, 0.5))`) travels as its notatio text, since it
is marks on the plot's own axes rather than a picture of its own. A component that
spells an option differently (`PlotLabel` is the plot's `label`) maps it in
`VisualSymbol.options`; an element's own attributes are its options too, read back by
name (`plot-range` on the element is `PlotRange` on the expression).

```vue
<Plot value="Sin(x)" var="x" domain="0,10" plot-range="-1,1" epilog="Point((1, 0.5))" />
<!-- or, structurally -->
<Plot plot-range="-1,1" epilog="Point((1, 0.5))"><Sin>x</Sin><Tuple>x, 0, 10</Tuple></Plot>
```

## 4. Controls and a scope: `Row([Slider((k, 2), (0, 5)), Dynamic(k^2)])`

MathJSON: `["Row", ["List", ["Slider", ["Tuple", "k", 2], ["Tuple", 0, 5]], ["Dynamic", ["Power", "k", 2]]]]`

Structural:

```js
h("notatio-row", {}, [
  h("notatio-list", {}, [
    h("notatio-slider", {}, [
      h("notatio-tuple", {}, [h("notatio-symbol", {}, "k"), h("notatio-integer", {}, "2")]),
      h("notatio-tuple", {}, [h("notatio-integer", {}, "0"), h("notatio-integer", {}, "5")]),
    ]),
    h("notatio-dynamic", {}, [
      h("notatio-power", {}, [h("notatio-symbol", {}, "k"), h("notatio-integer", {}, "2")]),
    ]),
  ]),
]);
```

Realized -- three lowerings at once. The slider's arguments become its props. The `List`
inside `Row` is spread into the row's children. And because a control **declares** `k`,
every other read of `k` becomes the wildcard `_k`, and the whole is wrapped in a scope:

```js
h("notatio-dynamic-module", {}, [
  h("notatio-row", {}, [
    h("notatio-slider", { name: "k", value: "2", min: "0", max: "5" }),
    h("notatio-dynamic", { value: "_k ^ 2" }),
  ]),
]);
```

Pseudo-Vue:

```vue
<DynamicModule>
  <Row>
    <Slider name="k" value="2" min="0" max="5" />
    <Dynamic value="_k ^ 2" />
  </Row>
</DynamicModule>
```

This is where the two trees differ most, and deliberately: the structural tree has no
`_k` and no `DynamicModule` -- those are the _realization_ of "a control binds a variable", and
they belong to the renderer, not to the expression. An author writing markup by hand
writes the realized form (as the playground pages do); an author writing an expression
never sees it.

## 5. `Manipulate(Plot(Sin(a x), (x, 0, 10)), (a, 1, 5))`

Realized (as today):

```js
h("notatio-manipulate", { params: "{a, 1, 5}" }, [
  h("notatio-plot", { value: "Sin(_a * x)", var: "x", domain: "0,10" }),
]);
```

The same shape as §4 with `Manipulate` playing `DynamicModule`: the trailing tuples are the
declarations, the body is the child, the body's `a` is `_a`. A `Manipulate` _is_ a scope
with a control strip; the general form in §4 is the scope without the strip.

## 6. Data: `[1, 2, 3]` and `Histogram([1, 2, 2, 3])`

Structural: `h("notatio-list", {}, [h("notatio-integer", {}, "1"), …])`.

Realized for the bare list: the same, typeset as `[1, 2, 3]`. Realized for the
histogram: `h("notatio-chart", { type: "histogram", data: "[1,2,2,3]" })` -- the data is
lowered into one JSON prop, since the chart's API takes it that way and a thousand
`notatio-integer` children would be a thousand elements for one array.

## Three things the examples raised

**`_k` is notatio, not LaTeX and not a regex.** `<Dynamic value="_k ^ 2" />` is right as
written: the attribute is notatio (Epsil), and `_k` is Epsil's wildcard -- compute-engine's
slot notation, the same `_` the pattern matcher uses. LaTeX is what goes in `$…$` islands
(`value="$\sin(kx)$"`), and a wildcard can sit inside one too. The renderer writes `_k`
where a control declares `k`; an author writes it by hand. What the rule _does_ insist on
is that anything LaTeX be fenced, which is the subset of Epsil the site already uses.

**Atoms take `value`, and so does everything else.** `<Integer value="2" />` rather than
`<Integer>2</Integer>` -- `value` is the text the symbol's constructor takes: an atom's
literal, and for any other head the whole expression as notatio. Children are the other
spelling, the argument form. Both are accepted by every generic element, and `value` is
what a scope reads and writes, so it is also how a generic element becomes a template:
the outermost publishes its children's expression as `value`, and a `_k` in it follows a
knob. This generalises to any carrier with a text representation it can serialise.

**The `<DynamicModule>` is for isolation, not for binding.** The page is a scope: a control and
a readout with no wrapper find each other through it, and a page assembled by a
framework binds as it mounts. A dynamic module (or a Manipulate) is an explicit scope over its
subtree, for the case that matters on a page of examples -- two of them each calling
their knob `n`. `renderingOf` still wraps an expression that declares controls in one,
since an expression is self-contained by intent; hand-written markup needs none.

## Where the lowering lives

Only in the elements. `notatio/vue` and `notatio/react` render `structuralOf` and
nothing else: heads to tags, arguments to children, options to props. A `<Plot>` that
reaches the DOM with a `<Sin>` inside it is lowered by `<notatio-plot>` when it adopts
its children (`structure.ts`), and a `<Dynamic>` beside a `<Slider>` reads the slider's
name as a wildcard through the same step. The frameworks know no component's API, and
adding one is a change to one table in the base.

## What the examples say

1. **Children are arguments, props are options -- or, for a fixed signature, named
   arguments.** The structural tree carries an option as a prop, an argument as a child
   (or an atom's `value`); a component's own API only appears when the element lowers.
   Every other attribute on a generic element is an option.
2. **The lowering is one table, read from two sides.** `renderingOf` applies it to an
   AST; a component reading its own children applies it to markup. Neither needs to
   know about the other.
3. **Scopes are realization, not structure.** `DynamicModule` and `_k` never appear in an
   expression; the renderer adds them where a control declares a variable.
4. **Atoms are leaf tags in the generated tree and text or `value` in the hand-written
   one.** `<Integer value="2" />` is the constructor spelling; `2` inside a parent's
   argument text is what a person types.
5. **Only the outermost generic element typesets.** Inner ones are structure with
   `display: contents`; they exist so the tree is addressable, not so each draws.

## The packages

Two, split along the dependency that matters:

| package                   | what                                                                                                                                                                                                                     | depends on              |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| `@enumeratio/notatio`     | the base: `symbols.ts` (head → tag, the lowering), `vdom.ts`, the control contract, the arithmetic of scrubbing and playback, the pure SVG renderers, the shared engine; and the framework glue at `./vue` and `./react` | compute-engine, formats |
| `@enumeratio/notatio-lit` | every `notatio-*` element, the DOM half of the contract (`define.ts`), structural adoption, the frame loops, bindings, styles, popovers, MathLive, xterm                                                                 | notatio, lit, mathlive  |

The base has no UI framework and no DOM at import; the CLI draws through it in Node.
`./vue` and `./react` are subpaths, so they cost nothing unless imported, and `vue` /
`react` are optional peers: each is `<Notatio expr>` over `structuralOf` and
`toVNode(h)` plus the generated per-symbol wrappers (`<Slider>`, `<Plot>`,
`<Binomial>`), sixty lines of glue that name the elements without registering them --
a page imports `@enumeratio/notatio-lit` once for that. The vue and react packages of
the first split (2026-09-16) folded back the same day: they had no dependency of their
own to justify a package. The lit package stays separate because MathLive and xterm
are heavy and DOM-only, and a Node consumer must not install them.

## Where it is

- `vdom.ts` in the base: `structuralOf(expr)` for the verbatim tree and `toVNode(h)`
  over it; `vue.ts` and `react.ts` are each a `<Notatio expr>` over those, and
  `generate.ts` the per-symbol wrapper generator, so both frameworks get `<Slider>`,
  `<Plot>`, `<Binomial>`.
- `options.ts` in `formats`: `optionsOf` / `withOptions`; `lowerOptions` and
  `VisualSymbol.options` in the base's `symbols.ts`; `primitives.ts` for what `Epilog`
  carries.
- Generic elements in `notatio-lit` (`generic.ts`): one class per head in the base's
  `HEADS` (`heads-data.ts`, collected from the engine's symbols, the reference entries
  and the drawing heads, with `PARAMS` for the fixed signatures), registered at its tag
  unless a hand-written element owns it; `expression` from `value`, the children or the
  named attributes; only the outermost typesets. `structure.ts` adopts the same
  spelling on the hand-written components.
- The page scope (`scope.ts`): `<notatio-dynamic-module>` and the page share one `Scope`; the
  page's re-reads merge, since an applied template has its result where its wildcard
  was.
