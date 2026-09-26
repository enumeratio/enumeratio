# Environments

An environment is a record of what the place a rendering lands can do — whether an
engine is there when the reader looks, what it can draw, how it can be touched. Where an
expression asks for more than that, `reduce(expr, env)` rewrites the _expression_ before
anything renders: a control with nothing to drive it is **pinned** (its variable takes its
start, and the declaration becomes a caption) or **sampled** (the body at a few values —
small multiples, the print-native reading of a slider); a `Dynamic` is read once; a GPU
plot on paper is rasterized; a `Row` in a narrow column stacks. The web and a terminal
have an engine and a way in, so there the expression is left alone. See
`design/rendering-environments.md`.

Every `<Notatio>` on the site reduces for the page's own environment as it changes --
print it (or open the print preview) and the sliders become grids; narrow the window and
the rows stack. The cards below let you pick the environment instead.

## Kick the tires

Three ways in, and all of them read the same `reduce`:

- **Print this page.** ⌘P (or the browser's print preview) and every `<Notatio>` on the
  site — here, on [Controls](/playground/controls), anywhere — re-renders for `print`:
  the sliders become grids of small multiples, the readouts are evaluated once, a
  WebGPU portrait rasterizes.
- **Narrow the window** past 640px (or open the site on a phone). `Row` becomes
  `Column`; the controls stay live, because a phone can still drive them.
- **Edit a card below.** The text box takes Epsil; the code block under it is the
  reduced expression, and the frame under that is what the components make of it.

At a terminal it is the same rewrite with a different answer, because a TTY _can_ drive
a control — see [At a terminal](#at-a-terminal) below.

<Story
  title="A Manipulate, sampled or pinned">
<template #description>
On the web the slider is live. For <code>print</code> the first control is sampled on
its step grid (six values, three to a row) and the rest are pinned into a caption; a
<code>pipe</code> pins everything. <code>Static -> "Pin"</code>, <code>"Sample"</code>
or a count on the expression overrides the environment's policy.
</template>
<EnvironmentPreview expr='Manipulate(Plot(Sin(a * x) + b, (x, 0, 10)), (a, 1, 5), ((b, 1), 0, 3, 0.5))' />
</Story>

<Story
  title="Controls in a layout">
<template #description>
A control inside a <code>Row</code> or <code>Grid</code> is taken out of it, and the
readouts that read its variable are evaluated at the pinned value. A row with one thing
left is that thing.
</template>
<EnvironmentPreview expr='Row([Slider((k, 2), (0, 5)), "squared is", Dynamic(k^2)])' env="pipe" />
</Story>

<Story
  title="A control in a cell">
<template #description>
A <code>Cell</code>'s In is source, so reduction leaves it as written; the cell's Out
evaluates on its own and reduces there, for the environment around it.
</template>
<EnvironmentPreview expr='Cell(Row([Slider((k, 2), (0, 5)), Dynamic(k^2)]))' env="print" />
</Story>

<Story
  title="A choice, enumerated">
<template #description>
A toggler's entries are the sample: one cell per choice, labelled. Each entry shows a
word and binds a number, and the readout beside it computes from the number.
</template>
<EnvironmentPreview expr='Row([Toggler((n, 6), [Labeled(4, "square"), Labeled(6, "hexagon"), Labeled(8, "octagon")]), "has interior angles of", Dynamic(180 - 360/n), "degrees"])' />
</Story>

<Story
  title="An Animator becomes a filmstrip">
<template #description>
Frames in a row, on the step grid; a print of a sweep.
</template>
<EnvironmentPreview expr='Row([Animator(t, (0, 1, 0.25)), Sin(Pi * t)])' />
</Story>

<Story
  title="A Locator becomes a mark">
<template #description>
A pinned <code>Locator</code> is drawn as an <code>Epilog</code> point on the plot it sat
over, joined to any marks the plot already had.
</template>
<EnvironmentPreview expr='Row([Plot(Sin(x), (x, 0, 10), Epilog -> Point((2, 0))), Locator((p, (1, 0.5)))])' />
</Story>

<Story
  title="A narrow column">
<template #description>
<code>compact</code> keeps the engine and the controls — a phone can drive them — and
only stacks the layout.
</template>
<EnvironmentPreview expr='Row([Plot(Sin(k * x), (x, 0, 10)), Slider((k, 1), (1, 5))])' env="compact" />
</Story>

## At a terminal

A TTY has an engine and keys, so the controls are real there — only keyed rather than
pointed. Evaluate an expression with controls in it and the REPL draws a strip: ←/→ move
the focused one (Shift for the coarse gear), Tab changes focus, Space plays, Enter
leaves it where you stopped and prints that as `Out[n]`. A `Plot` under the strip is
drawn on braille cells where the terminal has no image protocol, so it moves as you
scrub:

```text
In[1]:= Manipulate(Plot(Sin(a * x) / a, (x, 0, 6.28)), (a, 1, 4))

  a = 1.24          ◂━━●━━━━━━━━━━━━━━━━━━━━━━▸  1 … 4
  ←/→ move · shift: coarse · tab: next · space: play · enter: done

 0.806 │⠀⠀⠀⠀⠀⠀⠀⠀⡠⠔⠊⠉⠉⠉⠒⠤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⠔⠊⠉
       │⠀⠀⠀⠀⠀⠀⡠⠊⠀⠀⠀⠀⠀⠀⠀⠀⠈⠢⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡠⠊⠀⠀⠀⠀
       │⠀⠀⠀⠀⢠⠊⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠢⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠊⠀⠀⠀⠀⠀⠀
       │⠀⠀⠀⡰⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⢄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⡰⠁⠀⠀⠀⠀⠀⠀⠀
       │⠀⢀⠎⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢢⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠎⠀⠀⠀⠀⠀⠀⠀⠀⠀
       │⢠⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠱⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
-0.806 │⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠑⠢⢄⣀⣀⣀⠤⠒⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
       └────────────────────────────────────────────────────────────
        0                                                       6.28
```

The slider takes the **mouse** too, where the terminal reports one: click a point on the
bar, drag along it, or roll the wheel over it. **Enter** commits the line — what you left
becomes `Out[n]`, so a later line can read it back (`Out(n)`, `%n`; `In(n)` re-evaluates
the input instead, as in Wolfram).

Try it from a checkout:

```bash
pnpm --filter @enumeratio/cli exec tsx src/main.ts
```

```text
Manipulate(Plot(Sin(a * x) / a, (x, 0, 6.28)), (a, 1, 4))
Row([Slider((k, 2), (0, 5)), "squared is", Dynamic(k^2)])
Toggler(size, ["a few", "several", "many"])
```

`:env <name>` reduces every result for another environment without leaving the session —
`:env print` shows what the printed page gets, `:env auto` hands the controls back. Piped
output reduces for `pipe` on its own, and `--env` names one explicitly:

```bash
notatio "Manipulate(a^2 + b, (a, 0, 1), ((b, 2), 0, 3))"
# Labeled(2, "a = 0 (0 ≤ a ≤ 1); b = 2 (0 ≤ b ≤ 3)", Bottom)

notatio --env print "Manipulate(a * x, (a, 1, 3, 1))"
# Grid([[Labeled(x, "a = 1", Bottom), Labeled(2x, "a = 2", Bottom), …]])

notatio --json "Manipulate(a^2, (a, 0, 1))"   # structured: the expression, whole
```

Both live in the browser terminals too: the **Environments** group in the
[live REPL](/docs/cli/repl)'s dropdown runs the `:env` demos, and the
[live command line](/docs/cli/command-line) has the `--env` ones.
