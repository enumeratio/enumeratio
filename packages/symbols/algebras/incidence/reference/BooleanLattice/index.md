---
name: BooleanLattice
domain: Incidence algebras
signature: BooleanLattice(n)
summary: The poset of subsets of $\{1,\dots,n\}$ ordered by inclusion, on which [[MoebiusFunction]] gives the signs of inclusion–exclusion.
signatures:
  - call: BooleanLattice(n)
    description: subsets of $\{1,\dots,n\}$ ordered by inclusion
    library: enumeratio-incidence
    type: (integer) -> expression<BooleanLattice>
seeAlso:
  - IncidenceAlgebra
  - PosetElements
  - MoebiusFunction
---
