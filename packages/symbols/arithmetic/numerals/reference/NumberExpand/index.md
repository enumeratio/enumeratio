---
name: NumberExpand
domain: Numeral systems
signature: NumberExpand(n, base?, len?)
summary: "The place-value terms of $n$: each digit times its power of the base."
signatures:
  - call: NumberExpand(n)
    description: the base-10 place-value terms of $n$
    library: enumeratio-numerals
    type: (integer, integer?, integer?) -> list
  - call: NumberExpand(n, base)
    description: place-value terms in the given base
  - call: NumberExpand(n, base, len)
    description: padded to `len` digits (leading zero terms) first
seeAlso:
  - IntegerDigits
  - IntegerLength
names:
  wolframIdentity: true
---

- The terms sum back to $n$: `Total(NumberExpand(n))` is $n$
- Every term carries the sign of $n$, not just the leading one
