---
name: Quotient
domain: Number theory
signature: Quotient(m, n)
summary: The integer quotient of $m$ by $n$ — for Gaussian integers, $m/n$ rounded to the nearest lattice point.
signatures:
  - call: Quotient(m, n)
    description: $\lfloor m/n \rfloor$ for integers; $m/n$ rounded half-even in each part for Gaussian integers
    library: enumeratio-number-theory
    type: (number, number, number?) -> number
seeAlso:
  - Mod
  - GCD
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: oscar
    template: fld(ZZ($1), ZZ($2))
    arity: 2
  - origin: mapped
    form: wolfram
    template: Quotient[$1, $2]
    arity: 2
    checked:
      version: 15.0.0
      on: 2026-09-28
  - origin: mapped
    form: wolfram
    template: Quotient[$1, $2, $3]
    arity: 3
    checked:
      version: 15.0.0
      on: 2026-09-28
---

- For integers, $\lfloor m/n \rfloor$, so $m = n\,\mathrm{Quotient}(m, n) + \mathrm{Mod}(m, n)$ with the remainder taking the sign of $n$.
- For Gaussian integers the quotient rounds instead, ties to even, which is what makes $\mathbb{Z}[i]$ Euclidean: the remainder then has smaller norm than $n$.
- compute-engine has no Quotient; this follows Wolfram's.
