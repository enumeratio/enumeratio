---
name: NextPrime
domain: Number theory
signature: NextPrime(n, k?)
summary: The next prime strictly greater than n, or the kth prime after n.
signatures:
  - call: NextPrime(n)
    description: smallest prime strictly greater than $n$.
  - call: NextPrime(n, k)
    description: the $k$th prime after $n$; negative $k$ walks backward.
  - call: NextPrime(n, k?)
    description: The next prime strictly greater than n, or the kth prime after n.
    library: enumeratio-number-theory
    type: (number, number?) -> integer
    overrides: compute-engine
seeAlso:
  - NthPrime
  - PrimePi
references:
  - system: wikipedia
    identity: Prime number
  - system: mathworld
    identity: NextPrime
names:
  wolframIdentity: true
---

- NextPrime(n) is the $(m+1)$th prime, where $m$ is the count of primes $\le n$.
- NextPrime(n, k) generalizes to the $(m+k)$th prime, so a negative $k$ steps backward to a prime below $n$.
- n need not be prime or even an integer; compute-engine simply finds the next prime above it.
- Threads element-wise over a list, as Wolfram's Listable heads do.
