---
name: AdicNumerals
domain: Numeral systems
signature: AdicNumerals(b, prec?)
summary: "The first `prec` $b$-adic digits, always fixed-width: the sign is folded into the digits rather than a sign bit, giving a bijection between $(-b^{prec}/2, b^{prec}/2]$ and width-`prec` digit strings."
signatures:
  - call: AdicNumerals(b, prec?)
    description: the system, width `prec` (default 20)
    library: enumeratio-numerals
    type: (integer, integer?) -> value
seeAlso:
  - IntegerDigits
  - AdicNumeral
  - AdicExpansion
---
