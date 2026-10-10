---
name: Mean
domain: Collections
signature: Mean(collection)
summary: The arithmetic average of the elements of the collection.
signatures:
  - call: Mean(collection)
    description: the arithmetic average of the elements.
  - call: Mean(matrix)
    description: the column-wise mean, one value per column.
    library: enumeratio-combinatorics
    type: ((collection<any> | distribution | number)+) -> number
    overrides: compute-engine
  - call: Mean(collection)
    description: The arithmetic average of the elements of the collection.
    library: enumeratio-statistics
    type: ((collection<any> | distribution | number)+) -> number
    overrides: enumeratio-combinatorics
seeAlso:
  - Median
  - Mode
names:
  wolframIdentity: true
bindings:
  - origin: mapped
    form: oscar
    template: (sum($1) // length($1))
    arity: 1
---

- $Mean(c) = \dfrac{\sum c}{Length(c)}$. See [[Length]].
- Sensitive to outliers — a single extreme value can drag the mean far from the bulk of the data. See [[Median]] for a more robust alternative.
- Given a matrix (a list of equal-length rows), computes the mean of each column.
- See [[Mode]] for the most frequent value rather than the average.
