// The authoritative reference-page dataset. Every node here becomes docs/reference/<slug>.md via generate.mts,
// which computes all example numbers from the live pack kernels — so the prose here is the ONLY hand-maintained
// part, and it can never disagree with the kernels on a count or an element. Order within the array is the
// sidebar order within each family (see sidebar.ts). Add a head = add a record.
import type { NodeDoc } from "./render.js";

export const NODES: NodeDoc[] = [
  // ═══════════════ Permutations & permutation classes ═══════════════
  {
    head: "SymmetricGroup",
    slug: "symmetric-group",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The collection of permutations of $\\{1, \\dots, n\\}$, in one-line notation.",
    usage: [
      { form: "\\operatorname{SymmetricGroup}(n)", meaning: "the collection of all $n!$ permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{SymmetricGroup}(n),\\ i)", meaning: "the permutation at 1-based position $i$ in lexicographic order" },
      { form: "\\operatorname{Rank}(\\operatorname{SymmetricGroup}(n),\\ p)", meaning: "$p$'s 1-based lexicographic position" },
    ],
    details: [
      { label: "Arity", body: "1 — a single natural number $n$." },
      { label: "Element", body: "a length-$n$ list, the images of $1, 2, \\dots, n$ read left to right (one-line notation): `[3, 1, 2]` means $1 \\mapsto 3,\\ 2 \\mapsto 1,\\ 3 \\mapsto 2$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "$n!$ ([Factorial](https://reference.wolfram.com/language/ref/Factorial.html))." },
      { label: "Order", body: "lexicographic on the one-line word, via Lehmer-code decode/encode (`PermutationUnrank`/`PermutationRank` in `packages/compute-engine/src/kernels.ts`) — the same rank/unrank pair the SQL catalog's `permutation_unrank_lex` uses." },
      { label: "Random access", body: "$O(n)$ — decoding a Lehmer code touches every position once; not $O(1)$ despite the closed-form count." },
      { label: "Catalog alias", body: "the pg-catalog collection `permutations` is this same family (`COLL_HEADS`, `packages/client/src/ce-enum-engine.ts`) — a notebook can spell either `SymmetricGroup(4)` or `permutations(4)`." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{SymmetricGroup}(4)) = {count}$",
        "The lexicographically-first permutation of $[4]$ (1-based position 1) is ${at(0)}$; the last (position 24) is ${at(23)}$.",
        "The 6 words of $[3]$ in lex order are ${first(6; 3)}$, so $[2,3,1]$ sits at the 4th position: $\\operatorname{Rank}(\\operatorname{SymmetricGroup}(3),\\ [2,3,1]) = {rank([2,3,1]; 3)}$ — `Rank` is 1-based; the generic [`rank`](/reference/rank) reports the same position 0-based (`{rank0([2,3,1]; 3)}`).",
      ],
      // NOTE: live-notebook seeds are held until the notebook parser speaks the library vocabulary
      // (SymmetricGroup/Count/At + fixed rank/unrank lowering). render.ts emits the block when `notebook` is set.
    },
    seeAlso: [
      { head: "KPermutations" }, { head: "SignedPermutations" }, { head: "ColoredPermutations" },
      { head: "Derangements" }, { head: "Involutions" }, { head: "rank" }, { head: "unrank" },
      { head: "random_element" }, { head: "cardinality" },
    ],
  },
  {
    head: "KPermutations",
    slug: "k-permutations",
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
      { label: "Element", body: "a length-$k$ list of distinct values from $[n]$. At $k = n$ this is the same set as [`SymmetricGroup`](/reference/symmetric-group)." },
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
        "The first six $2$-arrangements of $[4]$ in lex order are ${first(6)}$ — so $[2,3]$ sits at 1-based position $\\operatorname{Rank}(\\operatorname{KPermutations}(4,\\ 2),\\ [2,3]) = {rank([2,3])}$ (the generic 0-based [`rank`](/reference/rank) reports `{rank0([2,3])}`).",
      ],
    },
    seeAlso: [
      { head: "SymmetricGroup", note: "the $k = n$ case" }, { head: "Tuples", note: "arrangements *with* repetition" },
      { head: "Surjections" }, { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "SignedPermutations",
    slug: "signed-permutations",
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
      { head: "SymmetricGroup", note: "the unsigned $A_{n-1}$ case" }, { head: "ColoredPermutations", note: "$B_n = \\mathbb{Z}_2 \\wr S_n$, the $k=2$ colored case" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "ColoredPermutations",
    slug: "colored-permutations",
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
      { label: "Count", body: "$k^n\\,n!$ (`ColoredPermutationCount`). At $k=1$ this is [`SymmetricGroup`](/reference/symmetric-group); at $k=2$, [`SignedPermutations`](/reference/signed-permutations)." },
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
      { head: "SymmetricGroup", note: "$k = 1$" }, { head: "SignedPermutations", note: "$k = 2$" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "CyclicPermutations",
    slug: "cyclic-permutations",
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
      { head: "SymmetricGroup" }, { head: "Involutions" }, { head: "Derangements" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "Involutions",
    slug: "involutions",
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
      { head: "SymmetricGroup" }, { head: "Derangements" }, { head: "PerfectMatchings", note: "fixed-point-free involutions" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "Derangements",
    slug: "derangements",
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
      { head: "SymmetricGroup" }, { head: "Involutions" }, { head: "CyclicPermutations" },
      { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "AlternatingPermutations",
    slug: "alternating-permutations",
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
      { head: "SymmetricGroup" }, { head: "rank" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "Permutations321Avoiding",
    slug: "permutations-321-avoiding",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ with no decreasing subsequence of length 3 (pattern $321$).",
    usage: [
      { form: "\\operatorname{Permutations321Avoiding}(n)", meaning: "all $321$-avoiding permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{Permutations321Avoiding}(n),\\ i)", meaning: "the avoider at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with no indices $i<j<k$ where $\\sigma_i > \\sigma_j > \\sigma_k$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the Catalan number $C_n$ (OEIS [A000108](https://oeis.org/A000108)) — as for every single-pattern class of length 3." },
      { label: "Order", body: "lexicographic: built left to right, smallest legal value first, where a value is legal iff it exceeds the running maximum inversion-bottom (the walk that keeps every prefix $321$-avoiding), memoized per state (`packages/compute-engine/src/packs/permutations.ts`)." },
      { label: "Random access", body: "each of the $n$ positions sums a memoized state count; polynomial in $n$, not a closed convolution." },
      { label: "Naming", body: "spelled `Permutations321Avoiding` (pattern-suffix), like its sibling [`Permutations132Avoiding`](/reference/permutations-132-avoiding); the four other length-3 classes use the `PermutationsAvoiding<pat>` spelling instead." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{Permutations321Avoiding}(4)) = {count}$ (the Catalan number $C_4$).",
        "The 14 avoiders of $[4]$ in this order are ${first(14)}$ — lex-first is the identity ${at(0)}$.",
      ],
    },
    seeAlso: [
      { head: "Permutations132Avoiding" }, { head: "PermutationsAvoiding123" }, { head: "PermutationsAvoiding231" },
      { head: "SymmetricGroup" }, { head: "CatalanNumber" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "Permutations132Avoiding",
    slug: "permutations-132-avoiding",
    family: "Permutations & permutation classes",
    kind: "collection",
    tagline: "The permutations of $[n]$ avoiding the pattern $132$ (no $i<j<k$ with $\\sigma_i < \\sigma_k < \\sigma_j$).",
    usage: [
      { form: "\\operatorname{Permutations132Avoiding}(n)", meaning: "all $132$-avoiding permutations of $[n]$" },
      { form: "\\operatorname{At}(\\operatorname{Permutations132Avoiding}(n),\\ i)", meaning: "the avoider at 1-based position $i$" },
    ],
    details: [
      { label: "Arity", body: "1 — the ground size $n$." },
      { label: "Element", body: "a permutation (one-line) with no indices $i<j<k$ where $\\sigma_i < \\sigma_k < \\sigma_j$." },
      { label: "Result type", body: "`collection` of `list<integer>`, each of length $n$." },
      { label: "Count", body: "the Catalan number $C_n$ (OEIS [A000108](https://oeis.org/A000108))." },
      { label: "Order", body: "the Catalan convolution recursion on the position $m$ of the maximum value $n$ — every value left of $m$ exceeds every value right of $m$, and each side recursively avoids $132$ (`packages/compute-engine/src/packs/permutations.ts`). This is *not* lexicographic." },
      { label: "Random access", body: "$O(n^2)$ arithmetic — a Catalan table plus the recursive split/merge." },
      { label: "Naming", body: "pattern-suffix spelling, matching [`Permutations321Avoiding`](/reference/permutations-321-avoiding)." },
    ],
    examples: {
      params: [4],
      narrative: [
        "$\\operatorname{Count}(\\operatorname{Permutations132Avoiding}(4)) = {count}$ ($C_4$).",
        "In this order the 14 avoiders of $[4]$ are ${first(14)}$ — rank $0$ is ${at(0)}$ (the max-position recursion puts the reversed identity first, so the order differs from the lex order of [`Permutations321Avoiding`](/reference/permutations-321-avoiding)).",
      ],
    },
    seeAlso: [
      { head: "Permutations321Avoiding" }, { head: "PermutationsAvoiding123" }, { head: "PermutationsAvoiding312" },
      { head: "SymmetricGroup" }, { head: "CatalanNumber" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "PermutationsAvoiding123",
    slug: "permutations-avoiding-123",
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
      { label: "Naming", body: "the `PermutationsAvoiding<pat>` spelling, shared with the $213/231/312$ heads." },
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
      { head: "Permutations321Avoiding" }, { head: "CatalanNumber" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
  {
    head: "PermutationsAvoiding213",
    slug: "permutations-avoiding-213",
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
      { label: "Order", body: "lexicographic among the avoiders, via the same prefix-counting engine as [`PermutationsAvoiding123`](/reference/permutations-avoiding-123) with the $213$ predicate (`packages/compute-engine/src/packs/permutations.ts`)." },
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
    slug: "permutations-avoiding-231",
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
    slug: "permutations-avoiding-312",
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
      { label: "Order", body: "the mirror of [`PermutationsAvoiding231`](/reference/permutations-avoiding-231): the same Catalan convolution split on the position of the minimum $1$, left block $\\{2, \\dots, m_0+1\\}$ and right block $\\{m_0+2, \\dots, n\\}$ (`packages/compute-engine/src/packs/permutations.ts`)." },
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
    slug: "stirling-permutations",
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
      { head: "SymmetricGroup" }, { head: "Groupings" }, { head: "unrank" }, { head: "cardinality" },
    ],
  },
];
