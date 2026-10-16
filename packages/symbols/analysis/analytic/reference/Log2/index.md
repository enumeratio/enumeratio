---
name: Log2
domain: Elementary functions
signature: Log2(z)
summary: The base-2 (binary) logarithm of z.
signatures:
  - call: Log2(z)
    description: the base-2 logarithm of z, $\log_2(z)$.
seeAlso:
  - Log
  - Log10
  - Lb
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: log($1, 2)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
  - origin: mapped
    form: mpmath
    template: log($1, 2)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: julia
    template: enumeratio_ball(_log2, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- Equivalent to Log(z, 2), and identical to [[Lb]].
- Folds exactly for an integer power of 2 in either direction -- positive ($1024 \to 10$) or negative ($1/8 \to -3$).
