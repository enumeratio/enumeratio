# Output syntax

The mirror of [input syntax](/guide/): the forms an expression comes back _out_
in. Any output cell (`<notatio-out>`) offers these through the form selector
on its right — and they compose (TeXForm of a MatrixForm is the `\begin{pmatrix}`
string).

## The forms

- **Display** — typeset math: **StandardForm**, **TraditionalForm** (conventional
  notation), **MatrixForm** (a List as a bracketed matrix).
- **Structure** — **TreeForm**: the expression as a tree of heads, opened one level
  at a time, each closed node summarised as a line of [InputForm](/reference/formats/inputform).
  How a reference page shows a head's defining expression down to the heads it
  bottoms out in.
- **Text** — a serialised string: **MathJSON** (the AST), **TeXForm** (LaTeX),
  **AsciiMathForm** (plain-text math), and
  [**MathMLForm**](/reference/formats/output/mathml) — presentation MathML, which unlike
  the others does not round-trip: there is no MathML parser on the other side.
- **Code** — source in another language, a _translation_ whose semantics may
  _diverge_ from compute-engine's. Each seeds an editable try-it cell and flags
  footguns:
  Listed in the order the CLI's `-f` names them (`FORMS`, `packages/cli/src/engine.ts`):

  - [Wolfram FullForm](/reference/formats/output/wolfram) — Wolfram Language `Head[…]`.
  - [NumPy](/reference/formats/output/numpy) — Python/NumPy source.
  - [GLSL](/reference/formats/output/glsl) — OpenGL shader source.
  - [WGSL](/reference/formats/output/wgsl) — WebGPU shader source, and **GPUShaderForm**,
    the whole shader a GPU path here would run for the expression.
  - [JavaScript](/reference/formats/output/javascript) — JS source (the default eval target).

## On the code forms

A code form is a _translation_, and translations aren't always faithful — Wolfram
rounds half-to-even, NumPy has no rationals, and so on. Where that happens we flag
it. The longer-term aim is to **compile into something slightly different** so the
result matches compute-engine's semantics; until then, the alterations and
footguns are documented on each page.
