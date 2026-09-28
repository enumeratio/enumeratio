---
name: IncidenceAlgebra
domain: Incidence algebras
signature: IncidenceAlgebra(poset)
summary: The incidence algebra of a finite poset — basis [[PosetInterval]], product composition of intervals, invertible zeta function whose inverse is [[MoebiusFunction]].
signatures:
  - call: IncidenceAlgebra(poset)
    description: the algebra of intervals of the poset
    library: enumeratio-incidence
    type: (expression<BooleanLattice> | expression<Chain> | expression<DivisorLattice>) -> incidence_algebra
seeAlso:
  - PosetInterval
  - MoebiusFunction
  - PosetZeta
---
