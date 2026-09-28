---
name: BraidWrithe
domain: Braids and knots
signature: BraidWrithe(braid)
summary: The exponent sum of a braid word, i.e. the abelianisation $B_n \to \mathbb{Z}$ — and the writhe of the closed diagram.
signatures:
  - call: BraidWrithe(braid)
    description: the exponent sum, i.e. the abelianisation $B_n \to \mathbb{Z}$
    library: enumeratio-braid
    type: (expression<Braid> | string) -> integer
seeAlso:
  - BraidCrossings
  - BracketInvariant
---
