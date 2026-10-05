# @enumeratio/ce-patches

Heads and fixes `@cortex-js/compute-engine` would plausibly take, kept apart from what is ours
so that landing upstream is a deletion, not an excavation. The model is Mathlib's
`ForMathlib/`: code written in our repo, shaped for theirs.

**Candidates, not just offers.** A head Wolfram or mpmath already has, or a fix or widening of
a native head, is written here from the start, whether or not an issue exists yet. What is
only ours stays in its own package. Some patches may never land upstream; they stay here,
applied at run time like the rest.

A leaf package: depends on compute-engine and `@enumeratio/engine`, nothing else of ours.
Other packages import from here; this package never imports from them.

**Laid out like compute-engine itself.** `src/compute-engine/` mirrors compute-engine's own
tree: pure numeric kernels in `numerics/`, head definitions in `library/` as
`SymbolDefinitions`-shaped records (or a function of the engine, for a widening that
captures a native handler), lowerings in `compilation/`. A pull request copies files to the
same paths; only the code goes upstream. `src/support/` holds glue that is ours only (the
boxing helpers, precision helpers).

**A patch is a manifest**, `src/patches/<slug>.ts` exporting one `Patch` (the registry,
`PATCHES`, is generated from that folder at build and before tests, never committed), sized like the pull request it would
become: the issue and PR it was offered as, the `src/compute-engine/...` files it carries, the
library record it declares, where it lands, and how to tell whether it has landed
(`fixed(ce)`, the issue's own repro as a probe). `applyPatches(ce)` applies every patch that
has not landed, and is idempotent per engine, so any package can call it (or a single patch's
`apply`) from its own `declare`. `symbols()` and `patchSymbols(patch)` list every head a patch
declares without building an engine.

**Kernels several patches share** (complex arithmetic, the ball and BigDecimal helpers) are
exported from `src/index.ts`, and `@enumeratio/analytic` calls them for its own heads too.
When a patch lands, a kernel still used elsewhere moves back into its package, or the package
calls the compute-engine head instead.

**Reference entries, examples and oracle goldens for these heads live in
`packages/reference/`**, beside compute-engine's own heads: they describe a head wherever
it is declared, and don't go upstream with the code.

**Retiring a patch**: once `fixed(ce)` is true on the compute-engine version this repo
pins, `tests/landed.test.ts` fails, naming the manifest to delete and its PR. Delete
`src/patches/<slug>.ts` and the files it lists (the registry is generated from
`src/patches/*.ts`, so there is no line to remove), drop its named re-export from
`src/index.ts` if it has one, and drop the `applyPatches` (or single-patch) call from whatever package
made it. The package's own tests catch anything that quietly depended on the patch rather
than on the native head.

**An upstream erratum with no code of ours** gets no patch; the workaround that points at it
links the issue.

**Sending one upstream.** Issue first, then the PR, as `enumeratio`. The PRs are built in a
compute-engine checkout beside this repo, `~/Playground/@enumeratio/compute-engine`, with the
`enumeratio` fork as its push remote; its branches hold only PRs we've sent that aren't
merged. What a PR needs to land as sent is on the wiki's
[Contributing](https://github.com/enumeratio/enumeratio/wiki/Contributing#upstreaming-to-compute-engine).
What we've asked for is the issues themselves:
[compute-engine issues by enumeratio](https://github.com/cortex-js/compute-engine/issues?q=author%3Aenumeratio).
