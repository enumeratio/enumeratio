# Design: what is left in the old repo

Status: **backlog** (2026-09-24). An audit of the old `enumeratio/enumeratio` repo — the
Postgres-era predecessor, since deleted; this repo now holds the name — for features that have not come across. The Postgres/pglite
plumbing (query engine, service worker, providers, pgdata profiles) is out of scope; what
is listed here is mathematics, presentation and UX worth rebuilding in this architecture.

## Where the old repo lives

Everything is in `~/Playground/@enumeratio/archive/`: `enumeratio.git` is a bare mirror
holding every branch (including the ones that only ever lived in the local checkout),
`enumeratio.wiki` the wiki, and `issues.json` / `pulls.json` / `project.json` the GitHub
metadata. Read a file with `git -C archive/enumeratio.git show <branch>:<path>`. Paths
below are on `main` unless a branch is named.

The catalogue itself came across whole: `packages/catalog` carries every old collection,
statistic, map and crosswalk by name. The gap is behaviour, not names.

## 1. Representations and table control

The old explorer let one element be seen through several presentations at once, with the
printer chosen per column and per scope. None of that layer exists here yet; the closest
relative is `reduce(expr, env)` ([rendering-environments.md](./rendering-environments.md)),
which works per cell, not per column or per policy.

- **Several glyph kinds per carrier** — `packages/data/sqlsrc/glyph_kinds.sql`:
  `glyph_svg(carrier, kind)` with an `is_default` registry. Permutations drew as matrix, arc
  diagram, cycle diagram or Rothe diagram; partitions as Ferrers, Young (English/French) or
  abacus. `notatio/src/glyphs.ts` has one glyph per carrier and no kind parameter.
- **Glyph families not yet drawn** — from `docs/develop/packages/components/kitchen-sink.md`:
  functional graph (endofunctions), bipartite diagram (surjections), permutation arc diagram
  (decorated/affine permutations, arrangements), signed bar row, bars with gaps (weak
  compositions), dot columns (multisets), skew Young diagram (skew/core partitions),
  polygon dissection, plane-partition grid, sequence bars (ascent sequences, RGS, Gray
  codes).
- **Alternate text notations that round-trip** — `packages/data/sqlsrc/representations.sql`:
  each named notation (cycle, one-line, blocks, parts, dots, bars, exponential …) is a
  `(render, parse)` pair, so any notation is also an input syntax.
- **Printer policy** — `packages/data/sqlsrc/policies.sql`: rows scoped to a collection,
  carrier, category, tag or everything, each with an environment, archetype, clause, mode
  (permissive, restrictive or override) and priority, resolved by one general→specific
  fold, GRANT/REVOKE-style. Decides default columns, which printers a column kind allows,
  and how an environment degrades (print revokes svg and links). Natural fit for the environment capability record.
- **Typed columns** — `packages/client/src/select.ts`: a column is one of ~20 kinds (repr,
  map, stat, dist, pivot, agg, over, glyph, data, title …), each with its own printer set
  (`plain | grouped | katex | link | svg | bars`). `<notatio-collection-table>` columns are
  untyped expression strings.
- **Column controls** — `packages/explorer/src/ColumnConfigPopover.vue` (format, header,
  min-width, link), `PropertiesPane.vue` + `propRows.ts` (reorderable column list, add
  menu, hide/remove). Same popover reached from the header and from the list.
- **Statement bar** — `StatementBar.vue`, `PredChips.vue`: WHERE / GROUP BY / HAVING /
  ORDER BY as separately editable, URL-persisted segments, predicates as chips. Group-by
  switches `RowTable.vue` into rollup/rowgroup mode; `distribution.ts` puts a histogram of a
  statistic over a fibre in a cell.
- **Element and identity panes** — `ElementPane.vue` (stepper, stats/maps grid, glyph hero,
  FindStat-style "which statistic produces these values" solver), `IdentityPane.vue`
  (generating function and crosswalk strip), `NameThisPanel.vue` (match a query against
  the registry). The crosswalk data is already in `packages/reference`.
- **Unmerged work** — `feat/composite-printers`, `auto/explorer-query-model`,
  `claude/query-view-policies-spike-6a314f` (element relations wired into the query view).
- **Never built in either repo** — the wiki's `Rendering-Printer-Config.md` and
  `Render-Assets.md`: per-environment printer capability tables, a structured render tree
  instead of SVG strings (issue #83), link target/history as printer config.

## 2. Polytopes

`packages/symbols/combinatorics/polytope` has the permutahedron, associahedron, cross-polytope, simplex and
hypercube, and `<notatio-polytope>` covers what the old WebGL figure did (face selection,
face labels from a representation). Left:

- **Cyclohedron W_n** — `packages/data/packs/polytopes/polytope-collections.sql`, the
  largest block. Faces are centrally symmetric dissections of a (2n+2)-gon, the fixed points
  of the associahedron's half-turn; point and containment reuse the associahedron's Loday
  point and refinement order; dim = (m/2 − 1) − (orbit count). Faces with k orbits number
  C(n,k)·C(n+k,k), summing to the central Delannoy numbers (A001850); enumerate by orbits,
  not by filtering. Issue #330 (open): an explicit Delannoy-path bijection for unrank —
  try tubings of the cycle graph.
- **Vertex-only families** — hypersimplex Δ(k,n) on k-subsets (Johnson-graph adjacency),
  Birkhoff B_n on permutations (permutation matrices, transposition adjacency), type-B
  permutahedron on signed permutations.
- **Overlay** — `packages/components/src/figures/polytope-overlay.ts`: several polytopes in
  one shared projection (Gram–Schmidt over the union of vertices) to show containment,
  duality and tiling; demo page `docs/develop/playground/helmert-projection.md`.
- **Guide content** — `docs/learn/explorations/polytopes.md`: duality pairs, majorization
  (Rado) containment, omnitruncation, tiling by the affine symmetric group, the Tonks
  projection / sylvester map onto the associahedron, Loday coordinates, the Biane
  bijection.
- **Open question** — wiki `Element-Relations.md`: should a poset's Hasse cover graph and a
  polytope's 1-skeleton be the same edge data?

## 3. Combinatorial species

Nothing has come across. In the old repo species were an annotation over hand-written
enumerators, not the definition: `base_collection_species(collection, species, reading)`
attached an expression, and `base_species_check` compared its series against the
collection's own cardinality (`packages/data/sqlsrc/base_species.sql`). The wiki's
`Species-Data-Model.md` proposed inverting that — a collection as a reading of a species,
with constructions, generating functions and sequence transforms on one expression tree —
but it was never built. Whether to make species the backbone here is an open decision.

- **Readings on `main`** — about thirty: permutations E∘C, set partitions E∘E₊, set
  compositions and surjections L∘E₊, subsets E·E, signed subsets E³, k-subsets E_k·E,
  words E^k, arrangements E·L, signed permutations E∘C∘(X+X), integer partitions and
  compositions as isotype readings, Dyck paths / binary / ordered trees 1+X·Y², parking
  functions, endofunctions, labelled forests and trees as fixpoints (trees via the
  dissymmetry theorem), Catalan / Motzkin / Schröder as OGF fixpoints.
- **Readings on `auto/species-info-collections-522f78`** (unmerged) — about thirty more,
  including involutions, derangements, k-coloured and decorated permutations, ballot
  sequences, Łukasiewicz paths, rook placements, necklaces, Gray codes, the polytope
  carriers, and the Bell / Fubini / factorial sequences. Also the `species_info` layer,
  a Species section on collection reference pages, atoms in the identity pane, and a
  `Species(C)` head. See also `auto/species-data-orchestration-31d950`.
- **Machinery** — `species_kernel.sql` (cycle index Z, plethysm, composition), labelled EGF
  evaluation, the OGF Picard fixpoint solver, `species_registry.sql` (atoms and operators),
  `species_structures.sql` + `selfcert-species.mts` (a slow definitional enumerator used as
  an oracle), and element notations like `C[{1,2}]C[{3,4}]` and `E[{E₊[…]}]`
  (`species.sql`).
- **Guide content** — `docs/learn/explorations/species.md`, `generic-species.md`.

## 4. Collections without kernels

184 of 282 catalogued collections have no declared head (`!ce.lookupDefinition(name)` over
census's `fullEngine()`). Of those, 89 are numeric sets (primes, perfect/abundant, figurate
families…) — none declared yet, and the first sets the pattern for unbounded collections.
The rest, by carrier: permutation classes (Baxter, separable, simple, vexillary,
Grassmannian…), binary-word families (bracelets, Stern–Brocot/Calkin–Wilf paths), plane
partitions, tableaux (semistandard, skew, shifted, Gelfand–Tsetlin, ASMs),
unlabelled/phylogenetic trees, and a long tail of one-offs.

Branches with content not yet here: `claude/234-gf` (bivariate and recurrence generating-
function programs), `auto/symmetric-group-slice2-401` (cycle notation, Coxeter-length
order), `auto/notebook-exact-irrationals` (exact algebraic irrationals in output).

## 5. Docs and design

- **Counting guides** — `docs/learn/guides/` (permutations, stars and bars, subsets and
  partitions, words and compositions, lattice paths and trees) and
  `docs/learn/explorations/` (bijections, set partitions, subset sum and q-binomials,
  tableaux, computer science). `web/guide` has no introductory combinatorics.
- **Wiki design pages with no counterpart in `design/`** — Grading, Triangular-Grading,
  Number-Gradings, Sequence-Transforms, Maps-and-Bijections, Function-Properties,
  Family-Parameters-and-Numerals (and branch `design/family-parameter-tier`),
  Dimensions-and-Measures, Adaptive-Enumeration-Windows, Self-Certification,
  Element-Relations, Parameterized-Collections, and the surveys (Sage categories, Haskell,
  Lean mathlib4, Rust traits, browser math libraries).
- **Open issues** — `issues.json` has about a hundred open, roughly half Postgres
  infrastructure. The rest track the design pages above plus sampled non-enumerable
  collections (`real_numbers`, `complex_numbers`). The multicomplex tower issue is done
  (`packages/symbols/algebras/hypercomplex`).
