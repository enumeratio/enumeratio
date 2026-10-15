---
name: Log10
domain: Elementary functions
signature: Log10(z)
summary: The base-10 (common) logarithm of z.
signatures:
  - call: Log10(z)
    description: the base-10 logarithm of z, $\log_{10}(z)$.
seeAlso:
  - Log
  - Log2
  - Lb
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: log($1, 10)
    arity: 1
    threadArg: 1
    checked:
      version: 1.14.0
      on: 2026-10-14
---

- Equivalent to Log(z, 10) and to compute-engine's default-base [[Log]](z).
- Same exact-power-of-the-base fold in either direction as [[Log2]].
