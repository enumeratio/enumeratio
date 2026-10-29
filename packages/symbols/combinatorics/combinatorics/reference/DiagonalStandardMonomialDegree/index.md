---
name: DiagonalStandardMonomialDegree
domain: Dyck path statistics
signature: DiagonalStandardMonomialDegree(path)
summary: The degree of the standard monomial of the path relative to the diagonal boundary.
catalog:
  - system: findstat
    identity: St001508
    url: https://www.findstat.org/St001508
    on: DyckPath
statOn:
  - DyckPath
signatures:
  - call: DiagonalStandardMonomialDegree(path)
    description: The degree of the standard monomial of the path relative to the diagonal boundary.
    library: enumeratio-combinatorics
    type: (dyck_path) -> number
---

- Defined over `DyckPath` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `DyckPath` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St001508, as its Sage code walks the path. St001509, the same relative to the trivial lower boundary, is not adopted: its published code does not run.
