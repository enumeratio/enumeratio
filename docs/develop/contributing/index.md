# Contributing

This page covers the mechanics of contributing to enumeratio — repo shape, local setup, verification gates, and (a
first-class path here) how to contribute effectively with an LLM-assisted agent session. It's written for a new
contributor, human or agent.

## Ways to contribute

- **A collection, stat, map, or repr** — the bulk of the work. See [Adding a
  collection](/develop/contributing/adding-a-collection) for the full worked model.
- **Visual identity** — the token layer, color/type/spacing scale, and the styling-hook convention every
  component and db-emitted SVG follows: [Design system](/develop/contributing/design-system).
- **A new representation or figure** — how an element casts into text, an SVG, or scene-space geometry, and what
  a new glyph needs: [Visual representations](/develop/contributing/visual-representations).
- **Docs** — this site's own content; the verification gate below (`docs:build`) applies the same as code.

The rest of this page is the mechanics that apply across all of them: repo shape, setup, gates, conventions.

## The shape of the repo

pnpm monorepo under `packages/`. The premise: **the math is data**.

- **[`@enumeratio/data`](/develop/packages/data/)** — the core. Collections are declared as rows (`base_collection`,
  `base_grade`, …) over one hand-authored floor engine per collection; `base_realize()` generates the rest of the
  surface (cardinality, elements, unrank, membership, rendering, …). Source lives in `packages/data/sqlsrc/*.sql`.
- **[`@enumeratio/client`](/develop/packages/client/)** — TS client over the generated pg surface (runs pglite in a worker).
- **[`@enumeratio/cli`](/develop/packages/cli/)** and **[`@enumeratio/components`](/develop/packages/components/)** — downstream
  consumers of the client.
- **This docs site** (VitePress, `docs/`) plus the **Explorer** (`/explore/collection/`), a Vue app over the client.

Everything downstream reads the generated surface and the catalog data — you almost never hand-write the engine
functions the client calls. See **[Adding a collection](/develop/contributing/adding-a-collection)** for the full worked model
(carrier → fiber → floor engine → `base_realize`); this page is about the surrounding workflow, not the math model
itself.

Design docs (architecture, spikes, roadmap) live in the
[GitHub wiki](https://github.com/enumeratio/enumeratio/wiki), not under `docs/` — this site is public-facing subject
matter and package docs only.

## Local setup

```bash
pnpm install                      # once, and again after pulling a worktree with no node_modules
node --import tsx run.mts         # from packages/data — apply the core, run the example suite
pnpm docs:dev                     # VitePress dev server, from repo root
```

`docs:build` requires **Node 24**.

## The verification gates

Two independent things need to be green, and a contribution isn't done until both are:

1. **The pg example suite** — `cd packages/data && node --import tsx run.mts` (or `pnpm test:core` from the root).
   Applies every `sqlsrc/*.sql` file into a bare PGlite and runs the `base_example` rows: living assertions that
   double as the regression suite *and* the documentation for each collection. While iterating on one file, apply
   it last against the built core: `node --import tsx run.mts sqlsrc/<file>.sql`.
2. **`pnpm docs:build`** (VitePress) — required whenever anything under `docs/` changed. Catches dead links, leaked
   Vue SFC parse errors, and broken component usage that the example suite can't see.

`pnpm test` runs both plus `test:stack` (client/CLI typecheck + tests) and the explorer build — the full gate before
anything lands on `main`.

**`selfcert.mts` is a third, opt-in check** that catches what the example suite misses:
`node --import tsx selfcert.mts [filter]` sweeps every collection and cross-checks each acceleration against the
definitional floor —
`fiber_count` vs. enumerated count, `fiber_unrank`/`element_at` vs. sequential enumeration. The example suite only
asserts the specific values you wrote examples for; selfcert catches a truncation or off-by-one at fiber sizes you
didn't think to pin. Run it whenever you add a `fiber_count`, `fiber_unrank`, or other accelerated engine.

## Conventions worth internalizing before you write SQL

These are the traps that come up on nearly every collection file — full detail in the [core package
notes](/develop/packages/data/):

- `-- requires:` header entries are **file basenames** (e.g. `k_colored_permutations`), not collection or module
  names — resolved by the toposort in `sqlsrc-order.ts`.
- A few pglite/Postgres gotchas: no `round(double precision, int)` (cast `::numeric` first); no `min`/`max` over
  `boolean` (encode a boolean-ish stat as `0`/`1`); `generate_series(lo, hi)` with `hi IS NULL` yields zero rows, not
  an open-ended scan.
- A new carrier's glyph goes in its **own** `<carrier>_glyph.sql` file, not into `glyphs.sql`.
- Registry self-tests assert **floors and containment**, not exact counts — if you're tempted to pin an exact
  count/list in a shared example, that's a bug to soften, not a target to match.

## Adding a stat, map, repr, or triangle

Same pattern as a collection: one data row, referencing an existing collection.

- **Stat** — a `base_stat` row wrapping a per-element function.
- **Map** — a `base_map` row wrapping a morphism between two collections.
- **Repr** — a `base_repr` row for an alternate rendering of an existing carrier.
- **Triangle** — a `base_triangle` row aliasing a graded collection's row-sums onto a number-triangle presentation
  (no new math — a view over an existing grading).

Find a sibling of the kind you're adding in `packages/data/sqlsrc/` and follow its shape; the registries are small
and the existing rows are the spec.

## Anchor to source, not memory

Count sequences, OEIS references, and known small values must come from an actual source (OEIS, a paper, a
computation you ran) — never from recalled-but-unverified memory, your own or an LLM's. A wrong anchor becomes a
silently-wrong regression test. If you can't verify a count, don't assert it as an example.

## Branch and worktree workflow

Work in a clean branch, off `main`. Commit freely as you go — small, frequent commits are fine during active
development.

**Merging is local for now.** There's no GitHub MR flow yet: merge back to `main` directly
(`git merge --no-ff <branch>`) once both gates are green, and **flatten the branch's commit history into one clean
commit** (occasionally a few, if genuinely separable) rather than carrying work-in-progress history onto `main`.
Once the project is published and starts taking outside contributors, this switches to GitHub MRs — same shape,
different door. No `Co-Authored-By` lines in commit messages.

## LLM-assisted contribution

This repo is built heavily through agent sessions, and the workflow above is deliberately agent-friendly. A few
things make that work well here specifically, and a few conventions keep it from making a mess.

### Why this repo suits it

The data-driven surface plus the self-cert differential oracle means an agent's contribution is **machine-checkable**
rather than something a human has to read line by line: does the accelerated path agree with the naive one, at every
fiber the sweep touches? A collection that passes both gates and selfcert is trustworthy on the math even before a
human reviews the SQL style. Trust the verification, but still read the diff — selfcert catches numerical
disagreement, not a bad model choice or a wrong OEIS anchor.

### Work in your own worktree

Each unit of work gets its own git worktree (this repo keeps them under `.claude/worktrees/`), sharing the main
checkout's object store — no push or patch needed to make a branch visible; `git merge`/`git diff` see it directly
from the main checkout. Stay **inside** your worktree path for every edit; the recurring failure mode is an absolute
path (copied from a prompt, or from habit) that lands in the main checkout instead. Before declaring done, check that
the main checkout is still clean.

### Writing a good task spec

- Point at the **in-repo spec and an analog file to copy** — e.g. "follow the shape of `words` in
  `adding-a-collection.md`, use `<sibling-collection>.sql` as your template" — rather than re-explaining the model.
  The conventions above already live in `CLAUDE.md`, which an agent session in this repo inherits automatically;
  a task prompt doesn't need to restate them, just point at what's collection-specific.
- Keep edits in **dedicated files**. Don't touch shared coordination surfaces directly — `.vitepress/config.ts` nav,
  shared seed files like `collection-meta.sql` or `tags.sql` — those are fold-back conflict hotspots when multiple
  sessions touch them at once. Instead, **describe** the intended shared-doc edit in the close-out for a human (or a
  coordinating session) to apply once.
- Ask for **both** verification gates, and for `selfcert.mts` when the change touches an accelerated engine.

### The close-out block

Every session should end with:

1. Branch + worktree path.
2. Commit SHA(s), one-line summary each, and confirmation the tree is clean.
3. Files changed, grouped, one-line why each.
4. The verification commands run and their pass/fail line.
5. Decisions/deviations, and anything intentionally left undone.
6. Pre-existing issues noticed but not fixed (so they can be tracked, not silently skipped).
7. The fold command — prefer `git merge --no-ff <branch>` (a 3-way merge handles the branch having fallen behind
   `main`; diff-apply or cherry-pick doesn't).

### Guardrails

- Verify **both** suites before calling anything done — a docs-only change that skips `docs:build` is exactly the
  kind of thing that ships a dead link or a leaked component parse error.
- Never leave tool-call markup in a file (stray `</content>`, `</invoke>` fragments from a copy-paste mistake).
- Doc links must resolve as VitePress pages — link to `.md` pages, never a raw path to a `.sql` file or a directory
  that isn't a page.

### Match the model to the task

Not every unit of work needs the same model. A mechanical rename or a single small edit doesn't need the same
horsepower as designing a new carrier or reasoning through a grading scheme. Default to the cheapest model that can
do the job correctly, and reserve the expensive one for genuine design work.
