# Fractals

The Mandelbrot and Julia sets come from one map, iterated:

$$z \mapsto z^2 + c.$$

Two ways to read it. Fix the starting point at $z = 0$ and let $c$ range over the plane —
that is the **Mandelbrot** set, a picture of the _parameter_. Or fix $c$ and let the
starting point range — that is a **Julia** set, a picture of the _dynamics_ at that one
parameter. Same map, two different planes.

## The n-th iterate, not an escape count

Most renderings colour a pixel by how long it took to escape. These colour the iterate
itself, $z_n(c)$, through the same domain colouring the rest of the site uses — hue is
the argument, brightness the magnitude.

That is not a trick to reuse machinery. The escape count is a summary of the orbit;
$z_n$ _is_ the orbit's position, and it carries the argument as well as the size. The
exterior blows up and reads as poles; the interior stays bounded and reads as colour.
Turning $n$ up sharpens the boundary, because the boundary is exactly where the answer
depends on how long you look.

<Story
  title="The Mandelbrot set, as the n-th iterate">
<template #description>
Three settings cells and one drawable — the plot falls out of the last cell alone.
</template>
<notatio-worksheet
  seed='["$\\mathsf{center}$ := [-0.5, 0]", "$\\mathsf{extent}$ := 3", "n := 64", "Mandelbrot(z, n)"]'
  screen="side"
/>
</Story>

The first two cells are framing, in the settings namespace — the set lives around
$-0.5$, not the origin. Drag the plot to pan and scroll to zoom; sweep $n$ to watch the
boundary resolve. At low
$n$ the set looks fat and smooth — few points have had time to escape. Each doubling
etches the filaments a little further out.

## A Julia set is one parameter's dynamics

<Story
  title="A Julia set, one parameter at a time">
<template #description>
<code>c</code> is complex, so it gets one slider per part.
</template>
<notatio-worksheet
  seed='["c := -0.4 + 0.6i", "n := 64", "Julia(z, c, n)"]'
  screen="side"
/>
</Story>

Sweep the two parts of $c$ and the Julia set changes shape continuously — and the
Mandelbrot set is the map of which shapes are possible. Inside it, the Julia set is
connected; outside, it shatters into dust. That is Mandelbrot's theorem, and here it is
something you can drag a slider through: take $c$ out past the boundary and watch the
picture come apart.

## Where the zoom runs out

The GPU works in `f32`, so there is a depth past which zooming stops revealing anything
and starts revealing the arithmetic: the picture goes blocky, because neighbouring pixels
have stopped being distinguishable coordinates. A fractal is the most direct way to see
that limit, since detail is what it has at every scale.

This is also what makes the pair a good test for framing that adapts to zoom — the
useful iteration count is not fixed but a function of how far in you are, since the
deeper you go the longer an orbit needs to declare itself.
