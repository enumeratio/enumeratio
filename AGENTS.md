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

## Names

- **enumeratio** is the mathematics: the symbol definitions (collections, domains,
  statistics and maps, the special functions, the algebras) and their evaluation, built on
  `@cortex-js/compute-engine` and written in its language, Epsil. When prose says "the
  library", "the catalogue", "a head we declare", it is talking about enumeratio.
- **notatio** is the interface: the notebook, the `<notatio-*>` elements, the plots and
  glyphs, the CLI and REPL, the format registry, the docs site — and the name of the
  restricted-Epsil subset those read and write. Never describe notatio as "the extension
  libraries" or "combinatorial math for compute-engine"; that is enumeratio.
- The line runs by what the word governs: enumeratio owns _meaning_ ("a head", "defined
  as", "evaluates to"), notatio owns _writing and showing_ ("written as", "typed", "prints
  as", InputForm, the `*Form` heads, `$…$` islands). The syntax is notatio's — say
  "notatio", never "the notatio notation". A cell is notatio plus one `:=` binding
  (`parseNotatio` with `allow: ["Assign"]`); nothing else in notatio is a statement. See
  `design/syntax-and-formats.md`.
- Package names have not all caught up; do not rename them in passing — see
  `design/component-naming.md` for how renames wait.

## Git hygiene

- **Never commit conflict markers** — the `<<<<<<<` / `=======` / `>>>>>>>` lines a
  merge or rebase leaves behind. After resolving any merge, and before committing,
  scan the result: `git grep -nE '^(<{7}|>{7})' $(git rev-parse --show-toplevel)` must
  be empty. A resolved-but-unverified merge landing in `main` breaks the dev server
  (esbuild refuses to parse the marked file) and every checkout — it is not a local-only
  mistake.
- **Do task work on a branch or worktree, not directly on `main`.** Merge to `main` only
  after `vp check` + `vp test` pass _and_ the conflict-marker scan is clean.

## Testing

- **Golden-example data, not snapshots.** Assert against a committed golden JSON file
  (`expect(actual).toEqual(golden[id])`), regenerated behind an `UPDATE_*` env flag —
  never `toMatchSnapshot` / `toMatchInlineSnapshot`. Their snapshot client isn't set up
  when the `test` task runs through `vp run` (the path `vp run -r test` / CI use), so a
  snapshot test passes under a bare `vp test` but fails the sweep; and golden JSON is
  plain data that's reviewable and reusable elsewhere. A guard test enforces this repo-wide
  (`packages/utils/tests/no-snapshots.test.ts`). See `packages/cli/tests/demos.test.ts` for
  the pattern.

## CI and deployment

- **Gate** (`ci.yml`, every push and PR): `pnpm -r run build` for the library packages, then
  `vp check`, the per-package tests (`pnpm -r run test`) and the site build. The dists come
  first because type-aware lint and the tests resolve siblings through `dist/`.
- **Production** (`enumeratio.dev`) ships from GitHub Pages on merge to `main` (`pages.yml`;
  `web/public/CNAME` names the domain).
- **Every build** of every commit — PR pushes and `main` — also goes up as a Cloudflare Pages
  preview at `<sha7>.enumeratio.pages.dev`, direct-uploaded from the artifact the gate already
  built. The PR's sticky `<!-- cf-preview -->` comment carries the URL; review links go below
  its first two lines, which each push rewrites and leaves the rest. `preview-cleanup.yml`
  nightly deletes a PR's previews a day after it closes, and untagged previews older than 30
  days; a tagged commit's preview stays. Needs repo secrets
  `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
- **Advisory sweeps** — never required checks. `quickcheck.yml` samples the collection
  kernels on every push touching them and deeply each night; a failure files/reopens one
  rolling issue, `quickcheck sampling regression`, labelled `nightly-fixup`. `nightly.yml`
  cross-checks the analytic heads against mpmath and rescans the Julia lane (Nemo +
  Combinatorics.jl) against the committed sidecars nightly, and follows every crosswalk link
  weekly. The Wolfram sweeps (`packages/wolfram`, `packages/oracle`) need a licensed kernel,
  and Oscar and Mathlib a multi-GB install, so those stay manual. The nightly-fixup routine
  (06:15 UTC) reads these runs, files `CI failure: <workflow> › <job>` issues, and opens fix
  PRs — it never merges.
