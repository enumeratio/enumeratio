# Stars and bars

The last chapter's compositions required every part to be **positive** — $4 = 1+3$, never $4 = 0+1+3$. Drop that
one restriction and you get a **weak composition**, and counting them is one of combinatorics' cleanest tricks.

## The question

How many ways can $5$ identical coins be split among $3$ people, some people possibly getting none? Line the
coins up as $5$ stars, then choose where $2$ dividing bars go among them — a bar between two stars (or at an end)
marks a new person's share:

```
★ ★ | | ★ ★ ★     =  2 + 0 + 3
| ★ ★ ★ ★ ★ |     =  0 + 5 + 0
★ | ★ | ★ ★ ★     =  1 + 1 + 3
```

Every arrangement of $5$ stars and $2$ bars in a row is a different split, and every split is exactly one such
arrangement — a **bijection**. So the count is just "how many ways to place 2 bars among 7 symbols," which is
$\binom{n+k-1}{k-1}$ for $n$ items and $k$ parts: $\binom{7}{2} = 21$.

## The collection

**[`weak_compositions_into_k_parts`](/explore/collection/weak_compositions_into_k_parts)** *is* this object —
nonnegative parts, summing to $n$, exactly $k$ of them. $n=5$, $k=3$ has all $21$. This page's widgets only bind
the first size axis, so leaving $k$ unbound streams $k=1$ (1 composition), then $k=2$ (6), then $k=3$ starts at
rank 7:

<p>
<enumeratio-notation collection="weak_compositions_into_k_parts" n="5" rank="7"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="weak_compositions_into_k_parts" n="5" rank="12"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="weak_compositions_into_k_parts" n="5" rank="19"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="weak_compositions_into_k_parts" n="5" rank="27"></enumeratio-notation>
</p>

<enumeratio-assert-summary label="stars and bars checks"></enumeratio-assert-summary>

<p>
<enumeratio-assert expect="0+0+5" reveal="always" label="first 3-part composition of 5: all in the last slot">
  <enumeratio-notation collection="weak_compositions_into_k_parts" n="5" rank="7"></enumeratio-notation>
</enumeratio-assert>
</p>

For the clean fixed-$(n,k)$ view — just the 21, no unbound axis to explain — open [the
explorer](/explore/collection/weak_compositions_into_k_parts) and set both parameters there; the header count
reads exactly $21$, the same $\binom{n+k-1}{k-1}$ the stars-and-bars argument predicts, for every $(n,k)$ you try.

## Why it's everywhere

Stars and bars is the reason **[`k_subsets`](/explore/collection/k_subsets)'s** count and
**[`weak_compositions_into_k_parts`](/explore/collection/weak_compositions_into_k_parts)'s** count are secretly the same shape: choosing $k$ dividers among $n+k-1$
slots *is* choosing a $k$-subset of an $(n+k-1)$-element set — $\binom{n+k-1}{k-1} = \binom{n+k-1}{n}$. It's also
the argument behind **[`box_confined_partitions`](/explore/#the-connective-tissue-counting-sequences)**'s
box count, and the reason a weak composition and a plain (strictly-positive) composition differ by exactly a
shift: subtract $1$ from each of $k$ positive parts summing to $n$ and you get $k$ nonnegative parts summing to
$n-k$ — a bijection straight to last chapter's [`integer_compositions`](/learn/guides/words-and-compositions).

Next: **[Lattice paths & trees](/learn/guides/lattice-paths-and-trees)** — a different counting trick, where the
constraint (never go below zero) makes the count *harder* to write in closed form, not easier.
