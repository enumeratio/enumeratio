---
name: Lb
domain: Elementary functions
signature: Lb(z)
summary: The binary logarithm of z, identical to [[Log2]].
signatures:
  - call: Lb(z)
    description: the base-2 logarithm of z, $\log_2(z)$.
seeAlso:
  - Log2
  - Log
  - Log10
names:
  wolfram: Log2
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
    form: sage
    template: log($1, 2)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_ball(_log2, $1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- An alias for [[Log2]] -- the "lb" notation is borrowed from information theory and computer science, as opposed to "lg" for base 10.
- $\mathrm{Lb}$ is the binary logarithm, identical to [[Log2]].
