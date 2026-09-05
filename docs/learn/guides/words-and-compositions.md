# Words & compositions

A **word** is just a string over some alphabet. That sounds like the plainest object in the library — but a lot
of structures turn out to secretly *be* a word once you pick the right encoding, and that encoding is where the
idea of a **bijection** — a perfect one-to-one correspondence between two collections — gets concrete.

## Encoding a structure as a word

Take this set partition of $[4]$ — blocks $\{1,2\}$, $\{3\}$, $\{4\}$:

<enumeratio-figure collection="set_partitions" n="4" rank="4"></enumeratio-figure>

Write down, for each element $1,2,3,4$ in turn, *which block it's in* (numbering blocks by the order they first
appear — $1$ and $2$ share block `0`, then `1`, then `2`): that's a **restricted growth string**, and it's so
directly a reading of the same data that [`set_partitions`](/explore/collection/set_partitions)' own notation already *is* that digit string:

<enumeratio-assert-summary label="words & compositions checks"></enumeratio-assert-summary>

<p>
<enumeratio-assert expect="0012" reveal="always" label="set_partitions(4) rank 4, as a word">
  <enumeratio-notation collection="set_partitions" n="4" rank="4"></enumeratio-notation>
</enumeratio-assert>
&nbsp;=&nbsp;
<enumeratio-assert expect="0012" reveal="always" label="restricted_growth_strings(4) rank 4">
  <enumeratio-notation collection="restricted_growth_strings" n="4" rank="4"></enumeratio-notation>
</enumeratio-assert>
</p>

**[`restricted_growth_strings`](/explore/collection/restricted_growth_strings)** and
[`set_partitions`](/explore/collection/set_partitions) are **order-isomorphic**: rank for rank, the $k$-th RGS
*is* the $k$-th set partition — not just corresponding to it, but, here, literally the same string. Same move on
permutations: record, for each position,
how many *later* values are smaller — the **[Lehmer code](/explore/collection/lehmer_codes)**, a permutation's
inversion table:

<p>
<enumeratio-notation collection="permutations" n="4" rank="9"></enumeratio-notation>
&nbsp;→&nbsp;
<enumeratio-notation collection="lehmer_codes" n="4" rank="9"></enumeratio-notation>
</p>

Two structures that look nothing alike — a grouping, an arrangement — both turn out to be countable by reading
off a word. That reduction is why word encodings are worth taking seriously as objects of their own, not just a
display trick.

## Binary words, and equivalence classes

The plainest word collection is **[`binary_words`](/explore/collection/binary_words)** — length-$n$ strings over
$\{0,1\}$, $2^n$ of them:

<enumeratio-figure collection="binary_words" n="5" rank="9"></enumeratio-figure>

Two restrictions worth knowing: **[`binary_necklaces`](/explore/collection/binary_necklaces)** collapses words
that are rotations of each other down to one representative (the lexicographically-least rotation), and
**[`lyndon_words`](/explore/collection/lyndon_words)** keeps only the *aperiodic* necklaces — the ones with no
smaller rotation at all. This is a different kind of slicing than the last chapter's: not "fix a size axis," but
"identify elements that are equivalent under a symmetry," and keep one representative per class.

## Compositions — an ordered sum

An **integer composition** is like the last chapter's integer partitions — parts summing to $n$ — except *order
matters*: $4 = 1+3$ and $4=3+1$ are different compositions but the same partition. That one relaxation changes
the count from $p(n)$ to a clean power of two: $2^{n-1}$ compositions of $n$.

<p>
<enumeratio-notation collection="integer_compositions" n="4" rank="3"></enumeratio-notation>
&nbsp;
<enumeratio-figure collection="integer_compositions" n="4" rank="3"></enumeratio-figure>
</p>

The same relaxation applies one level up: **[`set_compositions`](/explore/collection/set_compositions)** are
*ordered* set partitions — blocks in a sequence, not a set of blocks — counted by the Fubini numbers, and word-encoded
in turn by **[`surjections`](/explore/collection/surjections)** (which ordered block each element lands in). Every
family in this chapter fits the same shape as the last one: pick a structure, then either narrow it by a size
axis or re-encode it as a word — and either move produces a new, order-isomorphic sibling collection.

Next: **[Stars and bars](/learn/guides/stars-and-bars)**, a classic counting trick living one relaxation away from the
compositions above.
