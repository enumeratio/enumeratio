# Species as data

A **combinatorial species** is a rule that, for every finite set of labels, produces a finite set of
*structures* on those labels — and does so *naturally*, so that relabelling the ground set relabels the structures.
Formally it is a functor from finite sets with bijections to finite sets with bijections. This is the object
behind almost every collection in the library: a permutation *is* a set of cycles, a set partition *is* a set of
non-empty blocks, and enumeratio stores those identities as data.

The one idea to carry through this page: **a species is the object; a collection is a *reading* of one.** The same
species $E \circ C$ (a set of cycles) is read *labelled* to count permutations ($n!$) and could be read *unlabelled*
(by isotype) to count cycle *shapes*. enumeratio keeps the species once and records, per collection, which reading
it takes.

This is a reference tour of that layer — modeled loosely on Sage's [`combinat.species`](https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/species/all.html)
index — with each piece backed by a live collection rather than a static transcript. The machinery itself lives in
`base_species.sql` (the labelled/EGF engine and the exact cycle-index kernel) and the registry tables
`base_species_atom`, `base_species_op`, `base_species_def`, and `base_collection_species`.

## The atoms

The **atomic species** are the leaves every expression is built from. They are rows of `base_species_atom`:

| atom | symbol | what it is | labelled count $a_n$ |
|---|---|---|---|
| one | `1` | the empty species — one structure, only on the empty set | $1,0,0,\dots$ |
| singleton | `X` | one structure, only on a one-element set | $0,1,0,\dots$ |
| set | `E` | one structure per label set, any size | $1,1,1,\dots$ |
| non-empty set | `E+` | the set atom minus the empty structure | $0,1,1,\dots$ |
| cycle | `C` | a single cyclic order — $(n-1)!$ at size $n$ | $0,1,1,2,6,\dots$ |
| linear order | `L` | a total order — $n!$ at size $n$ | $1,1,2,6,24,\dots$ |

A permutation is a **set of cycles**, $E \circ C$, and enumeratio draws one as its cycle diagram:

<enumeratio-figure collection="permutations" n="4" rank="9"></enumeratio-figure>

## The operations

The **operations** combine species into new ones. They are rows of `base_species_op`, each carrying its Yorgey
(Haskell `species`) and Sage names, its labelled rule, and the kernel function that implements it on the cycle index:

| op | symbol | meaning | Yorgey | Sage |
|---|---|---|---|---|
| sum | `+` | either an $F$-structure or a $G$-structure | `+` | `Sum` |
| product | `·` | split the labels $A \sqcup B$, an $F$ on $A$ and a $G$ on $B$ | `*` | `Product` |
| Cartesian product | `×` | an $F$-structure *and* a $G$-structure on the *same* labels | `><` | — |
| composition | `∘` | partition the labels, a $G$ inside each block, an $F$ on the blocks | `o` | `Composition` |
| functor composition | `@@` | an $F$-structure on the set of *all* $G$-structures | `@@` | `FunctorialComposition` |
| derivative | `′` | $F$ on the labels plus one distinguished hole | `differentiate` | — |
| pointing | `•` | $F$ with one label distinguished | `pointed` | — |
| size restriction | `E_k` | only the structures of a fixed size $k$ | `ofSize` | `restricted` |
| power | `^` | a $k$-fold labelled product | — | — |
| recursion | `Y=` | a fixed point $Y = F(X, Y)$, solved by iteration | `rec` | `define` |

So `E∘C` is a permutation, `E∘E+` a set partition, `L∘E+` an ordered set partition, `E·E` a subset (in-set ×
out-set), and `E_k·E` the size-$k$ subsets. Two enumeratio caveats, kept honest in the data:

- **`@@` (functor composition)** has a registry row but no cycle-index formula yet (`species_z_functor_compose` is a
  raising stub) — no catalog collection needs it. See open call **S.7** on the design page.
- **Weighted, virtual, and multisort species** (Sage's `weighted`, virtual differences, multisort) are *not*
  modeled. The relabel-invariant statistics that a weighted species would carry — cycle count, block count — live
  today as q-polynomials in [Subset sum & q-binomials](/learn/explorations/subset-sum-and-q-binomials) and
  `generating_functions.sql`; folding them into the cycle index is a noted follow-up, not a claim.

## The three readings — labelled, isotype, count-sequence

Sage exposes three *series* for one species: the exponential generating series (labelled), the isotype generating
series (unlabelled), and the cycle-index series that both project from. enumeratio takes the same shape but as
**readings** a collection *chooses*, recorded in `base_collection_species.reading`:

- **labelled** — the EGF reading, $a_n = |F[n]|$, evaluated by the integer engine `species_eval` (`species_solve`
  for a recursive one). Permutations, set partitions, subsets read this way.
- **isotype** — the unlabelled reading, counting structures up to relabelling, evaluated through the exact
  **cycle-index kernel** $Z_F$ (fraction pairs; plethysm for `∘`). Integer partitions are the isotype reading of
  $E \circ E{+}$; integer compositions of $L \circ E{+}$.
- **count-sequence** — the same series read as the values of an unbounded number sequence (`catalan_numbers`,
  `partition_numbers`), the "one identity, many roles" case.

The isotype reading is why $E \circ E{+}$, read unlabelled, *is* the integer partitions — the same species that,
read labelled, is the set partitions (Bell numbers):

<enumeratio-figure collection="integer_partitions" n="6" rank="0"></enumeratio-figure>

Because the readings share one kernel, a wrong species expression cannot register: every collection's reading is
checked against its actual `cardinality` sequence in the example suite (`base_species_check*`), and the labelled
cycle-index walker is cross-checked against `species_eval` over the whole labelled corpus at degree 8.

## Where to go next

- [Generic species — two worked examples](/learn/explorations/generic-species) — the recursive/`define` side, live.
- The collections that read a species: [`permutations`](/explore/collection/permutations),
  [`set_partitions`](/explore/collection/set_partitions), [`integer_partitions`](/explore/collection/integer_partitions).
- The design record (architecture, open calls, migration status): the
  [Species as data (#274)](https://github.com/enumeratio/enumeratio/wiki/Species-Data-Model) wiki page.
