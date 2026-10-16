---
name: LiouvilleLambda
domain: Number theory
signature: LiouvilleLambda(n)
summary: The Liouville function $\lambda(n)=(-1)^{\Omega(n)}$.
signatures:
  - call: LiouvilleLambda(n)
    description: $(-1)^{\Omega(n)}$
    library: enumeratio-number-theory
    type: (integer) -> integer
seeAlso:
  - MoebiusMu
  - PrimeOmega
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: julia
    template: enumeratio_liouville($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
---

- Completely multiplicative: $\lambda(mn)=\lambda(m)\lambda(n)$ for every $m,n$, not just coprime ones — unlike [[MoebiusMu]].
- $\sum_{d\mid n}\lambda(d)$ is 1 when $n$ is a perfect square and 0 otherwise.
