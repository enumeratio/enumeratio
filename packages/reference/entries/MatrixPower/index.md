---
name: MatrixPower
domain: Compute engine
signature: MatrixPower(m, k)
summary: Compute-engine's own `MatrixPower`, widened to accept a [[ModularMatrix]] or a word in place of an ordinary matrix.
signatures:
  - call: MatrixPower(m, k)
    description: $m$ raised to the integer power $k$, in $\mathrm{PSL}(2,\mathbb{Z})$
    library: enumeratio-modular
    type: (expression<ModularMatrix> | matrix | real | string, real) -> expression<ModularMatrix> | matrix | real
    overrides: compute-engine
seeAlso:
  - ModularMatrix
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: "[list(r) for r in (matrix($1)^$2).rows()]"
    arity: 2
    checked:
      version: "10.9"
      on: 2026-10-16
---
