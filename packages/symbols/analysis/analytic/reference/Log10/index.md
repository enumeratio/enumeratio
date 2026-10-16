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
  - origin: mapped
    form: mpmath
    template: log10($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.3.0
      on: 2026-10-15
  - origin: mapped
    form: sage
    template: log($1, 10)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(_log10, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: log10($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: rustc 1.98.1
      on: 2026-10-16
---

- Equivalent to Log(z, 10) and to compute-engine's default-base [[Log]](z).
- Same exact-power-of-the-base fold in either direction as [[Log2]].
