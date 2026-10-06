---
name: PrimeNumbers
domain: Collections
signature: PrimeNumbers
summary: The prime numbers $2, 3, 5, 7, 11, …$ as a lazy indexed collection, unranked by position.
formerly:
  - Primes
signatures:
  - call: PrimeNumbers
    description: the primes in increasing order, an infinite indexed collection.
enumerate:
  expr: Take(PrimeNumbers, 20)
seeAlso:
  - Primes
  - Count
  - At
  - Element
  - SquareNumbers
  - AbundantNumbers
  - SmoothNumbers
catalog:
  - system: mathlib4
    identity: Nat.Prime
    url: https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Nat/Prime/Defs.html
  - system: matlab
    identity: primes
    url: https://www.mathworks.com/help/matlab/ref/primes.html
    note: primes(n) returns all primes ≤ n (a value-bounded set, count depends on n) — our prime_numbers is RANK-indexed (the k-th prime by index); the underlying set is the same, only the query shape differs
  - system: oeis
    identity: A000040
    url: https://oeis.org/A000040
  - system: sage
    identity: sage.sets.primes.Primes()
    url: https://doc.sagemath.org/html/en/reference/sets/sage/sets/primes.html
grades: []
carrier: Numeric
unbounded: true
---

- A lazy indexed collection: $Count(PrimeNumbers) = +\infty$, and $At(PrimeNumbers, k)$ unranks the $k$-th prime without ever sieving a full prefix -- $At(PrimeNumbers, 5) = 11$.
- OEIS A000040.
- Membership goes through [[Element]]: $Element(11, PrimeNumbers)$ is true, $Element(9, PrimeNumbers)$ is false.
- Distinct from [[Primes]], compute-engine's own `set<integer>` constant: a value can't be extended, so the two don't share one name.
