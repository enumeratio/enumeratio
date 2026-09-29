---
name: HankelMatrix
domain: Collections
signature: HankelMatrix(c)
summary: The square matrix, constant along every anti-diagonal, built from c.
signatures:
  - call: HankelMatrix(c)
    description: the n×n Hankel matrix with first column and first row c, zero-padded past c's reach
    library: enumeratio-combinatorics
    type: (collection<any>, collection<any>?) -> list<list<any>>
  - call: HankelMatrix(c, r)
    description: the n×m Hankel matrix (n = Length(c), m = Length(r)) with r as the last row
    library: enumeratio-combinatorics
names:
  wolframIdentity: true
---

- A Hankel matrix is constant along each anti-diagonal: M(i, j) depends only on i + j.
- r's first element coincides with c's last (both are the matrix's shared corner), so it never surfaces on its own.
