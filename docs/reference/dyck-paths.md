# DyckPaths

*Lattice paths of $2n$ unit steps (up $=1$, down $=0$) from $(0,0)$ to $(2n,0)$ that never dip below the axis.*

## Usage

| Form | Meaning |
|---|---|
| $\operatorname{DyckPaths}(n)$ | all Dyck paths of semilength $n$ (i.e. $n$ up-steps and $n$ down-steps) |
| $\operatorname{At}(\operatorname{DyckPaths}(n),\ i)$ | the path at 1-based position $i$ |
| $\operatorname{Rank}(\operatorname{DyckPaths}(n),\ w)$ | $w$'s 1-based position |

A path is a list of $2n$ entries, each $1$ (up-step) or $0$ (down-step), with every prefix sum $\geq 0$ and the
full sum $= 0$.

## Details

- **Arity:** 1 — the semilength $n$ (path length is $2n$).
- **Result type:** `collection` of `list<integer>` of length $2n$, entries in $\{0, 1\}$.
- **Count:** $\operatorname{CatalanNumber}(n) = \binom{2n}{n} / (n+1)$.
- **Order:** "up-before-down" — at each step, the unrank prefers an up-step whenever the number of paths
  completable that way covers the target rank, else takes a down-step and subtracts that count
  (`DyckPathUnrank`/`DyckPathRank` in `packages/compute-engine/src/kernels-extra.ts`, via a memoized
  `dyckCompletions(remainingSteps, height)` table).
- **Random access:** $O(n)$ amortized — one $\operatorname{dyckCompletions}$ lookup per of the $2n$ steps.
- **Catalog alias:** the pg-catalog collection `dyck_paths` names the same family (`COLL_HEADS`,
  `packages/client/src/ce-enum-engine.ts`).
- Related lattice-path families with their own heads: `MotzkinPaths` (up/level/down steps), `SchroderPaths`
  (large Schröder numbers), `GrandDyckPaths`/`GrandMotzkinPaths` (paths allowed below the axis).

## Examples

$\operatorname{Count}(\operatorname{DyckPaths}(3)) = \operatorname{CatalanNumber}(3) = \binom{6}{3}/4 = 5$

The lexicographically-last-to-touch-the-axis path — all ups then all downs — is
$\operatorname{At}(\operatorname{DyckPaths}(3),\ 1) = [1,1,1,0,0,0]$: "up-before-down" order always tries $1$
first, so the very first path in the order is the one that stays as high as possible for as long as possible.

## See also

`MotzkinPaths` · `SchroderPaths` · `GrandDyckPaths` · `LatticePaths` ·
[`CatalanNumber`](/reference/catalan-number) · [`unrank`](/reference/unrank) · [`rank`](/reference/rank)
