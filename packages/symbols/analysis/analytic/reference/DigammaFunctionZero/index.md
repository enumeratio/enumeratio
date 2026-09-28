---
name: DigammaFunctionZero
domain: Special functions
signature: DigammaFunctionZero(n)
summary: 'The $n$-th real zero of the digamma function $\psi$: $n=0$ names the zero on $(0,\infty)$ ($x_0 \approx 1.4616$), $n \ge 1$ the zero on $(-n, -n+1)$. Provided by `@enumeratio/analytic`.'
signatures:
  - call: DigammaFunctionZero(n)
    description: the $n$-th real zero of $\psi$, $n \ge 0$.
    library: "@enumeratio/analytic"
    type: (integer) -> number
details:
  - $\psi$ is real, meromorphic, with simple poles at $0, -1, -2, \dots$ and strictly increasing between consecutive poles ($\psi' = $ trigamma $> 0$), so each interval carries exactly one zero — bisection on the native [[PolyGamma]]/[[Digamma]] finds it without a separate digamma implementation.
  - $\psi(x_0) = 0$ at $x_0 \approx 1.4616321449683623$, sometimes called the digamma's positive real zero.
primitive: numeric
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/digamma-zero.ts
  - origin: mapped
    form: wolfram
    counterpart: false
    note: No direct equivalent head or built-in; N[x /. FindRoot[PolyGamma[0, x] == 0, {x, x0}]] would need a per-n bracket this row's fixed template can't supply. Wolfram Function Repository searched for a digamma-zero/root-finder resource specific to this; nothing found (only generic root-finding and PolyGamma-simplification resources turned up).
    checked:
      version: 15.0.0
      on: 2026-09-28
  - origin: mapped
    form: mpmath
    environment: external
    note: findroot(digamma, ...) at the appropriate bracket — Wolfram has no direct equivalent head.
seeAlso:
  - PolyGamma
---
