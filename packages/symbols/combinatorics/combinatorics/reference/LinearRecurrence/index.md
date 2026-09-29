---
name: LinearRecurrence
domain: Collections
signature: LinearRecurrence(kernel, init, n)
summary: The sequence of a linear recurrence with constant coefficients, from its kernel and initial values.
signatures:
  - call: LinearRecurrence(kernel, init, n)
    description: the first $n$ terms of $a_i = kernel_1 \, a_{i-1} + \dots + kernel_k \, a_{i-k}$, seeded by $init$.
    library: enumeratio-combinatorics
    type: "(kernel: list<any>, init: list<any>, n: integer | list<integer>) -> list<any>"
  - call: LinearRecurrence(kernel, init, {m})
    description: just the $m$-th term, as a one-element list.
  - call: LinearRecurrence(kernel, init, {m1, m2})
    description: the terms from index $m1$ through $m2$, inclusive.
seeAlso:
  - RecurrenceTable
  - Fibonacci
  - LucasL
names:
  wolframIdentity: true
---

- Exact throughout: an integer or rational $kernel$ and $init$ stay integer or rational all the way out, never floating point.
