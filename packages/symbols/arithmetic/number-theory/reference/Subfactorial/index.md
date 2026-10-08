---
name: Subfactorial
domain: Combinatorics
signature: Subfactorial(n)
summary: "The number of derangements of n objects: permutations that leave no element in its original position."
signatures:
  - call: Subfactorial(n)
    description: the number of derangements $D_n$ of n objects.
  - call: Subfactorial(n)
    description: "The number of derangements of n objects: permutations that leave no element in its original position."
    library: enumeratio-number-theory
    type: (any) -> any
    overrides: compute-engine
seeAlso:
  - Factorial
references:
  - system: wikipedia
    identity: Derangement
  - system: mathworld
    identity: Subfactorial
  - system: oeis
    identity: A000166
names:
  wolframIdentity: true
---

- Closed form $D_n = n! \sum_{k=0}^{n} \frac{(-1)^k}{k!}$, so $D_n$ is n! divided by e and rounded to the nearest integer.
- Recurrence: $D_n = n\,D_{n-1} + (-1)^n$, with $D_0 = 1$.
- Also satisfies the two-term recurrence $D_{n+1} = n\,(D_n + D_{n-1})$.
- The classic hat-check problem: $D_n$ counts the ways n people can have their hats returned so nobody gets their own.
- compute-engine leaves negative arguments unevaluated rather than extending Subfactorial analytically.
- A real, non-integer n continues as $D_n = \Gamma(n+1, -1)/e$, complex-valued; `N(x, d)` past a double's digits sums $\Gamma(a) - e^{i\pi a}\sum_{k\ge 0} 1/(k!\,(a+k))$ with $a = n+1$ (DLMF 8.7.1).
