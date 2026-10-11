---
name: SkewStandardTableaux
domain: Collections
signature: SkewStandardTableaux(size)
summary: Standard Young tableaux on reduced skew shapes $\lambda/\mu$, summed over every shape with $n$ cells, as a lazy indexed family.
signatures:
  - call: SkewStandardTableaux(size)
    library: enumeratio-combinatorics
    description: the standard fillings of every reduced skew shape $\lambda/\mu$ with `size` cells, entries $1..n$ each once, increasing along rows and down columns.
    type: (integer<0..>) -> indexed_collection<list<list<integer>>>
enumerate:
  expr: SkewStandardTableaux(3)
seeAlso:
  - SkewPartitions
  - Count
  - At
grades:
  - name: size
    role: axis
carrier: SkewTableau
---

- A lazy indexed collection with no closed form, summed over every reduced skew shape from [[SkewPartitions]]. A shape's fillings are counted over its order ideals (the cells placed so far), a table with a state for each count of cells left in each row, so a place in the order is found by walking that table; the count is exact, and `At` answers up to what `work` allows (the table's steps are the limit).
- Each element packs `[λ, μ, rowWord]`, where `rowWord[i]` is the 0-based row entry $i{+}1$ was placed in, in placement order; $\mu = 0$ (every row) recovers a plain standard Young tableau. $\mu$ has no zero parts, as in [[SkewPartitions]].
- Listed by shape ([[SkewPartitions]]'s $\lambda$-then-$\mu$ order), then by row-word, lexicographically within a shape.
