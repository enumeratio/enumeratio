---
name: IntegerPart
domain: Elementary functions
signature: IntegerPart(x)
summary: "The integer part of x: x truncated toward 0."
signatures:
  - call: IntegerPart(x)
    description: x truncated toward 0.
    library: "@enumeratio/analytic"
    type: (number) -> number
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: (sign(re($1)) * floor(Abs(re($1))) + I * sign(im($1)) * floor(Abs(im($1))))
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: Each part is truncated toward 0, as Wolfram's IntegerPart truncates a complex number.
  - origin: mapped
    form: sage
    template: (floor($1) if ($1) >= 0 else ceil($1))
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: trunc($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: num-rational 0.4.2
      on: 2026-10-16
---

- Truncates toward 0, unlike [[Floor]] (which rounds toward $-\infty$): $\mathrm{IntegerPart}(-2.4) = -2$, where $\mathrm{Floor}(-2.4) = -3$.
- Exact at an exact argument -- a rational reduces to an exact integer, and so does a symbolic constant like Pi ($\mathrm{IntegerPart}(\pi) = 3$, not a decimal).
- At a concretely complex argument, truncates the real and imaginary parts separately.
- $x = \mathrm{IntegerPart}(x) + \mathrm{FractionalPart}(x)$ always -- see [[FractionalPart]].
