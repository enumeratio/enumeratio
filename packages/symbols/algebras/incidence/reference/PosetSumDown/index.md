---
name: PosetSumDown
domain: Incidence algebras
signature: PosetSumDown(poset, values)
summary: "Sum a function down the poset's order: $g(y) = \\sum_{x \\le y} f(x)$, the map [[MoebiusInvert]] undoes."
signatures:
  - call: PosetSumDown(poset, values)
    description: $g(y) = \sum_{x \le y} f(x)$
    library: enumeratio-incidence
    type: (expression<BooleanLattice> | expression<Chain> | expression<DivisorLattice>, list<number>) -> list<number>
seeAlso:
  - MoebiusInvert
  - MoebiusFunction
  - PosetElements
---
