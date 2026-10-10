---
name: Eulerian
domain: Combinatorics
signature: Eulerian(n, k)
summary: The Eulerian number $A(n, k)$, the number of permutations of $\{1, …, n\}$ with exactly $k$ descents (equally, $k$ ascents).
signatures:
  - call: Eulerian(n, k)
    description: the number of permutations of $\{1, …, n\}$ with exactly $k$ descents
seeAlso:
  - Descents
  - Ascents
  - KDescentPermutations
  - MahonianNumber
references:
  - system: oeis
    identity: A008292
  - system: wikipedia
    identity: Eulerian number
  - system: mathworld
    identity: EulerianNumber
---

- Counts from $k = 0$: $A(n, 0) = 1$ is the identity, and $A(n, k) = 0$ for $k \ge n$ (except $A(0, 0) = 1$). Combinatorica's `Eulerian[n, k]` has the same convention; the Function Repository's `ResourceFunction["EulerianNumber"][n, k]` counts $k$ from $1$, so it equals `Eulerian(n, k - 1)`. Wolfram 15 has no core `Eulerian`.
- Satisfies $A(n, k) = (k + 1)\,A(n - 1, k) + (n - k)\,A(n - 1, k - 1)$ and the symmetry $A(n, k) = A(n, n - 1 - k)$, which is why descents and ascents agree.
- Equals $Count(KDescentPermutations(n, k))$, and the number of permutations $p$ with $Descents(p) = k$; compute-engine's native, exact in bigints.
- A negative argument is left unevaluated (as is [[MahonianNumber]]); Combinatorica answers $0$ for a negative $k$.
