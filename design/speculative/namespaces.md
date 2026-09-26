# Design: namespaces, resources, and the shape of a 1500-name catalog

Split from design/namespaces.md: §7 Open.

## Open

- **String identifier vs context path.** §4 argues for the path on promotion-cost grounds.
  Not settled, and the cheapest moment to settle it is now.
- **Which separator character.** §3.3 — only `_` is legal today and it collides with the
  subscript convention. `~` is semantically right and currently taken by LaTeX.
- **Where the frontier sits.** §6.1 — the primitive set is a decision, and everything in §6
  depends on it.
- **Does a resolved resource keep identity across sessions?** Wolfram resources have a UUID
  behind the name. If promotion is a rename, something stable underneath has to survive it.
- **Where the registry lives.** Today it would be extracted enumeratio data committed into
  notatio. The aspiration is fetched-on-demand. The shape should not assume either.
- **The 53 multi-carrier stats need the domain-keyed signature** to exist first. The other
  189 need only carrier-scoped definitions, which is ours to build; the 53 are a hard
  dependency on the upstream question pile rather than something we can route around.
- **Aggregates** are not counted above — they were not in the extraction. They need the same
  census before being placed in one of the three populations.
