# Torus Knots

The simplest infinite family of knots, and the one you can draw without lifting the pen.
Take a doughnut and a loop drawn on its surface: going round the hole $p$ times while
going through it $q$ times gives the **torus knot** $T(p, q)$.

$$
t \mapsto \bigl((2 + \cos qt)\cos pt,\; (2 + \cos qt)\sin pt,\; -\sin qt\bigr),
\qquad t \in [0, 2\pi).
$$

The $\cos pt$ and $\sin pt$ carry it round the axis $p$ times; the $\cos qt$ and
$\sin qt$ push it in and out through the hole $q$ times.

<Story
  title="T(2,3) — the trefoil, on the torus it lives on">
<ClientOnly>
<notatio-curve-3d
  value="KnotCurve(TorusKnot(2, 3))"
  torus="2,1"
  azimuth="45"
  elevation="25"
  label="T(2,3) — the trefoil"
/>
</ClientOnly>
</Story>

Hue runs along the parameter, so you can follow the strand through a crossing; where two
strands meet, the nearer one is drawn over the farther, which is the whole content of a
knot diagram. **Drag to turn it over**, ctrl/⌘ + scroll to zoom, double-click to reset —
and the expression above each figure is live, so changing $p$ and $q$ redraws it.

`KnotCurve(knot)` evaluates to the list of points the embedding passes through; the
figure is just that list, drawn. Move $p$ and $q$ — both whole numbers, since a knot
cannot wind half a turn:

<ClientOnly>
<notatio-worksheet
  structure="fixed"
  seed='[{"bind": "p", "domain": "integer", "value": "p := 3"}, {"bind": "q", "domain": "integer", "value": "q := 7"}, {"value": "KnotCurve(TorusKnot(p, q))", "locked": true}]'
/>
</ClientOnly>

### Or write the parameterisation out

`KnotCurve` is a convenience, not a primitive. The curve is a table of the
parameterisation at the top of this page, so you can write that out instead and get the
same picture — the equation _is_ the figure:

<ClientOnly>
<notatio-worksheet
  structure="fixed"
  seed='[{"bind": "p", "domain": "integer", "value": "p := 2"}, {"bind": "q", "domain": "integer", "value": "q := 5"}, {"value": "ParametricCurve((2 + Cos(q * t)) * Cos(p * t), (2 + Cos(q * t)) * Sin(p * t), -Sin(q * t))", "locked": true}]'
/>
</ClientOnly>

`ParametricCurve(x, y, z)` samples three coordinate expressions in $t$ over a full turn.
It is the equation from the top of this page, typed out — and `KnotCurve` is only a
convenience over it. The head that draws a curve does not care where the list of points
came from, so the equation and the shorthand give the same picture.

## The square picture

A torus is two circles multiplied together, $S^1 \times S^1$ — so it is a square with
opposite edges glued. On that square, $T(p,q)$ is nothing but a **straight line of slope
$q/p$**, wrapping round each time it leaves an edge. Everything below follows from
staring at that line.

The two circles are the two things a point can do. One takes it **round the hole**, the
long way about the central axis; the other takes it **round the tube**, through the
doughnut's cross-section. A single parameter $t$ drives both at once, at different rates:
by the time $t$ has gone once round, the point has been $p$ times round the hole and $q$
times round the tube, and it is back exactly where it began — which is why the loop
closes at all.

<ClientOnly>
<Story
  title="The same point, on the square and on the knot">
<template #description>
The gold point is the <em>same</em> point in both figures — one parameter, shown twice.
Follow it on the square and it walks a straight line, leaving one edge and arriving at
the opposite one; follow it on the knot and it is winding twice round the hole while it
winds three times round the tube. The two dials count those windings as they happen.
</template>
<p><notatio-clock label="one clock for the page" /></p>
<div class="torus-pair">
<notatio-torus-square p="2" q="3" />
<notatio-curve-3d value="KnotCurve(TorusKnot(2, 3))" torus="2,1" azimuth="35" elevation="30" clock label="T(2,3) — the trefoil" />
</div>
</Story>
</ClientOnly>

That control is not this figure's control. There is **one clock per page**, so pausing
here stops every animated figure below as well — a reader who stops to look at something
should not still be moved past by the figure beside it, and two pictures of the same
parameter must never drift apart. Scrub it and both figures step together.

<ClientOnly>
<Story
  title="Winding faster one way than the other">
<template #description>
Raise a winding number and the line gets steeper; the point crosses the same square more
often. <code>T(3,7)</code> goes three times round the hole for every seven times round
the tube, and the slope $7/3$ <em>is</em> that sentence.
</template>
<div class="torus-pair">
<notatio-torus-square p="3" q="7" />
<notatio-curve-3d value="KnotCurve(TorusKnot(3, 7))" torus="2,1" azimuth="20" elevation="35" clock label="T(3,7)" />
</div>
</Story>
</ClientOnly>

<Story
  title="Slope, held still">
<template #description>
<code>at</code> pins the point to a phase and the figure stops watching the clock, which
is what a figure in a written argument wants. <code>dials="false"</code> drops the two
circles and leaves the line.
</template>
<notatio-torus-square p="2" q="3" at="0.32" dials="false" />
<notatio-torus-square p="3" q="2" at="0.32" dials="false" />
</Story>

Those two are the same knot seen the two ways round — $T(2,3)$ and $T(3,2)$ — and on the
square that is just the line reflected in the diagonal. Swapping $p$ and $q$ is swapping
which circle you call which, and a torus does not care.

<style>
.torus-pair {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  align-items: center;
  justify-content: center;
}
/* Narrow enough that the pair still fits side by side in a story's own column — the
   whole argument is that these are two views of ONE point, and stacked they read as two
   separate figures. */
.torus-pair > * { flex: 1 1 16rem; min-width: 0; max-width: 100%; margin: 0; }
</style>

## When it is not a knot at all

If either winding number is $1$, the line crosses itself nowhere and the loop pulls
straight: $T(1, q)$ and $T(p, 1)$ are **unknots**, however large the other number.

<Story title="T(1,7) — a circle, wound seven times">
<ClientOnly>
<notatio-curve-3d value="KnotCurve(TorusKnot(1, 7))" azimuth="45" elevation="25" label="T(1,7) — a circle, wound seven times" />
</ClientOnly>
</Story>

More generally, the line closes up into a single loop only when $p$ and $q$ are coprime.
When $\gcd(p,q) = d > 1$ you get $d$ parallel strands — a **link**, not a knot.

## Two symmetries, and then nothing

$T(p,q)$ and $T(q,p)$ are the same knot. That is not obvious from the pictures — one is
tall and thin where the other is squat — but it is obvious on the square, where swapping
$p$ and $q$ is reflecting the line in the diagonal.

<Story title="T(2,3) and T(3,2)">
<ClientOnly>
<notatio-curve-3d value="KnotCurve(TorusKnot(2, 3))" azimuth="20" label="T(2,3)" />
<notatio-curve-3d value="KnotCurve(TorusKnot(3, 2))" azimuth="20" label="T(3,2) — the same knot" />
</ClientOnly>
</Story>

Past that, the family is rigid: for coprime $p > q \ge 2$, distinct pairs give **distinct
knots**. The proof is a van Kampen argument on the knot group, whose presentation
$\langle a, b \mid a^p = b^q \rangle$ remembers $p$ and $q$ and nothing else.

<Story title="T(7,3) and T(5,4)">
<ClientOnly>
<notatio-curve-3d value="KnotCurve(TorusKnot(7, 3))" azimuth="30" label="T(7,3)" />
<notatio-curve-3d value="KnotCurve(TorusKnot(5, 4))" azimuth="30" label="T(5,4) — genuinely different" />
</ClientOnly>
</Story>

## As a braid

A torus knot is the closure of a braid you can write down without thinking:

$$T(p, q) = \text{closure of } (\sigma_1 \sigma_2 \cdots \sigma_{p-1})^q.$$

Take $p$ strands, cycle them all once — that is the $\sigma_1 \cdots \sigma_{p-1}$ — and
repeat $q$ times. The $p$ strands are the $p$ times round the axis, and the $q$ repeats
are the $q$ times through the hole.

<Story
  title="The braid, and what it knows">
<template #description>
The trefoil as a two-strand braid: cross the same pair three times.
</template>
<notatio-cell value="TorusBraid(2, 3)" />
<notatio-cell value="AlexanderPolynomial(TorusKnot(2, 3))" />
<notatio-cell value="JonesPolynomial(TorusKnot(2, 3))" />
</Story>

Because the braid is positive — every crossing the same way — the closure's Seifert genus
comes straight out of the strand and crossing counts:

$$g = \tfrac{1}{2}(p-1)(q-1).$$

So $T(2,3)$ has genus $1$ and $T(5,4)$ has genus $6$, and the crossing number of
$T(p,q)$ with $p > q$ is $p(q-1)$.

<Story
  title="Distinct pairs, distinct invariants">
<template #description>
The Jones polynomials of T(7,3) and T(5,4) differ, which is one way to see the knots do.
</template>
<notatio-cell value="JonesPolynomial(TorusKnot(7, 3))" />
<notatio-cell value="JonesPolynomial(TorusKnot(5, 4))" />
</Story>

## What this connects to

Every torus knot is a **Lorenz knot** — a periodic orbit of the flow on the next page —
because $(\sigma_1 \cdots \sigma_{p-1})^q$ is a positive braid, and positive braids are
exactly what the Lorenz template produces. The trefoil is the first of both families, and
it is also the knot whose complement is [the modular surface](/guide/modular/).
