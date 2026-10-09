---
name: Median
domain: Collections
signature: Median(collection)
summary: The middle value of the collection once sorted.
signatures:
  - call: Median(collection)
    description: the middle value of the collection once sorted.
  - call: Median(matrix)
    description: the column-wise median, one value per column.
    library: enumeratio-combinatorics
    type: ((collection<any> | number)+) -> nan | real | signed_infinity
    overrides: compute-engine
  - call: Median(dist)
    description: the exact quantile at 1/2 of a distribution, where one exists; otherwise unevaluated.
    library: enumeratio-statistics
    type: ((collection<any> | distribution | number)+) -> number
    overrides: enumeratio-combinatorics
seeAlso:
  - Mean
  - Mode
names:
  wolframIdentity: true
---

- For an odd-length collection, the median is the middle element of [[Sort]]'s result; for even length, it's the average of the two middle elements.
- Much less sensitive to outliers than [[Mean]] — a single extreme value barely moves it.
- Given a matrix (a list of equal-length rows), computes the median of each column.
- See [[Mode]] for the most frequent value.
