# Plot 3D

A bivariate surface (`Plot3D`), rendered by `<notatio-plot-3d>`. It samples an
`n`×`n` grid, projects it obliquely, and paints the quads back-to-front with
height shading — pure SVG, no WebGL. `value` is **notatio**; LaTeX goes in a
`$…$` island. A boxed axes frame with range labels
draws by default (`axes="false"` to hide); each axis takes `x-scale` / `y-scale` /
`z-scale`.

The view is interactive: **drag to rotate** (`azimuth` / `elevation`, in
degrees), **ctrl/⌘ + wheel or a pinch to zoom** (`zoom`), and **double-click to
reset** to the initial view. Sampling happens once per expression; a view change
only re-projects the cached grid. `label` adds a `PlotLabel` title, and
`color-legend` a height key. **Hover the surface** to read out the nearest
sample's `(x, y, z)`. A list of expressions overlays several surfaces on one
shared z-scale, each in its own colour. `params` adds `Manipulate` sliders — see
[Manipulate](#manipulate) below. A **spin** toggle under each figure auto-rotates
the view (`spin` starts it on), so a surface can turn hands-free. Set `gpu` (opt-in) to
evaluate the grid in a WebGPU compute shader — see [GPU evaluation](#gpu-evaluation).

## Surfaces

<Story
  title="A saddle">
<notatio-plot-3d value="x^2 - y^2" x-domain="-2,2" y-domain="-2,2" />
</Story>

<Story
  title="A ripple">
<notatio-plot-3d value="Sin(x) * Cos(y)" x-domain="-3.14,3.14" y-domain="-3.14,3.14" />
</Story>

<Story
  title="Auto-rotating (spin on)">
<template #description>
<code>spin</code> starts the view turning on load; toggle it with the
<code>⟳ spin</code> button, and drag to take over.
</template>
<notatio-plot-3d value="Sin(x) * Cos(y)" x-domain="-3.14,3.14" y-domain="-3.14,3.14" spin />
</Story>

<Story
  title="A radial bump (title + height key)">
<template #description>
<code>label</code> is a <code>PlotLabel</code> title; <code>color-legend</code>
draws a height key matching the surface's shading. Hover to read a sample.
</template>
<notatio-plot-3d value="Exp(-(x^2 + y^2) / 4)" x-domain="-4,4" y-domain="-4,4" label="Gaussian" color-legend />
</Story>

<Story
  title="A preset view">
<template #description>
The initial view is attribute-driven; drag to change it, then double-click to
snap back here.
</template>
<notatio-plot-3d value="Sin(x) * Cos(y)" x-domain="-3.14,3.14" y-domain="-3.14,3.14" azimuth="200" elevation="40" zoom="0.8" />
</Story>

<Story
  title="Two overlaid surfaces">
<template #description>
A list of expressions draws several surfaces on one shared z-scale, each in its
own colour. Two ripples offset in <code>z</code> stack as clean layers — the
oblique painter's order sorts cells across both, so pick surfaces that don't
intersect (an intersection can't be resolved without true 3-D clipping).
</template>
<notatio-plot-3d value="{Sin(x) * Cos(y) + 2.5, Cos(x) * Sin(y) - 2.5}" x-domain="-3.14,3.14" y-domain="-3.14,3.14" />
</Story>

<Story
  title="Axes off">
<notatio-plot-3d value="x^2 - y^2" x-domain="-2,2" y-domain="-2,2" axes="false" />
</Story>

## Manipulate

`params` binds `Manipulate` control tuples into the expression; each control
fills the matching named wildcard (control `k` fills `_k`). Each slider gets a
**play button (▶)** that animates it on a loop. Drag still rotates the view.

<Story
  title="Sweep a frequency (press ▶)">
<template #description>
The slider fills <code>_k</code> and re-samples the whole grid; press ▶
to sweep it.
</template>
<notatio-plot-3d value="Sin(_k * x) * Cos(_k * y)" x-domain="-3.14,3.14" y-domain="-3.14,3.14" params="{k, 0.5, 3}" />
</Story>

<Story
  title="Morph between two surfaces">
<template #description>
A blend parameter <code>t</code> in <code>[0, 1]</code> interpolates a saddle
into a ripple. Press ▶ to watch it morph.
</template>
<notatio-plot-3d value="(1 - _t) * (x^2 - y^2) + _t * Sin(x) * Cos(y) * 4" x-domain="-2,2" y-domain="-2,2" params="{t, 0, 1}" />
</Story>

<Story
  title="A travelling wavefront (animate the phase)">
<template #description>
Animating the phase <code>p</code> sends ripples outward from the origin.
</template>
<notatio-plot-3d value="Sin(2 * Sqrt(x^2 + y^2) - _p)" x-domain="-4,4" y-domain="-4,4" params="{p, 0, 6.283}" />
</Story>

## GPU evaluation

Sampling is normally done on the CPU — the expression is compiled to a native function
(so even `Manipulate` sliders stay smooth). Set **`gpu`** to instead evaluate the whole
grid in a **WebGPU compute shader**: the expression compiles to WGSL through
compute-engine's WGSL target (special-function heads like `HurwitzZeta` emit calls into the
[`zetaWGSL`](/explore/zeta/phase-portrait) kernel), one shader invocation per grid point.
`gpu="120"` also sets a denser grid, since the GPU handles far more points; a **GPU** badge
appears under the figure when the path is taken. It falls back to the CPU automatically
where WebGPU is unavailable or the expression can't be compiled — so it is safe to leave on.

<Story
  title="A surface evaluated on the GPU">
<template #description>
The grid (here 100×100) is computed in a compute shader, then drawn through the same SVG
surface. Needs a WebGPU browser; otherwise it renders on the CPU.
</template>
<notatio-plot-3d value="Sin(x) * Cos(y)" x-domain="-3.14,3.14" y-domain="-3.14,3.14" gpu="100" />
</Story>

## Roadmap

- Interactivity — pan, a shared-view "spin" toggle, more control kinds.
- GPU grid **evaluation** now has an opt-in path (`gpu`); the remaining lift is a GPU
  scene **renderer** (the sibling's `polytope-figure`) for when the SVG mesh stops scaling.
- Image export — a REPL requests a surface and gets back a rendered file.
