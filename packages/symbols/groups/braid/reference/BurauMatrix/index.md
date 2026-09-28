---
name: BurauMatrix
domain: Braids and knots
signature: BurauMatrix(braid)
summary: The reduced Burau matrix of a braid, an $(n-1)\times(n-1)$ matrix over $\mathbb{Z}[t,t^{-1}]$ whose determinant gives the [[AlexanderPolynomial]].
signatures:
  - call: BurauMatrix(braid)
    description: the reduced Burau matrix itself
    library: enumeratio-braid
    type: (expression<Braid> | string) -> list<list<expression>>
seeAlso:
  - AlexanderPolynomial
  - Braid
---
