---
name: QFactorial
domain: Special functions
signature: QFactorial(n, q)
summary: The q-factorial $[n]_q! = [1]_q [2]_q \cdots [n]_q$, where $[k]_q = 1 + q + \cdots + q^{k-1}$. Provided by `@enumeratio/analytic`.
signatures:
  - call: QFactorial(n, q)
    description: the q-factorial $[n]_q!$.
    library: "@enumeratio/analytic"
    type: (real, complex) -> number
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/q-series.ts
    note: product of q-integers, built at canonicalization time (not evaluate) so Expand sees the tree to open up.
  - origin: mapped
    form: wolfram
    environment: external
    note: QFactorial[n, q].
seeAlso:
  - QPochhammer
  - QBinomial
  - Factorial
names:
  wolframIdentity: true
---

- Built as a product of q-integers $[k]_q$, each a sum of $k$ powers of $q$ — exact boxed arithmetic throughout, so it reduces to a number for numeric $q$ (rational stays rational) and to a genuine polynomial in $q$ that `Expand` can open up for symbolic $q$.
- At $q = 1$, $[k]_1 = k$ termwise (no division, so no $q \to 1$ limit to take), reducing exactly to $n!$.
- A non-integer $n$ is the q-Gamma function, $[n]_q! = \Gamma_q(n+1)$, which `N()` evaluates for real $q > 0$ through the infinite products $(q;q)_\infty / \big((q^{n+1};q)_\infty (1-q)^n\big)$ (for $q > 1$ reflected by $[n]_q! = q^{n(n-1)/2}[n]_{1/q}!$, and $\Gamma(n+1)$ at $q = 1$). A negative integer $n$ is a pole, and $q \le 0$ stays symbolic.
- A symbolic, non-integer or negative $n$ is a held call (still canonical). At $q = 0$ with a non-integer rational $n$, `Series` expands the same product quotient as a series in $q^{1/d}$, with Wolfram's truncation; for $-2 < n < -1$ the leading factor makes it start at a positive fractional power, and a lower $n$ stays unevaluated.
