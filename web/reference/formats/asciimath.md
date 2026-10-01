# AsciiMath

AsciiMath is a plain-text math notation (e.g. `sin(x)/2`). It's worth knowing
where it fits with compute-engine, because the support is one-directional.

## Output, not input (yet)

compute-engine **emits** AsciiMath — it's what `String(expr)` / `expr.toString()`
returns, and it surfaces as the **AsciiMathForm** output form:

<notatio-out value='["Divide", ["Sin", "x"], 2]' format="mathjson" form="asciimath" label="Out" />

But compute-engine does **not** parse AsciiMath as _input_. `ce.parse` reads
[LaTeX](/reference/formats/latex); to build an expression without LaTeX, hand it
[MathJSON](/reference/formats/mathjson) directly.

## Footgun

- **Don't paste AsciiMath into a LaTeX field.** Simple cases (`1/2`, `x^2`) may
  happen to parse because the syntaxes overlap, but anything with AsciiMath-only
  spelling (`sqrt x`, `sin x` without a command) will misparse. Use LaTeX
  (`\sqrt{x}`, `\sin x`) or MathJSON.
