---
name: Determinant
domain: Compute engine
signature: Determinant(matrix) -> number
summary: Determinant of a square matrix.
signatures:
  - call: Determinant(matrix) -> number
    description: as compute-engine declares it
names:
  wolfram: Det
stub: engine
bindings:
  - origin: mapped
    form: sage
    template: matrix($1).det()
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---
