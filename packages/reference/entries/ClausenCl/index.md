---
name: ClausenCl
domain: Special functions
signature: ClausenCl(n, θ)
summary: 'The Clausen functions $\mathrm{Cl}_n(\theta)$: $\sum_{k\ge1} \sin(k\theta)/k^n$ for even $n$ and $\sum_{k\ge1} \cos(k\theta)/k^n$ for odd $n$ — the imaginary or real part of $\operatorname{Li}_n(e^{i\theta})$. Provided by `@enumeratio/analytic`.'
signatures:
  - call: ClausenCl(n, θ)
    description: the Clausen function $\mathrm{Cl}_n(\theta)$ of integer order $n \ge 1$ and real $\theta$.
    library: enumeratio-analytic
    type: (integer, number) -> number
details:
  - $\mathrm{Cl}_2(\theta) = -\int_0^\theta \ln\left|2\sin\tfrac{t}{2}\right|\,dt$ is the classical Clausen function; $\mathrm{Cl}_1(\theta) = -\ln|2\sin(\theta/2)|$, infinite at $\theta \equiv 0$.
  - "Parity alternates with the order (DLMF §25.12(ii), mpmath's `clsin` / `clcos`): even $n$ gives the odd, $2\\pi$-periodic sine series, odd $n$ the even cosine series, so that $\\mathrm{Cl}_n(\\theta) = \\operatorname{Im}\\operatorname{Li}_n(e^{i\\theta})$ or $\\operatorname{Re}\\operatorname{Li}_n(e^{i\\theta})$ respectively. See [[PolyLog]]."
  - "Special values: $\\mathrm{Cl}_2(\\pi/2) = G$ (Catalan's constant), $\\mathrm{Cl}_{2m}(0) = \\mathrm{Cl}_{2m}(\\pi) = 0$, $\\mathrm{Cl}_{2m+1}(0) = \\zeta(2m+1)$, $\\mathrm{Cl}_{2m+1}(\\pi) = -\\eta(2m+1)$, $\\mathrm{Cl}_{2m}(\\pi/2) = \\beta(2m)$, $\\mathrm{Cl}_{2m+1}(\\pi/2) = -2^{-(2m+1)}\\eta(2m+1)$. See [[DirichletEta]], [[DirichletBeta]]."
  - $\mathrm{Cl}_2$ peaks at $\theta = \pi/3$ with value $1.01494\ldots$, the Gieseking constant's companion; the volume of the ideal regular tetrahedron is $3\,\mathrm{Cl}_2(\pi/3)/2$.
  - "Wolfram has no Clausen head: there it is spelled $\\operatorname{Im}[\\mathrm{PolyLog}[n, e^{i\\theta}]]$, which is how the oracle checks are phrased. Numerically, the polylogarithm's expansion at the unit circle (DLMF 25.12.12) with $\\theta$ reduced into $(-\\pi, \\pi]$."
bindings:
  - origin: reference
    form: notatio
    environment: engine
    expr:
      [
        Which,
        [IsEven, _n],
        [Im, [PolyLog, _n, [Exp, [Multiply, ImaginaryUnit, _theta]]]],
        True,
        [Re, [PolyLog, _n, [Exp, [Multiply, ImaginaryUnit, _theta]]]],
      ]
    note: "Cl_n cuts Li_n(e^{iθ}) in two by parity: the even orders are the sine series (its imaginary part), the odd orders the cosine series (its real part)."
  - origin: native
    form: typescript
    environment: engine
    source: upstream/compute-engine/src/compute-engine/numerics/clausen.ts
  - origin: mapped
    form: wolfram
    template: ResourceFunction["ClausenCl"][$1, $2]
    arity: 2
    note: 'No built-in Clausen head; the Wolfram Function Repository''s own ResourceFunction["ClausenCl"] matches ours -- Catalan at (2, π/2), 0 at (2, π), -3/4 ζ(3) at (3, π), DirichletBeta[4] at (4, π/2), 1.0149416064096535 at (2, 1.047…). Needs network access to the Function Repository to run. Known quirk: at (3, 0) it returns an unevaluated If[OddQ, Zeta[3], 0] -- a bug in the repository function, not ours -- so that example''s oracle verdict should read as inconclusive, not disagree.'
    checked:
      version: 15.0.0
      on: 2026-09-28
  - origin: mapped
    form: mpmath
    environment: external
    note: clsin(n, θ) for even n, clcos(n, θ) for odd n. Wolfram has no head; Im/Re PolyLog[n, E^(I θ)] instead.
    checked:
      version: 1.3.0
      on: 2026-09-27
seeAlso:
  - PolyLog
  - DirichletBeta
  - DirichletEta
  - Zeta
references:
  - system: wikipedia
    identity: Clausen function
  - system: mathworld
    identity: ClausenFunction
---
