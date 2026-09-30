---
name: Truncate
domain: Arithmetic
signature: Truncate(x)
summary: The integer part of x, rounding toward 0.
signatures:
  - call: Truncate(x)
    description: the integer part of x, rounded toward 0.
  - call: Truncate(x)
    description: the integer part of x, rounded toward 0, exact for an exact rational.
    library: enumeratio-analytic
    type: (real | signed_infinity) -> integer | signed_infinity
    overrides: compute-engine
seeAlso:
  - Floor
  - Ceil
  - Round
references:
  - system: wikipedia
    identity: Truncation
names:
  wolfram: IntegerPart
bindings:
  - origin: mapped
    form: wolfram
    template: IntegerPart[$1]
    arity: 1
---

- Rounds toward 0: [[Floor]] for $x \ge 0$ and [[Ceil]] for $x < 0$, so $\operatorname{Truncate}(-3.7) = -3$.
- An exact rational is truncated exactly, however large: $\operatorname{Truncate}\big((25! - 1)/24!\big) = 24$.
