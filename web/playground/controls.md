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
