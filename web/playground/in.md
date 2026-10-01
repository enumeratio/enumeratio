# Input

`<notatio-in>` — a MathLive-backed math editor. It emits `notatio-change`
with the current LaTeX on every edit; MathLive is lazy-loaded on first focus.

<Story
  title="Live editing → evaluated output">
<template #description>
Edit the field — the boxed, evaluated result updates on the right. Try
<code>\frac{1}{2}+\frac{1}{3}</code> or <code>\sqrt{16}+2^3</code>.
</template>
<LiveInput value="\frac{1}{2}+\frac{1}{3}" />
</Story>

<Story
  title="Wrapper heads">
<template #description>
The button writes a head around what you typed — <code>N(…)</code> for a number,
<code>FullForm(…)</code> for the AST, <code>TraditionalForm(…)</code> for the
rendering. The caret picks which. It is a wrapper, not an edit: the field keeps
showing your expression and only the emitted value gains the head, so pressing again
takes it off. Heads stay symbolic until you ask for one.
</template>
<notatio-cell value="Sqrt(2) + Pi" />
</Story>

<Story
  title="Plain editable field">
<notatio-in value="x^2 + 1" />
</Story>

<Story
  title="Read-only (no editor loaded)">
<template #description>
<code>readonly</code> renders the value with MathLive's static markup and
never loads the editor — cheap inline math for prose.
</template>
<notatio-in value="\int_0^1 x^2 \, dx" readonly />
</Story>

<Story
  title="Pinned to a declaration">
<template #description>
<code>bind</code> fixes the symbol and <code>domain</code> asserts its domain. The
declaration is a read-only field with one <code>\placeholder</code> hole, so the caret
cannot reach the name or the <code>≔</code> — try to delete them and nothing happens.
Only the value is yours.
</template>
<notatio-in bind="p" domain="integer" value="p \coloneq 3" />
</Story>

<Story
  title="A declaration that plays">
<template #description>
A pinned number can sweep itself: <code>play</code> adds a button, <code>min</code>,
<code>max</code> and <code>step</code> bound the sweep (inferred from the value when
absent, the way a knob's are), and each step is emitted as if it had been typed.
<code>loop</code> says what the ends do — <code>cycle</code>, <code>reflect</code>, or
<code>none</code>, the default, since a range has ends. Hold ▶ for the speed-and-loop
panel; typing into the field stops it.
</template>
<notatio-in bind="n" domain="integer" value="n \coloneq 3" min="0" max="12" step="1" play loop="reflect" />
</Story>

<Story
  title="Any type compute-engine knows">
<template #description>
The domain is whatever type you name — <code>\mathbb{Z}</code>, <code>\mathbb{R}</code>,
<code>\mathbb{Q}</code>, <code>\mathbb{C}</code> and <code>\mathbb{B}</code> are spelled
conventionally, anything else falls back to an upright name.
</template>
<notatio-in bind="camera" domain="complex" value="\mathrm{camera} \coloneq 2 + 3i" />
</Story>
