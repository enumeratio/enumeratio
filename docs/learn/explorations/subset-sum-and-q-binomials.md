# Counting subsets by their sum: q-binomials, partitions, and subset sum

One of the prettier connections in the library: a single sequence of numbers — the **Gaussian binomial
coefficient** — is simultaneously an answer about subsets, about partitions, and about a famous NP-complete problem.
Everything here is verified (against SageMath and against enumeratio's own enumeration); where a boundary matters —
what's tractable versus what's hard — it's drawn precisely.

## Three faces of one coefficient

Fix `N` and `k`. Consider three seemingly different counts:

1. **k-subsets of `{1,…,N}` by their sum.** The smallest possible sum of a k-subset is `1+2+⋯+k = \binom{k+1}{2}`;
   write each subset's sum as `\binom{k+1}{2} + r`. How many k-subsets have a given `r`?
2. **Partitions in a box.** How many integer partitions of `r` fit inside a `k × (N−k)` box (at most `k` parts, each
   at most `N−k`)? — our [`box_confined_partitions`](/explore/collection/box_confined_partitions).
3. **The Gaussian binomial.** The coefficient of `qʳ` in `\binom{N}{k}_q = \frac{[N]_q!}{[k]_q!\,[N-k]_q!}`, where
   `[m]_q = 1 + q + ⋯ + q^{m-1}`.

**These are the same sequence, term for term.** For `N=4, k=2` all three give `1,1,2,1,1`; for `N=6, k=3` all three
give `1,1,2,3,3,3,3,2,1,1` (which is `\binom{6}{3}_q`). The bijection behind it: sort a k-subset ascending,
subtract `i` from its i-th element, and read off a
partition that fits the box. Setting `q = 1` collapses all three to the ordinary `\binom{N}{k}` — the q-binomial is
the **q-analog** of the binomial that counts `finite_sets`.

In enumeratio you can watch the three coincide directly, and the library asserts it as a passing example:
`finite_sets(N, k)` grouped by member-sum, `box_confined_partitions(k, N−k)` grouped by `|λ|`, and `\binom{N}{k}_q`'s
coefficients are one and the same row.

## The companion: permutations by inversion

The q-binomial is built from **q-factorials** — `[N]_q! = [1]_q [2]_q \cdots [N]_q` where `[i]_q = 1+q+\cdots+q^{i-1}`
— exactly as `\binom{N}{k} = \frac{N!}{k!\,(N-k)!}`. And the q-factorial has its own combinatorial face: **the
number of permutations of `[n]` with a given number of inversions is the coefficient of that power of `q` in
`[n]_q!`** — the *Mahonian* distribution. For `n=4`: `1,3,5,6,5,3,1`, which is `[4]_q!`. So where the q-binomial
grades *subsets by sum*, the q-factorial grades *permutations by inversion count* — the same q-analog idea, one for
choosing and one for ordering, and the first is assembled from the second just as binomials are from factorials.

In enumeratio: `permutations(n)` grouped by the `inversions` statistic gives the `[n]_q!` coefficients (a passing
assertion). Setting `q=1` recovers `n!`. The pattern is general — every counting sequence has a q-analog obtained by
grading its collection with the right statistic: [`dyck_paths`](/explore/collection/dyck_paths) by *area* gives the **q-Catalan** numbers (also a
passing assertion), and so on. "Refine a count by a statistic, read a q-polynomial" is the recurring move.

## The link to subset sum

**Subset sum** asks: given weights `w₁,…,wₙ` and a target `t`, is there a subset summing to `t`? Its *counting*
version has an exact generating function — the number of subsets summing to `t` is the coefficient of `qᵗ` in

$$\prod_{i=1}^{n} (1 + q^{w_i}).$$

The **partition problem** (split the multiset into two equal halves) is the instance `t = S/2` where `S = Σwᵢ`. Both
are NP-complete.

Now specialize the weights to the *consecutive* integers `1,…,N` and ask only for k-element subsets: the generating
function becomes `\prod_{i=1}^{N}(1+q^i x)`, whose `x^k` part is exactly `q^{\binom{k+1}{2}} \binom{N}{k}_q` (the
q-binomial theorem). That is face (1) above. **So the Gaussian binomial is precisely subset sum for consecutive
weights** — and that is the whole point of the connection.

## Why this doesn't dent NP-completeness

Here is the crisp version of the boundary. The q-binomial coefficients are **positive and unimodal across their
entire range** `0 ≤ r ≤ k(N−k)` — a theorem of Sylvester. "Positive throughout" means **no gaps**: for consecutive
weights `{1,…,N}`, *every* sum between the minimum and maximum is achievable by some k-subset. So the subset-sum
decision problem on consecutive weights is a triviality — a range check — and its counting is a closed-form
q-binomial.

General subset sum is hard for exactly the reason this case is easy: arbitrary weights give an *unstructured* product
`∏(1+q^{wᵢ})` whose coefficients can be **zero** (unachievable targets) scattered anywhere. There is no box, no
unimodality, no range check. The q-binomial world is the structured, gap-free corner where the NP-complete problem
degenerates into arithmetic. Seen this way, the pseudo-polynomial DP for subset sum is *literally* the computation of
this generating function's coefficients — and the q-binomial is the case where that table has a formula.

*(A tempting stronger claim — reading a general multiset's `q^{S/2}` term off a single q-binomial — does not hold: a
single q-binomial is the consecutive-weight case only. The correct, general object is the product above; the
q-binomial is its structured specialization. That distinction is the result, not a footnote.)*

## The binary lens, and a bridge to the rationals

There's a clean isomorphism underneath all this: **a natural number, in binary, *is* a multiset of naturals** — read
the gaps between the 1-bits as successive differences. Sets with no repeats correspond to binary strings with **no
two adjacent 1s** — the **Zeckendorf** condition — which is exactly our [`sparse_subsets`](/explore/collection/sparse_subsets) (and why they're counted by
Fibonacci). The same binary-as-structure lens runs through the **Calkin–Wilf tree** (via hyperbinary
representations), which is precisely how [`rational_numbers`](/explore/collection/rational_numbers) enumerates ℚ⁺ here — so this circle of ideas connects the
subset/partition world straight to the rationals.

