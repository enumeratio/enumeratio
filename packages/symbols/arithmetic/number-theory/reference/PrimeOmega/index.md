---
name: PrimeOmega
domain: Number theory
signature: PrimeOmega(n)
summary: The number of prime factors of n, counted with multiplicity.
signatures:
  - call: PrimeOmega(n)
    description: number of prime factors of $n$, counted with multiplicity.
  - call: PrimeOmega(n)
    description: The number of prime factors of n, counted with multiplicity.
    library: enumeratio-number-theory
    type: (number | quadratic_integer, any*) -> integer
    overrides: compute-engine
seeAlso:
  - PrimeNu
  - FactorInteger
references:
  - system: wikipedia
    identity: Prime omega function
  - system: mathworld
    identity: PrimeFactor
  - system: oeis
    identity: A001222
names:
  wolframIdentity: true
---

- Counts every prime factor with multiplicity -- $\Omega(2^5)=5$, unlike [[PrimeNu]]'s 1.
- Completely additive: $\Omega(mn)=\Omega(m)+\Omega(n)$ for all $m,n$, not just coprime ones.
- $\Omega(1)=0$: 1 has no prime factors.
- $\Omega(n)=\nu(n)$ exactly when $n$ is squarefree; otherwise $\Omega(n)>\nu(n)$.
