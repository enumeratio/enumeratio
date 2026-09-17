# Complex Plot 3D

Wolfram's `ComplexPlot3D`, rendered by `<notatio-complex-plot-3d>`: |f(z)| as a surface
over the complex plane, each face coloured by arg f(z) on the same hue wheel the
[complex plot](/playground/complex-plot) paints. A pole is a spike that rises to
`max-height` (default 4) with every hue winding round it; a zero is a dimple the hues wind
round the other way. `value` is **notatio**; LaTeX goes in a `$…$` island.

The surface is sampled on the CPU (`samples` per side, default 40) through the base
package's complex evaluator — the elementary operations and the analytic special functions —
or through the engine's own numeric evaluation for anything else; `gpu` moves the sampling
to a compute shader (see [GPU evaluation](#gpu-evaluation)). The view is the one every
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

## GPU evaluation

Set `gpu` and the grid is evaluated in a WebGPU compute shader through the same complex
lowering the [portrait](/playground/complex-plot) uses -- `gpu="160"` also sets the
sample count, since the GPU takes a far denser grid in stride. Where WebGPU is missing,
or the expression has no lowering, the CPU sampler runs instead; a **GPU** badge under
the figure says which happened.

<Story
  title="A dense rational surface">
<template #description>
The rational function again at 160 samples a side, so the spikes come to a point and the
hue is continuous across each face.
</template>
<notatio-complex-plot-3d value="(z^3 - 1)/(z^2 + 1)" gpu="160" max-height="3" />
</Story>

<Story
  title="An essential singularity">
<template #description>
<code>Exp(1/z)</code> near the origin: the surface climbs to the ceiling on the right and
falls to the floor on the left, and between them every hue passes infinitely often.
</template>
<notatio-complex-plot-3d value="Exp(1/z)" domain="-1,1,-1,1" gpu="200" max-height="3" elevation="30" />
</Story>

<Story
  title="The trigamma function">
<template #description>
<code>PolyGamma(1, z)</code> through the analytic kernels on the GPU: double poles at
<code>0, −1, −2, …</code>, so the hue winds twice round each spike.
</template>
<notatio-complex-plot-3d value="PolyGamma(1, z)" domain="-4,2,-2,2" gpu="160" max-height="5" />
</Story>

## As an expression

The head is the component: an evaluated `ComplexPlot3D(f, (z, a + b i, c + d i))` draws
itself, the iterator's complex corners becoming the `domain`.

<Story
  title="Through notatio-out">
<notatio-out format="notatio" value="ComplexPlot3D(1/(z^2 + 1), (z, -2 - 2 * i, 2 + 2 * i))" />
</Story>

## Notes

- **Canvas past 80 samples a side.** Below that the surface is SVG polygons, which
  print and theme through CSS. Above it the same scene is painted on a canvas: a face as a
  DOM node costs more to parse and lay out than to fill, and at 40 000 faces the difference
  is a turn of the view that takes a second against one that takes a frame or two.

- **Clipping, not infinity.** |f| near a pole grows without bound; the surface is cut at
  `max-height`, as Wolfram's is, so a single pole does not flatten everything else to the
  floor.
- **Faces across the branch cut.** A face's hue is the circular mean of its corners, so a
  cell straddling arg = ±π takes the hue between its sides rather than the opposite one.
