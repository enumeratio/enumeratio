// The authoritative reference-page dataset. Every node here becomes docs/reference/<slug>.md via generate.mts,
// which computes all example numbers from the live pack kernels — so the prose here is the ONLY hand-maintained
// part, and it can never disagree with the kernels on a count or an element. Order within the array is the
// sidebar order within each family (see sidebar.ts). Add a head = add a record.
import type { NodeDoc } from "./render.js";

export const NODES: NodeDoc[] = [
  // ═══════════════ Permutations & permutation classes ═══════════════
  {
    head: "Permutations",
    catalogId: "permutations",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The collection of permutations of $\\{1, \\dots, n\\}$, in one-line notation.",
    usage: [
      { form: "\\operatorname{Permutations}(n)", meaning: "the collection of all $n!$ permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{Permutations}(n),\\ i)", meaning: "the permutation at 1-based position $i$ in lexicographic order" },
      { form: "\\operatorname{Rank}(\\operatorname{Permutations}(n),\\ p)", meaning: "$p$'s 1-based lexicographic position" },
    ],
    details: [
      { label: "Arity", body: "1 — a single natural number $n$." },
      { label: "Element", body: "a length-$n$ list, the images of $1, 2, \\dots, n$ read left to right (one-line notation): `[3, 1, 2]` means $1 \\mapsto 3,\\ 2 \\mapsto 1,\\ 3 \\mapsto 2$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "$n!$ ([Factorial](https://reference.wolfram.com/language/ref/Factorial.html))." },
      { label: "Order", body: "lexicographic on the one-line word, via Lehmer-code decode/encode (`PermutationUnrank`/`PermutationRank` in `packages/compute-engine/src/kernels.ts`) — the same rank/unrank pair the SQL catalog's `permutation_unrank_lex` uses." },
      { label: "Random access", body: "$O(n)$ — decoding a Lehmer code touches every position once; not $O(1)$ despite the closed-form count." },
      { label: "Catalog alias", body: "the pg-catalog collection `permutations` is this same family (`COLL_HEADS`, `packages/client/src/ce-enum-engine.ts`) — a notebook can spell either `Permutations(4)` or `permutations(4)`." },
    ],
    examples: {
      params: [4],
      blocks: [
        {
          md: "$\\operatorname{Permutations}(n)$ is all $n!$ orderings of $[n]$ (the symmetric group $S_n$). Enumerate them, then count — $4! = {count}$:",
          lines: [
            { latex: "\\operatorname{Permutations}(4)" },
            { latex: "\\left|\\operatorname{Permutations}(4)\\right|", expect: "{count}" },
          ],
        },
        {
          md: "Elements are indexed 1-based in lexicographic order — the first and last permutations of $[4]$:",
          lines: [
            { latex: "\\operatorname{Permutations}(4)[1]", expect: "{at(0)}" },
            { latex: "\\operatorname{Permutations}(4)[24]", expect: "{at(23)}" },
          ],
        },
        {
          md: "The lines of one example share a scope, so a parameter set once carries down — here $|S_n| = n!$ read straight off a bound $n$:",
          lines: [
            { latex: "n = 4" },
            { latex: "\\operatorname{Factorial}(n)", expect: "{count}" },
          ],
        },
      ],
    },
    seeAlso: [
      { head: "KPermutations" }, { head: "SignedPermutations" }, { head: "ColoredPermutations" },
      { head: "Derangements" }, { head: "Involutions" }, { head: "SymmetricGroup", note: "same set, cycle notation, Coxeter-length order" },
      { head: "rank" }, { head: "unrank" }, { head: "random_element" }, { head: "cardinality" },
    ],
  },
  {
    head: "SymmetricGroup",
    catalogId: "symmetric_group",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "Permutations of $\\{1, \\dots, n\\}$ READ AS A GROUP: disjoint cycle notation, ordered by Coxeter length — a sibling of [`Permutations`](/reference/Permutations) over the same $n!$ underlying set.",
    usage: [
      { form: "\\operatorname{SymmetricGroup}(n)", meaning: "the collection of all $n!$ permutations of $[n]$, in cycle notation" },
      { form: "\\operatorname{At}(\\operatorname{SymmetricGroup}(n),\\ i)", meaning: "the permutation at 1-based position $i$ in Coxeter-length order" },
      { form: "\\operatorname{Rank}(\\operatorname{SymmetricGroup}(n),\\ p)", meaning: "$p$'s 1-based Coxeter-length position" },
    ],
    details: [
      { label: "Arity", body: "1 — a single natural number $n$." },
      { label: "Element", body: "disjoint cycle notation, e.g. $(1\\ 2\\ 3)(4)$ for $n=4$: cycles in increasing order of their minimal element, each starting at that minimum; fixed points appear as singleton cycles, so the identity of $S_n$ is $n$ singletons." },
      { label: "Result type", body: "`collection` of cycle-notation permutations, same underlying set as `Permutations`." },
      { label: "Count", body: "$n!$ — same cardinality as `Permutations` (they share the underlying $n!$-element set)." },
      { label: "Order", body: "by COXETER LENGTH (the number of inversions of the one-line word), ascending — identity first ($0$), the reversal last ($\\binom{n}{2}$) — tiebreak lexicographic on the one-line word. This is NOT `Permutations`' plain-lex order: `SymmetricGroup` and `Permutations` are a *sibling pair* (a bijective but non-order-isomorphic `base_map`, `packages/data/packs/permutations-plus/cross-collection-maps.permutations-plus.sql`), not order-isomorphic twins like `Permutations`/`LehmerCodes`." },
      { label: "Random access", body: "a Mahonian-numbers DP: find the inversions block via cumulative counts, then decode the within-block offset as a fixed-digit-sum bounded Lehmer code (`symmetric_group_mahonian_table` / `symmetric_group_unrank_by_coxeter`, `packages/data/packs/permutations-plus/symmetric_group.sql`)." },
      { label: "Borrowed stat", body: "opts in to `Permutations`' `inversions` stat across the sibling bijection (`base_sibling_borrow`, #409) — by construction it equals the element's own Coxeter length, a self-consistency check exercised in `symmetric_group.sibling_borrow.sql`." },
    ],
    examples: {
      params: [4],
      blocks: [
        {
          md: "$\\operatorname{SymmetricGroup}(n)$ is the same $n!$-element $S_n$ as `Permutations`, read in Coxeter-length order — count agrees: $4! = {count}$:",
          lines: [
            { latex: "\\operatorname{SymmetricGroup}(4)" },
            { latex: "\\left|\\operatorname{SymmetricGroup}(4)\\right|", expect: "{count}" },
          ],
        },
        {
          md: "The identity (Coxeter length 0) is first; the full reversal (max length $\\binom{n}{2}$) is last:",
          lines: [
            { latex: "\\operatorname{SymmetricGroup}(4)[1]", expect: "{at(0)}" },
            { latex: "\\operatorname{SymmetricGroup}(4)[24]", expect: "{at(23)}" },
          ],
        },
      ],
    },
    seeAlso: [
      { head: "Permutations", note: "same underlying set, plain-lex order, one-line notation" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "KPermutations",
    catalogId: "arrangements",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The ordered arrangements of $k$ distinct symbols drawn from $\\{1, \\dots, n\\}$ — injections $[k] \\hookrightarrow [n]$.",
    usage: [
      { form: "\\operatorname{KPermutations}(n,\\ k)", meaning: "all $n!/(n-k)!$ length-$k$ arrangements of distinct values from $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{KPermutations}(n,\\ k),\\ i)", meaning: "the arrangement at 1-based position $i$ in lexicographic order" },
      { form: "\\operatorname{Rank}(\\operatorname{KPermutations}(n,\\ k),\\ a)", meaning: "$a$'s 1-based lexicographic position" },
    ],
    details: [
      { label: "Arity", body: "2 — the ground size $n$ and the arrangement length $k$." },
      { label: "Element", body: "a length-$k$ list of distinct values from $[n]$. At $k = n$ this is the same set as [`Permutations`](/reference/Permutations)." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $k$." },
      { label: "Count", body: "$n^{\\underline{k}} = n!/(n-k)!$, the falling factorial (`FallingFactorial`, via `KPermutationCount` in `packages/compute-engine/src/kernels-extra.ts`)." },
      { label: "Order", body: "lexicographic, decoded as a mixed-radix falling-factorial numeral — position $p$ takes the $\\lfloor r / (n-1-p)^{\\underline{k-1-p}} \\rfloor$-th still-available symbol, then recurses (`KPermutationUnrank`/`KPermutationRank`)." },
      { label: "Random access", body: "$O(nk)$ — each of the $k$ positions removes its symbol from an $n$-slot pool by an `indexOf`/`splice` scan." },
      { label: "Edge cases", body: "$k > n$ gives an empty collection (falling factorial $0$); $k = 0$ gives the single empty arrangement `[]`." },
    ],
    examples: {
      params: [4, 2],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{KPermutations}(4,\\ 2)) = {count}$",
        "The first six $2$-arrangements of $[4]$ in lex order are ${first(6)}$ — so $[2,3]$ sits at 1-based position $\\operatorname{Rank}(\\operatorname{KPermutations}(4,\\ 2),\\ [2,3]) = {rank([2,3])}$ (the generic 0-based `rank` reports `{rank0([2,3])}`).",
      ],
    },
    seeAlso: [
      { head: "Permutations", note: "the $k = n$ case" }, { head: "Tuples", note: "arrangements *with* repetition" },
      { head: "Surjections" }, { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "SignedPermutations",
    catalogId: "signed_permutations",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The hyperoctahedral group $B_n$ — permutations of $[n]$ with an independent $\\pm$ sign on each entry.",
    usage: [
      { form: "\\operatorname{SignedPermutations}(n)", meaning: "all $2^n\\,n!$ signed permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{SignedPermutations}(n),\\ i)", meaning: "the signed permutation at 1-based position $i$" },
      { form: "\\operatorname{Rank}(\\operatorname{SignedPermutations}(n),\\ s)", meaning: "$s$'s 1-based position" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a length-$n$ one-line word whose entries are $\\pm 1, \\dots, \\pm n$, one of each magnitude: `[-1, 2]` is $1 \\mapsto -1,\\ 2 \\mapsto 2$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$ (nonzero, signed)." },
      { label: "Count", body: "$2^n\\,n!$ (`SignedPermutationCount` in `packages/compute-engine/src/kernels-extra.ts`)." },
      { label: "Order", body: "mixed-radix with the underlying permutation as the low digit and the sign bitmask as the high digit — rank $r$ splits as $\\text{signMask} = \\lfloor r/n! \\rfloor$ (bit $i$ signs position $i$) over the lex permutation $\\operatorname{PermutationUnrank}(r \\bmod n!)$." },
      { label: "Random access", body: "$O(n)$ — one Lehmer decode plus an $n$-bit sign pass." },
    ],
    examples: {
      params: [2],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{SignedPermutations}(2)) = {count}$",
        "In rank order the 8 signed permutations of $[2]$ are ${first(8)}$ — the first $n! = 2$ are the sign-free permutations (mask $0$), then each higher block flips the signs its bitmask selects.",
        "$\\operatorname{Rank}(\\operatorname{SignedPermutations}(2),\\ [-1, 2]) = {rank([-1,2])}$ (0-based `{rank0([-1,2])}`): permutation $[1,2]$ at lex-rank $0$, sign bitmask $1$ (position 1 negated), so $1 \\cdot 2! + 0 = 2$.",
      ],
    },
    seeAlso: [
      { head: "Permutations", note: "the unsigned $A_{n-1}$ case" }, { head: "ColoredPermutations", note: "$B_n = \\mathbb{Z}_2 \\wr S_n$, the $k=2$ colored case" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "ColoredPermutations",
    catalogId: "k_colored_permutations",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The wreath product $\\mathbb{Z}_k \\wr S_n$ — a permutation of $[n]$ with an independent color in $\\{0, \\dots, k-1\\}$ on each position.",
    usage: [
      { form: "\\operatorname{ColoredPermutations}(n,\\ k)", meaning: "all $k^n\\,n!$ $k$-colored permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{ColoredPermutations}(n,\\ k),\\ i)", meaning: "the colored permutation at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "2 — the ground size $n$ and the number of colors $k$." },
      { label: "Element", body: "a pair `[image, colors]`: `image` a permutation of $[n]$ (one-line), `colors` a length-$n$ word over $\\{0, \\dots, k-1\\}$. E.g. `[[1, 2], [1, 0]]` colors position 1 with $1$ and position 2 with $0$." },
      { label: "Result type", body: "`collection` of `list<list<integer>>` (the two length-$n$ lists)." },
      { label: "Count", body: "$k^n\\,n!$ (`ColoredPermutationCount`). At $k=1$ this is [`Permutations`](/reference/Permutations); at $k=2$, [`SignedPermutations`](/reference/SignedPermutations)." },
      { label: "Order", body: "mixed-radix: $\\text{colorNum} = \\lfloor r/n! \\rfloor$ read big-endian base-$k$ into the color word, over the lex permutation $r \\bmod n!$ (`ColoredPermutationUnrank`/`Rank`)." },
      { label: "Random access", body: "$O(n)$ — a Lehmer decode plus an $n$-digit base-$k$ expansion." },
    ],
    examples: {
      params: [2, 2],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{ColoredPermutations}(2,\\ 2)) = {count}$",
        "The 8 elements in rank order are ${first(8)}$ — each `[perm, colors]` cycles the permutation fastest, then the base-$2$ color word.",
        "$\\operatorname{Rank}(\\operatorname{ColoredPermutations}(2,\\ 2),\\ [[1,2],[1,0]]) = {rank([[1,2],[1,0]])}$ (0-based `{rank0([[1,2],[1,0]])}`).",
      ],
    },
    seeAlso: [
      { head: "Permutations", note: "$k = 1$" }, { head: "SignedPermutations", note: "$k = 2$" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "CyclicPermutations",
    catalogId: "cyclic_permutations",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ that are a single $n$-cycle, in one-line notation.",
    usage: [
      { form: "\\operatorname{CyclicPermutations}(n)", meaning: "all $(n-1)!$ full $n$-cycles on $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{CyclicPermutations}(n),\\ i)", meaning: "the $n$-cycle at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) whose cycle structure is one cycle of length $n$. `[2, 3, 4, 1]` is the cycle $(1\\,2\\,3\\,4)$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "$(n-1)!$ — fixing $1$ as the cycle's start and arranging the other $n-1$ (`CyclicPermutationCount`)." },
      { label: "Order", body: "the cycle is written $(1,\\,p)$ where $p = \\operatorname{PermutationUnrank}(n-1, r)$ arranges $\\{2, \\dots, n\\}$; the one-line image is read off that cycle (`CyclicPermutationUnrank`/`Rank`)." },
      { label: "Random access", body: "$O(n)$ — one Lehmer decode plus a cycle-to-image pass." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{CyclicPermutations}(4)) = {count}$",
        "The 6 four-cycles in rank order (one-line) are ${first(6)}$ — the first, ${at(0)}$, is the cycle $(1\\,2\\,3\\,4)$.",
      ],
    },
    seeAlso: [
      { head: "Permutations" }, { head: "Involutions" }, { head: "Derangements" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "Involutions",
    catalogId: "involutions",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The self-inverse permutations of $[n]$ — those equal to their own inverse ($\\sigma = \\sigma^{-1}$).",
    usage: [
      { form: "\\operatorname{Involutions}(n)", meaning: "all involutions of $[n]$ (fixed points + disjoint transpositions)" },
      { form: "\\operatorname{At}(\\operatorname{Involutions}(n),\\ i)", meaning: "the involution at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) built only from fixed points and 2-cycles. `[2, 1, 3, 4]` swaps $1 \\leftrightarrow 2$ and fixes $3, 4$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the involution / telephone numbers $I(n)$ (OEIS [A000085](https://oeis.org/A000085): $1, 1, 2, 4, 10, 26, \\dots$), satisfying $I(n) = I(n-1) + (n-1)\\,I(n-2)$ (`InvolutionCount`)." },
      { label: "Order", body: "recursion on the last label $n$: either it is fixed (the first $I(n-1)$ ranks) or paired with label $j$ (`InvolutionUnrank`/`Rank`)." },
      { label: "Random access", body: "$O(n)$ with a memoized telephone-number table." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{Involutions}(4)) = {count}$",
        "The 10 involutions of $[4]$ in rank order are ${first(10)}$ — rank $0$ is the identity ${at(0)}$; ${at(1)}$ is the single transposition $(1\\,2)$.",
      ],
    },
    seeAlso: [
      { head: "Permutations" }, { head: "Derangements" }, { head: "PerfectMatchings", note: "fixed-point-free involutions" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "Derangements",
    catalogId: "derangements",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ with no fixed point — $\\sigma(i) \\neq i$ for every $i$.",
    usage: [
      { form: "\\operatorname{Derangements}(n)", meaning: "all fixed-point-free permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{Derangements}(n),\\ i)", meaning: "the derangement at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with $\\sigma(i) \\neq i$ everywhere. `[2, 1, 4, 3]` is a derangement of $[4]$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the subfactorial $!n$ (OEIS [A000166](https://oeis.org/A000166): $1, 0, 1, 2, 9, 44, \\dots$), $!n = (n-1)\\,(!(n-1) + !(n-2))$ (`DerangementCount`)." },
      { label: "Order", body: "recursion on the largest label $m$: it either sits in a 2-cycle or in a longer cycle, splitting each rank block by the derangement counts of the two cases (`DerangementUnrank`/`Rank`)." },
      { label: "Random access", body: "$O(n)$ with a memoized subfactorial table." },
      { label: "Edge cases", body: "$!0 = 1$ (the empty permutation), $!1 = 0$ (the one point must be fixed) — so `Derangements(1)` is empty." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{Derangements}(4)) = {count}$",
        "The 9 derangements of $[4]$ in rank order are ${first(9)}$ — every one moves all four points.",
      ],
    },
    seeAlso: [
      { head: "Permutations" }, { head: "Involutions" }, { head: "CyclicPermutations" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "AlternatingPermutations",
    catalogId: "alternating_permutations",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The up-down permutations of $[n]$: $a_1 < a_2 > a_3 < a_4 > \\cdots$.",
    usage: [
      { form: "\\operatorname{AlternatingPermutations}(n)", meaning: "all up-down (zigzag) permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{AlternatingPermutations}(n),\\ i)", meaning: "the alternating permutation at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with strict ascents and descents alternating from the first step up: `[1, 4, 2, 3]` has $1 < 4 > 2 < 3$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the Euler zigzag (secant-tangent) numbers (OEIS [A000111](https://oeis.org/A000111): $1, 1, 1, 2, 5, 16, 61, \\dots$), summed from the Entringer triangle (`AlternatingPermutationCount`)." },
      { label: "Order", body: "Entringer recursion on the first value $a_1 = k$: the tail is a down-up permutation of the rest, mapped via the complement $x \\mapsto n-x$ to an up-down permutation of $[n-1]$ (`AlternatingPermutationUnrank`/`Rank`)." },
      { label: "Random access", body: "$O(n^2)$ — each level rebuilds the Entringer row (prefix sums of the previous row)." },
      { label: "Convention", body: "the walk starts with an ascent (up-down); the reverse-first (down-up) class is its mirror image and not a separate head." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{AlternatingPermutations}(4)) = {count}$",
        "The 5 up-down permutations of $[4]$ in rank order are ${first(5)}$ — e.g. ${at(0)}$ reads $1 < 4 > 2 < 3$.",
      ],
    },
    seeAlso: [
      { head: "Permutations" }, { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "PermutationsAvoiding321",
    catalogId: "permutations_avoiding_321",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ with no decreasing subsequence of length 3 (pattern $321$).",
    usage: [
      { form: "\\operatorname{PermutationsAvoiding321}(n)", meaning: "all $321$-avoiding permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{PermutationsAvoiding321}(n),\\ i)", meaning: "the avoider at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with no indices $i<j<k$ where $\\sigma_i > \\sigma_j > \\sigma_k$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the Catalan number $C_n$ (OEIS [A000108](https://oeis.org/A000108)) — as for every single-pattern class of length 3." },
      { label: "Order", body: "lexicographic: built left to right, smallest legal value first, where a value is legal iff it exceeds the running maximum inversion-bottom (the walk that keeps every prefix $321$-avoiding), memoized per state (`packages/compute-engine/src/packs/permutations.ts`)." },
      { label: "Random access", body: "each of the $n$ positions sums a memoized state count; polynomial in $n$, not a closed convolution." },
      { label: "Naming", body: "the `PermutationsAvoiding<pat>` spelling, shared with every length-3 class." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{PermutationsAvoiding321}(4)) = {count}$ (the Catalan number $C_4$).",
        "The 14 avoiders of $[4]$ in this order are ${first(14)}$ — lex-first is the identity ${at(0)}$.",
      ],
    },
    seeAlso: [
      { head: "PermutationsAvoiding132" }, { head: "PermutationsAvoiding123" }, { head: "PermutationsAvoiding231" },
      { head: "Permutations" }, { head: "CatalanNumber" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "PermutationsAvoiding132",
    catalogId: "permutations_avoiding_132",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ avoiding the pattern $132$ (no $i<j<k$ with $\\sigma_i < \\sigma_k < \\sigma_j$).",
    usage: [
      { form: "\\operatorname{PermutationsAvoiding132}(n)", meaning: "all $132$-avoiding permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{PermutationsAvoiding132}(n),\\ i)", meaning: "the avoider at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with no indices $i<j<k$ where $\\sigma_i < \\sigma_k < \\sigma_j$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the Catalan number $C_n$ (OEIS [A000108](https://oeis.org/A000108))." },
      { label: "Order", body: "the Catalan convolution recursion on the position $m$ of the maximum value $n$ — every value left of $m$ exceeds every value right of $m$, and each side recursively avoids $132$ (`packages/compute-engine/src/packs/permutations.ts`). This is *not* lexicographic." },
      { label: "Random access", body: "$O(n^2)$ arithmetic — a Catalan table plus the recursive split/merge." },
      { label: "Naming", body: "the `PermutationsAvoiding<pat>` spelling, shared with every length-3 class." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{PermutationsAvoiding132}(4)) = {count}$ ($C_4$).",
        "In this order the 14 avoiders of $[4]$ are ${first(14)}$ — rank $0$ is ${at(0)}$ (the max-position recursion puts the reversed identity first, so the order differs from the lex order of [`PermutationsAvoiding321`](/reference/PermutationsAvoiding321)).",
      ],
    },
    seeAlso: [
      { head: "PermutationsAvoiding321" }, { head: "PermutationsAvoiding123" }, { head: "PermutationsAvoiding312" },
      { head: "Permutations" }, { head: "CatalanNumber" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "PermutationsAvoiding123",
    catalogId: "permutations_avoiding_123",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ with no increasing subsequence of length 3 (pattern $123$).",
    usage: [
      { form: "\\operatorname{PermutationsAvoiding123}(n)", meaning: "all $123$-avoiding permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{PermutationsAvoiding123}(n),\\ i)", meaning: "the avoider at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with no $i<j<k$ where $\\sigma_i < \\sigma_j < \\sigma_k$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the Catalan number $C_n$ (OEIS [A000108](https://oeis.org/A000108))." },
      { label: "Order", body: "lexicographic among the avoiders — built value-by-value smallest-first, counting the pattern-free completions of each prefix (`countAvoiding`, `packages/compute-engine/src/packs/permutations.ts`)." },
      { label: "Random access", body: "prefix-counting recomputed per descent — heavier than the closed Catalan convolution, but $n$ stays small in practice." },
      { label: "Naming", body: "the `PermutationsAvoiding<pat>` spelling, shared with every length-3 class." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{PermutationsAvoiding123}(4)) = {count}$ ($C_4$).",
        "The 14 avoiders of $[4]$ in lex order are ${first(14)}$ — lex-first is ${at(0)}$ (the identity itself contains $123$, so it is absent).",
      ],
    },
    seeAlso: [
      { head: "PermutationsAvoiding213" }, { head: "PermutationsAvoiding231" }, { head: "PermutationsAvoiding312" },
      { head: "PermutationsAvoiding321" }, { head: "CatalanNumber" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "PermutationsAvoiding213",
    catalogId: "permutations_avoiding_213",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ avoiding the pattern $213$ (no $i<j<k$ with $\\sigma_j < \\sigma_i < \\sigma_k$).",
    usage: [
      { form: "\\operatorname{PermutationsAvoiding213}(n)", meaning: "all $213$-avoiding permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{PermutationsAvoiding213}(n),\\ i)", meaning: "the avoider at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with no $i<j<k$ where $\\sigma_j < \\sigma_i < \\sigma_k$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the Catalan number $C_n$ (OEIS [A000108](https://oeis.org/A000108))." },
      { label: "Order", body: "lexicographic among the avoiders, via the same prefix-counting engine as [`PermutationsAvoiding123`](/reference/PermutationsAvoiding123) with the $213$ predicate (`packages/compute-engine/src/packs/permutations.ts`)." },
      { label: "Random access", body: "prefix-counting recomputed per descent; $n$ stays small in practice." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{PermutationsAvoiding213}(4)) = {count}$ ($C_4$).",
        "The 14 avoiders of $[4]$ in lex order are ${first(14)}$ — lex-first is the identity ${at(0)}$ (it avoids $213$).",
      ],
    },
    seeAlso: [
      { head: "PermutationsAvoiding123" }, { head: "PermutationsAvoiding231" }, { head: "PermutationsAvoiding312" },
      { head: "CatalanNumber" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "PermutationsAvoiding231",
    catalogId: "permutations_avoiding_231",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ avoiding the pattern $231$ — equivalently the stack-sortable permutations.",
    usage: [
      { form: "\\operatorname{PermutationsAvoiding231}(n)", meaning: "all $231$-avoiding (stack-sortable) permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{PermutationsAvoiding231}(n),\\ i)", meaning: "the avoider at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with no $i<j<k$ where $\\sigma_k < \\sigma_i < \\sigma_j$ — the classical stack-sortable class." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the Catalan number $C_n$ (OEIS [A000108](https://oeis.org/A000108))." },
      { label: "Order", body: "the Catalan convolution on the position of the maximum $n$: the left block is exactly $\\{1, \\dots, k_0\\}$, the right block $\\{k_0+1, \\dots, n-1\\}$, each recursively $231$-avoiding (`packages/compute-engine/src/packs/permutations.ts`). Not lexicographic." },
      { label: "Random access", body: "$O(n^2)$ arithmetic — Catalan table plus the recursive split." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{PermutationsAvoiding231}(4)) = {count}$ ($C_4$).",
        "In this order the 14 avoiders of $[4]$ are ${first(14)}$ — rank $0$ is ${at(0)}$.",
      ],
    },
    seeAlso: [
      { head: "PermutationsAvoiding312", note: "the mirror class, split on the minimum" }, { head: "PermutationsAvoiding123" },
      { head: "PermutationsAvoiding213" }, { head: "CatalanNumber" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "PermutationsAvoiding312",
    catalogId: "permutations_avoiding_312",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ avoiding the pattern $312$ (no $i<j<k$ with $\\sigma_j < \\sigma_k < \\sigma_i$).",
    usage: [
      { form: "\\operatorname{PermutationsAvoiding312}(n)", meaning: "all $312$-avoiding permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{PermutationsAvoiding312}(n),\\ i)", meaning: "the avoider at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with no $i<j<k$ where $\\sigma_j < \\sigma_k < \\sigma_i$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the Catalan number $C_n$ (OEIS [A000108](https://oeis.org/A000108))." },
      { label: "Order", body: "the mirror of [`PermutationsAvoiding231`](/reference/PermutationsAvoiding231): the same Catalan convolution split on the position of the minimum $1$, left block $\\{2, \\dots, m_0+1\\}$ and right block $\\{m_0+2, \\dots, n\\}$ (`packages/compute-engine/src/packs/permutations.ts`)." },
      { label: "Random access", body: "$O(n^2)$ arithmetic." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{PermutationsAvoiding312}(4)) = {count}$ ($C_4$).",
        "In this order the 14 avoiders of $[4]$ are ${first(14)}$ — rank $0$ is the identity ${at(0)}$.",
      ],
    },
    seeAlso: [
      { head: "PermutationsAvoiding231", note: "the mirror class, split on the maximum" }, { head: "PermutationsAvoiding123" },
      { head: "PermutationsAvoiding213" }, { head: "CatalanNumber" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "StirlingPermutations",
    catalogId: "stirling_permutations",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of the multiset $\\{1,1,2,2,\\dots,n,n\\}$ in which everything between the two copies of $i$ exceeds $i$.",
    usage: [
      { form: "\\operatorname{StirlingPermutations}(n)", meaning: "all $(2n-1)!!$ Stirling permutations of order $n$" },
      { form: "\\operatorname{At}(\\operatorname{StirlingPermutations}(n),\\ i)", meaning: "the Stirling permutation at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the order $n$ (the word has length $2n$)." },
      { label: "Element", body: "a length-$2n$ word over $\\{1, \\dots, n\\}$, each value twice, with every entry strictly between the two copies of $i$ being $> i$. `[1, 2, 2, 1]` qualifies; `[1, 2, 1, 2]` does not." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $2n$." },
      { label: "Count", body: "the double factorial $(2n-1)!! = 1 \\cdot 3 \\cdot 5 \\cdots (2n-1)$ (OEIS [A001147](https://oeis.org/A001147): $1, 1, 3, 15, 105, \\dots$; `stirlingCount`)." },
      { label: "Order", body: "the two copies of the maximum $n$ are forced adjacent, so every order-$n$ word is a unique order-$(n-1)$ word with the block `n n` spliced into one of its $2n-1$ gaps — a mixed-radix $r = \\text{innerRank}\\,(2n-1) + \\text{gapIndex}$ (`stirlingUnrankInner`/`stirlingRankInner`)." },
      { label: "Random access", body: "$O(n)$ — one splice per level of the recursion." },
    ],
    examples: {
      params: [3],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{StirlingPermutations}(3)) = {count}$ ($5!! = 1 \\cdot 3 \\cdot 5$).",
        "The 3 order-2 words are ${first(3; 2)}$. Rank $0$ at order 3 is ${at(0)}$.",
      ],
    },
    seeAlso: [
      { head: "Permutations" }, { head: "Groupings" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  // ═══════════════ Counting sequences ═══════════════
  {
    head: "BellNumber",
    family: "Counting sequences",
    kind: "sequence",
    tagline: "The number of ways to partition an $n$-element set into non-empty, unordered blocks.",
    usage: [
      { form: "\\operatorname{BellNumber}(n)", meaning: "the $n$-th Bell number, $B_n$" },
      { form: "\\operatorname{BellNumber}(\\{n_1, n_2, \\dots\\})", meaning: "threads element-wise over a list (Listable)" },
    ],
    details: [
      { label: "Arity", body: "1 — a natural number $n$." },
      { label: "Result type", body: "`(integer) -> integer`, Listable — applied to a list, threads element-wise." },
      { label: "Implementation", body: "the Bell triangle (`packages/compute-engine/src/kernels-combinatorics.ts`) — each row built from the previous one in $O(n)$ additions, $O(n^2)$ total for $B_0, \\dots, B_n$; not a closed form." },
      { label: "Domain", body: "$n \\geq 0$; $B_0 = 1$ by convention (the empty set has exactly one partition: itself, with zero blocks)." },
      { label: "Counts", body: "the collection `SetPartitions(n)` — $\\operatorname{Count}(\\operatorname{SetPartitions}(n)) = B_n$ by construction (`packages/compute-engine/src/packs/core.ts`)." },
      { label: "Also known as", body: "Wolfram spells this `BellB`; both `BellB(n)` and the compute-engine-native `BellNumber(n)` resolve as aliases." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          md: "$B_n$ counts the ways to partition $\\{1, \\dots, n\\}$ into unordered blocks — enumerate `SetPartitions(3)`, and its count is $B_3$:",
          lines: [
            { latex: "\\operatorname{SetPartitions}(3)" },
            { latex: "\\left|\\operatorname{SetPartitions}(3)\\right|", expect: "5" },
          ],
        },
        {
          md: "$B_6 = 203$:",
          lines: [{ latex: "\\operatorname{BellNumber}(6)", expect: "203" }],
        },
      ],
    },
    seeAlso: [
      { head: "SetPartitions" }, { head: "FubiniNumber", note: "the ordered version" }, { head: "PartitionNumber", note: "integer, not set, partitions" },
      { head: "CatalanNumber" },
    ],
  },
  {
    head: "CatalanNumber",
    family: "Counting sequences",
    kind: "sequence",
    tagline: "The $n$-th Catalan number, $C_n = \\dfrac{1}{n+1}\\dbinom{2n}{n}$ — the size of dozens of combinatorial families, Dyck paths among them.",
    usage: [
      { form: "\\operatorname{CatalanNumber}(n)", meaning: "$C_n$" },
      { form: "\\operatorname{CatalanNumber}(\\{n_1, n_2, \\dots\\})", meaning: "threads element-wise over a list (Listable)" },
    ],
    details: [
      { label: "Arity", body: "1 — a natural number $n$." },
      { label: "Result type", body: "`(integer) -> integer`, Listable." },
      { label: "Implementation", body: "the closed form $\\lfloor \\binom{2n}{n}/(n+1) \\rceil$ via this library's own `Binomial` kernel, rounded to absorb floating-point error at larger $n$ (`packages/compute-engine/src/kernels-extra.ts`) — $O(n)$ per call, not memoized across calls." },
      { label: "Domain", body: "$n \\geq 0$ returns the sequence; a negative $n$ returns $0$." },
      { label: "Counts", body: "[`DyckPaths`](/reference/DyckPaths)`(n)`. Also the underlying count for several other lattice-path/tree families in this library (`Triangulations`, `NonCrossingMatchings`), each with its own bijection to a Dyck path." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          md: "$C_n$ is native to the notebook's compute engine — the first few values:",
          lines: [
            { latex: "\\operatorname{CatalanNumber}(0)", expect: "1" },
            { latex: "\\operatorname{CatalanNumber}(4)", expect: "14" },
          ],
        },
        {
          md: "It agrees with the [`DyckPaths`](/reference/DyckPaths) collection by construction:",
          lines: [{ latex: "\\left|\\operatorname{DyckPaths}(4)\\right|", expect: "14" }],
        },
      ],
    },
    seeAlso: [
      { head: "DyckPaths" }, { head: "BellNumber" }, { head: "FubiniNumber" }, { head: "PartitionNumber" },
    ],
  },
  {
    head: "FubiniNumber",
    family: "Counting sequences",
    kind: "sequence",
    tagline: "The number of ways to partition an $n$-element set into non-empty blocks AND put those blocks in order — the ordered Bell numbers.",
    usage: [
      { form: "\\operatorname{FubiniNumber}(n)", meaning: "the $n$-th Fubini (ordered Bell) number" },
      { form: "\\operatorname{FubiniNumber}(\\{n_1, n_2, \\dots\\})", meaning: "threads element-wise over a list (Listable)" },
    ],
    details: [
      { label: "Arity", body: "1 — a natural number $n$." },
      { label: "Result type", body: "`(integer) -> integer`, Listable." },
      { label: "Implementation", body: "the recurrence $\\operatorname{FubiniNumber}(n) = \\sum_{k=1}^{n} \\binom{n}{k}\\operatorname{FubiniNumber}(n-k)$, $\\operatorname{FubiniNumber}(0) = 1$, built bottom-up in one array (`packages/compute-engine/src/kernels-combinatorics.ts`) — $O(n^2)$ total for the whole table up to $n$." },
      { label: "Domain", body: "$n \\geq 0$." },
      { label: "Counts", body: "the collection `SetCompositions(n)` — ordered set partitions of $[n]$ (`packages/compute-engine/src/packs/core.ts`: `SetCompositions`'s count is literally the Fubini number)." },
      { label: "Relation to BellNumber", body: "$\\operatorname{FubiniNumber}(n) \\geq B_n$ for $n \\geq 1$ — every set partition contributes $k!$ ordered compositions, where $k$ is its number of blocks." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          md: "$\\operatorname{FubiniNumber}$ is native to the notebook's compute engine — the first few values, and the count of `SetCompositions` it agrees with:",
          lines: [
            { latex: "\\operatorname{FubiniNumber}(0)", expect: "1" },
            { latex: "\\operatorname{FubiniNumber}(2)", expect: "3" },
            { latex: "\\operatorname{FubiniNumber}(4)", expect: "75" },
            { latex: "\\left|\\operatorname{SetCompositions}(4)\\right|", expect: "75" },
          ],
        },
      ],
    },
    seeAlso: [
      { head: "SetCompositions" }, { head: "BellNumber", note: "the unordered count" }, { head: "CatalanNumber" },
    ],
  },
  {
    head: "PartitionNumber",
    family: "Counting sequences",
    kind: "sequence",
    tagline: "$p(n)$ — the number of integer partitions of $n$ (OEIS [A000041](https://oeis.org/A000041)).",
    usage: [
      { form: "\\operatorname{PartitionNumber}(n)", meaning: "$p(n)$" },
      { form: "\\operatorname{PartitionNumber}(\\{n_1, n_2, \\dots\\})", meaning: "threads element-wise over a list (Listable)" },
    ],
    details: [
      { label: "Arity", body: "1 — a natural number $n$." },
      { label: "Result type", body: "`(integer) -> integer`, Listable." },
      { label: "Implementation", body: "Euler's pentagonal-number recurrence, $p(n) = \\sum_{k\\geq1} (-1)^{k-1}\\left(p\\!\\left(n - \\tfrac{k(3k-1)}{2}\\right) + p\\!\\left(n - \\tfrac{k(3k+1)}{2}\\right)\\right)$, built bottom-up in one array (`packages/compute-engine/src/kernels-extra.ts`) — sub-quadratic (the pentagonal gaps grow, so each row's inner loop terminates well before $n$ terms)." },
      { label: "Domain", body: "$n \\geq 0$; a negative $n$ returns $0$." },
      { label: "Counts", body: "the collection [`IntegerPartitions`](/reference/IntegerPartitions) — $\\operatorname{Count}(\\operatorname{IntegerPartitions}(n)) = p(n)$ by construction." },
      { label: "Distinct from PartitionsQ", body: "`PartitionsQ(n)` counts partitions into *distinct* parts only — a different, smaller sequence with its own collection, `DistinctPartitions`." },
      { label: "Also known as", body: "Wolfram spells this `PartitionsP`; both `PartitionsP(n)` and the compute-engine-native `NPartition(n)` resolve as aliases." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          md: "$p(5) = 7$:",
          lines: [{ latex: "\\operatorname{PartitionNumber}(5)", expect: "7" }],
        },
        {
          md: "It matches counting [`IntegerPartitions`](/reference/IntegerPartitions) directly:",
          lines: [{ latex: "\\left|\\operatorname{IntegerPartitions}(5)\\right|", expect: "7" }],
        },
      ],
    },
    seeAlso: [
      { head: "IntegerPartitions" }, { head: "PartitionsQ" }, { head: "DistinctPartitions" }, { head: "BellNumber", note: "set, not integer, partitions" },
    ],
  },
  // ═══════════════ Subsets, multisets, tuples & functions ═══════════════
  {
    head: "Subsets",
    catalogId: "subsets",
    family: "Subsets, multisets, tuples & functions",
    kind: "collection",
    tagline: "The power set of $\\{1, \\dots, n\\}$ — every subset, of every size, including $\\varnothing$ and the full set.",
    usage: [
      { form: "\\operatorname{Subsets}(n)", meaning: "all $2^n$ subsets of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{Subsets}(n),\\ i)", meaning: "the subset at 1-based position $i$" },
      { form: "\\operatorname{Rank}(\\operatorname{Subsets}(n),\\ S)", meaning: "$S$'s 1-based position" },
    ],
    details: [
      { label: "Arity", body: "1. For subsets of a fixed size $k$, see `KSubsets(n, k)`." },
      { label: "Element", body: "a strictly increasing list of members, e.g. `[1, 3, 4]` $\\subseteq [5]$. The empty set is `[]`." },
      { label: "Result type", body: "`collection` of `list<integer>` (any length $0$ to $n$)." },
      { label: "Count", body: "$2^n$." },
      { label: "Order", body: "binary membership mask — element $i$ (1-indexed) is present iff bit $i-1$ of the 0-based rank is set (`SubsetUnrank`/`SubsetRank` in `packages/compute-engine/src/packs/subsets.ts`). Rank 0 is $\\varnothing$; the top rank $2^n-1$ is the full set $[n]$." },
      { label: "Random access", body: "$O(n)$ — unrank/rank both scan the $n$ bit positions once." },
      { label: "Catalog alias", body: "the pg-catalog collection `subsets` is this same family (`COLL_HEADS`, `packages/client/src/ce-enum-engine.ts`)." },
      { label: "Related order", body: "a companion order, `GrayCodeSubsets(n)`, visits the same $2^n$ subsets with each consecutive pair differing by exactly one element (a reflected binary Gray code) rather than by bitmask value." },
    ],
    examples: {
      params: [3],
      blocks: [
        {
          md: "$\\operatorname{Subsets}(n)$ is the power set of $[n]$ — all $2^3 = {count}$ subsets of $[3]$:",
          lines: [
            { latex: "\\operatorname{Subsets}(3)" },
            { latex: "\\left|\\operatorname{Subsets}(3)\\right|", expect: "{count}" },
          ],
        },
        {
          md: "Reading a 0-based rank in binary (LSB = element 1) gives the membership mask directly — rank 0 is $\\varnothing$, the top rank is the full set:",
          lines: [
            { latex: "\\operatorname{Subsets}(3)[1]", expect: "{at(0)}" },
            { latex: "\\operatorname{Subsets}(3)[8]", expect: "{at(7)}" },
          ],
        },
        {
          md: "$\\{2, 4\\} \\subseteq [4]$ has mask $2^1 + 2^3 = 10_{10} = 1010_2$, a 0-based rank of $10$ — 1-based rank ${rank([2,4]; 4)}$, so indexing back at that position recovers it:",
          lines: [{ latex: "\\operatorname{Subsets}(4)[11]", expect: "{at(10; 4)}" }],
        },
      ],
    },
    seeAlso: [
      { head: "KSubsets" }, { head: "GrayCodeSubsets" }, { head: "EvenSubsets" }, { head: "OddSubsets" },
      { head: "unrank" }, { head: "rank" }, { head: "cardinality" },
    ],
  },
  // ═══════════════ Lattice paths & Catalan objects ═══════════════
  {
    head: "DyckPaths",
    catalogId: "dyck_paths",
    family: "Lattice paths & Catalan objects",
    kind: "collection",
    tagline: "Lattice paths of $2n$ unit steps (up $=1$, down $=0$) from $(0,0)$ to $(2n,0)$ that never dip below the axis.",
    usage: [
      { form: "\\operatorname{DyckPaths}(n)", meaning: "all Dyck paths of semilength $n$ ($n$ up-steps, $n$ down-steps)" },
      { form: "\\operatorname{At}(\\operatorname{DyckPaths}(n),\\ i)", meaning: "the path at 1-based position $i$" },
      { form: "\\operatorname{Rank}(\\operatorname{DyckPaths}(n),\\ w)", meaning: "$w$'s 1-based position" },
    ],
    details: [
      { label: "Arity", body: "1 — the semilength $n$ (path length is $2n$)." },
      { label: "Element", body: "a list of $2n$ entries, each $1$ (up-step) or $0$ (down-step), with every prefix sum $\\geq 0$ and the full sum $= 0$." },
      { label: "Result type", body: "`collection` of `list<integer>` of length $2n$, entries in $\\{0, 1\\}$." },
      { label: "Count", body: "$\\operatorname{CatalanNumber}(n) = \\binom{2n}{n}/(n+1)$." },
      { label: "Order", body: "\"up-before-down\" — at each step, the unrank prefers an up-step whenever the number of paths completable that way covers the target rank, else takes a down-step and subtracts that count (`DyckPathUnrank`/`DyckPathRank` in `packages/compute-engine/src/kernels-extra.ts`, via a memoized `dyckCompletions(remainingSteps, height)` table)." },
      { label: "Random access", body: "$O(n)$ amortized — one `dyckCompletions` lookup per of the $2n$ steps." },
      { label: "Catalog alias", body: "the pg-catalog collection `dyck_paths` is this same family (`COLL_HEADS`, `packages/client/src/ce-enum-engine.ts`)." },
      { label: "Related families", body: "`MotzkinPaths` (up/level/down steps), `SchroderPaths` (large Schröder numbers), `GrandDyckPaths`/`GrandMotzkinPaths` (paths allowed below the axis)." },
    ],
    examples: {
      params: [3],
      blocks: [
        {
          md: "$\\operatorname{Count}(\\operatorname{DyckPaths}(3)) = \\operatorname{CatalanNumber}(3) = \\binom{6}{3}/4 = {count}$:",
          lines: [
            { latex: "\\operatorname{DyckPaths}(3)" },
            { latex: "\\left|\\operatorname{DyckPaths}(3)\\right|", expect: "{count}" },
          ],
        },
        {
          md: "\"Up-before-down\" order always tries $1$ first, so the very first path stays as high as possible for as long as possible — all ups then all downs:",
          lines: [{ latex: "\\operatorname{DyckPaths}(3)[1]", expect: "{at(0)}" }],
        },
      ],
    },
    seeAlso: [
      { head: "MotzkinPaths" }, { head: "SchroderPaths" }, { head: "GrandDyckPaths" }, { head: "CatalanNumber" },
      { head: "unrank" }, { head: "rank" }, { head: "cardinality" },
    ],
  },
  // ═══════════════ Partitions & set partitions ═══════════════
  {
    head: "IntegerPartitions",
    catalogId: "integer_partitions",
    family: "Partitions & set partitions",
    kind: "collection",
    tagline: "The collection of integer partitions of $n$ — ways to write $n$ as a sum of positive integers, order disregarded.",
    usage: [
      { form: "\\operatorname{IntegerPartitions}(n)", meaning: "all partitions of $n$ into positive parts" },
      { form: "\\operatorname{At}(\\operatorname{IntegerPartitions}(n),\\ i)", meaning: "the partition at 1-based position $i$" },
      { form: "\\operatorname{Rank}(\\operatorname{IntegerPartitions}(n),\\ p)", meaning: "$p$'s 1-based position" },
    ],
    details: [
      { label: "Arity", body: "1 — the number $n$ being partitioned. (A separate two-argument family, `PartitionsIntoKParts(n, k)`, fixes the number of parts.)" },
      { label: "Element", body: "a list of positive integers summing to $n$, always in **weakly decreasing** (largest-part-first) normal form: `[3, 2, 2, 1]` is $3+2+2+1=8$." },
      { label: "Result type", body: "`collection` of `list<integer>`, weakly decreasing, summing to $n$." },
      { label: "Count", body: "$p(n)$ — [`PartitionNumber`](/reference/PartitionNumber), computed by Euler's pentagonal-number recurrence." },
      { label: "Order", body: "greedy descending — the unrank walks remaining sum $m$ and a shrinking part-size ceiling, always choosing the largest part consistent with the target rank (`IntegerPartitionUnrank` in `packages/compute-engine/src/kernels-combinatorics.ts`). This is a well-defined total order but not lexicographic on the part sequence in the usual sense — don't assume adjacent ranks differ by a small edit." },
      { label: "Random access", body: "polynomial, not $O(1)$ — unrank/rank both walk the partition's own parts (at most $n$ of them), consulting a memoized partial-count table (`partsAtMost`) at each step." },
      { label: "Catalog alias", body: "the pg-catalog collection `integer_partitions` is this same family (`COLL_HEADS`, `packages/client/src/ce-enum-engine.ts`)." },
    ],
    examples: {
      params: [5],
      blocks: [
        {
          md: "$\\operatorname{Count}(\\operatorname{IntegerPartitions}(5)) = \\operatorname{PartitionNumber}(5) = {count}$ — the 7 partitions of 5 are $5,\\ 4{+}1,\\ 3{+}2,\\ 3{+}1{+}1,\\ 2{+}2{+}1,\\ 2{+}1{+}1{+}1,\\ 1{+}1{+}1{+}1{+}1$:",
          lines: [
            { latex: "\\operatorname{IntegerPartitions}(5)" },
            { latex: "\\left|\\operatorname{IntegerPartitions}(5)\\right|", expect: "{count}" },
          ],
        },
        {
          md: "The unrank always prefers the largest available part first, so rank 1 is always the single part $n$ itself:",
          lines: [{ latex: "\\operatorname{IntegerPartitions}(5)[1]", expect: "{at(0)}" }],
        },
      ],
    },
    seeAlso: [
      { head: "PartitionsIntoKParts" }, { head: "DistinctPartitions" }, { head: "PartitionsMaxPart" },
      { head: "PartitionNumber" }, { head: "unrank" }, { head: "rank" }, { head: "cardinality" },
    ],
  },
  // ═══════════════ Notebook primitives ═══════════════
  {
    head: "rank",
    family: "Notebook primitives",
    kind: "primitive",
    tagline: "The index of an already-located element within its collection — the inverse of `unrank`.",
    usage: [
      { form: "\\operatorname{Rank}(x)", meaning: "the 0-based index of $x$ within the collection it was located in" },
    ],
    details: [
      { label: "Kind", body: "a generic engine primitive, dispatched on the argument's type (the `NEXT_PREV_RANK` set in `packages/notatio/src/bind.ts`, shared with `next`/`prev`)." },
      { label: "Argument type", body: "`elem(C)` for some collection $C$ — $x$ must already be a *located* element (the result of `unrank`, `random_element`, `next`, or `prev`), not a bare value. Passing a plain scalar is a type error: `\"rank\" expects a collection element, not <kind>`." },
      { label: "Result type", body: "`natural_number`." },
      { label: "Indexing", body: "**0-based**, matching `unrank`'s own convention — `rank` and `unrank` are exact inverses at this layer. When the located element carries its rank already (came straight out of an `unrank` call), evaluation reads that rank back directly rather than recomputing it; otherwise it lowers to compute-engine's own `Rank(C, x) − 1` (`packages/client/src/compute-engine-enumerator.ts`) — CE's `Rank` is 1-based, so the primitive subtracts 1." },
      { label: "Non-membership", body: "if $x$ is not actually a member of the collection the type system believes it belongs to, the result is undefined (stays symbolic) rather than an error — `rankOf` in `packages/compute-engine/src/library.ts` returns `undefined` for a non-member." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          md: "`rank` and `unrank` round-trip: locate the element at 0-based rank $5$ of [`Subsets`](/reference/Subsets)$(4)$, then recover that rank:",
          lines: [
            { latex: "\\operatorname{Unrank}(\\operatorname{Subsets}(4),\\ 5)", expect: "[1, 3]" },
            { latex: "\\operatorname{Rank}(\\operatorname{Unrank}(\\operatorname{Subsets}(4),\\ 5))", expect: "5" },
          ],
        },
      ],
    },
    seeAlso: [
      { head: "unrank", note: "the inverse" }, { head: "random_element" }, { head: "cardinality" },
    ],
  },
  {
    head: "unrank",
    family: "Notebook primitives",
    kind: "primitive",
    tagline: "The element at a given index — $O(1)$ to $O(n)$ random access into any collection, no scan.",
    usage: [
      { form: "\\operatorname{Unrank}(C,\\ i)", meaning: "the element of collection handle $C$ at 0-based index $i$" },
    ],
    details: [
      { label: "Kind", body: "a generic engine primitive — one mechanism shared by every collection in the catalog, recognized by its literal name once registered as a parser function (`GENERIC_PRIMITIVES` in `packages/components/src/notebook-catalog.ts`), not by matching a per-collection stat or map." },
      { label: "Dispatch", body: "on the argument's type, not the head name alone — `unrank`/`random_element` are the `HANDLE_ELEM` set in `packages/notatio/src/bind.ts`, distinguishing them from ordinary catalog functions." },
      { label: "Result type", body: "`elem(C)` — a *located* element of $C$, not a bare list; typing it this way is what lets a later `next`/`prev`/`rank` chain onto the result without re-declaring it." },
      { label: "Indexing", body: "the primitive's own index $i$ is **0-based**. At evaluation it lowers to compute-engine's own `At(C, i+1)` (`packages/client/src/compute-engine-enumerator.ts`) — CE's collection index is 1-based, so the off-by-one is absorbed at the engine boundary." },
      { label: "Complexity", body: "$O(1)$ to $O(n)$ depending on the family — every collection in this library supplies fast random access (via its own unrank), never a scan-and-count." },
      { label: "Out of range", body: "an index outside $[0, \\operatorname{Count}(C))$ has no value rather than throwing." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          md: "$0$-based rank $0$ of [`Subsets`](/reference/Subsets)$(4)$ is $\\varnothing$; rank $5 = 101_2$ is $\\{1, 3\\}$ — see `Subsets` for the bitmask convention:",
          lines: [
            { latex: "\\operatorname{Unrank}(\\operatorname{Subsets}(4),\\ 0)", expect: "[]" },
            { latex: "\\operatorname{Unrank}(\\operatorname{Subsets}(4),\\ 5)", expect: "[1, 3]" },
          ],
        },
      ],
    },
    seeAlso: [
      { head: "rank", note: "the inverse" }, { head: "random_element", note: "a uniform random unrank" }, { head: "cardinality", note: "the bound its index ranges over" },
    ],
  },
  {
    head: "random_element",
    family: "Notebook primitives",
    kind: "primitive",
    tagline: "A uniformly random element of a collection — $O(1)$–$O(n)$ at any size, never enumerates.",
    usage: [
      { form: "\\operatorname{RandomElement}(C)", meaning: "one uniform draw from collection handle $C$" },
    ],
    details: [
      { label: "Kind", body: "a generic engine primitive, in the same `HANDLE_ELEM` dispatch set as `unrank` (`packages/notatio/src/bind.ts`) — typed `elem(C)`, so its result can chain into `next`/`prev`/`rank` just like an `unrank`ed element." },
      { label: "Result type", body: "`elem(C)`." },
      { label: "Implementation", body: "draws one uniform integer in $[0, \\operatorname{Count}(C))$ and calls the collection's own unrank — `RandomElement` in `packages/compute-engine/src/library.ts`. Because every collection's unrank is $O(1)$–$O(n)$, this stays cheap even for astronomically large collections." },
      { label: "Randomness source", body: "a single module-level, seedable PRNG (mulberry32) shared by `random_element`, `random_shuffle`, and `random_sample` (`packages/compute-engine/src/library.ts`) — reseeding is global, affecting every random primitive on the engine, not just the caller's own collection." },
      { label: "Empty collection", body: "`random_element` of a collection with `Count = 0` has no value rather than drawing from an empty range." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          md: "One uniform draw from [`Subsets`](/reference/Subsets)$(4)$'s $16$ subsets — re-evaluate the cell and it changes, so this line is shown unasserted rather than pinned to one value:",
          lines: [
            { latex: "\\left|\\operatorname{Subsets}(4)\\right|", expect: "16" },
            { latex: "\\operatorname{RandomElement}(\\operatorname{Subsets}(4))" },
          ],
        },
      ],
    },
    seeAlso: [
      { head: "unrank" }, { head: "rank" }, { head: "cardinality", note: "the range random_element draws over" },
    ],
  },
  {
    head: "cardinality",
    family: "Notebook primitives",
    kind: "primitive",
    tagline: "The size of a collection — $|C|$.",
    usage: [
      { form: "\\left|C\\right|", meaning: "the LaTeX spelling — parses to the `Count` MathJSON head" },
    ],
    details: [
      { label: "Kind", body: "one of the generic engine primitives bound directly by head name (`Count` → `cardinality` in `packages/notatio/src/names.ts`'s `OPERATORS` table) — unlike `unrank`/`rank`/`random_element`, it's recognized purely by its MathJSON head, no argument-type dispatch needed." },
      { label: "Result type", body: "`natural_number`, unconditionally." },
      { label: "Evaluation", body: "lowers to compute-engine's own `Length(C)` (`packages/client/src/compute-engine-enumerator.ts`), which reads the collection's own count handler directly — a closed-form lookup (e.g. $n!$, $2^n$, $p(n)$), never an enumeration. $O(1)$ regardless of $C$'s size." },
      { label: "Not (yet) wired to bare `Abs`", body: "compute-engine's own `Abs`/`|x|` head over a plain scalar is the ordinary absolute value; `|C|` reaches `cardinality` only when the operand types as a collection/fiber handle — see `bind.ts`'s special-case on `Abs`." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          md: "$\\lvert \\operatorname{Permutations}(5) \\rvert = 5! = 120$, and $\\lvert \\operatorname{Subsets}(10) \\rvert = 2^{10} = 1024$:",
          lines: [
            { latex: "\\left|\\operatorname{Permutations}(5)\\right|", expect: "120" },
            { latex: "\\left|\\operatorname{Subsets}(10)\\right|", expect: "1024" },
          ],
        },
      ],
    },
    seeAlso: [
      { head: "unrank", note: "the bound its index ranges over" }, { head: "rank" }, { head: "random_element" },
    ],
  },
  // ═══════════════ List operations ═══════════════
  {
    head: "join",
    family: "List operations",
    kind: "listop",
    tagline: "Concatenate lists into one.",
    usage: [
      { form: "\\operatorname{Join}(L_1,\\ L_2,\\ \\dots)", meaning: "the lists concatenated in argument order" },
    ],
    details: [
      { label: "Kind", body: "a generic list primitive (`GENERIC_PRIMITIVES` in `packages/components/src/notebook-catalog.ts`) — one of three (with `sort` and `unique`) that compute-engine already implements natively, so enumeratio binds to it rather than reimplementing it: at evaluation the identifier canonicalizes to compute-engine's own Pascal head, `Join` (`CE_LIST_OPS` in `packages/client/src/compute-engine-enumerator.ts`)." },
      { label: "Result type", body: "`integer[]` (typed by `LIST_RESULT_OPS` in `packages/notatio/src/bind.ts`; arguments are still individually typed for error-checking even though the result type doesn't depend on them)." },
      { label: "Semantics", body: "list concatenation — `Join([1,2], [3], [4,5])` is `[1,2,3,4,5]`. This is compute-engine's own operator; enumeratio does not alter or extend its behavior." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          lines: [{ latex: "\\operatorname{Join}([1, 2], [3, 4])", expect: "[1, 2, 3, 4]" }],
        },
      ],
    },
    seeAlso: [{ head: "sort" }, { head: "unique" }],
  },
  {
    head: "sort",
    family: "List operations",
    kind: "listop",
    tagline: "Sort a list into ascending order.",
    usage: [
      { form: "\\operatorname{Sort}(L)", meaning: "$L$'s elements in ascending order" },
    ],
    details: [
      { label: "Kind", body: "a generic list primitive canonicalized at evaluation to compute-engine's own `Sort` head — see `join` for the shared \"bind, don't reimplement\" mechanism (`LIST_RESULT_OPS` in `packages/notatio/src/bind.ts`; `CE_LIST_OPS` in `packages/client/src/compute-engine-enumerator.ts`)." },
      { label: "Result type", body: "`integer[]`." },
      { label: "Semantics", body: "compute-engine's own `Sort` — ascending numeric order. Enumeratio does not alter or extend its behavior (no custom comparator support beyond what CE itself exposes)." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          lines: [{ latex: "\\operatorname{Sort}([3, 1, 4, 1, 5])", expect: "[1, 1, 3, 4, 5]" }],
        },
      ],
    },
    seeAlso: [{ head: "join" }, { head: "unique" }],
  },
  {
    head: "unique",
    family: "List operations",
    kind: "listop",
    tagline: "Remove duplicate elements from a list, preserving first-occurrence order.",
    usage: [
      { form: "\\operatorname{Unique}(L)", meaning: "$L$ with duplicates removed" },
    ],
    details: [
      { label: "Kind", body: "a generic list primitive canonicalized at evaluation to compute-engine's own `Unique` head — see `join` for the shared \"bind, don't reimplement\" mechanism." },
      { label: "Result type", body: "`integer[]`." },
      { label: "Semantics", body: "order-preserving deduplication — the first occurrence of each distinct value is kept, in its original position; later duplicates are dropped (`packages/client/src/compute-engine-enumerator.ts`'s comment on `CE_LIST_OPS` states this explicitly). This is compute-engine's own operator; enumeratio does not alter it." },
    ],
    examples: {
      params: [],
      blocks: [
        {
          lines: [{ latex: "\\operatorname{Unique}([1, 3, 1, 2, 3, 3])", expect: "[1, 3, 2]" }],
        },
      ],
    },
    seeAlso: [{ head: "join" }, { head: "sort" }],
  },
];
