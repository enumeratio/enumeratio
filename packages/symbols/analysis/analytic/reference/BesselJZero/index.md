---
name: BesselJZero
domain: Special functions
signature: BesselJZero(nu, k)
summary: The $k$-th positive zero of the Bessel function $J_\nu$, for real $\nu > -1$ and positive integer $k$. Provided by `@enumeratio/analytic`.
signatures:
  - call: BesselJZero(nu, k)
    description: the $k$-th positive zero of $J_\nu$.
    library: "@enumeratio/analytic"
    type: (number, integer) -> number
primitive: numeric
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/bessel-zeros.ts
  - origin: mapped
    form: wolfram / mpmath
    environment: external
    note: BesselJZero[nu, k]; mpmath.besseljzero(nu, k).
seeAlso:
  - Sinc
names:
  wolframIdentity: true
---

- compute-engine's native `BesselJ` only evaluates numerically at integer order, so the zero-finder here carries its own real $J_\nu$ series (term-ratio, stable for the double-precision range zero-finding needs) rather than depending on it — which matters for exactly the half-integer orders Fungrim's identities use.
- A zero is located in doubles (McMahon's expansion, then a bracketed series search) and refined by Newton's method in arbitrary precision: the alternating series cancels about $x/2.3$ digits, so a double alone is good to roughly $16 - x/2.3$. Past $j = 400$ it stays symbolic.
- McMahon's asymptotic expansion seeds a bracket around the $k$-th zero, then bisection (with a few closing Newton steps) converges it.
- Matches mpmath's `besseljzero(nu, k)` and Wolfram's `BesselJZero[nu, k]`.
