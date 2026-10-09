---
order: 9
---

# Controls

Wolfram's [`Control`](https://reference.wolfram.com/language/ref/Control.html) family,
one component per kind: a control is the element of its box, `<slider-box>` for
`Slider` and `VerticalSlider`, `<setter-box>` for `SetterBar`. Every
control has a `name`, publishes a value, and fires `notatio-control-change` when it
moves — so a `<dynamic-module-box>` or a `<notatio-manipulate>` binds any of them the same
way, and a template that mentions `_name` follows. The controls that iterate a span
(sliders, togglers, an animator) share the knob's gears, keyboard, `play` and `loop`.

## Sliders

<Story
  title="Slider">
<template #description>
<code>Slider</code>. Drag the thumb; the arrows step it in gears — Shift coarse, Alt
fine, held arrows accelerate. <code>readout</code> shows the value. Space on the
focused thumb sweeps it; <code>play</code> adds the button.
</template>
<dynamic-module-box>
<slider-box name="k" value="2" min="0" max="10" step="0.5" readout play /> so
<dynamic-box value="_k^2" /> is its square.
</dynamic-module-box>
</Story>

<Story
  title="Animator and VerticalSlider">
<template #description>
An <code>Animator</code> is a slider that plays by default and cycles; a
<code>VerticalSlider</code> stands up and takes up/down.
</template>
<dynamic-module-box>
<animator-box name="t" value="0" min="0" max="6.28" step="0.05" interval="40" />
<slider-box axis="y" name="h" value="3" min="0" max="10" step="1" readout />
sin t = <dynamic-box value="N(Sin(_t))" digits="3" />, h = <dynamic-box value="_h" />
</dynamic-module-box>
</Story>

<Story
  title="Slider2D">
<template #description>
<code>Slider2D</code>: a point on a square. The binding is the list <code>[x, y]</code>
— or a complex number with <code>complex</code>, so a knob's two axes and a pad's are the
same thing.
</template>
<dynamic-module-box>
<slider-2d-box name="p" value="0.3,0.6" min="0,0" max="1,1" step="0.01" readout />
<slider-2d-box name="z" value="1+1i" min="-2,-2" max="2,2" step="0.1" complex readout />
|z| = <dynamic-box value="N(Abs(_z))" digits="3" />, p = <dynamic-box value="_p" digits="2" />
</dynamic-module-box>
</Story>

<Story
  title="IntervalSlider">
<template #description>
Two thumbs that cannot cross; the binding is <code>[lo, hi]</code>.
</template>
<dynamic-module-box>
<notatio-interval-slider name="r" value="1,3" min="0" max="5" step="0.5" readout />
width <dynamic-box value="At(_r, 2) - At(_r, 1)" />
</dynamic-module-box>
</Story>

## Choices

<Story
  title="SetterBar and RadioButtonBar">
<template #description>
One entry down. Entries are <code>|</code>-separated and may be
<code>value -> label</code>; a value that looks like mathematics is typeset.
</template>
<dynamic-module-box>
<setter-box name="p" values="2|3|5|7" /> is prime;
<notatio-radio-button-bar name="q" values="1 -> one|2 -> two|3 -> three" value="2" />
and their product is <dynamic-box value="_p * _q" />.
</dynamic-module-box>
</Story>

<Story
  title="TogglerBar and ListPicker">
<template #description>
Any number down; the binding is the <code>List</code> of selected values.
<code>ListPicker</code> shows the entries as a list, <code>single</code> allows one.
</template>
<dynamic-module-box>
<notatio-toggler-bar name="s" values="1|2|3|4|5" value="1|3" />
sums to <dynamic-box value="Sum(_s)" />;
<notatio-list-picker name="L" values="2|3|5|7|11|13" value="3|5" rows="4" />
has <dynamic-box value="Length(_L)" /> picked.
</dynamic-module-box>
</Story>

<Story
  title="PopupMenu">
<dynamic-module-box>
<popup-menu-box name="n" values="4 -> square|5 -> pentagon|6 -> hexagon|8 -> octagon" value="6" />
has interior angles of <dynamic-box value="180 - 360/_n" /> degrees.
</dynamic-module-box>
</Story>

<Story
  title="Toggler, Checkbox">
<template #description>
A <code>Toggler</code> with no entries is a switch between <code>False</code> and
<code>True</code>; with entries it cycles them on click and opens them on a long press.
A <code>Checkbox</code> binds <code>True</code>/<code>False</code> too.
</template>
<dynamic-module-box>
<toggler-box name="on" /> <checkbox-box name="c" value="True" label="checked" />
<toggler-box name="size" values="a few|several|many" />
— on: <dynamic-box value="_on" />, c: <dynamic-box value="_c" />, size: <dynamic-box value="_size" />
</dynamic-module-box>
</Story>

## Others

<Story
  title="Locator on a plot">
<template #description>
A <code>Locator</code> is a point <em>on</em> the picture: drag it, and the binding is
where it is in the plot's own coordinates.
</template>
<dynamic-module-box>
<notatio-plot value="Sin(x)" domain="-6.283,6.283" grid>
<notatio-locator name="p" value="1,0.5" />
</notatio-plot>
The dot is at <dynamic-box value="_p" digits="3" />.
</dynamic-module-box>
</Story>

<Story
  title="InputField and ColorSlider">
<template #description>
An <code>InputField</code> binds whatever Epsil you type, on Enter; a
<code>ColorSlider</code> binds <code>RGBColor(r, g, b)</code>.
</template>
<dynamic-module-box>
<input-field-box name="f" value="Sin(x)" size="12" /> squared is
<dynamic-box value="Expand((_f)^2)" />;
<notatio-color-slider name="c" value="#3451b2" /> is <dynamic-box value="_c" digits="2" />.
</dynamic-module-box>
</Story>

## In a Manipulate

<Story
  title="ControlType">
<template #description>
A parameter picks its control from its range — a slider, a short list a setter bar, a
long one a popup menu — unless a trailing symbol names one, Wolfram's
<code>ControlType</code>.
</template>
<notatio-manipulate v-pre params="{ {k, 2}, 1, 5, 1, Knob}; {a, {0.5, 1, 2}}; {m, {1, 2, 3, 4, 5, 6, 7}, PopupMenu}">
<notatio-plot value="_a * Sin(_k * x) + _m" domain="-6.283,6.283" />
</notatio-manipulate>
</Story>

## As expressions

A control is a symbol, so an interface is an expression. The controls' variables are
declared where the control is — `Slider(k, (0, 5))`, or `Slider((k, 2), (0, 5))` to
say where it starts — and read as wildcards everywhere else in the same expression,
which `<notatio-out>` draws as a dynamic module. `Row`, `Column`, `Grid`, `Panel` and
`Labeled` arrange; a string is text; anything else is a readout. An entry of a
choice list may be `Labeled(value, "label")`.

<Story
  title="An interface as an expression">
<template #description>
The same thing a cell could evaluate to, or the REPL could hold: no markup, just the
symbols the engine knows.
</template>
<notatio-out format="epsil" value='Row([Slider((k, 2), (0, 5, 0.5)), "so", Dynamic(k^2)])' />
</Story>

<Story
  title="A panel of controls and a plot">
<notatio-out format="epsil" value='Column([Panel(Grid([[Labeled(Slider((a, 1), (0.2, 2, 0.1)), "amplitude"), Labeled(SetterBar((k, 2), [1, 2, 3, 5]), "frequency")]])), Plot(a * Sin(k * x), (x, -6.283, 6.283))])' />
</Story>

<Story
  title="Every kind, in one grid">
<notatio-out format="epsil" value='Grid([[Checkbox((on, True)), Toggler(size, ["a few", "several", "many"]), PopupMenu((n, 6), [Labeled(4, "square"), Labeled(6, "hexagon"), Labeled(8, "octagon")])], [on, size, 180 - 360/n]])' />
</Story>

## Options

Options are Wolfram's: rules after the positional arguments, `PlotRange -> (-1, 1)`,
singly or in lists, the leftmost setting of a name winning. On an element they are
attributes — `plot-range`, or the name a component already has (`PlotLabel` is the
plot's `label`) — and one whose value is something to draw, like `Epilog`, is
carried the same way, as the Epsil it was.

<Story
  title="Options as rules, and as attributes">
<template #description>
The expression and the element say the same thing; <code>Epilog</code> marks the
plot with a graphics primitive.
</template>
<notatio-out format="epsil" value='Plot(Sin(x), (x, 0, 10), PlotRange -> (-1.5, 1.5), PlotLabel -> "sine", Epilog -> [Point((1.5, 1)), Line([(0, 0), (10, 0)])])' />
<notatio-plot value="Sin(x)" var="x" domain="0,10" plot-range="-1.5,1.5" label="sine" epilog="[Point((1.5, 1)), Line([(0, 0), (10, 0)])]" />
</Story>

## Structure, not attributes

A built component can also be written the way its expression reads: the arguments
as children, the options as attributes in Wolfram's names. The element lowers them
itself — `<notatio-plot>` holding a `<notatio-sin>` and a `<notatio-tuple>` is
`Plot(Sin(x), (x, 0, 10))` — so a framework that hands the DOM an expression's tree
needs to know nothing about the components. A head with a fixed signature takes its
arguments by name too: `<notatio-binomial n="5" k="2">`.

<Story
  title="A plot, structurally">
<notatio-plot plot-range="-1,1" grid-lines="true">
<notatio-sin>x</notatio-sin>
<notatio-tuple>x 0 10</notatio-tuple>
</notatio-plot>
</Story>

<Story
  title="Named arguments">
<p>
<notatio-binomial n="5" k="2" evaluate />, and
<notatio-fibonacci n="10" evaluate />.
</p>
</Story>

## As a vdom

The same trees, written structurally: every head a tag, every argument a child (a run of
atoms as text, `k 1`), every option an attribute — `structuralOf` in the base package, and
what an expression's component form is. The elements do the rest, lowering their own
children; a layout (`Row`, `Grid`, …) is boxes, drawn as plain DOM around its entries.

<Story
  title="The realized tree">
<dynamic-module-box>
<row-box data-head="Row">
<slider-box name="k" min="0" max="5" step="0.5" value="2" readout></slider-box>
<dynamic-box value="_k ^ 2"></dynamic-box>
</row-box>
</dynamic-module-box>
</Story>

<Story
  title="A plot with options, as a vdom">
<notatio-plot plot-range="(-1, 1)" epilog="Point((1.5, 1))"><notatio-sin>x</notatio-sin><notatio-tuple>x 0 10</notatio-tuple></notatio-plot>
</Story>

## As markup

The same form without the `notatio-` prefix is markup a page can hold: FullForm written as
JSX, read at build and shown as its value. A head's tag in a sentence is inline,
<Binomial>10 3</Binomial> or <Fibonacci n="20" /> (a slot naming a parameter takes its
place), and `<ToExpression value="…" />` holds Epsil: <ToExpression value="Sum(1/k^2, (k, 1, 4))" />.
On lines of its own, it is displayed:

<HurwitzZeta s="3">
  <Divide>1 2</Divide>
</HurwitzZeta>

### From a library

A published library's symbols are written the same way, by their qualified name. The page
fetches [enumeratio/library-template](https://github.com/enumeratio/library-template) the first
time an expression names one of its symbols, checks its examples, and declares it:
<enumeratio.PolygonalNumber sides="5">4</enumeratio.PolygonalNumber> is the fourth pentagonal
number, and the fourth square pyramidal number is

<notatio-cell value="enumeratio.PyramidalNumber(4, 4)" />

## Every symbol, and no wrapper

Every head the engine knows is an element, `notatio-` plus its name: the ones that
draw or control have components of their own, and the rest are **generic** — a
`<notatio-binomial>` typesets `Binomial(…)`, its arguments its children (or its
`value`, the text the symbol's constructor takes). And the page is itself a scope: a
control and a readout with no `<dynamic-module-box>` around them still find each other;
the wrapper is for isolation, when two examples reuse a name.

<Story
  title="Generic elements">
<template #description>
No component was written for <code>Binomial</code>, <code>Sqrt</code> or
<code>Add</code>. The outermost typesets; the ones inside are structure.
</template>
<p>
<notatio-binomial>n 2</notatio-binomial>,
<notatio-sqrt><notatio-add><notatio-power>x 2</notatio-power> 1</notatio-add></notatio-sqrt>,
<notatio-integer value="42" />, <notatio-string value="a string" />.
</p>
</Story>

<Story
  title="The page as the scope">
<template #description>
No tangle: the slider is named <code>m</code> nowhere else on this page, so the page
scope binds it to the readout and to the generic element beside it.
</template>
<p>
<slider-box name="m" value="4" min="0" max="10" step="1" readout /> choose 2 is
<notatio-binomial evaluate>_m 2</notatio-binomial>, and squared it is
<dynamic-box value="_m^2" />.
</p>
</Story>
