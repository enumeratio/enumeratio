# WGSL

A **code output form**: WebGPU Shading Language source, via compute-engine's WGSL
target (the `WGSLForm` form) — WebGPU's shader language. For scalar math it reads
much like [GLSL](/reference/formats/output/glsl); it diverges from GLSL in typing and
built-in names for anything beyond plain arithmetic and common functions.

Like any shader language it's floating-point, so exact rationals become float
literals. Each row shows an expression and its WGSL source.

<SourceOutput language="wgsl" />

## GPUShaderForm — the whole shader

`WGSLForm` is the expression alone. **GPUShaderForm** is the complete shader one of this
site's GPU paths would run for it: with one unknown, the domain-colouring fragment shader
`<notatio-complex-plot>` compiles (the unknown is the complex variable, and the special
functions it may call — `Zeta`, `HurwitzZeta`, `PolyLog` — are prepended); with one or two
real unknowns, the compute shader the plot grid evaluator dispatches, one invocation per
grid point. Three or more unknowns, or an expression neither path can emit, has no shader
form and the entry is left off the menu.

<notatio-output value="\zeta(s)" form="gpushader" label="Out" />
