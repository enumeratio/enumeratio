# Worksheet

A set of named expressions and a shared view of what they draw, rendered by
`<notatio-worksheet>`. It is the [reactive notebook](/playground/notebook) with two
additions, and both fall out of the cells rather than being configured:

- a cell that **binds a plain number** gets a slider — a knob is just a binding you can
  move;
- a cell that **leaves an axis variable free** gets drawn — `z` is the complex plane and
  colours as a portrait, `x` is a curve, `x` and `y` a surface.

A binding may be complex, in which case it gets a slider per part.

So there is no control syntax and no plot syntax. `s := 2` is a slider because it is a
number; `PolyLog(s, z)` is a portrait because `z` is the only thing left free in it.

## A knob and a view

<Story
  title="The polylogarithm's order">
<template #description>
Drag the slider and the portrait follows. The binding cell draws nothing — it has no
free axis — so it stays off the screen without being told to.
</template>
<ClientOnly>
<notatio-worksheet seed='["s := 2", "PolyLog(s, z)"]' />
</ClientOnly>
</Story>

## Several views, one parameter

<Story
  title="Two conventions, side by side">
<template #description>
Both cells read the same <code>s</code>, so they move together. This is what replaces a
"which function?" control: the choice is which cells you leave visible, and the mark
beside each cell toggles it. Two domain colourings occupy the same plane, so only the
upper one is drawn — the other would be entirely hidden behind it.
</template>
<ClientOnly>
<notatio-worksheet seed='["s := 2", "HurwitzZeta(s, z)", "Zeta(s, z)"]' />
</ClientOnly>
</Story>

## Curves and surfaces

<Story
  title="A complex knob">
<template #description>
A binding does not have to be real. A complex one gets a slider per part, so the Lerch
transcendent's order can be swept across the plane rather than along a line.
</template>
<ClientOnly>
<notatio-worksheet seed='["w := 0.5 + 8i", "LerchPhi(z, w, 1)"]' />
</ClientOnly>
</Story>

<Story
  title="The free variables pick the projection">
<template #description>
One free <code>x</code> is a curve; <code>x</code> and <code>y</code> together are a
surface. Everything visible is drawn into <em>one</em> screen rather than a frame each:
the curve sits above the surface, because a lower-dimensional thing hidden under a
higher-dimensional one is a thing you cannot see.
</template>
<ClientOnly>
<notatio-worksheet seed='["a := 2", "Sin(a * x)", "Sin(a * x) * Cos(y)"]' />
</ClientOnly>
</Story>

## A picture is a value

`Image` is a picture the way a number is a number — something a cell can evaluate to,
and therefore something the screen can composite without knowing where it came from.
`Rasterize` makes one out of a graphic; where pixels are available (Node, the CLI) it
renders them, and elsewhere it hands back the document itself, which a page can still
draw.

<Story
  title="An image layer">
<template #description>
An image stacks like any other plane: it is opaque, so it hides whatever sits beneath
it, while the curve drawn over it stays visible.
</template>
<ClientOnly>
<notatio-worksheet seed='["Image(\"data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMjAgNjAiPjxyZWN0IHdpZHRoPSIxMjAiIGhlaWdodD0iNjAiIGZpbGw9IiNlMmU4ZjAiLz48Y2lyY2xlIGN4PSI0MCIgY3k9IjMwIiByPSIxOCIgZmlsbD0iIzM0NTFiMiIvPjxjaXJjbGUgY3g9IjgwIiBjeT0iMzAiIHI9IjE4IiBmaWxsPSIjZDk3NzA2Ii8+PC9zdmc+\")", "Sin(3x)"]' />
</ClientOnly>
</Story>

## Framing is a cell too

A setting is written in a namespace of its own — `\mathsf{extent}`, which in notatio is
the island `$\mathsf{extent}$` — so it can never collide with an ordinary name the
mathematics is using. Wolfram reserves a context for the same reason.

<Story
  title="Setting the view">
<template #description>
Because a setting is an ordinary binding, it gets a slider like any other number — so
the framing itself is manipulable. Write <code>Auto</code> instead of a value to hand an
axis back to the automatic choice.
</template>
<ClientOnly>
<notatio-worksheet seed='["$\\mathsf{extent}$ := 1.2", "PolyLog(2, z)"]' />
</ClientOnly>
</Story>

The view is one model, not per-renderer options. A 2-D graphic is a camera at a standard
distance looking straight at a point, so `center` and `extent` _are_ a camera and
`azimuth`/`elevation` are the angles it happens to sit at — zero and zero for anything
flat. Domains are the same statement in the form authors think in: `xdomain := (-1, 5)`
is read back as a centre and a distance.

| setting                | means                                            |
| ---------------------- | ------------------------------------------------ |
| `center`, `extent`     | where the camera looks, and how much it takes in |
| `xdomain`, `ydomain`   | the same, written as ranges                      |
| `azimuth`, `elevation` | its orientation, in degrees                      |
| `height`               | pane height in pixels                            |

## Notes

- **Panes draw the cell, not its value.** A cell is plotted with its bindings
  substituted but _not_ evaluated, so `HurwitzZeta(1, z)` draws its pole rather than
  collapsing to `ComplexInfinity` and vanishing — and a slider moves a literal without
  changing the compiled shape.
- **Every cell has a mark.** A drawable one carries a toggle shaped like what it draws,
  a binding carries a play button that sweeps it, and anything else carries a sign of
  what kind of row it is. The rest of that column is the drag handle.
- **One screen, stacked.** Layers are ordered by dimension — points over curves over
  planes — and an opaque field hides whatever is beneath it, so only the topmost is
  drawn at all.
- **No history, no ordinals.** Every cell is defined by its name and recomputed from its
  dependencies, so cells can be reordered freely — the same schedule as
  [`<notatio-notebook>`](/playground/notebook), which is this without the screen. A
  transcript you can refer back to by `Out(n)` is the [notebook](/notebook/), still to come.
- **Bindings are scoped to the sheet.** Two sheets on a page, both using `x`, do not see
  each other — and neither sees the variables the surrounding prose uses.
- `screen` places the view: `auto` (default) puts it beside the cells and drops it below
  on a narrow viewport, `side` and `below` pin it.
