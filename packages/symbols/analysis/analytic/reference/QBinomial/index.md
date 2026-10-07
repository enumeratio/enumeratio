---
name: QBinomial
domain: Special functions
signature: QBinomial(n, k, q)
summary: The Gaussian (q-)binomial coefficient $\binom{n}{k}_q$, the generating polynomial in $q$ for partitions fitting in a $k \times (n-k)$ box. Provided by `@enumeratio/analytic`.
signatures:
  - call: QBinomial(n, k, q)
    description: the Gaussian binomial coefficient $\binom{n}{k}_q$.
    library: "@enumeratio/analytic"
    type: (complex, complex, complex) -> number
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/q-series.ts
    note: the Pascal-like recurrence, built at canonicalization time so Expand sees the tree.
  - origin: mapped
    form: wolfram
    environment: external
    note: QBinomial[n, k, q].
seeAlso:
  - QPochhammer
  - QFactorial
  - Binomial
names:
  wolframIdentity: true
---

- Built by the Pascal-like recurrence $\binom{n}{k}_q = \binom{n-1}{k-1}_q + q^k \binom{n-1}{k}_q$, with $\binom{n}{0}_q = \binom{n}{n}_q = 1$ — pure addition and multiplication, never division, so it stays a genuine polynomial for symbolic $q$ that `Expand` can open up. The equivalent quotient $[n]_q!/([k]_q![n-k]_q!)$ is exact numerically but `Expand` alone can't cancel it down to a polynomial when $q$ is symbolic, which is why the recurrence is used instead.
- At $q = 1$ it reduces to the ordinary $\binom{n}{k}$ by the same recurrence Pascal's triangle uses.
- A symbolic, non-integer or negative $n$ or $k$ is a held call (still canonical, so it sits in a sum or difference). At $q = 0$ with a non-integer rational $n$ or $k$, `Series` expands the product $(q^{k+1};q)_\infty (q^{n-k+1};q)_\infty / \big((q;q)_\infty (q^{n+1};q)_\infty\big)$ as a series in $q^{1/d}$, with Wolfram's truncation; a shape outside $n \ge 0$, $-1 < k < n+1$ stays unevaluated.
