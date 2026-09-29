---
name: Log2
domain: Elementary functions
signature: Log2(z)
summary: The base-2 (binary) logarithm of z.
signatures:
  - call: Log2(z)
    description: the base-2 logarithm of z, $\log_2(z)$.
seeAlso:
  - Log
  - Log10
  - Lb
names:
  wolframIdentity: true
---

- Equivalent to Log(z, 2), and identical to [[Lb]].
- Folds exactly for an integer power of 2 in either direction -- positive ($1024 \to 10$) or negative ($1/8 \to -3$).
