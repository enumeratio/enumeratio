---
name: CliffordConjugate
domain: Geometric algebra
signature: CliffordConjugate(x)
summary: 'Clifford conjugation $\bar{x}$: reversion after grade involution, costing sign $(-1)^{k(k+1)/2}$ per grade $k$.'
signatures:
  - call: CliffordConjugate(x)
    description: $\bar{x}$, the Clifford conjugate of $x$
    library: enumeratio-geometric
    type: (number) -> number
seeAlso:
  - Reversion
  - GradeInvolution
  - Sandwich
---
