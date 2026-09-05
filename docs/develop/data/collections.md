---
status: stub
---

# Collections reference

::: warning Stub
Planned, not built. Design below is settled enough to build against; nothing here is implemented yet.
:::

A code-docs-style reference distinct from [the Atlas](/explore/) (a narrative map) and [the
Explorer](/explore/collection/) (an interactive browser): a spec sheet per collection — carrier, grade chain,
cardinality closed form, stats, maps, examples — the way you'd expect from generated API docs, not a tour.

## The design

Two pieces:

- **`/develop/data/collections`** (this page, eventually) — a flat, sortable/filterable index of all 242
  collections, one row each: id, title, carrier, grade axes, cardinality. Generated the same way
  `statistics.md`/`api.md` are (a build-time `.data.ts` loader reading the registry).
- **`/develop/data/collection/[id]`** — the per-collection spec sheet. **Not** VitePress's static route
  prebuilding — that only works for collections known at build time, and this needs to render collections that
  weren't (a user-defined one added at runtime, once that's possible). Self-routing instead, the same pattern
  `/explore/collection/*` already uses: a mounted app owning the path, resolving `id` off
  `window.location.pathname` at request time, with the not-found slot as the built-site fallback.
- **`id=''`** (the bare `/develop/data/collection/`) doubles as the "create new" form once that exists —
  no separate page needed for it.

Both directions cross-link once built: a reference page links to the same collection's live view in
[the Explorer](/explore/collection/), and (new work on the Explorer side) the Explorer links back to its
reference page.

## What's blocking it

Nothing conceptually — the route pattern already exists and works (`/explore/collection/*`). This is a matter of
building the second mounted app + the spec-sheet renderer, not a design question.
