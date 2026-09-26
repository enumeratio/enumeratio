# Manipulate

A generic, Wolfram-style [`Manipulate`](https://reference.wolfram.com/language/ref/Manipulate.html),
rendered by `<notatio-manipulate>`. It shows a slider (or setter) per parameter
and re-binds those parameters into **any** slotted content: every descendant
attribute that is an **expression** carrying a **named wildcard** (`_a`)
is a template, re-evaluated live as the controls move. The same wrapper drives a
plot, a glyph, several elements at once, or plain markup.

`params` uses Wolfram's control tuples — `{a, min, max}`, `{a, min, max, step}`,
`{ {a, init}, min, max }`, and a discrete `{k, {1, 2, 3}}`; separate several with
`;` or `,`. A slot is a named wildcard filled from the matching control: `_a` takes the
value of `a`, and the slot body can be any expression over them
(`_n`, `_n * 20`, `_A / 2`). Every slider carries a **play button (▶)** that
animates it on a loop.

::: tip Authoring note
`_a` wildcards are plain text — no framework escaping needed. The wrapper is still
written with `v-pre` only so VitePress leaves the literal `{ … }` control tuples
in `params` alone. In a plain HTML host (or a REPL) it is just
`<notatio-manipulate params="…">…</notatio-manipulate>`. Plots and surfaces also
accept a `params` attribute directly — a shorthand for the common single-child case.
:::

Controls sit **above** the content by default, as in Wolfram's own Manipulate — a panel
underneath a tall plot can fall off the bottom of the screen. `controls="below"` flips
that. `fps` adds a frame-rate readout, shown only while a slider is playing.

Dragging a slider applies immediately. **Play** is what interpolates: it advances
continuously, covering one step per tick but moving _through_ the values in between, so a
swept parameter reads as motion rather than as a sequence of jumps. A whole-number step —
an order, a count — stays on its grid regardless, since half of an integer order is not a
thing you want to plot.

## Drive a curve

<Story
  title="A frequency knob">
<template #description>
The slider fills the wildcard <code>_a</code> in the plot's <code>value</code> and
re-samples. Press ▶ to sweep it.
</template>
<notatio-manipulate v-pre params="{a, 1, 5}">
<notatio-plot value="Sin(_a * x)" domain="-6.283,6.283" />
</notatio-manipulate>
</Story>

<Story
  title="Amplitude · frequency · phase">
<notatio-manipulate v-pre params="{ {A, 1}, 0, 2}; { {w, 2}, 0.5, 6}; {p, 0, 6.283}">
<notatio-plot value="_A * Sin(_w * x + _p)" domain="-6.283,6.283" plot-range="-2,2" />
</notatio-manipulate>
</Story>

## Drive a glyph

<Story
  title="Grow a subset">
<template #description>
Here <code>_n</code> is the ground-set size of a <code>subset</code> glyph — the
same control machinery, a different representation.
</template>
<notatio-manipulate v-pre params="{ {n, 4}, 1, 8, 1}">
<notatio-figure kind="subset" value="[1,3]" n="_n" />
</notatio-manipulate>
</Story>

## One control, several views

<Story
  title="A curve and its harmonic index">
<template #description>
One slider feeds two children at once — the plot's frequency and a glyph marking
<code>k</code> in <code>{1..6}</code>.
</template>
<notatio-manipulate v-pre params="{ {k, 3}, 1, 6, 1}">
<notatio-plot value="Sin(_k * x)" domain="-6.283,6.283" grid />
<notatio-figure kind="subset" value="[_k]" n="6" />
</notatio-manipulate>
</Story>

## Animate

<Story
  title="A travelling wave (press ▶)">
<notatio-manipulate v-pre params="{t, 0, 6.283}">
<notatio-plot value="Sin(x - _t)" domain="-6.283,6.283" />
</notatio-manipulate>
</Story>

`loop` on the wrapper says what playback does at the ends — `cycle` (the
default, Manipulate's own), `reflect` or `none` — and holding ▶ (or
right-clicking it) opens a panel for that and for the speed, per slider. The
same attribute and panel serve a plot's own `params` sliders and a worksheet's
bindings.

## Drive a surface

<Story
  title="Sweep a surface frequency">
<notatio-manipulate v-pre params="{ {k, 1}, 0.5, 3}">
<notatio-plot-3d value="Sin(_k * x) * Cos(_k * y)" x-domain="-3.14,3.14" y-domain="-3.14,3.14" />
</notatio-manipulate>
</Story>

## A discrete choice

<Story
  title="A setter over a list">
<notatio-manipulate v-pre params="{k, {1, 2, 3, 5}}">
<notatio-plot value="Sin(_k * x)" domain="-6.283,6.283" grid />
</notatio-manipulate>
</Story>

## A sentence for a panel

Wolfram's `Manipulate` puts the controls in a strip, and the reader has to hold
in their head which slider goes with which term. `prose` replaces the strip
with a **sentence**: the same `params` declaration, but each parameter appears
where the prose mentions it, as a knob you drag, and any other expression in
braces is a readout that follows. `$…$` typesets. Every knob has the full
[Tangle](/playground/inspirations/tangle) gesture set — gears, keyboard, typing,
and Space to play.

<Story
  title="A control paragraph">
<template #description>
Drag the <strong>3</strong> and the <strong>1.0</strong>; press ▶ (or focus a
knob and hit Space) to sweep. The readouts are ordinary
<code>&lt;notatio-dynamic&gt;</code> templates and the plot is an ordinary
Manipulate target — nothing in the sentence knows the plot exists.
</template>
<notatio-manipulate v-pre
  params="{ {k, 3}, 1, 8, 1}; { {a, 1}, 0.2, 2, 0.1}"
  prose="The curve $a\sin(kx)$ with frequency {k} and amplitude {a | play} crosses zero {2 * _k + 1} times on $[-\pi, \pi]$ and reaches {N(_a) | digits=2} at its peaks.">
<notatio-plot value="_a * Sin(_k * x)" domain="-3.1416,3.1416" grid />
</notatio-manipulate>
</Story>

A hole's options ride after a bar: `{k | axis=y}` drags vertically,
`{k | play}` shows the play button, `{k | autoplay}` sweeps while on screen,
`{k | loop=reflect rate=2}` sets how and how fast, `{expr | digits=3}` rounds
a readout. The range, step and starting value stay
in `params`, where Wolfram keeps them.

## Roadmap

- More control kinds (checkbox, 2-D locator, colour), matching `Manipulate`.
- A `Manipulate` entry in the [Symbol reference](/reference/symbol/), with the
  Wolfram control-spec grammar alongside the live wrapper.
