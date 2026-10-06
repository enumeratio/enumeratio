---
name: LambertW
domain: Special functions
signature: LambertW(z) / LambertW(z, k)
summary: The Lambert $W$ function (Wolfram's `ProductLog`), the inverse of $w\,e^w$. compute-engine's native `LambertW` already covers the principal ($k=0$) and lower-real ($k=-1$) branches numerically; extended here with exact values at algebraically nice points and every other integer branch.
signatures:
  - call: LambertW(z)
    description: the principal branch $W_0(z)$ — native, extended with exact values.
    library: "@enumeratio/analytic"
    type: (complex | infinity, number?) -> number
    overrides: compute-engine
  - call: LambertW(z, k)
    description: the $k$-th branch $W_k(z)$, by Halley's iteration from the standard log-log seed (Corless et al. 1996). $k=0$ and $k=-1$ stay on compute-engine's own native handler.
    library: "@enumeratio/analytic"
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/lambert-w.ts
    note: Halley's iteration in the complex plane for k ∉ {0, -1}; structural pattern matching for the exact cases.
seeAlso:
  - Exp
  - Ln
references:
  - system: wikipedia
    identity: Lambert W function
  - system: mathworld
    identity: LambertW-Function
  - system: dlmf
    identity: "4.13"
---

- Differs from Wolfram: the branch is the second argument, $\mathrm{LambertW}(z, k)$, in compute-engine's order. Wolfram's `ProductLog[k, z]` and Sage's `lambert_w(k, z)` take $(k, z)$; mpmath's `lambertw(z, k)` takes $(z, k)$, like ours. Keep this order in mind when pasting a call across systems: the same branch $W_{-1}(-0.2) \approx -2.5426$ is `LambertW(-0.2, -1)` here, `ProductLog[-1, -0.2]` in Wolfram, `lambert_w(-1, -0.2)` in Sage and `lambertw(-0.2, -1)` in mpmath. Swapped, `ProductLog[-0.2, -1]` is an error in Wolfram (the branch must be an integer), and `LambertW(-1, -0.2)` declines here. The Wolfram transpiler reverses the arguments at the boundary.
- Checked directly: `LambertW(-0.14, -1)` is the $k=-1$ branch. The Sage form is documented prior art, not run here.
- Exact values are recognized structurally at $z=0$, $z=e$ (giving $w=1$), $z=-1/e$ (giving $w=-1$), $z = n\,e^n$ for small integer $n$, and $z=-\ln(k)/k$ for small integer $k \ge 2$ (giving $w=-\ln k$, since $e^{-\ln k}=1/k$) — even under plain `evaluate()`, not just `N()`.
- Every other branch is solved by Halley's method in the complex plane; checked against `wolframscript`'s `N[ProductLog[k, z], 16]` at several points (real and complex $z$, several $k$) to full double precision.
