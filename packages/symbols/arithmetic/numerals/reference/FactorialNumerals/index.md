---
name: FactorialNumerals
domain: Numeral systems
signature: FactorialNumerals()
summary: "Factoradic: place $k$ has weight $k!$ and digit at most $k$. The digits of $n$ are the Lehmer code of the $n$-th permutation in lexicographic order, so unranking a permutation and writing a number in this system are the same operation."
signatures:
  - call: FactorialNumerals()
    description: the system, place $k$ weighted $k!$
    library: enumeratio-numerals
    type: () -> value
seeAlso:
  - IntegerDigits
  - PrimorialNumerals
---
