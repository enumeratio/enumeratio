# Sources

<script setup>
import { data } from './data/relations.data.ts'
</script>

A crosswalk of the external systems and inspirations enumeratio relates to — the sources cross-referenced against
the library's own registry, `base_reference`. Each section below links into a pre-filtered view of the full
[Relations](/develop/data/relations) table (in [Data Reference](/develop/data/)) rather than embedding its own; a stale link
means the registry is stale, not this page.

## OEIS

The [Online Encyclopedia of Integer Sequences](https://oeis.org) — every collection or number sequence with a
known A-number. **{{ data.counts.oeis }}** pointers today.
→ [see them all](/develop/data/relations?systems=oeis&kinds=collection)

## FindStat

The [FindStat](https://www.findstat.org) combinatorial-statistics database — stats and maps registered here with
a known FindStat id (`St######`/`Mp#####`). **{{ data.counts.findstat }}** pointers today.
→ [see them all](/develop/data/relations?systems=findstat)

## Sage

**{{ data.counts.sage }}** cross-references against [SageMath](https://www.sagemath.org)'s `sage.combinat`
classes and functions (a couple of collections carry two — a counting function alongside the real class), each
individually verified (Sage is installed and live in this dev environment, so most of these are checked against
real Sage output, not just documentation). Most rows are genuine order-isomorphisms
(`permutations` → `Permutations(n)`, `set_partitions` → `SetPartitions(n)`, …); a few are looser and marked as
such — `non_crossing_partitions` and its siblings are predicate filters on a bigger sage class, not a dedicated
one, and `fubini_numbers` → `OrderedSetPartitions(n)` only matches on cardinality, not structure (`set_compositions`
sits right next to it as the genuine isomorphism to the same sage class). See
[Reading a row](/develop/data/relations#reading-a-row) for what those markers mean. A follow-up audit of
`sage.combinat.combinat`'s remaining named counting functions (`packages/data/sqlsrc/sage-refs.sql`) added 6 more,
verified the same way: `eulerian_number`/`eulerian_polynomial` for `k_descent_permutations`,
`stirling_number1`/`stirling_number2` for `k_cycle_permutations`/`set_partitions_into_k_blocks`, `fibonacci(n)`
for `fibonacci_numbers` (the one genuine isomorphism of the six), and `number_of_unordered_tuples` for `multisets`
— all `aggregate` except `fibonacci`. Checked and confirmed absent from Sage entirely, same rigor as the Wolfram
exclusion list above: `delannoy_number`, `schroeder_number`, `motzkin_number`, `tribonacci` (in any capitalization
or module). One row is a **map**, not a collection: `integer_partitions.conjugate` points at real running Sage
syntax, `Partitions(n).map(lambda p: p.conjugate())`, rather than the bare `Partition.conjugate` property
(`self_conjugate_partitions`' own row, right below it in the table, stays a bare property — Sage's
`EnumeratedSets` has no `.filter()` in this version, only `.map()`, so no equally-nice construction exists for
that one). A first concrete case for [an idea still on the wiki backlog](https://github.com/enumeratio/enumeratio/wiki/Backlog):
deriving rows like this straight from `base_map`'s own registrations instead of hand-authoring each one.
→ [see them all](/develop/data/relations?systems=sage&kinds=collection)

## mathlib4

**{{ data.counts.mathlib4 }}** pointers into Lean's [mathlib4](https://leanprover-community.github.io/mathlib4_docs/)
— a proof library, not a computational one, so these anchor definitions and named theorems (`Nat.bell`,
`Equiv.Perm (Fin n)`, `Finset.powersetCard k`) rather than runnable code.
→ [see them all](/develop/data/relations?systems=mathlib4&kinds=collection)

## Wolfram Language

**{{ data.counts.wolfram }}** collections checked against Wolfram Language's own named counting functions. No
live kernel verifies these (none is installed in the build environment) — every row is checked instead against
the function's own page on `reference.wolfram.com`, its exact definition and indexing, not just an OEIS-number
coincidence. Covers the classical named counting functions (`PartitionsP`, `BellB`, `StirlingS2`, `CatalanNumber`,
…) plus the q-analogs (`QBinomial`, `QFactorial`) and factorial variants (`Factorial2`, `FactorialPower`). A few
plausible-looking candidates were checked and are **not** rows here because they don't exist as WL builtins per
Wolfram's own docs: `DelannoyNumber`, `FubiniNumber`, `Eulerian`, `MotzkinNumber`, `NarayanaNumber`,
`DeBruijnSequence` — worth knowing precisely because the absence is verified, not just unresearched.
→ [see them all](/develop/data/relations?systems=wolfram&kinds=collection)

## SymPy

**{{ data.counts.sympy }}** matches, backed by a real **live oracle** — the same discipline as the Sage oracle
(`packages/cli/tests/oracle_sympy.py` + `cases-sympy.yaml`, mirroring `oracle_sage.py`/`cases.yaml`), not just
documentation-checked rows. 14 element-level generator matches ([`permutations`](/explore/collection/permutations),
[`derangements`](/explore/collection/derangements), [`involutions`](/explore/collection/involutions),
[`subsets`](/explore/collection/subsets), [`k_subsets`](/explore/collection/k_subsets),
[`integer_partitions`](/explore/collection/integer_partitions),
[`set_partitions`](/explore/collection/set_partitions), signed permutations, arrangements, words, necklaces,
bracelets, …) plus 2 cardinality-only matches (`motzkin_numbers`, `tribonacci_numbers`) that neither Sage nor
Wolfram Language covered. Running the oracle surfaced real bugs to work around, not just naming lookups:
`sympy.utilities.iterables.ordered_partitions` returns *integer* partitions despite the name (not compositions —
an early attempt at matching it to `integer_compositions` failed on cardinality, live, and was dropped rather than
forced); `sympy.motzkin(n)` is off-by-one from the OEIS indexing enumeratio uses (`find_first_n_motzkins` is the
one that agrees); SymPy's own tribonacci sequence starts one term later than enumeratio's — a real, documented
delta, not silently glossed over.
→ [see them all](/develop/data/relations?systems=sympy&kinds=collection)

## MATLAB

Thin, as expected — MATLAB is a numerical-computing platform, not a combinatorics system. **{{ data.counts.matlab }}**
doc-verified rows (`nchoosek`, `perms`, `factorial`, `primes`, `factor`) still live in the Relations table above,
but the full write-up — what was excluded and why, plus a broader survey of other candidate libraries and data
sources worth considering — has moved to the
[wiki](https://github.com/enumeratio/enumeratio/wiki/Related-Systems-Candidates).

## Coming next

Wolfram Engine is free for personal/development use, which would open the door to an actual **live** Wolfram
oracle on top of the doc-verified rows above, the same way SymPy's oracle now works; not started yet.

Sage's own live OEIS reverse-lookup (`oeis()`, searching by leading terms) found 3 candidates among the catalog's
number sequences that were missing an `oeis` row — `all_ones` → A000012, `powers_of_two` → A000079,
`fubini_numbers` → A000670 — each an unambiguous top hit, terms checked against enumeratio's own values. All 3
now have one: `all_ones` was genuinely new (`oeis.sql`); the other two turned out already curated in `base_oeis`
under richer entries (formula, blurb, provenance) than a bare `oeis-refs.sql` row would carry, which is why the
audit's own grep of that file alone missed them.
