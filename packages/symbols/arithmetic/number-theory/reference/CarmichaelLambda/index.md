---
name: CarmichaelLambda
domain: Number theory
signature: CarmichaelLambda(n)
summary: 'The Carmichael function $\lambda(n)$: the exponent of the multiplicative group mod $n$ — the least $m$ with $a^m\equiv1\pmod n$ for every $a$ coprime to $n$.'
signatures:
  - call: CarmichaelLambda(n)
    description: the exponent of $(\mathbb{Z}/n)^\times$
  - call: CarmichaelLambda(n)
    description: 'The Carmichael function $\lambda(n)$: the exponent of the multiplicative group mod $n$ — the least $m$ with $a^m\equiv1\pmod n$ for every $a$ coprime to $n$.'
    library: enumeratio-number-theory
    type: (integer) -> integer
    overrides: compute-engine
seeAlso:
  - Totient
  - MultiplicativeOrder
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: sympy
    template: reduced_totient($1)
    arity: 1
    threadArgOnly: 1
    checked:
      version: 1.14.0
      on: 2026-10-12
    note: reduced_totient is SymPy's Carmichael function.
---

- compute-engine has this natively; the gap closed here is Wolfram's $\lambda(-n)=\lambda(n)$ and threading over a list, which the native handler left unevaluated.
- $\lambda(n) \mid \varphi(n)$ always, and the two agree exactly when $(\mathbb{Z}/n)^\times$ is cyclic. See [[Totient]].
