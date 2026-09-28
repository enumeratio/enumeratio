---
name: BraidProduct
domain: Braids and knots
signature: BraidProduct(a, b)
summary: The product of two braids on the same number of strands — one word after the other.
signatures:
  - call: BraidProduct(a, b)
    description: the two words concatenated
    library: enumeratio-braid
    type: (expression<Braid> | string, expression<Braid> | string) -> expression<Braid>
seeAlso:
  - BraidInverse
  - BraidPower
---
