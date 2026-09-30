# @enumeratio/for-compute-engine

What we have offered `@cortex-js/compute-engine` upstream, kept apart from what is ours —
the model is Mathlib's `ForMathlib/`: code written in our repo, shaped for theirs. See
`https://github.com/enumeratio/enumeratio/wiki/Upstreaming` §10.

A leaf package: depends on compute-engine and `@enumeratio/engine`, nothing else of ours.
Other packages import from here; this package never imports from them.

**Laid out like compute-engine itself.** `src/compute-engine/` mirrors compute-engine's own
tree: pure numeric kernels in `numerics/`, head definitions in `library/` as
`SymbolDefinitions`-shaped records (or a function of the engine, for a widening that
captures a native handler), lowerings in `compilation/`. `src/support/` holds glue that is
ours only and would never go upstream as-is (the boxing helpers, precision helpers).

**A patch is a manifest**, `src/patches/<slug>.ts`: the issue and PR it was offered as, the
`src/compute-engine/...` files a pull request for it would carry, the library record it
declares, where it lands, and how to tell whether it has landed (`fixed(ce)`).
`applyPatches(ce)` applies every patch that has not landed yet, and is idempotent per
engine, so any package can call it (or a single patch's `apply`) from its own `declare`.
`symbols()` and `patchSymbols(patch)` list every head a patch declares without building an
engine (a plain record's own keys; a function-form patch states them as `heads`).

**Reference entries, examples and oracle goldens for these heads live in
`packages/reference/`**, beside compute-engine's own heads — they describe a head wherever
it is declared, and don't go upstream with the code.

**Retiring a patch**: once `fixed(ce)` is true on the compute-engine version this repo
pins, `tests/landed.test.ts` fails, naming the manifest to delete and its PR. Delete
`src/patches/<slug>.ts` and the files it lists, remove it from the registry in
`src/index.ts`, and drop the `applyPatches` (or single-patch) call from whatever package
made it — the package's own tests are the net that catches anything that quietly depended
on the patch rather than on the native head.

**cortex-js/compute-engine#340** (the analytic special-function family) is most of these
patches: `lerch-phi` (`LerchPhi`), `dirichlet` (`DirichletEta`, `DirichletBeta`,
`DirichletCharacter`, `DirichletL`), `barnes-g` (`BarnesG`, `LogBarnesG`), `log-gamma`
(`LogGamma`), `clausen` (`ClausenCl`), and `stieltjes` (`StieltjesGamma`). `zeta-hurwitz`
(complex `Zeta`, `Zeta(s, a)`, `HurwitzZeta`; offered as PR #350), `polylog-order` and
`polygamma-complex` (`PolyLog`/`PolyGamma` widened to non-integer/complex arguments), and
`round-places` all landed in compute-engine 0.141 and were retired; the arbitrary-precision
kernels and `evaluateHurwitz`/`evaluateZeta`/`evaluatePolygamma` they left behind are
re-exported straight from `src/index.ts` for `@enumeratio/analytic` to call directly.
`hyperbolic-zero`, `elliptic-e-complex` and `number-theory-large-integers` are each their
own, smaller issue. `@enumeratio/analytic`'s `declareAnalytic` and
`@enumeratio/number-theory`'s Gaussian-integer declare apply the ones each needs, at the
point its declaration used to run.
