# Young tableaux & partition algebras

Young tableaux are the connective tissue of algebraic combinatorics: they index a symmetric group's irreducible
representations, they carry the Robinson–Schensted–Knuth correspondence, they expand Schur functions, and — through
Schur–Weyl duality — they sit opposite the **partition algebra** on the same tensor space. enumeratio realizes three
of the players as live collections, and the maps between them run in the [CLI](/develop/packages/cli/). This page shows the
classical associations *in action* on those collections, with every number below derived from the actual data (the
telephone/Bell counts, the RSK images, and the shape distributions are all verified example cases in
[`@enumeratio/data`](/develop/packages/data/)).

## The three collections

| collection | objects | carrier | count | sequence |
|---|---|---|---|---|
| [`standard_tableaux`](/explore/collection/standard_tableaux) | SYT with $n$ cells, all shapes $\lambda \vdash n$ | ballot **row-word** (`row_word[i]` = row of entry $i$) | $T_n$ | telephone / involutions (A000085) |
| [`semistandard_tableaux`](/explore/collection/semistandard_tableaux) | SSYT with $n$ cells, entries $\le k$ | flat `(entries, shape)` | $\sum_{\lambda\vdash n} s_\lambda(1^k)$ | 2-parameter $(n,k)$ |
| [`partition_algebra`](/explore/collection/partition_algebra) | set-partition diagram basis on $n$ points | RGS `set_partition` (borrowed) | $B_n$ | Bell (A000110) |

The counts are exactly what the collections report:

```bash
enumeratio standard_tableaux size=6 --count      # 76   — T_0..6 = 1,1,2,4,10,26,76
enumeratio partition_algebra n=5 --count         # 52   — B_0..5 = 1,1,2,5,15,52
enumeratio semistandard_tableaux size=3 max_entry=3 --count   # 19
```

A **standard** Young tableau of shape $\lambda$ fills the cells with $1,\dots,n$ increasing along rows *and* columns;
a **semistandard** one weakly increases along rows and strictly increases down columns, drawing entries from
$\{1,\dots,k\}$ with repeats. [`standard_tableaux`](/explore/collection/standard_tableaux) ranges over every shape $\lambda \vdash n$ at once — its 4 elements
at $n=3$ are the row, the two hooks, and the column:

```bash
enumeratio standard_tableaux size=3            # 1,2,3 · 1,2/3 · 1,3/2 · 1/2/3
```

## RSK: permutations ↔ pairs of tableaux

The **Robinson–Schensted correspondence** is a bijection

$$ \mathfrak S_n \;\longleftrightarrow\; \{(P,Q) : P,Q \text{ standard tableaux of the same shape } \lambda \vdash n\}, $$

built by *row insertion* (Schensted bumping): read the one-line word left to right, insert each value into the first
row, bumping the leftmost strictly-larger entry down to the next row; $P$ (the **insertion** tableau) records the
entries, $Q$ (the **recording** tableau) records the order in which cells were added. enumeratio provides both halves
plus the inverse — `rsk_insertion`, `rsk_recording`, `rsk_inverse` — all validated element-by-element against Sage's
`robinson_schensted` for permutations of size $\le 5$.

Worked example, $w = 2\,4\,1\,3$:

| step | insert | $P$ (insertion) | $Q$ (recording) |
|---|---|---|---|
| 1 | 2 | `2` | `1` |
| 2 | 4 | `2,4` | `1,2` |
| 3 | 1 | `1,4 / 2` | `1,2 / 3` |
| 4 | 3 | `1,3 / 2,4` | `1,2 / 3,4` |

So $w = 2413$ maps to $P = \texttt{1,3/2,4}$ and $Q = \texttt{1,2/3,4}$ — the same shape $(2,2)$, different fillings —
and `rsk_inverse(P,Q)` recovers $2413$. The bijection has two symmetries the data confirms across all of
$\mathfrak S_4$: it is **shape-compatible** (the shape of $P$ always has $n$ cells), and it satisfies the
**Schützenberger symmetry** $P(w^{-1}) = Q(w)$, $Q(w^{-1}) = P(w)$ — inverting the permutation swaps the two tableaux.

Two immediate corollaries, both visible in the counts:

- **$\sum_{\lambda \vdash n} (f^\lambda)^2 = n!$** — RSK is a bijection onto *pairs* of same-shape SYT, so squaring the
  per-shape count and summing recovers $|\mathfrak S_n|$. At $n=4$: $1^2+3^2+2^2+3^2+1^2 = 24 = 4!$.
- **Involutions ↔ single tableaux** — since $w = w^{-1}$ forces $P = Q$, involutions biject with *single* SYT. Hence
  $|\text{`standard_tableaux`}(n)| = \sum_{\lambda\vdash n} f^\lambda = T_n$ is the telephone/involution number
  (A000085), not $n!$ — the collection literally checks `|standard_tableaux(5)| = |involutions(5)| = 26`.

## Hook-length formula

The number of standard tableaux of a *fixed* shape $\lambda \vdash n$ is

$$ f^\lambda \;=\; \frac{n!}{\prod_{u \in \lambda} h(u)}, $$

where the **hook length** $h(u)$ of a cell counts the cell itself plus the cells to its right in the same row and
below it in the same column. [`standard_tableaux`](/explore/collection/standard_tableaux) doesn't grade by shape, but it carries a `shape` map, so the shape
distribution of a fiber recovers each $f^\lambda$ as a class size. At $n=3$ the three shapes appear with multiplicities

$$ f^{(3)},\,f^{(2,1)},\,f^{(1^3)} \;=\; 1,\,2,\,1, $$

which the data reports directly (the `shape` distribution over `standard_tableaux(3)` is $1,2,1$). Check against the
formula: shape $(2,1)$ has hooks $\{3,1,1\}$, so $f^{(2,1)} = 3!/3 = 2$; the row $(3)$ has hooks $\{3,2,1\}$, giving
$3!/6 = 1$; the column likewise $1$. Summing over all shapes reproduces the telephone number, $1+2+1 = 4 = T_3$.

At $n=4$ the five shapes give $f = 1,3,2,3,1$ summing to $10 = T_4$. The two-cell hook shape $(2,2)$ is the one that
makes the sum-of-squares corollary bite: hooks $\{3,2,2,1\}$, product $12$, so $f^{(2,2)} = 24/12 = 2$. Two of
enumeratio's shape-restricted siblings pin down whole hook-length families as `base_restrict`s of [`standard_tableaux`](/explore/collection/standard_tableaux):

```bash
enumeratio syt_hook_shape size=4 --count    # 8  = 2^{n-1}  (hook shapes (a,1^b), A011782)
enumeratio syt_two_row size=4 --count       # 6  = C(4,2)   (shapes (a,b), central binomial A001405)
```

## SSYT ↔ Schur functions

Semistandard tableaux are the combinatorial model of the **Schur functions**. The Schur polynomial in $k$ variables
is the generating function of SSYT of shape $\lambda$ weighted by content:

$$ s_\lambda(x_1,\dots,x_k) \;=\; \sum_{T \in \mathrm{SSYT}(\lambda,\,k)} x^{\operatorname{content}(T)}, \qquad
x^{\operatorname{content}(T)} = \prod_i x_i^{\#\{\text{cells holding } i\}}. $$

Setting every $x_i = 1$ counts the tableaux: $s_\lambda(1^k) = |\mathrm{SSYT}(\lambda, k)|$, the **principal
specialization**, and closed by the hook-content formula $s_\lambda(1^k) = \prod_{u\in\lambda} \frac{k + c(u)}{h(u)}$
where $c(u)$ is the cell's content (column $-$ row). [`semistandard_tableaux`](/explore/collection/semistandard_tableaux) aggregates this over all shapes of a
given size — the count $|\text{`semistandard_tableaux`}(n,k)| = \sum_{\lambda\vdash n} s_\lambda(1^k)$ — and the
family behaves as the specialization predicts:

```bash
enumeratio semistandard_tableaux size=3 max_entry=2 --count   # 6   — the six SSYT of 3 cells, entries ≤ 2
# k = 1..4 with n = 3 fixed:                                    1,6,19,44   (more letters, more fillings)
```

Forcing $k=1$ leaves only the all-ones single row, so $|\text{`semistandard_tableaux`}(n,1)| = 1$ for every $n$ — the
degenerate specialization $s_\lambda(1) = [\lambda \text{ is a single row}]$. When the content is *forced to be all
distinct* — one of each of $1,\dots,n$, i.e. the specialization $1^n$ with each letter used exactly once — an SSYT is
precisely a standard tableau. That last observation is the modeling thread below.

## Schur–Weyl duality & the partition algebra

Schur–Weyl duality is the statement that, on the $k$-fold tensor space $V^{\otimes k}$ with $V = \mathbb C^n$, the
commuting actions of the symmetric group $\mathfrak S_k$ (permuting factors) and the general linear group
$\mathrm{GL}(V)$ are **mutual centralizers**, and the space decomposes as

$$ V^{\otimes k} \;\cong\; \bigoplus_{\lambda} \; S^\lambda \otimes W_\lambda, $$

a sum over shapes $\lambda$ with $\le n$ rows, pairing an $\mathfrak S_k$-irreducible $S^\lambda$ (indexed by SYT) with
a $\mathrm{GL}(V)$-irreducible $W_\lambda$ (indexed by SSYT). The **partition algebra** $P_k(n)$ is what appears when
you shrink $\mathrm{GL}(V)$ to the symmetric group $\mathfrak S_n \subset \mathrm{GL}(V)$: $P_k(n)$ is the centralizer
of the diagonal $\mathfrak S_n$-action on $V^{\otimes k}$, the Schur–Weyl *dual* of $\mathfrak S_n$. Its basis is the
**set-partition diagrams** on $2k$ points (a top and bottom row of $k$), so $\dim P_k(n) = B_{2k}$, the Bell number.

enumeratio's [`partition_algebra`](/explore/collection/partition_algebra) realizes the **one-row** slice of this: the
set-partition diagrams on a single row of $n$ points, $B_n$ of them, borrowing the [`set_partitions`](/explore/collection/set_partitions) carrier and count
verbatim (it is the algebra *reading* of that same data). The block-count statistic recovers the Stirling triangle,
exactly as for set partitions:

```bash
enumeratio partition_algebra n=4 --count            # 15 = B_4
# block-count distribution over P(4):  1,7,6,1        (Stirling-2 row S(4,k))
```

The full two-row diagram basis indexed by set partitions of a $2k$-point set (dimension $B_{2k}$) is a deliberate
follow-up — it needs a two-row carrier — noted in the collection's own source. What is live is the tableaux side of
the duality (both SYT and SSYT) and the one-row partition-monoid basis; the bridge between them is the representation
theory sketched above rather than a computed map, for now.

## A modeling thread: SYT as a restriction of SSYT

There is an obvious containment the data does *not* yet express directly. A standard tableau is exactly a
semistandard tableau whose **content is $1^n$** — every entry $1,\dots,n$ used once, which forces the strict-along-rows
condition and makes it standard. So mathematically

$$ \text{`standard_tableaux`}(n) \;\cong\; \{\, T \in \text{`semistandard_tableaux`}(n, n) : \operatorname{content}(T) = 1^n \,\}, $$

i.e. [`standard_tableaux`](/explore/collection/standard_tableaux) is *morally* a `base_restrict` of
[`semistandard_tableaux`](/explore/collection/semistandard_tableaux) — the same kind of derived-membership sibling that [`syt_hook_shape`](/explore/collection/syt_hook_shape)
and [`syt_two_row`](/explore/collection/syt_two_row) already are of [`standard_tableaux`](/explore/collection/standard_tableaux) (those restrict by *shape*; this one
would restrict by *content*).

The obstruction is purely a carrier mismatch, not a mathematical one:

- [`standard_tableaux`](/explore/collection/standard_tableaux) is carried as a **ballot row-word** (`row_word[i]` = the row of entry $i$) — compact because a
  standard filling is determined by which row each successive entry extends.
- [`semistandard_tableaux`](/explore/collection/semistandard_tableaux) is carried **flat** as `(entries, shape)` — it has to name the actual entries, since they
  repeat and are bounded by $k$.

A `base_restrict` needs the child to *share the parent's carrier* and cut it with a membership predicate. These two
carriers are different, so unifying them would first require either a shared carrier for both families or an explicit
order-isomorphic **map** `standard_tableaux → semistandard_tableaux` (row-word $\mapsto$ the $(entries, shape)$ with
content $1^n$) to hang the restriction on. Both are viable; neither is built. Recording it here as an **open modeling
thread** — the associations on this page are the argument that the unification is worth doing, and the carrier note is
the reason it is not a one-liner.

## The numbers, in one place

$$
T_n = 1,1,2,4,10,26,76,\dots \;\; (\text{SYT, telephone}), \qquad
B_n = 1,1,2,5,15,52,\dots \;\; (\text{partition algebra, Bell}),
$$
$$
\sum_{\lambda\vdash n}(f^\lambda)^2 = n! \;\; (\text{RSK}), \qquad
f^\lambda = \frac{n!}{\prod h(u)} \;\; (\text{hook length}), \qquad
s_\lambda(1^k) = |\mathrm{SSYT}(\lambda,k)| \;\; (\text{Schur}).
$$

Every collection named here is live in the [explorer](/explore/collection/) and enumerable from the
[CLI](/develop/packages/cli/); the RSK maps, the `shape` and `transpose` maps on [`standard_tableaux`](/explore/collection/standard_tableaux), and the counts above are
all covered by the verified example suite in [`@enumeratio/data`](/develop/packages/data/).
