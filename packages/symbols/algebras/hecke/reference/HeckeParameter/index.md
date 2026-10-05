---
name: HeckeParameter
domain: Hecke algebras
signature: HeckeParameter
summary: The deformation parameter $q$ of $H_n(q)$, the symbol every coefficient of a product is a polynomial in.
signatures:
  - call: HeckeParameter
    description: $q$, free until [[HeckeSpecialize]] gives it a value
    library: enumeratio-hecke
    type: number
seeAlso:
  - HeckeSpecialize
  - HeckeT
  - HeckeAlgebra
---

- Spelled out and capitalised so that a plain `q` stays free for you to use as a variable: a declared name is a defined symbol.
- Products in $H_n(q)$ write their coefficients with it, e.g. $T_s^2 = q + (q-1)T_s$ comes back in `HeckeParameter`.
