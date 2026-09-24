# Tangle

[Tangle](http://worrydream.com/Tangle/) is Bret Victor's library for **reactive
documents**: an essay where the numbers are handles. You read a sentence, you
notice a number is underlined, you drag it, and the rest of the page re-derives
itself around you. The argument it makes is that a reader who can move a
quantity understands the model that quantity sits in, and a reader who can only
look at one number does not.

That is a very different thing from a control panel. A `Manipulate` puts the
sliders in a box above a plot, and the reader has to hold in their head which
slider goes with which term. Tangle's controls sit **where the quantity is
mentioned**, in the sentence that says what it means — so there is nothing to
map.

Five components come out of that, and they are all inline:

| Component                  | What it is                                   | After                |
| -------------------------- | -------------------------------------------- | -------------------- |
| `<notatio-dynamic-module>` | the scope; renders nothing of its own        | Tangle's `Tangle`    |
| `<notatio-knob>`           | a number you drag inside the prose           | `TKAdjustableNumber` |
| `<notatio-toggler>`        | a word that cycles when clicked              | Wolfram's `Toggler`  |
| `<notatio-dynamic>`        | a derived readout                            | Wolfram's `Dynamic`  |
| `<notatio-when>`           | a phrase that appears only under a condition | Tangle's `TKIf`      |

The binding machinery is the one `<notatio-manipulate>` already uses: a knob
named `a` publishes the wildcard `_a`, and **any** notatio expression in the
subtree that mentions `_a` is a template, re-evaluated on every move. So a knob
can drive a sentence, a glyph and a plot at once without knowing that any of
them exist.

## Drag a number

<Story
  title="The cookie">
<template #description>
The canonical Tangle demo. Drag the <strong>3</strong> — right raises it, left
lowers it. Nothing else on the page is a control.
</template>
<notatio-dynamic-module>
You eat <notatio-knob name="n" value="3" min="0" max="12" step="1" /> cookies,
which is <notatio-dynamic value="_n * 50" /> calories.
</notatio-dynamic-module>
</Story>

The value follows the pointer's **position**, not a rate. Drag out and back and
you land on the number you started from — a scrubber that accelerates the
further you pull is a throttle, not a value, and a reader cannot put it back.

`step` also fixes how many places are printed, so the readout keeps a constant
width while you drag it. A number that reflows its own sentence on every frame
is unreadable, and reading it is the point.

<Story
  title="Sensitivity and places">
<template #description>
<code>step</code> gives the rate three places and the years none;
<code>sensitivity</code> is how many pixels of travel buy one step, so the rate
moves faster under the same gesture. <code>N(…)</code> forces the decimal —
without it the engine would hand back an exact power of a fraction.
</template>
<notatio-dynamic-module>
A rate of <notatio-knob name="r" value="0.05" min="0" max="0.25" step="0.005" sensitivity="4" />
compounded over <notatio-knob name="y" value="10" min="1" max="40" step="1" /> years
multiplies a stake by <notatio-dynamic value="N((1 + _r)^_y)" />.
</notatio-dynamic-module>
</Story>

## Gears

A knob that moves at one speed is either too fast for the last digit or too
slow for the first. Every gesture here is in one of three **gears**: normal
moves by `step`, coarse by ten steps, fine by a tenth of one — and there are
three ways into a gear, so what you learn at the keyboard holds under the
pointer and on a phone.

- **Off the axis.** Drag a one-axis knob and wander up: past a small band the
  gear goes coarse, and a ladder beside the value shows the three increments
  with the live one filled. Wander down for fine. The value never jumps when
  the gear changes — the drag re-anchors where it is and the new gain applies
  from there.
- **Modifiers.** Hold `Shift` for coarse or `Alt` for fine, while dragging or
  at the keyboard. `PageUp`/`PageDown` step coarse on their own.
- **A second finger.** On a touchscreen, a second finger anywhere means fine —
  the one refinement a complex knob can take, since both its axes are spoken for.

<Story
  title="Climb the ladder">
<template #description>
Drag the principal and drift upward to move by ten thousands, then back down
into the band to settle the last thousand. Drift below the band on the rate to
land on a quarter point.
</template>
<notatio-dynamic-module>
A loan of <notatio-knob name="p" value="25000" min="1000" max="500000" step="1000" /> at
<notatio-knob name="r" value="0.06" min="0.01" max="0.2" step="0.001" /> over
<notatio-knob name="y" value="30" min="1" max="40" step="1" /> years costs
<notatio-dynamic value="N(12 * _y * _p * (_r/12) / (1 - (1 + _r/12)^(-12 * _y)))" digits="7" /> in all.
</notatio-dynamic-module>
</Story>

An integer knob has no tenth of a step to offer, so its fine gear keeps whole
numbers and asks ten times the travel for each — the ladder says `1 slow`. A
real knob in fine gear lands off its own grid, and the readout grows a place
to say so rather than rounding back onto it.

**Typing.** Sometimes you know the number. `Enter`, or a double tap, turns the
value into a field; `Enter` commits and `Escape` puts the old value back. A
count typed with a fraction is rounded, since the knob would otherwise show one
number and bind another.

**Vertical.** `axis="y"` makes a one-axis knob drag up to raise, with the
ladder on the horizontal — for a quantity the prose already treats as a height.

## Play

Focus a knob and press `Space`: it sweeps its range one step at a time, until
you press again or touch it. `play` adds a ▶ beside the value for the mouse;
`autoplay` starts the sweep when the knob scrolls into view and pauses it when
it leaves, which is how an explainer animates itself without a reader having to
find the button. A toggler plays too, cycling its entries.

**Loop.** What happens at the ends is the control's `loop`, and it governs
every iteration — playback, a click on a toggler, the arrow keys: `cycle` wraps,
`reflect` turns round, `none` stops there (and a play-through that has run to
its end rewinds when played again). The arrows are a special case: they wrap on
`cycle` and clamp on the other two, since pressing the other arrow _is_ the
reflection. A range has ends, so a numeric knob is `none` by default; a list
goes round, so `choices` and togglers are `cycle`. A drag never loops — it is a
position.

**Speed.** `interval` is milliseconds per step and `rate` multiplies it. Hold ▶
(or right-click it) for a panel with both the speed and the loop; a pick
applies at once. The same panel opens off every ▶ there is: a `Manipulate` slider's, a plot's
`params`, a worksheet binding's.

<Story
  title="A sentence that sweeps itself">
<template #description>
Press either ▶. The knob steps along its grid at a pace that covers the range
in a few seconds and, being <code>loop="cycle"</code>, starts over at the top —
without that a numeric knob plays through once and stops. The toggler cycles its
entries every second and a half. Hold either ▶ for the speed and loop panel.
</template>
<notatio-dynamic-module>
At <notatio-knob name="t" value="0" min="0" max="6.28" step="0.04" play loop="cycle" /> the wave has
reached <notatio-dynamic value="N(Sin(_t))" digits="3" />, and it is
<notatio-toggler name="mood" values="rising|falling|rising again" play interval="1500" />.
<notatio-plot value="Sin(x - _t)" domain="-6.283,6.283" />
</notatio-dynamic-module>
</Story>

## Two axes

A knob does not have to be real. `complex` adds the second axis: **up raises the
imaginary part**, down lowers it, and the cursor changes to say so. Both parts
stay on screen even when one of them reads zero — an axis you cannot see is an
axis you cannot find again.

<Story
  title="A complex knob">
<template #description>
Drag horizontally for the real part, vertically for the imaginary one. The same
gesture that moves a real knob along the line moves this one around the plane.
</template>
<notatio-dynamic-module>
The number <notatio-knob name="z" value="3+2i" complex step="0.25" /> has modulus
<notatio-dynamic value="N(Abs(_z))" /> and argument
<notatio-dynamic value="N(Arg(_z))" /> radians. Its square is
<notatio-dynamic value="_z^2" />.
</notatio-dynamic-module>
</Story>

## Scrub a discrete thing

Not every quantity is a number on a line. `choices` turns the knob into a scrub
through a list — each step of the gesture moves one entry along, clamped at the
ends rather than wrapped.

<Story
  title="Scrubbing a list">
<notatio-dynamic-module>
The <notatio-knob name="p" value="7" choices="2|3|5|7|11|13|17|19" /> is a prime you
cannot arrive at by adding — so the knob walks the list rather than a range.
</notatio-dynamic-module>
</Story>

The more interesting discrete case is a **family of objects**, where the knob is
an index and the thing it indexes is drawn. An integer knob is already that, and
the glyph is just another template.

<Story
  title="Scrub a combinatorial family">
<template #description>
The knob is the ground-set size; the glyph and the count both read it. Neither
knows the other exists.
</template>
<notatio-dynamic-module>
Ground set of <notatio-knob name="n" value="5" min="1" max="9" step="1" /> elements:
<notatio-figure kind="subset" value="[1,3]" n="_n" />
— which is one of <notatio-dynamic value="2^_n" /> subsets.
</notatio-dynamic-module>
</Story>

<Story
  title="Scrub the permutations themselves">
<template #description>
The index unranks: the knob walks the 24 permutations of <code>{1..4}</code> in
the collection's own order, and the glyph draws whichever one it lands on. No
<code>step</code> here — a value written <code>1</code> rather than
<code>1.0</code> already says it is a count.
</template>
<notatio-dynamic-module>
Permutation <notatio-knob name="k" value="1" min="1" max="24" /> of 4:
<notatio-figure kind="permutation" value="At(Permutations(Range(1,4)), _k)" />
</notatio-dynamic-module>
</Story>

## Drag the thing itself

A number beside a picture is still one level removed: you move the number and the
picture follows. Better is to **put the gesture on the picture**, so that walking a
family of objects is the same motion as walking a range.

Give a knob children and they become the grip. It renders no number of its own —
you drag whatever is inside it, and what you are dragging is the thing you are
looking at.

<Story
  title="Brush the permutation, not its index">
<template #description>
Drag across the matrix. The knob is still an index into the 24 permutations of
<code>{1..4}</code> — it just has nothing of its own on the page, and the ring on
hover is the whole affordance.
</template>
<notatio-dynamic-module>
<notatio-knob name="k" value="1" min="1" max="24">
<notatio-figure kind="permutation" value="At(Permutations(Range(1,4)), _k)" />
</notatio-knob>
</notatio-dynamic-module>
</Story>

<Story
  title="A figure you brush, and a sentence that watches">
<template #description>
The same gesture on a different family. Nothing in the sentence knows the control
is a picture rather than a number — a knob publishes one binding whatever it looks
like.
</template>
<notatio-dynamic-module>
<p>
<notatio-knob name="n" value="4" min="1" max="8">
<notatio-figure kind="partition" value="At(IntegerPartitions(_n), 1)" />
</notatio-knob>
is the first of <notatio-dynamic value="Count(IntegerPartitions(_n))" /> partitions of
<notatio-dynamic value="_n" />.
</p>
</notatio-dynamic-module>
</Story>

## Words, and prose that comes and goes

A toggler is **a knob without an axis**, and that is the whole difference
between them. There is no direction to drag a word in, so a click steps it once
and wraps, the arrows step it from the keyboard, and a **long press** (or
right-click) opens a menu of every entry — the only way to reach the fifth of
twelve without passing four.

A knob, having an axis, has no menu: `choices` is a list you brush along, and
the two gestures would fight over the same press. Which one a quantity wants is
the question worth asking — a list you move _through_ is a knob, a value you
_pick_ is a toggler.

A toggler is a word you click. Entries are separated by `|`, since commas belong
to the sentence. An entry that looks like a value is typeset; a word is set as
prose. Either way the binding is a number — the entry's own value when it has
one, and otherwise its index — so a toggle over words can still drive a
condition.

<Story
  title="A toggler and a conditional">
<template #description>
Click the phrase to cycle it. The clause after it belongs to a
<code>&lt;notatio-when&gt;</code>, and appears only on the last entry.
</template>
<notatio-dynamic-module>
There are <notatio-toggler name="crowd" values="a few|several|rather a lot of" /> people here<notatio-when test="_crowd > 1">, which is more than the room was built for</notatio-when>.
</notatio-dynamic-module>
</Story>

<Story
  title="Both branches of an either/or">
<template #description>
<code>invert</code> is the other half of the sentence: the same test, shown when
it fails. Two conditionals rather than an if/else attribute, because each half is
prose with its own markup in it.
</template>
<notatio-dynamic-module>
A graph on <notatio-knob name="v" value="4" min="2" max="10" step="1" /> vertices has
<notatio-dynamic value="Binomial(_v, 2)" /> possible edges, which is
<notatio-when test="_v > 5">more than you want to draw by hand</notatio-when><notatio-when test="_v > 5" invert>still a picture you can draw</notatio-when>.
</notatio-dynamic-module>
</Story>

## Out of the sentence and into the figure

The binding does not stop at the prose. Any component attribute in the subtree
that mentions a knob is a template too, so the same drag that changes a word
changes the plot beside it. This is where a tangle stops being a nicer slider
and starts being a document.

<Story
title="A sentence and a curve, one knob">
<notatio-dynamic-module>
<p>
The curve <notatio-out inline format="latex" value="\sin(kx)" /> with
<notatio-knob name="k" value="3" min="1" max="8" step="1" /> crosses zero
<notatio-dynamic value="2 * _k + 1" /> times on <notatio-out inline format="latex" value="[-\pi,\pi]" />.
</p>
<notatio-plot value="Sin(_k * x)" domain="-3.1416,3.1416" grid />
</notatio-dynamic-module>
</Story>

<Story
title="A complex knob and a phase portrait">
<template #description>
One knob, two axes, and a picture that has to be re-evaluated on every frame of
the drag. This is the case a panel of sliders handles badly: the quantity is a
<em>point</em>, and it wants a gesture with two directions in it.
</template>
<notatio-dynamic-module>
<p>
Moving the pole <notatio-knob name="a" value="0.5+0.5i" complex step="0.1" min="-2" max="2" />
drags the singularity of <notatio-out inline format="latex" value="1/(z-a)" /> around the plane.
</p>
<notatio-complex-plot value="1 / (z - (_a))" domain="-2,2,-2,2" />
</notatio-dynamic-module>
</Story>

## Notes on the parts

- **Affordances.** The axis arrows appear on hover at the ends of the dashed
  rule, which is the knob's own space — flanking the value put them in the gaps
  between words, where a neighbour clipped them. The cursor names the axis too:
  `ew-resize`, `ns-resize` for `axis="y"`, `move` for a complex knob, and a
  plain pointer on a toggler, which has nothing to drag.
- **Keyboard.** Every knob is a `role="slider"` with a tab stop, and a click
  focuses it as a Tab would. The arrows along its drag axis step it (left/right,
  up/down for `axis="y"`, both pairs on a complex knob — the keys teach the
  gesture), holding one accelerates through 1, 2, 5 and 10 steps a repeat, `Shift`/`Alt` and the
  Page keys change gear, Home/End take it to the ends and Enter opens the
  field. A document whose only affordance is a drag excludes the readers who
  cannot drag.
- **Position, not rate.** Within a gear the value is a function of where the
  pointer is, so a drag out and back lands where it started. A gear change
  re-anchors rather than rescaling, which is what keeps that true across the
  ladder — Blender does the same when you press Shift mid-drag.
- **Prior art.** The ladder is Houdini's value ladder; the perpendicular-drag
  refinement is also how iOS scrubbers slow down; Shift-for-ten is the Figma
  and Photoshop convention (Blender's is the reverse, and lost the vote).
  Nobody has put gears in running prose before, which is only because Tangle
  did not.
- **Ranges.** `min`/`max`/`step` are all optional. What is left over comes from
  the same predictable ±10-or-wider window the worksheet sliders infer, so a
  knob's sensitivity is guessable before you touch it.
- **Counts against measurements.** With no `step`, a knob reads how its value was
  written: `value="4"` steps by one and `value="4.0"` does not. A count — a
  ground-set size, an index, a number of cookies — is written without a point
  precisely because there is nothing between its values, and a knob that says 4
  and lands on 4.05 is reporting a quantity nobody meant it to have.
- **Nesting.** Tangles are separate scopes; a control belongs to its nearest
  enclosing one. Two examples on one page do not collide.
- **Naming.** `Dynamic` and `Toggler` are real Wolfram symbols, and the tags take
  them. The other three are not: Wolfram has no inline draggable value, no
  prose-run conditional and no reactive-document wrapper, so those keep
  descriptive names — which is what the naming rule says to do when there is no
  symbol to take.
