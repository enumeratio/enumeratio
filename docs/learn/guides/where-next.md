# Where next

Five chapters, five families: permutations, subsets & partitions, words & compositions, lattice paths & trees.
That's a deliberately small slice — enough to see the recurring moves (restriction, grading, word-encoding,
bijection) actually happen, live, more than once each. The registry currently groups collections into about
fifteen tag families in total; here's where the rest of them, and everything this tour only pointed at, actually
live.

## The full map

**[The collection atlas](/explore/)** is the whole library, organized by family, generated fresh from the
registry on every build — so it never drifts the way a hand-maintained list would. It's the right next stop for
*browsing*: trees, tableaux, matchings, polytopes, matrices, graphs, number sequences, and everything else this
tour didn't touch, each with its counting sequence and its place in the family tree. The same page's ["organizing
ideas"](/explore/#the-organizing-ideas) section names the patterns this tour taught by example —
grading grids, word-side encodings, restriction hierarchies, dualities — as a reference list instead of a
narrative.

## The deep essays

Three chapters here ended with a teaser into the **[Explorations](/learn/explorations/polytopes)** — this is where
those teasers pay off, written for a reader who already has the vocabulary this tour just built:

- **[Polytopes & their combinatorics](/learn/explorations/polytopes)** — the permutahedron, associahedron, and cross-polytope;
  the sylvester map and Tonks projection promised in [lattice paths & trees](/learn/guides/lattice-paths-and-trees);
  duality, containment, and which ones tile space.
- **[Young tableaux & partition algebras](/learn/explorations/tableaux)** — the RSK correspondence promised in
  [permutations](/learn/guides/permutations); the hook-length formula; Schur–Weyl duality.
- **[Set partitions](/learn/explorations/set-partitions)** — the standard-reference treatment promised in [subsets &
  partitions](/learn/guides/subsets-and-partitions): the refinement lattice as a live, generated Hasse diagram, and the
  non-crossing restriction.
- **[Bijections](/learn/explorations/bijections)** — a tour of the registered maps (`base_map`) behind every "same count"
  claim this tour made along the way — Euler's theorem, the crossing/nesting swap, order-isomorphism as
  rank-borrowing.
- **[The shared projective space](/develop/playground/helmert-projection)** — several polytopes live, overlaid in one coordinate
  system you can orbit and navigate.
- **[Connections to computer science](/learn/explorations/computer-science)** and **[Subset sum &
  q-binomials](/learn/explorations/subset-sum-and-q-binomials)** — several collections turn out to be the solution spaces of
  classic (often NP-complete) algorithmic problems.

## The generated references

Two pages are introspected straight from the live database, not hand-written, so they're exhaustive and never
stale:

- **[Statistics](/develop/data/statistics)** — every named per-element invariant (`inversions`, `descents`, `blocks`, …)
  registered against every collection, each with a live worked example.
- **[API reference](/develop/api)** — the one uniform SQL surface every collection gets for free (`cardinality`,
  `unrank`, `contains`, `render`, …), signatures introspected from the built schema.

## Build with it

Everything on this tour ran through the same layers you can use directly:

- **[`@enumeratio/cli`](/develop/packages/cli/)** — the `enumeratio` terminal command used throughout this tour.
- **[`@enumeratio/components`](/develop/packages/components/)** — `<enumeratio-notation>`, `<enumeratio-figure>`,
  `<enumeratio-expression>`, and the polytope views, drop-in for any page.
- **[`@enumeratio/client`](/develop/packages/client/)** and **[`@enumeratio/data`](/develop/packages/data/)** — the TypeScript
  client and the pure-SQL core underneath everything above it.

## Keep exploring

**[The collection explorer](/explore/collection/)** is every collection from this tour (and the rest of the
atlas) as a live, browsable table — filter, sort, and page through real elements. **[The query
view](/explore/query/)** is the same data from the other side: write the `WHERE` / `GROUP BY` / `ORDER BY`
yourself and watch the table follow.
