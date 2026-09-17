# Controls

Wolfram's [`Control`](https://reference.wolfram.com/language/ref/Control.html) family,
one component per symbol: a tag is `notatio-` plus the symbol, kebab-cased. Every
control has a `name`, publishes a value, and fires `notatio-control-change` when it
moves — so a `<notatio-tangle>` or a `<notatio-manipulate>` binds any of them the same
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
<notatio-tangle>
<notatio-slider name="k" value="2" min="0" max="10" step="0.5" readout play /> so
<notatio-dynamic value="_k^2" /> is its square.
</notatio-tangle>
</Story>

<Story
  title="Animator and VerticalSlider">
<template #description>
An <code>Animator</code> is a slider that plays by default and cycles; a
<code>VerticalSlider</code> stands up and takes up/down.
</template>
<notatio-tangle>
<notatio-animator name="t" value="0" min="0" max="6.28" step="0.05" interval="40" />
<notatio-vertical-slider name="h" value="3" min="0" max="10" step="1" readout />
sin t = <notatio-dynamic value="N(Sin(_t))" digits="3" />, h = <notatio-dynamic value="_h" />
</notatio-tangle>
</Story>

<Story
  title="Slider2D">
<template #description>
<code>Slider2D</code>: a point on a square. The binding is the list <code>[x, y]</code>
— or a complex number with <code>complex</code>, so a knob's two axes and a pad's are the
same thing.
</template>
<notatio-tangle>
<notatio-slider-2d name="p" value="0.3,0.6" min="0,0" max="1,1" step="0.01" readout />
<notatio-slider-2d name="z" value="1+1i" min="-2,-2" max="2,2" step="0.1" complex readout />
|z| = <notatio-dynamic value="N(Abs(_z))" digits="3" />, p = <notatio-dynamic value="_p" digits="2" />
</notatio-tangle>
</Story>

<Story
  title="IntervalSlider">
<template #description>
Two thumbs that cannot cross; the binding is <code>[lo, hi]</code>.
</template>
<notatio-tangle>
<notatio-interval-slider name="r" value="1,3" min="0" max="5" step="0.5" readout />
width <notatio-dynamic value="At(_r, 2) - At(_r, 1)" />
</notatio-tangle>
</Story>

## Choices

<Story
  title="SetterBar and RadioButtonBar">
<template #description>
One entry down. Entries are <code>|</code>-separated and may be
<code>value -> label</code>; a value that looks like mathematics is typeset.
</template>
<notatio-tangle>
<notatio-setter-bar name="p" values="2|3|5|7" /> is prime;
<notatio-radio-button-bar name="q" values="1 -> one|2 -> two|3 -> three" value="2" />
and their product is <notatio-dynamic value="_p * _q" />.
</notatio-tangle>
</Story>

<Story
  title="TogglerBar and ListPicker">
<template #description>
Any number down; the binding is the <code>List</code> of selected values.
<code>ListPicker</code> shows the entries as a list, <code>single</code> allows one.
</template>
<notatio-tangle>
<notatio-toggler-bar name="s" values="1|2|3|4|5" value="1|3" />
sums to <notatio-dynamic value="Sum(_s)" />;
<notatio-list-picker name="L" values="2|3|5|7|11|13" value="3|5" rows="4" />
has <notatio-dynamic value="Length(_L)" /> picked.
</notatio-tangle>
</Story>

<Story
  title="PopupMenu">
<notatio-tangle>
<notatio-popup-menu name="n" values="4 -> square|5 -> pentagon|6 -> hexagon|8 -> octagon" value="6" />
has interior angles of <notatio-dynamic value="180 - 360/_n" /> degrees.
</notatio-tangle>
</Story>

<Story
  title="Toggler, Checkbox">
<template #description>
A <code>Toggler</code> with no entries is a switch between <code>False</code> and
<code>True</code>; with entries it cycles them on click and opens them on a long press.
A <code>Checkbox</code> binds <code>True</code>/<code>False</code> too.
</template>
<notatio-tangle>
<notatio-toggler name="on" /> <notatio-checkbox name="c" value="True" label="checked" />
<notatio-toggler name="size" values="a few|several|many" />
— on: <notatio-dynamic value="_on" />, c: <notatio-dynamic value="_c" />, size: <notatio-dynamic value="_size" />
</notatio-tangle>
</Story>

## Others

<Story
  title="Locator on a plot">
<template #description>
A <code>Locator</code> is a point <em>on</em> the picture: drag it, and the binding is
where it is in the plot's own coordinates.
</template>
<notatio-tangle>
<notatio-plot value="Sin(x)" domain="-6.283,6.283" grid>
<notatio-locator name="p" value="1,0.5" />
</notatio-plot>
The dot is at <notatio-dynamic value="_p" digits="3" />.
</notatio-tangle>
</Story>

<Story
  title="InputField and ColorSlider">
<template #description>
An <code>InputField</code> binds whatever notatio you type, on Enter; a
<code>ColorSlider</code> binds <code>RGBColor(r, g, b)</code>.
</template>
<notatio-tangle>
<notatio-input-field name="f" value="Sin(x)" size="12" /> squared is
<notatio-dynamic value="Expand((_f)^2)" />;
<notatio-color-slider name="c" value="#3451b2" /> is <notatio-dynamic value="_c" digits="2" />.
</notatio-tangle>
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
which `<notatio-out>` draws as a tangle. `Row`, `Column`, `Grid`, `Panel` and
`Labeled` arrange; a string is text; anything else is a readout. An entry of a
choice list may be `Labeled(value, "label")`.

<Story
  title="An interface as an expression">
<template #description>
The same thing a cell could evaluate to, or the REPL could hold: no markup, just the
symbols the engine knows.
</template>
<notatio-out format="notatio" value='Row([Slider((k, 2), (0, 5, 0.5)), "so", Dynamic(k^2)])' />
</Story>

<Story
  title="A panel of controls and a plot">
<notatio-out format="notatio" value='Column([Panel(Grid([[Labeled(Slider((a, 1), (0.2, 2, 0.1)), "amplitude"), Labeled(SetterBar((k, 2), [1, 2, 3, 5]), "frequency")]])), Plot(a * Sin(k * x), (x, -6.283, 6.283))])' />
</Story>

<Story
  title="Every kind, in one grid">
<notatio-out format="notatio" value='Grid([[Checkbox((on, True)), Toggler(size, ["a few", "several", "many"]), PopupMenu((n, 6), [Labeled(4, "square"), Labeled(6, "hexagon"), Labeled(8, "octagon")])], [on, size, 180 - 360/n]])' />
</Story>

## In Vue

The same trees, from the template side. Every symbol is a Vue component
(`<Slider>`, `<Row>`, `<Dynamic>` — from `@enumeratio/notatio-vue`, generated from the
element sources), and `<Notatio expr>` renders an expression as the vdom it is —
`vdomOf` in the base package, handed to Vue's `h`. `structural` draws the expression
verbatim: every head a tag, every argument a child.

<Story
  title="The symbols as components">
<Tangle>
<Row>
<Slider name="k" :min="0" :max="5" :step="0.5" value="2" readout />
<Dynamic value="_k ^ 2" />
</Row>
</Tangle>
</Story>

<Story
  title="An expression, as a vdom">
<Notatio expr='Row([Slider((k, 1), (0, 5, 0.5)), "squared is", Dynamic(k^2)])' />
</Story>

<Story
  title="The structural tree">
<template #description>
Nothing interpreted: <code>Sin(x)^2 + 1</code> as its own tags. Inspect the DOM.
</template>
<Notatio expr="Sin(x)^2 + 1" structural />
</Story>

## Every symbol, and no wrapper

Every head the engine knows is an element, `notatio-` plus its name: the ones that
draw or control have components of their own, and the rest are **generic** — a
`<notatio-binomial>` typesets `Binomial(…)`, its arguments its children (or its
`value`, the text the symbol's constructor takes). And the page is itself a scope: a
control and a readout with no `<notatio-tangle>` around them still find each other;
the wrapper is for isolation, when two examples reuse a name.

<Story
  title="Generic elements">
<template #description>
No component was written for <code>Binomial</code>, <code>Sqrt</code> or
<code>Add</code>. The outermost typesets; the ones inside are structure.
</template>
<p>
<notatio-binomial>n, 2</notatio-binomial>,
<notatio-sqrt><notatio-add><notatio-power>x, 2</notatio-power><notatio-integer value="1" /></notatio-add></notatio-sqrt>,
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
<notatio-slider name="m" value="4" min="0" max="10" step="1" readout /> choose 2 is
<notatio-binomial evaluate>_m, 2</notatio-binomial>, and squared it is
<notatio-dynamic value="_m^2" />.
</p>
</Story>
