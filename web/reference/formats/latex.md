# LaTeX

LaTeX is compute-engine's default text input: `ce.parse("\\frac{1}{2}")`. `<notatio-out>`
takes it via `format="latex"` (its default); the plotting elements take Epsil
instead, and read LaTeX only inside a `$…$` island.

<notatio-out value="\sin(x)^2 + \cos(x)^2" format="latex" label="In" />

The same string typesets and parses to MathJSON. (An unevaluated LaTeX input
renders but doesn't populate the AST forms yet — add `evaluate` to box it, or see
the parse results below.)

## What it parses to

A few inputs and the MathJSON they produce:

| LaTeX         | MathJSON                        |
| ------------- | ------------------------------- |
| `\frac{1}{2}` | `["Rational", 1, 2]`            |
| `x^2 + 1`     | `["Add", ["Power", "x", 2], 1]` |
| `\sin x`      | `["Sin", "x"]`                  |
| `2x`          | `["Multiply", 2, "x"]`          |
| `\sqrt{-1}`   | `["Sqrt", -1]`                  |

## Footguns

- **Implicit multiplication is inferred.** `2x` parses as `["Multiply", 2, "x"]`,
  and `f(x)` may parse as multiplication unless `f` is a known function — prefer
  `\sin(x)`, `\ln(x)` with known heads.
- **`\log` vs `\ln`.** compute-engine's `\log` is base-10 (`Log`), `\ln` is
  natural (`Ln`) — the opposite of Wolfram's convention. See the
  [Ln](/reference/symbol/Ln) and [Log](/reference/symbol/Log) pages.
- **Whitespace and grouping.** `x^2+1` and `x^{2}+1` parse the same, but
  `x^2+1` vs `x^{2+1}` do not — brace your exponents.
- **Display vs parse.** What you type is parsed; what you see may be
  canonicalised when boxed (e.g. argument ordering). Use FullForm to check what
  compute-engine actually built.
