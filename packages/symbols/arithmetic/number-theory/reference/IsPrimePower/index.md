---
name: IsPrimePower
domain: Number theory
signature: IsPrimePower(n)
summary: Tests whether $n$ is a positive integer power of a single prime.
signatures:
  - call: IsPrimePower(n)
    description: $n = p^k$ for a prime $p$, $k \ge 1$
    library: enumeratio-number-theory
    type: (integer) -> boolean
seeAlso:
  - IsPrime
  - FactorInteger
names:
  wolfram: PrimePowerQ
bindings:
  - origin: mapped
    form: sage
    template: is_prime_power($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- $1=p^0$ does not count: it has no prime base.
- Wolfram's `PrimePowerQ`.
