# enumeratio — working notes for Claude

A data-driven library of combinatorial collections — the math is data (pure-SQL core over pglite, a TS client, a
CLI, web components, and a VitePress docs site + explorer). pnpm monorepo under `packages/`.

## Git workflow

- **Commit freely inside your own worktree.** When working in a session-owned worktree/branch (not `main`), commit as
  you go without asking — small, frequent commits are fine during active development.
- **Flatten before merging to `main`.** When folding a worktree branch back, squash the branch's commits down to a
  single clean commit (occasionally a few, if they're genuinely separable) with a good message. Don't carry the
  work-in-progress history onto `main`.
- **Merges are local for now.** No GitHub/GitLab MR flow yet — merge back to `main` directly in the local checkout.
  Once the project is published *and* we start taking outside contributors, we'll switch to GitHub MRs; until then,
  keep it local.
- No `Co-Authored-By` lines in commit messages.
- **Worktrees live in `.claude/worktrees/<name>` — never a repo-root `worktrees/` dir.** This repo overrides the
  global `worktrees/` convention: keeping them under `.claude/` keeps VS Code search, `.claude/` settings, and IDE
  config working, and `.claude/worktrees/` is gitignored. When spawning subagents, use `isolation: "worktree"` (the
  harness places the worktree here) or pass an explicit `.claude/worktrees/<name>` path in the prompt — do not let an
  agent default to the global root-`worktrees/` convention. **Shared primary checkout:** parallel sessions share this
  one checkout, so a peer can switch its branch under you — before committing here run `git rev-parse --abbrev-ref
  HEAD`, and do main-side commits from a dedicated `.claude/worktrees/` worktree, never by `git checkout` in the shared
  dir while a peer is live in it.

## GitHub wiki (`wiki/`)

Design docs (architecture, spikes, roadmap, surveys) live in the [GitHub wiki](https://github.com/enumeratio/enumeratio/wiki),
not under `docs/` (public docs site) and not committed to this repo.

- **`wiki/` is a plain git clone of `https://github.com/enumeratio/enumeratio.wiki.git`, at the root of the MAIN
  checkout only.** It's gitignored (`wiki/` in `.gitignore`) — anything placed there is structurally unable to be
  committed to this repo, so there's no risk of it becoming a tracked staging folder again (it was one before
  2026-09-04; retired in favor of this clone). If `wiki/` doesn't exist yet, clone it; don't recreate it per-worktree.
- Interact with it as its own git repo (`cd wiki && git ...`) — commit and `git push origin master` directly. This
  is a separate remote from `origin` in the main repo; don't confuse the two. Going through git avoids GitHub API
  rate limits — never use the GitHub API/MCP for routine wiki reads or writes.
- Page files are flat (`Some-Page.md`), no subfolders — GitHub wiki has no real directory support. Wire new pages
  into `_Sidebar.md`.
- **`spikes-private` branch** (local-only, never pushed) holds raw/half-baked material that isn't prose-ready for
  the public wiki — spike scripts, dumps, anything not meant to go public yet. Fold pieces of it into `master` once
  they're ready; don't push the branch itself.

## Verifying changes

- Docs / components / explorer: `pnpm docs:dev` (VitePress) — from the MAIN checkout, drive it with the browser
  preview tools. (Worktree sessions: see the gotcha below — `preview_start` serves main, not your worktree.)
- Full gate: `pnpm test` (`test:core` data suites, `test:stack` typecheck + CLI tests, `test:build` explorer + docs
  build). For a quick loop, run just the relevant package's typecheck/test.

## Running long processes & verifying autonomously

- **State an ETA up front for any command over ~20s, and run it in the BACKGROUND** so the user isn't blocked. Known
  durations: `pnpm test` (full gate) ~5–6 min (test:core ~2–3m · test:stack ~1m · test:build ~2m); `run.mts` /
  `test:core` ~2–3 min; `pnpm docs:build` ~2 min; `selfcert.mts <coll>` secs–30s; `pnpm install` (warm) ~1–3s.
  **Overrunning the stated ETA — not elapsed time alone — is the "hung" signal**; then diagnose, don't just keep waiting.
- **Don't shorten the gate by package unless the diff really is confined to it** — check which packages changed (a docs
  data-loader still needs `test:build`; a data-only change is fully covered by `test:core`).
- **Don't trust an agent's self-reported "green" — re-verify independently before merging.** Run `run.mts` under an OS
  `timeout` so a runaway surfaces as exit 124, not a silent hang (a tight plpgsql loop ignores `statement_timeout`). The
  cli `worker.test.ts` (worker_threads) is #14-fragile — heavy per-query work in the worker tips its teardown into an
  `onTaskUpdate` hang.
- **Subagents/workflows: set the least-capable model PER STAGE** (Haiku for triage/grep/format, Sonnet for real code +
  correctness review, Opus rarely) and name the model when fanning out — never blanket one tier or inherit Opus by
  omitting `model`.

## Common gotchas (read before starting — these come up every time)

- **A fresh worktree has NO `node_modules`.** Run `pnpm install` once before any `run.mts` / build. (This is the
  single most-repeated startup step — just do it first.)
- **`-- requires:` names are FILE BASENAMES**, resolved by `sqlsrc-order.ts` — not collection or module names.
  `requires: k_colored_permutations`, not `colored_permutations`. A wrong name throws `requires unknown "…"`.
  `requires-tag: collection` (+ `requires: realizer`) is the safe "load last" anchor when a file reads all collections.
- **pglite = Postgres; a few real SQL gotchas:** no `round(double precision, int)` — cast the arg `::numeric` first
  (also fixes `11.0000…` display via `trim_scale(round(x::numeric, 2))`); no `min`/`max(boolean)` — register a
  boolean-ish stat as int `0/1` (the client builds min/max/sum over every stat and crashes on a boolean); STRICT
  `generate_series(lo, hi)` yields ZERO rows when `hi IS NULL` (the open-handle trap — `fibers()`/`cardinality()`
  guard against it); a plpgsql `generate_series(...) x` alias collides with a declared variable named `x`
  (rename one); `sum()` of an empty array is `NULL`.
- **Glyphs:** put a new carrier's glyph in its own `<carrier>_glyph.sql` (don't edit `glyphs.sql`); wrap SVG
  coordinates in `trim_scale(round(…::numeric, 2))`; do NOT add a `base_glyph` registry row (it bumps the
  glyphs-meta count example) — `carrier_renders_svg(<carrier>)` derives automatically from the overload's existence.
- **Registry self-tests assert FLOORS/containment, not exact counts** (post-#171) — when you add rows, existing
  examples should still pass; if one pins an exact count/list, that's a bug to soften (`>= N` / `@>`), not to match.
- **selfcert (`node --import tsx selfcert.mts [coll]`) catches what `run.mts` misses** — the accelerated==naive
  differential (fiber_count vs enumeration; element_at vs sequential). Run it after adding a `fiber_count` accel or an
  unrank/element engine; the example suite alone won't catch a truncation/off-by-one at large n.
- **Explorer/browser verification in a worktree:** `preview_start` serves the MAIN checkout, not your worktree — run
  `pnpm docs:dev` in the worktree via a backgrounded Bash command and drive THAT. The embedded Browser pane's
  compositor is frequently stale/frozen — verify functionally via `read_page` / `javascript_tool` / DOM queries, not
  screenshots. Deep `/explore/collection/<slice>` hard-loads hit a dev MIME quirk (#158) — load the base and route
  in-app.
