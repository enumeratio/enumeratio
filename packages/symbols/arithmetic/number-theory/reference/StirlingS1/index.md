---
name: StirlingS1
domain: Combinatorics
signature: StirlingS1(n, k)
summary: The signed Stirling number of the first kind, relating falling factorials to powers of n.
signatures:
  - call: StirlingS1(n, k)
    description: the signed Stirling number of the first kind $s(n, k)$.
  - call: StirlingS1(n, k)
    description: The signed Stirling number of the first kind, relating falling factorials to powers of n.
    library: enumeratio-number-theory
    type: (integer, integer) -> integer
    overrides: compute-engine
seeAlso:
  - Binomial
  - Stirling
references:
  - system: wikipedia
    identity: Stirling numbers of the first kind
  - system: mathworld
    identity: StirlingNumberoftheFirstKind
  - system: dlmf
    identity: "26.8"
  - system: oeis
    identity: A008275
names:
  dlmf: Stirling number of the first kind
  catalog: Stirling1
  wolframIdentity: true
bindings:
  - origin: mapped
    form: wolfram
    template: StirlingS1[$1, $2]
    arity: 2
    threadArg: 1
    note: Signed in Wolfram and compute-engine; Sage's stirling_number1, Combinatorics.jl's stirlings1 and Mathlib's Nat.stirlingFirst are UNSIGNED, so a sign difference here is expected, not a bug. Combinatorics.jl's stirlings1 also needs n as a BigInt past its Int64 lookup table (n > 20).
  - origin: mapped
    form: sage
    template: ((-1) ** ($1 - $2) * stirling_number1($1, $2))
    arity: 2
    threadArg: 1
    note: Signed in Wolfram and compute-engine; Sage's stirling_number1 is unsigned, so the template carries the sign (-1)^(n-k), and threads over a list as Wolfram's Listable head does. Combinatorics.jl's stirlings1 and Mathlib's Nat.stirlingFirst are UNSIGNED, so a sign difference there is expected, not a bug. Combinatorics.jl's stirlings1 also needs n as a BigInt past its Int64 lookup table (n > 20).
  - origin: mapped
    form: julia
    template: Combinatorics.stirlings1(big($1), $2)
    arity: 2
    threadArg: 1
    note: Signed in Wolfram and compute-engine; Sage's stirling_number1, Combinatorics.jl's stirlings1 and Mathlib's Nat.stirlingFirst are UNSIGNED, so a sign difference here is expected, not a bug. Combinatorics.jl's stirlings1 also needs n as a BigInt past its Int64 lookup table (n > 20).
  - origin: mapped
    form: mathlib4
    template: (Nat.stirlingFirst $1 $2)
    arity: 2
    threadArg: 1
    note: Signed in Wolfram and compute-engine; Sage's stirling_number1, Combinatorics.jl's stirlings1 and Mathlib's Nat.stirlingFirst are UNSIGNED, so a sign difference here is expected, not a bug. Combinatorics.jl's stirlings1 also needs n as a BigInt past its Int64 lookup table (n > 20).
  - origin: mapped
    form: combinatorica
    template: Function[{n, k}, (-1)^(n - k) StirlingFirst[n, k], Listable][$1, $2]
    arity: 2
    note: Signed in Wolfram and compute-engine; Combinatorica's StirlingFirst, like Sage's stirling_number1, is UNSIGNED, so the template carries the sign (-1)^(n-k). Combinatorics.jl's stirlings1 and Mathlib's Nat.stirlingFirst are UNSIGNED too, so a sign difference there is expected, not a bug. Combinatorics.jl's stirlings1 also needs n as a BigInt past its Int64 lookup table (n > 20).
  - origin: mapped
    form: sympy
    template: stirling($1, $2, kind=1, signed=True)
    arity: 2
    threadArgOnly:
      - 1
      - 2
    checked:
      version: 1.14.0
      on: 2026-10-14
    note: SymPy's `stirling` defaults to the second kind and unsigned; `kind=1, signed=True` is the signed first kind, as ours and Wolfram's.
catalog:
  - system: wolfram
    identity: StirlingS1
    url: https://reference.wolfram.com/language/ref/StirlingS1.html
    note: WL StirlingS1 is SIGNED; stirling1 here is the UNSIGNED cycle-count c(n,k) = |StirlingS1(n,k)|
---

- Coefficients relating falling factorials to ordinary powers: $(x)_n = \sum_{k} s(n, k)\, x^k$.
- $|s(n, k)|$ counts the permutations of n elements with exactly k cycles.
- $s(n, n) = 1$ and $s(n, 0) = 0$ for $n > 0$, with the boundary case $s(0, 0) = 1$.
- The unsigned values in each row sum to $n!$: $\sum_k |s(n, k)| = n!$
- $s(n, 1) = (-1)^{n-1}(n-1)!$.
- Threads element-wise over a list of $n$, as Wolfram's Listable heads do.
