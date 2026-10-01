# @enumeratio/analytic

Analytic and special-function extensions for `@cortex-js/compute-engine` — everything past
the combinatorial collections: the Hurwitz-zeta family, Gamma-adjacent functions, elliptic
and modular functions, hypergeometric functions, integral transforms, and the symbolic
machinery (simplification, function-analysis predicates, ODE/difference-equation solving)
that reasons about them. Numeric kernels are the implementation; each head also carries a
reference definition in `definitions.ts` — the same function written as a plain expression
over compute-engine's own heads — that doubles as a differential oracle against the kernel.

## Usage

`declareAnalytic(ce)` declares everything in one pass. `./definitions` exports `DEFINITIONS`
and `PRIMITIVE` for reading a head's reference expression without declaring the package.

```text
HurwitzZeta(2, 1)
// Pi ^ 2 / 6 — reduces to the ordinary zeta at a = 1
```

## Heads

**Zeta and Dirichlet family** — [`Zeta`](https://enumeratio.dev/reference/symbol/Zeta),
[`HurwitzZeta`](https://enumeratio.dev/reference/symbol/HurwitzZeta),
[`LerchPhi`](https://enumeratio.dev/reference/symbol/LerchPhi),
[`PolyLog`](https://enumeratio.dev/reference/symbol/PolyLog),
[`DirichletL`](https://enumeratio.dev/reference/symbol/DirichletL),
[`DirichletEta`](https://enumeratio.dev/reference/symbol/DirichletEta),
[`DirichletBeta`](https://enumeratio.dev/reference/symbol/DirichletBeta),
[`DirichletCharacter`](https://enumeratio.dev/reference/symbol/DirichletCharacter),
[`StieltjesGamma`](https://enumeratio.dev/reference/symbol/StieltjesGamma),
[`PrimeZetaP`](https://enumeratio.dev/reference/symbol/PrimeZetaP),
[`MultiZetaValue`](https://enumeratio.dev/reference/symbol/MultiZetaValue),
[`RiemannSiegelZ`](https://enumeratio.dev/reference/symbol/RiemannSiegelZ),
[`RiemannSiegelTheta`](https://enumeratio.dev/reference/symbol/RiemannSiegelTheta),
[`RiemannZetaZero`](https://enumeratio.dev/reference/symbol/RiemannZetaZero),
[`KeiperLiLambda`](https://enumeratio.dev/reference/symbol/KeiperLiLambda),
[`ClausenCl`](https://enumeratio.dev/reference/symbol/ClausenCl).

**Gamma-adjacent** — [`Gamma`](https://enumeratio.dev/reference/symbol/Gamma),
[`GammaLn`](https://enumeratio.dev/reference/symbol/GammaLn),
[`GammaRegularized`](https://enumeratio.dev/reference/symbol/GammaRegularized) /
[`InverseGammaRegularized`](https://enumeratio.dev/reference/symbol/InverseGammaRegularized),
[`Beta`](https://enumeratio.dev/reference/symbol/Beta) /
[`BetaRegularized`](https://enumeratio.dev/reference/symbol/BetaRegularized) /
[`InverseBetaRegularized`](https://enumeratio.dev/reference/symbol/InverseBetaRegularized),
[`Digamma`](https://enumeratio.dev/reference/symbol/Digamma),
[`PolyGamma`](https://enumeratio.dev/reference/symbol/PolyGamma),
[`BarnesG`](https://enumeratio.dev/reference/symbol/BarnesG) /
[`LogBarnesG`](https://enumeratio.dev/reference/symbol/LogBarnesG),
[`BernoulliB`](https://enumeratio.dev/reference/symbol/BernoulliB),
[`HarmonicNumber`](https://enumeratio.dev/reference/symbol/HarmonicNumber),
[`Pochhammer`](https://enumeratio.dev/reference/symbol/Pochhammer) /
[`RisingFactorial`](https://enumeratio.dev/reference/symbol/RisingFactorial),
[`Hyperfactorial`](https://enumeratio.dev/reference/symbol/Hyperfactorial),
[`NorlundB`](https://enumeratio.dev/reference/symbol/NorlundB),
[`BellY`](https://enumeratio.dev/reference/symbol/BellY).

**Elliptic and modular** — the Jacobi elliptic functions
([`JacobiSN`](https://enumeratio.dev/reference/symbol/JacobiSN), …),
[`EllipticTheta`](https://enumeratio.dev/reference/symbol/EllipticTheta),
[`IncompleteEllipticPi`](https://enumeratio.dev/reference/symbol/IncompleteEllipticPi),
[`ModularJ`](https://enumeratio.dev/reference/symbol/ModularJ) /
[`KleinInvariantJ`](https://enumeratio.dev/reference/symbol/KleinInvariantJ),
[`EisensteinG`](https://enumeratio.dev/reference/symbol/EisensteinG), the Carlson
symmetric forms
([`CarlsonRF`](https://enumeratio.dev/reference/symbol/CarlsonRF),
`RC`, `RD`, `RG`, `RJ`).

**Hypergeometric** — [`HypergeometricPFQ`](https://enumeratio.dev/reference/symbol/HypergeometricPFQ),
[`HypergeometricU`](https://enumeratio.dev/reference/symbol/HypergeometricU),
[`Hypergeometric0F1`](https://enumeratio.dev/reference/symbol/Hypergeometric0F1) and the
regularized `1F1`/`2F1`/`3F2` forms,
[`MeijerG`](https://enumeratio.dev/reference/symbol/MeijerG),
[`LambertW`](https://enumeratio.dev/reference/symbol/LambertW),
[`ChebyshevT`](https://enumeratio.dev/reference/symbol/ChebyshevT) /
[`ChebyshevU`](https://enumeratio.dev/reference/symbol/ChebyshevU),
[`LegendrePolynomial`](https://enumeratio.dev/reference/symbol/LegendrePolynomial),
[`ExpIntegralE`](https://enumeratio.dev/reference/symbol/ExpIntegralE),
[`BesselJZero`](https://enumeratio.dev/reference/symbol/BesselJZero).

**Transforms and signals** — [`FourierTransform`](https://enumeratio.dev/reference/symbol/FourierTransform) /
[`InverseFourierTransform`](https://enumeratio.dev/reference/symbol/InverseFourierTransform),
[`LaplaceTransform`](https://enumeratio.dev/reference/symbol/LaplaceTransform) /
[`InverseLaplaceTransform`](https://enumeratio.dev/reference/symbol/InverseLaplaceTransform),
[`MellinTransform`](https://enumeratio.dev/reference/symbol/MellinTransform) /
[`InverseMellinTransform`](https://enumeratio.dev/reference/symbol/InverseMellinTransform),
[`HankelTransform`](https://enumeratio.dev/reference/symbol/HankelTransform),
[`FourierSeries`](https://enumeratio.dev/reference/symbol/FourierSeries),
[`UnitStep`](https://enumeratio.dev/reference/symbol/UnitStep),
[`DiscreteDelta`](https://enumeratio.dev/reference/symbol/DiscreteDelta) /
[`DiracDelta`](https://enumeratio.dev/reference/symbol/DiracDelta),
[`SquareWave`](https://enumeratio.dev/reference/symbol/SquareWave) /
[`SawtoothWave`](https://enumeratio.dev/reference/symbol/SawtoothWave) /
[`TriangleWave`](https://enumeratio.dev/reference/symbol/TriangleWave).

**Symbolic and solving** — [`FullSimplify`](https://enumeratio.dev/reference/symbol/FullSimplify),
[`FunctionExpand`](https://enumeratio.dev/reference/symbol/FunctionExpand),
[`PowerExpand`](https://enumeratio.dev/reference/symbol/PowerExpand),
[`TrigFactor`](https://enumeratio.dev/reference/symbol/TrigFactor),
[`Refine`](https://enumeratio.dev/reference/symbol/Refine) under
[`Assuming`](https://enumeratio.dev/reference/symbol/Assuming),
[`Inequality`](https://enumeratio.dev/reference/symbol/Inequality),
[`FindInstance`](https://enumeratio.dev/reference/symbol/FindInstance),
[`DSolveValue`](https://enumeratio.dev/reference/symbol/DSolveValue),
[`DifferenceRoot`](https://enumeratio.dev/reference/symbol/DifferenceRoot) /
[`DifferentialRoot`](https://enumeratio.dev/reference/symbol/DifferentialRoot),
[`SeriesCoefficient`](https://enumeratio.dev/reference/symbol/SeriesCoefficient),
[`NSum`](https://enumeratio.dev/reference/symbol/NSum),
[`Minimize`](https://enumeratio.dev/reference/symbol/Minimize) /
[`Maximize`](https://enumeratio.dev/reference/symbol/Maximize), and the
[`FunctionDomain`](https://enumeratio.dev/reference/symbol/FunctionDomain) family of
function-analysis predicates (`FunctionContinuous`, `FunctionMonotonicity`,
`FunctionSingularities`, …).

The patches these heads land through (`lerch-phi`, `dirichlet`, `barnes-g`, `log-gamma`,
`clausen`, `stieltjes`) live in
[`@enumeratio/ce-patches`](../../../ce-patches) — see its README for
the upstreaming model. (`round-places`, `zeta-hurwitz`, `polylog-order` and
`polygamma-complex` landed in compute-engine 0.141, and `hurwitz-zeta-forms` and
`polylog-precision` in 0.142, and were retired.)

## Explore

- [`/explore/zeta`](https://enumeratio.dev/explore/zeta/) — `Zeta`/`HurwitzZeta`
- [`/explore/lerchphi`](https://enumeratio.dev/explore/lerchphi/) — `LerchPhi`
- [`/explore/polylog`](https://enumeratio.dev/explore/polylog/) — `PolyLog`
