# @enumeratio/for-compute-engine

What we have offered `@cortex-js/compute-engine` upstream, kept apart from what is ours —
the model is Mathlib's `ForMathlib/`: code written in our repo, shaped for theirs. See
`design/upstreaming.md` §10.

A leaf package: depends on compute-engine and `@enumeratio/boxed`, nothing else of ours.
Other packages import from here; this package never imports from them.

One folder per candidate, `src/<slug>/`, holding its kernel, its declaration, and its
`patch.ts` — the issue and PR it was offered as, where the code lands in compute-engine,
and how to tell whether it has landed (`fixed(ce)`). `applyPatches(ce)` applies every patch
that has not landed yet, and is idempotent per engine, so any package can call it (or a
single patch's `apply`) from its own `declare`.

**Retiring a patch**: once `fixed(ce)` is true on the compute-engine version this repo
pins, `tests/landed.test.ts` fails, naming the folder to delete and its PR. Delete the
folder, remove it from the registry in `src/index.ts`, and drop the `applyPatches` (or
single-patch) call from whatever package made it — the package's own tests are the net
that catches anything that quietly depended on the patch rather than on the native head.

**Zeta / HurwitzZeta** (cortex-js/compute-engine#340) stays in `@enumeratio/analytic` until
its PR is open.
