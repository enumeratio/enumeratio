# Complex Plot 3D

Wolfram's `ComplexPlot3D`, rendered by `<notatio-complex-plot-3d>`: |f(z)| as a surface
over the complex plane, each face coloured by arg f(z) on the same hue wheel the
[complex plot](/playground/complex-plot) paints. A pole is a spike that rises to
`max-height` (default 4) with every hue winding round it; a zero is a dimple the hues wind
round the other way. `value` is **notatio**; LaTeX goes in a `$…$` island.

The surface is sampled on the CPU (`samples` per side, default 40) through the base
package's complex evaluator — the elementary operations and the analytic special functions —
or through the engine's own numeric evaluation for anything else. The view is the one every
3-D figure has: **drag to rotate** (`azimuth` / `elevation`), **ctrl/⌘ + wheel to zoom**,
**double-click to reset**. Hover to read out `(re, im, |f|)`.

## Poles and zeros

<Story
  title="A rational function">
<template #description>
Two poles at <code>±i</code>, clipped at the ceiling, and the hue running once round each.
</template>
<notatio-complex-plot-3d value="1/(z^2 + 1)" />
</Story>

<Story
  title="Zeros too">
<template #description>
The cube roots of unity are the three dimples; the poles are the two spikes. Reading the
colour wheel round a point gives its order, and the direction of the winding says which.
</template>
<notatio-complex-plot-3d value="(z^3 - 1)/(z^2 + 1)" domain="-2,2,-2,2" samples="60" />
</Story>

## Special functions

<Story
  title="The gamma function">
<template #description>
Poles at <code>0, −1, −2, …</code>, each a spike; to the right the surface climbs as the
factorials do.
</template>
<notatio-complex-plot-3d value="Gamma(z)" domain="-4,4,-3,3" samples="60" max-height="6" />
</Story>

<Story
  title="The Riemann zeta function">
<template #description>
The pole at <code>z = 1</code>, and up the critical line the first non-trivial zeros at
<code>½ + 14.13 i</code>, <code>½ + 21.02 i</code>, <code>½ + 25.01 i</code> -- the dimples
every hue winds round.
</template>
<notatio-complex-plot-3d value="Zeta(z)" domain="-2,3,0,30" samples="70" max-height="3" />
</Story>

## As an expression

The head is the component: an evaluated `ComplexPlot3D(f, (z, a + b i, c + d i))` draws
itself, the iterator's complex corners becoming the `domain`.

<Story
  title="Through notatio-out">
<notatio-out format="notatio" value="ComplexPlot3D(1/(z^2 + 1), (z, -2 - 2 * i, 2 + 2 * i))" />
</Story>

## Notes

- **Clipping, not infinity.** |f| near a pole grows without bound; the surface is cut at
  `max-height`, as Wolfram's is, so a single pole does not flatten everything else to the
  floor.
- **Faces across the branch cut.** A face's hue is the circular mean of its corners, so a
  cell straddling arg = ±π takes the hue between its sides rather than the opposite one.
