# MathJSON

MathJSON is compute-engine's expression AST — the most explicit input form, and
what every other input (LaTeX, …) parses into. A notatio component takes it via
`format="mathjson"`.

## The shape

An expression is a number, a string (a symbol), or a function as an array
`["Head", ...args]`:

<notatio-output value='["Add", ["Power", "x", 2], 1]' format="mathjson" label="In" />

Toggle the Out form (hover the label) to **FullForm** to read the MathJSON back,
or **StandardForm**/**TeXForm** to see it typeset.

## Atoms

- **Numbers** are JSON numbers: `2`, `-3.5`, `1.5e3`. For exact values beyond a
  double, use a string-wrapped number `{ "num": "123456789012345678" }`.
- **Symbols** are strings: `"x"`, `"Pi"`, `"ExponentialE"`. Reserved constants
  have canonical names — `Pi`, `ExponentialE` (e), `ImaginaryUnit` (i),
  `PositiveInfinity`.
- **Strings** (text, not symbols) are wrapped: `["String", "hello"]`.

## Footguns

- **A symbol is a string, a string literal is wrapped.** `"Pi"` is the constant
  π; a literal word is `["String", "Pi"]`. Bare `"2"` is _not_ the number 2 —
  numbers are JSON numbers, so write `2`.
- **Rationals stay exact.** `["Rational", 1, 2]` is ½, not `0.5`. Writing `0.5`
  gives a float. This matters downstream: the [NumPy](/reference/formats/output/numpy)
  target has no rationals and collapses `["Rational",1,2]` to `0.5`.
- **Function heads are capitalised.** It's `["Sin", "x"]`, not `["sin","x"]`.
- **Lists are a head too.** `["List", 1, 2, 3]`, not a bare JSON array at the top
  level — the outermost array is always `[head, ...args]`.

<notatio-output value='["List", ["Rational", 1, 2], ["Rational", 1, 3]]' format="mathjson" label="In" />
