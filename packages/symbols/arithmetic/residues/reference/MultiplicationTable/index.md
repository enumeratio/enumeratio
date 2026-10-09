---
name: MultiplicationTable
domain: Modular arithmetic
signature: MultiplicationTable(R)
summary: "The multiplication table of ℤ/n, R = QuotientRing(Integers, n): the matrix whose (i, j) entry is aᵢaⱼ, its rows and columns ℤ/n's elements in the order `ElementOrder` lists them."
signatures:
  - call: MultiplicationTable(R)
    description: the n × n matrix of products, as ResidueClass entries, for 2 ≤ n ≤ 64
    library: enumeratio-residues
    type: (value, value*) -> list
  - call: MultiplicationTable(R, ElementOrder -> order)
    description: rows and columns listed `Natural` (0, 1, …), by their `ChineseRemainder` residues, or by their p-adic digits (`Adic`)
    library: enumeratio-residues
    type: (value, value*) -> list
seeAlso:
  - AdditionTable
  - QuotientRing
  - MultiplicativeOrder
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: "Wolfram has no ring tables: GroupMultiplicationTable tabulates a group, and ℤ/n under multiplication is not one."
---

- The units' rows and columns form a Latin square: the multiplication table of the unit group
- Listed by Chinese remainders, the idempotents mark how n splits; listed by digits, ℤ/pᵏ's table is p × p blocks of ℤ/pᵏ⁻¹'s, each block the products of the lifts of one pair of residues
- A `Show` draws it at any size as `ArrayPlot(MultiplicationTable(R))`; as a value it stops at n = 64
