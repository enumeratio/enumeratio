---
name: GeometricMean
domain: Collections
signature: GeometricMean(collection)
summary: The n-th root of the product of n values.
signatures:
  - call: GeometricMean(collection)
    description: $\sqrt[n]{x_1 x_2 \cdots x_n}$ for the $n$ elements of $collection$.
    library: enumeratio-combinatorics
    type: (collection<any>) -> number
seeAlso:
  - HarmonicMean
  - Mean
names:
  wolframIdentity: true
---

- See [[HarmonicMean]] and [[Mean]] for the other Pythagorean means.
