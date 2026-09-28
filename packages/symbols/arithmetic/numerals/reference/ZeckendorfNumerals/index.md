---
name: ZeckendorfNumerals
domain: Numeral systems
signature: ZeckendorfNumerals()
summary: 'Zeckendorf: binary digits over the Fibonacci place values $1,2,3,5,8,\dots$ — every positive integer has exactly one representation with no two adjacent ones, and greedy digit choice finds it.'
signatures:
  - call: ZeckendorfNumerals()
    description: the system, digits $0,1$, no two adjacent ones
    library: enumeratio-numerals
    type: () -> value
seeAlso:
  - IntegerDigits
  - OstrowskiNumerals
---
