---
name: PrimeNu
domain: Number theory
signature: PrimeNu(n)
summary: The number of distinct prime factors of n.
signatures:
  - call: PrimeNu(n)
    description: number of distinct prime factors of $n$.
  - call: PrimeNu(n)
    description: The number of distinct prime factors of n.
    library: enumeratio-number-theory
    type: (number | quadratic_integer, any*) -> integer
    overrides: compute-engine
seeAlso:
  - PrimeOmega
  - FactorInteger
references:
  - system: wikipedia
    identity: Prime omega function
  - system: mathworld
    identity: DistinctPrimeFactors
  - system: oeis
    identity: A001221
names:
  dlmf: number of distinct primes dividing a number
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: primenu($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: primenu counts distinct prime factors of an integer; a Gaussian integer is not one.
  - origin: mapped
    form: sage
    template: len(prime_divisors($1))
    arity: 1
    threadArgOnly: 1
    checked:
      version: "10.9"
      on: 2026-10-16
  - origin: mapped
    form: julia
    template: enumeratio_prime_nu($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: rust
    template: prime_nu($1)
    arity: 1
    threadArgOnly: 1
    note: The number of primes in the factorization.
    checked:
      version: primal 0.3.3
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: (ArithmeticFunction.cardDistinctFactors $1)
    arity: 1
    note: "ArithmeticFunction.cardDistinctFactors, omega(n): distinct prime factors, omega(0) = 0; natural n only."
---

- Counts distinct primes only -- $\nu(2^5)=1$, not 5.
- Equal to the length of [[FactorInteger]]$(n)$.
- $\nu(1)=0$: 1 has no prime factors.
- Always $\nu(n)\le\Omega(n)$, with equality exactly when $n$ is squarefree. See [[PrimeOmega]].
