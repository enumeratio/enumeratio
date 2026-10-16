---
name: RamanujanTau
domain: Number theory
signature: RamanujanTau(n)
summary: "Ramanujan's tau function: the coefficients of the discriminant modular form $\\Delta(q) = q\\prod_{k\\ge1}(1-q^k)^{24}$."
signatures:
  - call: RamanujanTau(n)
    description: the coefficient of $q^n$ in $\Delta(q)$
    library: enumeratio-number-theory
    type: (integer) -> integer
seeAlso:
  - PartitionsQ
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sage
    template: delta_qexp($1 + 1)[$1]
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Multiplicative: $\tau(mn)=\tau(m)\tau(n)$ for coprime $m,n$.
- Computed by truncated power-series multiplication of $\prod(1-q^k)^{24}$, exactly, not from a closed form.
