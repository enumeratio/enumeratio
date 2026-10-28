---
name: MangoldtLambda
domain: Number theory
signature: MangoldtLambda(n)
summary: 'The von Mangoldt function: $\ln p$ if $n$ is a power of the prime $p$, else 0.'
signatures:
  - call: MangoldtLambda(n)
    description: $\ln p$ for $n=p^k$, else 0
    library: enumeratio-number-theory
    type: (integer) -> number
bindings:
  - origin: mapped
    form: sympy
    template: (log(list(factorint($1))[0]) if $1 > 1 and len(factorint($1)) == 1 else 0)
    arity: 1
    threadArgOnly:
      - 1
    checked:
      version: 1.14.0
      on: 2026-10-28
seeAlso:
  - IsPrimePower
  - FactorInteger
names:
  wolframIdentity: true
---

- Exact: the result is a symbolic $\ln p$, not a numeric approximation — wrap in [[N]] to get one.
- $\sum_{d\mid n}\Lambda(d)=\ln n$; central to the prime-counting proofs (Chebyshev's $\psi$ and $\theta$ functions).
