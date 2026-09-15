# ζ on the GPU: a phase portrait

[The two-argument zeta](/explore/zeta/) is a sheet when you plot its height. But its real
character shows when you fix $s$ and sweep the **second argument** $a$ across the whole
complex plane and colour each point by the value there — a _domain colouring_:

- **hue** is the phase $\arg \zeta(s, a)$, so a full turn of colour circles a zero or a
  pole;
- **brightness** rises with $|\zeta(s, a)|$ — dark at zeros, blazing at poles;
- faint **bands** mark each doubling of magnitude.

Every pixel below runs the same Euler–Maclaurin kernel as the CPU path —
`@enumeratio/analytic`'s exported `zetaWGSL`, evaluated per pixel, per frame, on the GPU,
through the general [`<notatio-complex-plot>`](/playground/complex-plot) element. Both conventions
are drawn at once from the same $s$, so the difference between them is a glance rather
than a toggle. Drag to pan, scroll to zoom; hit ▶ to sweep $\operatorname{Im}(s)$ up the
critical strip.

<Story
  title="Both conventions, swept together">
<template #description>
One pair of sliders drives both portraits, so the only difference on screen is the
convention.
</template>
<notatio-manipulate params="{ {sr, 1.5}, -2, 6, 0.05}; { {si, 4}, 0, 40, 0.25}" fps>
  <p><strong>HurwitzZeta(s, a)</strong> — poles at every nonpositive integer</p>
  <notatio-complex-plot value="HurwitzZeta(_sr + _si * i, z)" extent="8" height="380" />
  <p><strong>Zeta(s, a)</strong> — the generalized convention, no poles</p>
  <notatio-complex-plot value="Zeta(_sr + _si * i, z)" extent="8" height="380" />
</notatio-manipulate>
</Story>

## What to look for

**HurwitzZeta.** Along the negative real axis the poles at $a = 0, -1, -2, \ldots$ flare
white, each wrapped in a full pinwheel of phase. Between them the colour wheels turn the
other way around the zeros.

**Zeta.** In the lower portrait the poles are simply gone. The generalized zeta drops the
singular $(n + a) = 0$ term, so it is finite at the nonpositive integers — the left
half-plane reorganizes into a clean periodic lattice. That is the one real difference
between the two conventions, and with both drawn from the same $s$ it is the only thing
that differs between the two pictures.

**s up the critical strip.** Play the $si$ slider: at large imaginary part the
portrait develops the fine oscillatory texture that makes zeta on the critical line so
delicate. (The GPU works in `f32`, so this is a portrait, not a proof — the CPU kernel and
the mpmath/Wolfram oracles remain the source of truth for accuracy.)

## Why it's fast

Two compilers are at work. `ce.compile(expr, { target: "wgsl" })` normally can't emit these
heads — compute-engine doesn't know `HurwitzZeta` — so `@enumeratio/analytic` registers a
`compile` handler that emits a call into `zetaWGSL`. That path is real-scalar, which suits
a surface plot and not a portrait, where the phase _is_ the picture; so a second, complex
lowering emits the same kernels as `vec2f`, and that is what colours the plane above.

What keeps it interactive is that the sliders move a _literal_, not the expression's
shape. Numeric literals compile to uniform slots, and the pipeline is cached on the shape,
so dragging $\operatorname{Im}(s)$ re-uploads a few bytes rather than rebuilding a shader —
about 0.1 ms of work per frame outside the GPU. That headroom is why the value can be
_interpolated_ between slider steps instead of jumping: the slider is quantised and fires
below the refresh rate, and the frames in between are free.
