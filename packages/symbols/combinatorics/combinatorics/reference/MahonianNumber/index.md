---
name: MahonianNumber
domain: Combinatorics
signature: MahonianNumber(n, k)
summary: The number of permutations of $\{1, …, n\}$ with exactly $k$ inversions — entry $k$ of row $n$ of the Mahonian triangle.
signatures:
  - call: MahonianNumber(n, k)
    description: the coefficient of $q^k$ in the $q$-factorial $[n]_q!$
    library: enumeratio-combinatorics
    type: (integer, integer) -> integer
seeAlso:
  - Inversions
  - KInversionPermutations
  - Eulerian
  - MajorIndex
references:
  - system: oeis
    identity: A008302
  - system: wikipedia
    identity: Permutation#Inversions
catalog:
  - system: oeis
    identity: A008302
    url: https://oeis.org/A008302
---

- Equals $Count(KInversionPermutations(n, k))$, and the number of permutations $p$ with $Inversions(p) = k$.
- Satisfies $M(n, k) = \sum_{d < n} M(n - 1, k - d)$ and the symmetry $M(n, k) = M(n, \binom{n}{2} - k)$. It is $0$ for $k > \binom{n}{2}$.
- Defined in Epsil as that recurrence over a table of rows; a bigint kernel answers, exactly, and `tests/mahonian.test.ts` holds the two together.
- Combinatorica's `NumberOfPermutationsByInversions`; the same convention, with $k$ counted from $0$. A negative $n$ or $k$ is left unevaluated, as compute-engine's [[Eulerian]] does (Combinatorica leaves a negative $k$ unevaluated too). The kernel also declines, rather than block, past about three million cell updates (about 0.2 s).
- Not a core Wolfram head: there is no `MahonianNumber` in Wolfram 15 or the Function Repository.
