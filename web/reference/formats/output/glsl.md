# GLSL

A **code output form**: OpenGL Shading Language source, via compute-engine's GLSL
target (the `GLSLForm` form) — the C-like syntax of fragment and vertex shaders.
It translates numeric and function expressions; math maps to GLSL's built-ins.

Shaders are floating-point, so exact rationals become float literals, and only
scalar-math expressions translate cleanly. Each row shows an expression and its
GLSL source.

<SourceOutput language="glsl" />
