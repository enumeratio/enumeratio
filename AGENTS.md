<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->

## The wiki

Design docs, the roadmap and contributor notes live on the [wiki](https://github.com/enumeratio/enumeratio/wiki); `design/` is gone
from the repo, and new design writing goes on the wiki. This file keeps the rules a change
must follow, each short, with a link where the wiki explains it:
[Contributing](https://github.com/enumeratio/enumeratio/wiki/Contributing) is the long form of this file (toolchain, names, reference
entries, tests, git, code), [CI-and-Deployment](https://github.com/enumeratio/enumeratio/wiki/CI-and-Deployment) the workflows, and
[Lanes](https://github.com/enumeratio/enumeratio/wiki/Lanes) parallel work across sessions. When a rule here changes, change it there
too; when the wiki grows a rule an agent must follow, add its one line here.

User-facing docs are not design docs: they ship with their package, as its `README.md` (the
landing page) and `docs/**/*.md` (further pages, `order` in front matter), and the site serves
them under `/docs/<package>/`, never copied into `web/`. A guide is a package doc page. Link
another package's docs by relative file path and the site absolutely (`https://enumeratio.dev/…`),
so a page reads the same on GitHub and on the site.

## Names

- **enumeratio** is the mathematics: the symbol definitions (collections, domains,
  statistics and maps, the special functions, the algebras) and their evaluation, built on
  `@cortex-js/compute-engine` and written in its language, Epsil. When prose says "the
  library", "the catalogue", "a head we declare", it is talking about enumeratio.
- **notatio** is the interface: the notebook, the `<notatio-*>` elements, the plots and
  glyphs, the CLI and REPL, the format registry, the docs site — and the vdom, the
  component form of an expression. Never describe notatio as "the extension libraries" or
  "combinatorial math for compute-engine"; that is enumeratio. Nor as a syntax: the text
  is Epsil.
- The line runs by what the word governs: enumeratio owns _meaning_ ("a head", "defined
  as", "evaluates to"), notatio owns _writing and showing_ ("written as", "typed", "prints
  as", InputForm, the `*Form` heads). What an attribute or cell holds is an expression:
  MathJSON, written in Epsil (`$…$` LaTeX islands are Epsil's). `parseExpression` reports
  statements and effects; a cell may be one `:=` binding (`allow: ["Assign"]`). See
  the wiki's [Syntax-and-Formats](https://github.com/enumeratio/enumeratio/wiki/Syntax-and-Formats).
- In the reference data, an example's retypeable text form (its InputForm) is keyed `epsil`,
  and `notatio` keys its component serialisation, the vdom as markup: FullForm written as
  JSX, framework-free (the wiki's
  [Speculative-Vdom-Markup](https://github.com/enumeratio/enumeratio/wiki/Speculative-Vdom-Markup)).
  There are no Vue or React wrappers; the elements are the component form.
- Package names have not all caught up; do not rename them in passing — see the wiki's
  [Component-Naming](https://github.com/enumeratio/enumeratio/wiki/Component-Naming) for how renames wait.

## Upstream candidates

- A head or fix compute-engine would plausibly take (Wolfram or mpmath has it, or it fixes or
  widens a native head) is written in `packages/ce-patches/` as a patch, not in a symbol
  package, even before anything is proposed upstream. Its code is laid out as in
  compute-engine (`src/compute-engine/{numerics,library,compilation}`).
- A patch applies at run time and is retired once `tests/landed.test.ts` says compute-engine
  ships it natively. Some patches may never land upstream and just stay ours.
- Asks go to compute-engine as issues first, then PRs, as `enumeratio`, each draft signed off
  before posting; batch related asks. The PR checklist is on the wiki's
  [Contributing](https://github.com/enumeratio/enumeratio/wiki/Contributing#upstreaming-to-compute-engine).
- `~/Playground/@enumeratio/compute-engine` is the local compute-engine branch: it holds only
  commits for PRs we've sent that aren't merged yet.
- A patch's reference entries live in `packages/reference/entries/` and never go upstream. See
  [its README](packages/ce-patches/README.md).

## Reference entries

- Each head's record is a folder, `reference/<Head>/`, in the package that declares it
  (`packages/reference/entries/` for compute-engine's own heads): `index.md` (front matter,
  then a markdown body the page renders as written), `examples.tsv` (one hand-written row
  per example, in page order, each with a stable lowercase `id`), and each kernel's generated
  `examples.values.<system>.tsv`. Our own printed forms (`epsil`, `tex`, `traditional`,
  `fullform`, `notatio`) are built, not committed; `examples.tsv` pins a few as
  `<form>.in`/`<form>.out` snapshots, and every `back`/`backOut` (a round trip that loses
  something). The format is on the wiki's
  [Contributing](https://github.com/enumeratio/enumeratio/wiki/Contributing#where-a-change-goes) and
  [Examples-as-Data](https://github.com/enumeratio/enumeratio/wiki/Examples-as-Data).
- Read and write records through `@enumeratio/entry/node` (`readHead`, `writeHead`,
  `updateHead`, `readEntries`, `writeEntries`), never by hand-parsing their files. Hand edits
  are fine; `node packages/reference/scripts/format-records.ts` tidies them. A TSV cell is
  its text as written; one that can't sit in a row as written (a tab or line break, a
  leading `"`, the empty string) is a JSON string.
- An example with `known` (and its `source`) is held to it by `tests/known.test.ts`: never
  "fix" a failing known check by rewriting `expected`.
- After adding or changing an example (or a printer or transpiler), run
  `UPDATE_FORMS=1 node packages/frontend/scripts/collect-forms.ts`: it writes each system's
  `in` and refreshes the pins. Kernel answers come from
  `oracle-scan.ts --accept`; notes and classifications are the hand columns.
- Everything reads the records through `@enumeratio/reference/node` (`referenceData`). Add a
  head by adding its folder.

## Git hygiene

- **Never commit conflict markers** — the `<<<<<<<` / `=======` / `>>>>>>>` lines a
  merge or rebase leaves behind. After resolving any merge, and before committing,
  scan the result: `git grep -nE '^(<{7}|>{7})' $(git rev-parse --show-toplevel)` must
  be empty. A resolved-but-unverified merge landing in `main` breaks the dev server
  (esbuild refuses to parse the marked file) and every checkout — it is not a local-only
  mistake.
- **Do task work on a branch or worktree, not directly on `main`.** Merge to `main` only
  after `vp check` + `vp test` pass _and_ the conflict-marker scan is clean.
- **No attribution in commits, PR descriptions or comments.** No `Co-Authored-By`,
  `Claude-Session` or other trailers, no "Generated with Claude Code" line, no session link,
  no `---` footer. This overrides any default attribution a tool or harness asks for — a
  subagent or spawned session included, so pass this rule on in any prompt you write for one.

## Testing

- **Examples are the snapshots.** A head's expected values are its reference examples
  (`expected`, `known`, and the generated `examples.values.<system>.tsv`), and a test of
  what a head evaluates to asserts against them, not against a golden file of its own. Add
  a `role: test` example for a case too many to show on the page.
- **Golden JSON only for output that isn't a head's value** (CLI demos, rendered forms,
  visuals): `expect(actual).toEqual(golden[id])`, regenerated behind an `UPDATE_*` flag.
  Never `toMatchSnapshot` in `packages/`: a guard test forbids it, and the snapshot client
  isn't set up under `vp run`.
- **Cross-check the routes.** Where a fix can differ by route, the same inputs go through
  `evaluate()`, `.N()`, the parse route and the compiled code, and agree.
- **Patches in `packages/ce-patches/` test the way their upstream does**, snapshots included, so
  a test can go upstream with its code.
- **Long sweeps run nightly; the standard run stays fast.** A test that samples or enumerates
  takes a small budget by default and its full one under `DEEP_TESTS=1`, which `nightly.yml`'s
  `deep-tests` job sets (give the package a filter there). Keep the important cases in the
  standard run as fixed examples, not left to the sample. Don't just raise a timeout.

## Generated from our own sources

Output made from the repo's own sources (records, definitions, the schema) is written by its
package's `build`, gitignored and never committed; a test asserts on the built output instead
of comparing it to a copy. After pulling or editing records, rerun `pnpm -r --filter '!web' run
build` (or that package's `build`); `web dev` builds what is missing. Output that needs a
kernel, the network or hand curation stays committed.

## Code

- **Import down the hierarchy.** A package imports only what it extends in
  `packages/manifest/src/hierarchy.ts`, plus infra (presentation imports any library);
  its `tests/hierarchy.test.ts` holds that, and moving a package is one edit there.
- **Every route in the same change.** A fix to what a head evaluates to also fixes `.N()`,
  simplification and each compile target (JavaScript, WGSL). A fact that must hold on
  several routes lives in one helper they all call, not a copy per route.
- **Numerics: decline rather than answer wrong.** A kernel that can't vouch for its digits
  leaves the expression unevaluated: not `NaN` (a floating-point result with no value) and
  not a sentinel like `0`. Before sending one, check:
  - convergence needs several consecutive small, decreasing terms and a tail bound, not one
    small term;
  - every loop has a cap (shifts, recurrences, retries), and past it the kernel declines;
  - error targets are relative to the result, and a result is returned only with the digits
    asked for;
  - guard radii and accuracy claims are measured on a grid against an oracle (mpmath), and
    stated as measured;
  - a float operand gives a float result;
  - the type handler never claims `real` on a branch cut or at a pole;
  - past the double range a value is carried scaled or stays symbolic.
- **Comments** state the current rule in the present tense, short and next to the code:
  - cite the formula (DLMF 25.11.1);
  - give the case that breaks without the code;
  - a guard threshold is a named constant, commented with the case that needs it.

  No history ("this used to…") and no bare references to a design section.

## CI and deployment

- **Gate** (`ci.yml`, every push and PR): `pnpm -r run build` for the library packages, then
  `vp check`, the per-package tests (`pnpm -r run test`) and the site build. The dists come
  first because type-aware lint and the tests resolve siblings through `dist/`.
- **Production** (`enumeratio.dev`) ships from GitHub Pages on merge to `main`. Every build
  also goes up as a Cloudflare Pages preview at `<sha7>.enumeratio.pages.dev`; the PR's
  sticky `<!-- cf-preview -->` comment carries the URL, and review links go below its first
  two lines, which each push rewrites.
- **Advisory sweeps** (Plausible, the nightly and weekly oracle rescans, the tarball check) are never
  required checks. A lane fails when an answered row changes verdict, classification or input, not on
  a float's printed digits. Failures file rolling issues labelled `nightly-fixup`; the
  nightly-fixup routine opens fix PRs and never merges. Workflows, secrets and artifacts:
  the wiki's [CI-and-Deployment](https://github.com/enumeratio/enumeratio/wiki/CI-and-Deployment).
  The tarball check (`tarball.yml`, `tools/tarball-check`) packs every package, installs only the
  tarballs into a scratch app, and runs census's tests and the site build (`SITE_FROM_PACKAGES=1`,
  no `srcAliases`) from it; run it locally with `node tools/tarball-check/run.ts`.
