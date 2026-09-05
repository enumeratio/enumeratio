# Permutations

A **permutation** of size $n$ is an arrangement of $1,\dots,n$ in some order — no repeats, none left out. Its
notation is just the values read off in order (a "one-line" word). Size 3 is small enough to show in full —
here are all six, ranks 0 through 5:

<p>
<enumeratio-notation collection="permutations" n="3" rank="0"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="permutations" n="3" rank="1"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="permutations" n="3" rank="2"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="permutations" n="3" rank="3"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="permutations" n="3" rank="4"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="permutations" n="3" rank="5"></enumeratio-notation>
</p>

Rank 0 is always the identity — the values already in order — and every chapter's numbering agrees with the
database, not just this page's prose:

<enumeratio-assert-summary label="permutations checks"></enumeratio-assert-summary>

<p>
<enumeratio-assert expect="123" reveal="always" label="rank 0 is the identity">
  <enumeratio-notation collection="permutations" n="3" rank="0"></enumeratio-notation>
</enumeratio-assert>
</p>

## How many

$n$ choices for the first slot, $n-1$ for the next, and so on: $|\mathfrak S_n| = n!$. At $n=4$ that's $24$;
check it from the [CLI](/develop/packages/cli/) (`enumeratio permutations size=4 --count`) or read it off the
[explorer](/explore/collection/permutations)'s header — both go through the same accelerated count, not a scan.

## Restrictions — permutations with a property

Most of the library's permutation collections are [`permutations`](/explore/collection/permutations) narrowed by one predicate — same notation,
fewer elements:

- **[`derangements`](/explore/collection/derangements)** — no value stays in its own position ($1$ never at
  slot 1, etc). $\frac{n!}{e}$, rounded, for large $n$.
- **[`involutions`](/explore/collection/involutions)** — applying the permutation twice gets back to the start
  ($w(w(i)) = i$ for every $i$). These are exactly the permutations that are their own inverse.
- **[`even_permutations`](/explore/collection/even_permutations)** — sign $+1$ (an even number of swaps to build).
- **[`cyclic_permutations`](/explore/collection/cyclic_permutations)** — a single $n$-cycle, $(n-1)!$ of them.

Each is its own collection — its own cardinality, its own ranking — not a filter you apply after the fact. The
[atlas](/explore/#restriction-hierarchies) has the fuller family tree, including the pattern-avoidance
classes ([`baxter_permutations`](/explore/collection/baxter_permutations), [`grassmannian_permutations`](/explore/collection/grassmannian_permutations), …).

## A first statistic

A **statistic** is a named number attached to every element — descents, cycles, fixed points, whatever's
interesting. `inversions` counts the out-of-order pairs: `321` has 3 (every pair is backwards), `123` has 0.
Grouping a collection by a statistic gives its **distribution** — for `inversions` over all of $\mathfrak S_n$,
that's the classical **Mahonian numbers**:

```bash
enumeratio permutations size=1:6 --triangle inversions
```

The full statistic catalog for permutations — 16 of them, `descents`, `cycles`, `fixed_points`, and more, each
with a live worked example — is in the [statistics reference](/develop/data/statistics#permutations).

## Going deeper

Permutations aren't just arrangements — via the **Robinson–Schensted correspondence** every permutation
corresponds to a *pair* of same-shape Young tableaux, which is where the telephone numbers, the hook-length
formula, and a good chunk of algebraic combinatorics live. That whole story, worked through on real data, is
**[Young tableaux & partition algebras](/learn/explorations/tableaux)**.

Next: **[Subsets & partitions](/learn/guides/subsets-and-partitions)** — the same idea of "the same $n$ things, sliced
differently" that the restrictions above hinted at, but as the main event.
