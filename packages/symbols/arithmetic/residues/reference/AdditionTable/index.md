---
name: AdditionTable
domain: Modular arithmetic
signature: AdditionTable(R)
summary: "The addition table of ℤ/n, R = QuotientRing(Integers, n): the matrix whose (i, j) entry is aᵢ + aⱼ, its rows and columns ℤ/n's elements in the order `ElementOrder` lists them."
signatures:
  - call: AdditionTable(R)
    description: the n × n matrix of sums, as ResidueClass entries, for 2 ≤ n ≤ 64
    library: enumeratio-residues
    type: (value, value*) -> list
  - call: AdditionTable(R, ElementOrder -> order)
    description: rows and columns listed `Natural` (0, 1, …), by their `ChineseRemainder` residues, or by their p-adic digits (`Adic`)
    library: enumeratio-residues
    type: (value, value*) -> list
seeAlso:
  - MultiplicationTable
  - QuotientRing
  - ResidueClass
bindings:
  - origin: mapped
    form: wolfram
    counterpart: false
    note: Wolfram's GroupMultiplicationTable[CyclicGroup[n]] tabulates the same group, by element indices in GroupElements' order rather than by residues.
---

- A circulant: each row is the one above shifted by one place, so every value appears once in each row and column
- Listed by Chinese remainders, ℤ/mn's table (m, n coprime) is ℤ/m's with a copy of ℤ/n's in each cell; listed by digits, ℤ/pᵏ's is p × p blocks of ℤ/pᵏ⁻¹'s
- A `Show` draws it at any size as `ArrayPlot(AdditionTable(R))`, its cells colored by their values; as a value it stops at n = 64
