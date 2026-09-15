# Complex Plot

Domain-colouring of a complex-valued expression over the complex plane, rendered by
`<notatio-complex-plot>` — Wolfram's `ComplexPlot` — one WebGPU invocation per pixel. Hue is the argument, brightness
a compressed magnitude, poles blow out white and zeros go black.

Unlike the other plot elements, which sample a real-valued function, this one carries the
whole complex value: the phase _is_ the picture. It works on any expression the complex
GPU lowering can emit — the elementary operations, and the analytic special functions from
`@enumeratio/analytic`.

## Any expression

<Story
  title="A rational function">
<template #description>
The three cube roots of unity are the black zeros; the poles at <code>±i</code> are the
points every hue spirals into. Reading the colour wheel around a point gives its order,
and the direction of the winding says zero or pole.
</template>
<ClientOnly><notatio-complex-plot value="(z^3 - 1)/(z^2 + 1)" extent="4" height="380" /></ClientOnly>
</Story>

<Story
  title="An essential singularity">
<template #description>
Every hue, infinitely often, in any neighbourhood of the origin — Picard's theorem as a
picture.
</template>
<ClientOnly><notatio-complex-plot value="Exp(1/z)" extent="1.2" height="380" /></ClientOnly>
</Story>

## Special functions

<Story
  title="The Riemann zeta function">
<template #description>
The pole at <code>z = 1</code>, the trivial zeros marching left along the real axis, and
the critical strip's zeros stacked up the imaginary axis.
</template>
<ClientOnly><notatio-complex-plot value="Zeta(z)" extent="40" height="380" /></ClientOnly>
</Story>

<Story
  title="A disk of convergence">
<template #description>
<code>mask</code> dims everything outside that radius — for a series whose disk of
convergence is part of the story. The polylogarithm's Lerch series reaches
<code>|z| &lt; 1</code> only, so the lit disk is exactly its domain.
</template>
<ClientOnly><notatio-complex-plot value="PolyLog(2, z)" mask="1" height="380" /></ClientOnly>
</Story>

## Every constant an axis

Because the compiled pipeline is keyed on the expression's _shape_, moving a constant costs
one small uniform upload rather than a shader rebuild. So any literal can become a
Manipulate axis and still hold frame rate.

<Story
  title="The polylogarithm's order">
<template #description>
Sweep the order and watch the disk go from the wound-up spirals of a small real part to
the near-linear ramp where the first term dominates.
</template>
<ClientOnly>
<notatio-manipulate params="{s, 0.25, 6, 0.05}" fps>
<notatio-complex-plot value="PolyLog(_s, z)" mask="1" height="380" />
</notatio-manipulate>
</ClientOnly>
</Story>

<Story
  title="Two axes at once">
<template #description>
Framing is manipulable too — <code>center</code> takes the notatio list form
<code>[_c, 0]</code>, and <code>extent</code> a bare wildcard. The polygamma's poles sit
at <code>0, −1, −2, …</code>, of order <code>m+1</code> — raise the order and the hue
winds more times around each.
</template>
<ClientOnly>
<notatio-manipulate params="{m, 1, 12, 1}, {c, -4, 1, 0.1}">
<notatio-complex-plot value="PolyGamma(_m, z)" center="[_c, 0]" extent="6" height="380" />
</notatio-manipulate>
</ClientOnly>
</Story>

## Notes

- **WebGPU only.** Where it is unavailable the element says so rather than falling back —
  a CPU sampler at this resolution is seconds per frame, not milliseconds.
- **f32 on the GPU.** Good for ~5–6 digits. The CPU kernels in `@enumeratio/analytic` stay
  the source of truth; a portrait is for seeing shape, not for reading values off.
- **Expressions that do not lower** — an unsupported head, or a free symbol other than the
  plot variable — are reported instead of silently drawn wrong.
