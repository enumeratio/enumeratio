---
name: NegativeNumerals
domain: Numeral systems
signature: NegativeNumerals(b)
summary: 'Base $-b$: digits $0,\dots,b-1$ again, but the place values alternate sign, so every integer — negatives included — has exactly one representation and there is no sign bit.'
signatures:
  - call: NegativeNumerals(b)
    description: the system, base $-b$
    library: enumeratio-numerals
    type: (integer) -> value
seeAlso:
  - IntegerDigits
  - BalancedNumerals
  - NegativeRadix
---
