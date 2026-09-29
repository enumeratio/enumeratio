---
name: HarmonicMean
domain: Collections
signature: HarmonicMean(collection)
summary: The reciprocal of the mean of the reciprocals.
signatures:
  - call: HarmonicMean(collection)
    description: $n \big/ \sum_{i} 1/x_i$ for the $n$ elements of $collection$.
    library: enumeratio-combinatorics
    type: (collection<any>) -> number
seeAlso:
  - GeometricMean
  - Mean
names:
  wolframIdentity: true
---

- See [[GeometricMean]] and [[Mean]] for the other Pythagorean means.
