---
name: AdicSqrt
domain: Numeral systems
signature: AdicSqrt(x, prec?)
summary: A square root of a [[AdicNumeral]] in $\mathbb{Q}_p$, found by Hensel lifting — defined only for prime bases, and only when one exists.
signatures:
  - call: AdicSqrt(x, prec?)
    description: the root, to `prec` digits (default 20)
    library: enumeratio-numerals
    type: (value, integer?) -> value
details:
  - Needs an even valuation, and (for odd $p$) a unit part that is a quadratic residue mod $p$; for $p=2$ the unit part must be $1 \bmod 8$
seeAlso:
  - AdicNumeral
  - HenselLift
---
