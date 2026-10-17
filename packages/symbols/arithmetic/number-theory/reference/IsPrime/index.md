---
name: IsPrime
domain: Number theory
signature: IsPrime(n)
summary: Tests whether n is a prime number.
signatures:
  - call: IsPrime(n)
    description: tests whether $n$ is prime.
  - call: IsPrime(n, Over -> GaussianIntegers)
    description: tests whether $n$ is prime in $\mathbb{Z}[i]$; a complex $n$ is always tested there
    library: enumeratio-number-theory
    type: (number | quadratic_integer, any*) -> boolean
    overrides: compute-engine
  - call: IsPrime(n, Over -> QuadraticIntegers(d))
    description: tests whether $n$ is prime in the ring of integers of $\mathbb{Q}(\sqrt d)$, where an irreducible need not be prime
    library: enumeratio-number-theory
    type: (number | quadratic_integer, any*) -> boolean
    overrides: compute-engine
seeAlso:
  - FactorInteger
  - NextPrime
references:
  - system: wikipedia
    identity: Primality test
  - system: mathworld
    identity: PrimalityTest
  - system: rosettacode
    identity: Primality by trial division
names:
  wolfram: PrimeQ
bindings:
  - origin: mapped
    form: wolfram
    template: PrimeQ[$1]
    arity: 1
  - origin: mapped
    form: sympy
    template: isprime($1)
    arity: 1
  - origin: mapped
    form: sage
    template: is_prime($1)
    arity: 1
    threadArgOnly:
      - 1
  - origin: mapped
    form: oscar
    template: is_prime(ZZ($1))
    arity: 1
  - origin: mapped
    form: julia
    template: is_prime(ZZ($1))
    arity: 1
    threadArgOnly: 1
    checked:
      version: Nemo 0.56.1
      on: 2026-10-16
  - origin: mapped
    form: mathlib4
    template: (decide (Nat.Prime $1))
    arity: 1
  - origin: mapped
    form: rust
    template: is_prime($1)
    arity: 1
    threadArgOnly: 1
---

- A prime has no positive divisors other than 1 and itself; 1 itself is not prime.
- Returns False unless n is provably prime -- there's no third "unknown" outcome.
- Threads element-wise over a list argument.
- A negative n is not prime: compute-engine rules `IsPrime(-7)` False, a prime being a natural number. Wolfram's PrimeQ counts a prime's associates and answers True.
