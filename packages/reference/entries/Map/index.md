---
name: Map
domain: Collections
signature: Map(f, xs+)
summary: The collection where each element has been transformed by $f$; with several collections, combines them element-wise (like zip), to the length of the shortest.
signatures:
  - call: Map(f, xs)
    description: $[f(x_1), f(x_2), \ldots]$ — $f$ applied to each element of $xs$.
    type: "(mapping: (T) any -> U, collection<T>+) -> indexed_collection where T, U"
  - call: Map(f, xs, ys, …)
    description: combines several collections element-wise (like zip), to the length of the shortest — $[f(x_1, y_1), f(x_2, y_2), \ldots]$.
seeAlso:
  - Tabulate
  - Fold
  - Filter
names:
  wolframIdentity: true
---

- The mapping function is always the first argument, opposite `Fold`/`Scan`.
- With one collection, equivalent to `[f(x) for x in xs]`; with several, `zipWith`.
