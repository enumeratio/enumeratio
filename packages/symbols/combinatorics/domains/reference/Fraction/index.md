---
name: Fraction
domain: Combinatorial maps
signature: Fraction(numerator, denominator)
summary: A bare numerator/denominator pair over `number`, kept unreduced — unlike [[RationalNumber]] or [[FractionalNumber]], whose components are `integer`.
signatures:
  - call: Fraction(numerator, denominator)
    description: a numerator/denominator pair, unreduced and untyped beyond `number`
    library: enumeratio-domains
    type: (tuple<number, number>) -> fraction
seeAlso:
  - RationalNumber
  - FractionalNumber
---
