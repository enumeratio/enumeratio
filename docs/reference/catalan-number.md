# CatalanNumber

*The $n$-th Catalan number, $C_n = \dfrac{1}{n+1}\dbinom{2n}{n}$ — the size of dozens of combinatorial families,
Dyck paths among them.*

## Usage

| Form | Meaning |
|---|---|
| $\operatorname{CatalanNumber}(n)$ | $C_n$ |
| $\operatorname{CatalanNumber}(\{n_1, n_2, \dots\})$ | threads element-wise over a list (Listable) |

## Details

- **Arity:** 1 — a natural number $n$.
- **Argument/result type:** `(integer) -> integer`.
- **Attributes:** `broadcastable: true` (Listable), like every counting sequence in this library.
- **Implementation:** the closed form $\lfloor \binom{2n}{n}/(n+1) \rceil$ via this library's own `Binomial`
  kernel, rounded to the nearest integer to absorb floating-point error at larger $n$
  (`packages/compute-engine/src/kernels-extra.ts`) — $O(n)$ per call (the binomial coefficient's own cost), not
  memoized across calls.
- **Domain:** $n \geq 0$ returns the sequence; a negative $n$ returns $0$.
- **Counts:** `DyckPaths(n)` — see [`DyckPaths`](/reference/dyck-paths). Also the underlying count for several
  other lattice-path/tree families in this library (`Triangulations`, `NonCrossingMatchings`,
  `LittleSchroderPaths`'s cousins), each with its own bijection to a Dyck path.

## Examples

$\operatorname{CatalanNumber}(0) = 1,\quad \operatorname{CatalanNumber}(1) = 1,\quad
\operatorname{CatalanNumber}(2) = 2,\quad \operatorname{CatalanNumber}(3) = 5,\quad
\operatorname{CatalanNumber}(4) = 14$

$\operatorname{Count}(\operatorname{DyckPaths}(4)) = \operatorname{CatalanNumber}(4) = 14$ — the collection and
the closed form agree by construction (`DyckPathCount(n)` literally calls `CatalanNumber(n)`).

## See also

[`DyckPaths`](/reference/dyck-paths) · `Triangulations` · `NonCrossingMatchings` · [`BellB`](/reference/bell-b) ·
[`Fubini`](/reference/fubini)
