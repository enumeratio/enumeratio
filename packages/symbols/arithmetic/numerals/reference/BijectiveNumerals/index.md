---
name: BijectiveNumerals
domain: Numeral systems
signature: BijectiveNumerals(k)
summary: 'Bijective base $k$: digits $1,\dots,k$, with no zero digit at all — every positive integer has exactly one representation, and zero is the empty numeral. Bijective base 26 is how spreadsheet columns are lettered (A, …, Z, AA, …).'
signatures:
  - call: BijectiveNumerals(k)
    description: the system, digits $1,\dots,k$
    library: enumeratio-numerals
    type: (integer) -> value
seeAlso:
  - IntegerDigits
  - BijectiveRadix
---
