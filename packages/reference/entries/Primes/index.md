---
name: Primes
domain: Compute engine
signature: "Primes: set<integer>"
summary: The set of prime numbers, a constant compute-engine declares; it answers membership, not position.
signatures:
  - call: "Primes: set<integer>"
    description: a constant, as compute-engine declares it
seeAlso:
  - PrimeNumbers
  - Element
  - NthPrime
  - NextPrime
---

- Membership goes through [[Element]]: $Element(11, Primes)$ is true, $Element(9, Primes)$ is false.
- A set has no order, so $At(Primes, k)$ and $Take(Primes, k)$ don't apply. [[PrimeNumbers]] is the same primes as an indexed collection, and [[NthPrime]] is the $k$-th one.
