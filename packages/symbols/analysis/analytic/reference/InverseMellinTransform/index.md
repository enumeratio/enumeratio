---
name: InverseMellinTransform
domain: Transforms
signature: InverseMellinTransform(F, s, x)
summary: The inverse Mellin transform — $f$ such that $\mathcal{M}\{f\}(s) = F(s)$ — as a rule table mirroring MellinTransform's nine pairs.
signatures:
  - call: InverseMellinTransform(F, s, x)
    description: $f(x)$ such that $\int_0^\infty f(x)\,x^{s-1}\,dx = F(s)$.
    library: "@enumeratio/analytic"
    type: (expression, expression, expression) -> expression
primitive: kernel
bindings:
  - origin: native
    form: typescript
    environment: engine
    source: packages/symbols/analysis/analytic/src/mellin-transform.ts
seeAlso:
  - MellinTransform
  - InverseLaplaceTransform
names:
  wolframIdentity: true
---

- Mirrors MellinTransform's nine pairs (each confirmed against `wolframscript`'s own `InverseMellinTransform`), with one exception: $\pi\csc(\pi s)/s$ inverts to $\log(1+1/x)$, NOT $\log(1+x)$ — Wolfram's default inversion contour for this particular $F(s)$ sits in the strip $0<\mathrm{Re}(s)<1$, while $\log(1+x)$'s own forward transform lives in $-1<\mathrm{Re}(s)<0$; the same $F(s)$ genuinely inverts to different $f(x)$ depending on which strip the (otherwise ambiguous) Mellin-Barnes contour sits in, and this matches Wolfram's actual default rather than assuming the round trip is symmetric.
- The scaling theorem ($F(s)/a^s \to f(ax)$, any provably positive `a`) generalizes every pair; the power shift ($F(s+c)\to x^c f(x)$) is supported only for the $\Gamma(s)\leftrightarrow e^{-x}$ pair (matching the one shifted example the forward table lists, $\Gamma(a+s)\to x^a e^{-x}$) — combining a shift and a scale together is declined (unverified).
- Beyond the nine: $1/(s+b)\to x^b\,\theta(1-x)$, its scaling $a^s/(s+b)\to(x/a)^b\,\theta(1-x/a)$, and $\Gamma(cs)^2\to(2/c)K_0(2x^{1/2c})$ ($\Gamma(s)^2\to 2K_0(2\sqrt x)$), the last two for a provably positive `a` or `c`.
- Also: $\Gamma((s+c+1)/2)/(s+c)\to\sqrt\pi\,x^c\operatorname{erfc}(x)$ ($c$ a half-integer or integer, any multiple of the denominator), and $\Gamma(\kappa s)\Gamma(1-2\kappa s)/\Gamma(1-\kappa s)\to m(1+4x^m)^{-1/2}$ for $\kappa=1/m$, the pair of $(1+x)^{-1/2}$ after Gamma's duplication formula and a scaling.
- Declined: anything outside these shapes.
