---
name: LinkingWithTrefoil
domain: The modular group
signature: LinkingWithTrefoil(matrix)
summary: The linking number of a hyperbolic element's modular knot with the trefoil — Ghys's theorem, and the same number as [[RademacherSymbol]].
signatures:
  - call: LinkingWithTrefoil(matrix)
    description: the linking number
    library: enumeratio-modular
    type: (expression<ModularMatrix> | list | string) -> integer
seeAlso:
  - RademacherSymbol
---
