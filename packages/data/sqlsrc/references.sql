-- requires: realizer, constructions
-- base_reference — HARD pointers to alternate implementations of our objects (mathlib4, sage) that SHOULD match, with
-- the DELTA where they don't. The resolvable `identity` (a declaration / class name) is the pointer; `url` is the doc
-- page when known (else resolvable from identity later); `delta` is '' for an exact match, else the mapping/difference.
-- Complements base_oeis (integer sequences) + base_map.findstat (map cross-links). This is the substrate for a mathlib/
-- sage ORACLE (cross-check our cardinality/enumeration against theirs) and for BORROWING their proven facts. Could also
-- drive COMMENT ON declarations so the pointer lives with the definition. Seed below is skeptic-verified (see
-- https://github.com/enumeratio/enumeratio/wiki/Parameterized-Collections); the exhaustive per-collection enrichment (urls, sage, deltas) is backlog #24.
CREATE TABLE base_reference (
  subject_kind text NOT NULL,      -- collection | construction | carrier | stat | structure
  subject      text NOT NULL,
  system       text NOT NULL,      -- mathlib4 | sage
  identity     text NOT NULL,      -- the resolvable declaration / class — the hard pointer
  url          text,
  delta        text NOT NULL DEFAULT '',   -- '' = should match; else what differs / the mapping needed
  -- how `identity` actually relates to `subject`, since not every row is a straight bijection:
  --   isomorphic — same object, order-isomorphic or a straight bijection (the default, the common case)
  --   partial    — identity is a predicate/filter on a BIGGER external class, not the class itself
  --   aggregate  — a cardinality-only coincidence (identity's .cardinality() matches, not the same object)
  --   conceptual — a soft/grounding association (e.g. wikipedia), not a structural claim
  relation     text NOT NULL DEFAULT 'isomorphic' CHECK (relation IN ('isomorphic','partial','aggregate','conceptual')),
  PRIMARY KEY (subject_kind, subject, system, identity),
  pack         text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack
);
CREATE TRIGGER base_reference_pack_guard BEFORE UPDATE OR DELETE ON base_reference FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

-- constructions + carrier + the borrowed ops (with urls — the ones we lean on most)
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('construction','finset',          'mathlib4','Finset',         'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Finset/Defs.html',''),
  ('construction','multiset',        'mathlib4','Multiset',       'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Multiset/Defs.html',''),
  ('construction','words',           'mathlib4','List.Vector',    NULL, 'a length-n word over Fin b = List.Vector (Fin b) n'),
  ('construction','boolean_algebra', 'mathlib4','BooleanAlgebra', 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/BooleanAlgebra/Defs.html','an ORDER class (distributive lattice + complement); our BOUNDED finset instantiates it'),
  ('carrier','finset','mathlib4','Finset', 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Finset/Defs.html','Finset (Fin n) when n finite, Finset ℕ when n NULL'),
  ('stat','additive_energy',      'mathlib4','Finset.additiveEnergy',      'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Additive/Energy.html',''),
  ('stat','multiplicative_energy','mathlib4','Finset.multiplicativeEnergy','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Additive/Energy.html','');

-- collection ↔ mathlib4 (from the verified mapping; identity is the hard pointer, url resolvable later)
INSERT INTO base_reference (subject_kind, subject, system, identity, delta) VALUES
  ('collection','permutations','mathlib4','Equiv.Perm (Fin n)',''),
  ('collection','subsets','mathlib4','Finset (Fin n)',''),
  ('collection','finsets','mathlib4','Finset ℕ',''),
  ('collection','k_subsets','mathlib4','Finset.powersetCard k',''),
  ('collection','multisets','mathlib4','Sym (Fin n) k',''),
  ('collection','set_partitions','mathlib4','Finpartition (Finset.univ : Finset (Fin n))',''),
  ('collection','integer_partitions','mathlib4','Nat.Partition',''),
  ('collection','integer_compositions','mathlib4','Composition n',''),
  ('collection','compositions_into_k_parts','mathlib4','Composition n','no k-restricted type in mathlib — the parent, filtered to .length = k'),
  ('collection','weak_compositions_into_k_parts','mathlib4','Finset.Nat.antidiagonalTuple',''),
  ('collection','semistandard_tableaux','mathlib4','SemistandardYoungTableau',''),
  ('collection','standard_tableaux','mathlib4','SemistandardYoungTableau','no standalone SYT type — an SSYT with content (1ⁿ) (all-distinct ⇒ strict rows)'),
  ('collection','endofunctions','mathlib4','Function.End (Fin n)',''),
  ('collection','cyclic_permutations','mathlib4','Equiv.Perm (Fin n)',''),
  ('collection','natural_numbers','mathlib4','Nat',''),
  ('collection','integer_numbers','mathlib4','Int',''),
  ('collection','rational_numbers','mathlib4','Rat',''),
  ('collection','modular_residues','mathlib4','ZMod n',''),
  ('collection','gaussian_integers','mathlib4','GaussianInt',''),
  ('collection','cardinal_numbers','mathlib4','Cardinal',''),
  ('collection','omega_ordinals','mathlib4','Ordinal',''),
  ('collection','catalan_numbers','mathlib4','catalan',''),
  ('collection','fibonacci_numbers','mathlib4','Nat.fib',''),
  ('collection','prime_numbers','mathlib4','Nat.Prime',''),
  ('collection','prime_power_numbers','mathlib4','IsPrimePow',''),
  ('collection','perfect_numbers','mathlib4','Nat.Perfect',''),
  ('collection','square_numbers','mathlib4','IsSquare',''),
  ('collection','square_free_numbers','mathlib4','Squarefree','');

-- collection ↔ sage (from the per-collection headers' "sage X(n)" notes + the stable sage.combinat names)
INSERT INTO base_reference (subject_kind, subject, system, identity, delta) VALUES
  ('collection','permutations','sage','Permutations(n)',''),
  ('collection','subsets','sage','Subsets(n)',''),
  ('collection','integer_partitions','sage','Partitions(n)',''),
  ('collection','set_partitions','sage','SetPartitions(n)',''),
  ('collection','integer_compositions','sage','Compositions(n)',''),
  ('collection','alternating_sign_matrices','sage','AlternatingSignMatrices(n)',''),
  ('collection','core_partitions','sage','Cores(k, n)',''),
  ('collection','plane_partitions','sage','PlanePartitions(n)',''),
  ('collection','skew_partitions','sage','SkewPartitions(n)',''),
  ('collection','standard_tableaux','sage','StandardTableaux(n)',''),
  ('collection','semistandard_tableaux','sage','SemistandardTableaux(n)','');

-- ── enrichment batch (2026-08-27, harvested from collection headers + verified; workflow base-reference-enrichment) ──
-- 11 mathlib4 + 47 sage new pointers. binary_trees→mathlib was dropped (its type is `Tree`, not `BinaryTree`, and it is
-- a value-carrying data structure not tied to the Catalan shape count). OEIS A-numbers (132) staged for base_oeis, TODO.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','arrangements','mathlib4','Nat.descFactorial','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Nat/Factorial/BigOperators.html','counting formula only — |arrangements(n,k)| = n.descFactorial k; the structural analog (injective length-k word) would be Function.Embedding (Fin k) (Fin n), which mathlib does not itself name as ''arrangements'''),
  ('collection','bell_numbers','mathlib4','Nat.bell','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Bell.html',''),
  ('collection','binary_words','mathlib4','List.Vector Bool n','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Vector/Basic.html',''),
  ('collection','boolean_algebra','mathlib4','BooleanAlgebra','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/BooleanAlgebra/Defs.html','an order CLASS, not a type — our finset-under-⊆ carrier on [n] is the concrete instance (BooleanAlgebra (Finset (Fin n)))'),
  ('collection','deficient_numbers','mathlib4','Nat.Deficient','https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/FactorisationProperties.html',''),
  ('collection','distinct_partitions','mathlib4','Nat.Partition.distincts','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Partition.html',''),
  ('collection','double_factorial_numbers','mathlib4','Nat.doubleFactorial','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Nat/Factorial/DoubleFactorial.html','our a(n) = Nat.doubleFactorial (2n−1); mathlib''s n‼ is defined for all n, we only take the odd subsequence'),
  ('collection','dyck_paths','mathlib4','catalan','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Catalan.html',''),
  ('collection','factorial_numbers','mathlib4','Nat.factorial','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Nat/Factorial/Basic.html',''),
  ('collection','finite_set_elements','mathlib4','Fin n','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Fin/Basic.html','the n atoms of ground set [n]; Fin n is mathlib''s canonical n-element type (our atoms are 1-indexed, Fin n is 0-indexed)'),
  ('collection','integer_factorizations','mathlib4','Nat.factorization','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Nat/Factorization/Basic.html','Nat.factorization (ℕ →₀ ℕ, support=primes, values=exponents) covers only the magnitude; our carrier adds a sign bit for ℤ'),
  ('collection','affine_permutations','sage','AffinePermutationGroup(cartan_type) [sage.combinat.affine_permutation.AffinePermutation]','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/affine_permutation.html','window-notation elements of the affine symmetric group; our r-bounded-translation-box grading (n, radius) is our own restriction, not part of the sage class'),
  ('collection','arrangements','sage','Permutations(n,k) [= Arrangements([1..n], k)]',NULL,''),
  ('collection','associahedron','sage','Associahedron(cartan_type)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/root_system/associahedron.html','sage builds the geometric polytope from a Cartan type (e.g. type A_{n-2} for our n); ours is the combinatorial face poset reached via the dissection order-isomorphism'),
  ('collection','ballot_sequences','sage','DyckWords(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/dyck_word.html','same object under an alternate ±1-step reading (sage represents it as open/close symbols)'),
  ('collection','bell_numbers','sage','sage.combinat.combinat.bell_number(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html#sage.combinat.combinat.bell_number',''),
  ('collection','binary_necklaces','sage','Necklaces(content)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/necklace.html','binary necklaces of length n = ⋃_{k=0}^{n} Necklaces([k, n−k]) — sage''s class fixes content (weight), not just length'),
  ('collection','binary_trees','sage','BinaryTrees(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/binary_tree.html',''),
  ('collection','binary_words','sage','Words(2, n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/words/words.html','sage''s alphabet is {1,2}, ours is {0,1} — a relabeling'),
  ('collection','box_confined_partitions','sage','PartitionsInBox(h, w)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html','our (parts, max_part) = their (h, w)'),
  ('collection','bounded_part_partitions','sage','Partitions(n, max_part=k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html',''),
  ('collection','catalan_numbers','sage','sage.combinat.combinat.catalan_number(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html',''),
  ('collection','compositions_into_k_parts','sage','Compositions(n, length=k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/composition.html',''),
  ('collection','cross_polytope','sage','sage.geometry.polyhedron.library.polytopes.cross_polytope(dim)','https://doc.sagemath.org/html/en/reference/discrete_geometry/sage/geometry/polyhedron/library.html','their object is the geometric polyhedron (vertex/facet coordinate data) for one fixed dim; our collection is the full face lattice at ground n, enumerated via the order-isomorphic signed_subset carrier'),
  ('collection','decorated_permutations','sage','DecoratedPermutations(n)',NULL,''),
  ('collection','distinct_partitions','sage','Partitions(n, max_slope=-1)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html',''),
  ('collection','dyck_paths','sage','DyckWords(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/dyck_word.html',''),
  ('collection','gaussian_integers','sage','GaussianIntegers()','https://doc.sagemath.org/html/en/reference/number_fields/',''),
  ('collection','gaussian_rationals','sage','QuadraticField(-1)','https://doc.sagemath.org/html/en/reference/number_fields/sage/rings/number_field/number_field.html','field of Gaussian rationals ℚ(i); our carrier is an explicit (re,im) rational_number pair, not a number-field element type'),
  ('collection','gelfand_tsetlin','sage','GelfandTsetlinPatterns(n, k)',NULL,''),
  ('collection','integer_factorizations','sage','IntegerFactorization (sage.structure.factorization_integer)','https://doc.sagemath.org/html/en/reference/structure/sage/structure/factorization_integer.html',''),
  ('collection','k_bounded_compositions','sage','Compositions(n, max_length=k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/composition.html',''),
  ('collection','k_colored_permutations','sage','ColoredPermutations(k, n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/colored_permutations.html','sage parameter order is (colors, size); ours is (size, colors)'),
  ('collection','k_lyndon_words','sage','LyndonWords(n, k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/words/lyndon_word.html','sage signature is (alphabet size, word length); matches our (base, size)'),
  ('collection','k_necklaces','sage','Necklaces(content)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/necklace.html','sage parameterizes by letter-multiplicity content (a composition); ours by fixed (size, base) — a different but related parameterization of the same rotation-class idea'),
  ('collection','k_part_partitions','sage','Partitions(n, length=k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html',''),
  ('collection','largest_part_partitions','sage','PartitionsGreatestEQ(n, k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html',''),
  ('collection','modular_residues','sage','IntegerModRing(n) / Zmod(n)','https://doc.sagemath.org/html/en/reference/finite_rings/sage/rings/finite_rings/integer_mod_ring.html',''),
  ('collection','narayana_numbers','sage','sage.combinat.combinat.narayana_number(n, k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html','their k is 0-indexed (0..n-1); our k is the 1-indexed peak count (1..n) — our N(n,k) = their narayana_number(n, k-1)'),
  ('collection','non_crossing_partitions','sage','sage.combinat.set_partition.SetPartition.is_noncrossing','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition.html','predicate method, not a dedicated class — filter SetPartitions(n) by .is_noncrossing()'),
  ('collection','non_nesting_partitions','sage','sage.combinat.set_partition.SetPartition.is_nonnesting','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition.html','predicate method, not a dedicated class — filter SetPartitions(n) by .is_nonnesting()'),
  ('collection','ordered_trees','sage','sage.combinat.ordered_tree.OrderedTrees(size)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/ordered_tree.html','their parameter is NODE count; ours is EDGE count — our n = their size − 1 (n edges ⇒ n+1 nodes)'),
  ('collection','parking_functions','sage','sage.combinat.parking_functions.ParkingFunctions(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/parking_functions.html',''),
  ('collection','partition_algebra','sage','sage.combinat.diagram_algebras.PartitionAlgebra(k, q, base_ring, prefix)','https://doc.sagemath.org/html/en/reference/algebras/sage/combinat/diagram_algebras.html','sage''s full diagram partition algebra basis = set partitions of a 2k-point set (Bell(2k)); our collection borrows only the one-row Bell(n) basis (identical to set_partitions), a simpler sub-object of the real partition algebra'),
  ('collection','perfect_matchings','sage','sage.combinat.perfect_matching.PerfectMatchings(k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/perfect_matching.html','sage parameterizes by ground-set size k (k=2n); ours parameterizes by pair-count n'),
  ('collection','permutahedron','sage','sage.combinat.set_partition_ordered.OrderedSetPartitions(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition_ordered.html','order-isomorphic borrow of set_compositions (ordered set partitions of [n]); the geometric permutahedron itself is sage''s polytopes.permutahedron(n), a different (coordinate) reading of the same combinatorics'),
  ('collection','plane_trees','sage','sage.combinat.ordered_tree.OrderedTrees(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/ordered_tree.html',''),
  ('collection','prime_numbers','sage','sage.sets.primes.Primes()','https://doc.sagemath.org/html/en/reference/sets/sage/sets/primes.html',''),
  ('collection','restricted_growth_strings','sage','SetPartitions(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition.html','word (RGS) encoding, not sage''s block-list representation'),
  ('collection','set_compositions','sage','OrderedSetPartitions(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition_ordered.html',''),
  ('collection','set_partitions_into_k_blocks','sage','SetPartitions(n, k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition.html',''),
  ('collection','signed_permutations','sage','SignedPermutations(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/colored_permutations.html',''),
  ('collection','singleton_species','sage','SingletonSpecies (= CharacteristicSpecies(1))','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/species/characteristic_species.html',''),
  ('collection','surjections','sage','OrderedSetPartitions(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition_ordered.html','word (surjection) encoding, not sage''s block-list encoding'),
  ('collection','surjections_onto_k','sage','OrderedSetPartitions(n, k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition_ordered.html','word encoding (surjection [n]↠[k] as a word), not sage''s block-list encoding'),
  ('collection','thue_morse_numbers','sage','sage.combinat.words.word_generators.words.ThueMorseWord()','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/words/word_generators.html',''),
  ('collection','triangular_numbers','sage','sage.combinat.combinat.polygonal_number(3, n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html','s=3 fixed for the triangular case; their n = our r'),
  ('collection','weak_compositions_into_k_parts','sage','sage.combinat.integer_vector.IntegerVectors(n, k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/integer_vector.html','same set (nonnegative length-k vectors summing to n) but sage''s default iteration order is reverse-lex (e.g. IntegerVectors(2,3) starts [2,0,0]) vs our ascending-lex ([0,0,2] first)'),
  ('collection','words','sage','sage.combinat.words.words.Words(base, size)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/words/words.html','arg order reversed: sage''s Words(k, n) is alphabet-size-then-length vs our words(size, base) = length-then-alphabet-size; same {1..base}^size lex enumeration');

-- seed-row doc-URL backfill (workflow seed-url-backfill, 2026-08-27; each URL WebFetch-verified). The seed
-- collection rows were inserted url-less; set them here so the explorer identity strip links out (mathlib4 + sage).
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Logic/Equiv/Defs.html#Equiv.Perm' WHERE subject='permutations' AND system='mathlib4' AND identity='Equiv.Perm (Fin n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Finset/Defs.html' WHERE subject='subsets' AND system='mathlib4' AND identity='Finset (Fin n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Finset/Defs.html' WHERE subject='finsets' AND system='mathlib4' AND identity='Finset ℕ' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Finset/Powerset.html' WHERE subject='k_subsets' AND system='mathlib4' AND identity='Finset.powersetCard k' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Sym/Basic.html' WHERE subject='multisets' AND system='mathlib4' AND identity='Sym (Fin n) k' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/Partition/Finpartition.html' WHERE subject='set_partitions' AND system='mathlib4' AND identity='Finpartition (Finset.univ : Finset (Fin n))' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Partition/Basic.html' WHERE subject='integer_partitions' AND system='mathlib4' AND identity='Nat.Partition' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Composition.html' WHERE subject='integer_compositions' AND system='mathlib4' AND identity='Composition n' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Composition.html' WHERE subject='compositions_into_k_parts' AND system='mathlib4' AND identity='Composition n' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Fin/Tuple/NatAntidiagonal.html' WHERE subject='weak_compositions_into_k_parts' AND system='mathlib4' AND identity='Finset.Nat.antidiagonalTuple' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Young/SemistandardTableau.html' WHERE subject='semistandard_tableaux' AND system='mathlib4' AND identity='SemistandardYoungTableau' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Young/SemistandardTableau.html' WHERE subject='standard_tableaux' AND system='mathlib4' AND identity='SemistandardYoungTableau' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Algebra/Group/End.html' WHERE subject='endofunctions' AND system='mathlib4' AND identity='Function.End (Fin n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Logic/Equiv/Defs.html#Equiv.Perm' WHERE subject='cyclic_permutations' AND system='mathlib4' AND identity='Equiv.Perm (Fin n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Init/Prelude.html' WHERE subject='natural_numbers' AND system='mathlib4' AND identity='Nat' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Init/Data/Int/Basic.html' WHERE subject='integer_numbers' AND system='mathlib4' AND identity='Int' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Init/Data/Rat/Basic.html' WHERE subject='rational_numbers' AND system='mathlib4' AND identity='Rat' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/ZMod/Defs.html' WHERE subject='modular_residues' AND system='mathlib4' AND identity='ZMod n' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/Zsqrtd/GaussianInt.html' WHERE subject='gaussian_integers' AND system='mathlib4' AND identity='GaussianInt' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/SetTheory/Cardinal/Defs.html' WHERE subject='cardinal_numbers' AND system='mathlib4' AND identity='Cardinal' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/SetTheory/Ordinal/Basic.html' WHERE subject='omega_ordinals' AND system='mathlib4' AND identity='Ordinal' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Catalan/Basic.html' WHERE subject='catalan_numbers' AND system='mathlib4' AND identity='catalan' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Nat/Fib/Basic.html' WHERE subject='fibonacci_numbers' AND system='mathlib4' AND identity='Nat.fib' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Nat/Prime/Defs.html' WHERE subject='prime_numbers' AND system='mathlib4' AND identity='Nat.Prime' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Algebra/IsPrimePow.html' WHERE subject='prime_power_numbers' AND system='mathlib4' AND identity='IsPrimePow' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/Divisors.html' WHERE subject='perfect_numbers' AND system='mathlib4' AND identity='Nat.Perfect' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Algebra/Group/Even.html' WHERE subject='square_numbers' AND system='mathlib4' AND identity='IsSquare' AND url IS NULL;
UPDATE base_reference SET url = 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Algebra/Squarefree/Basic.html' WHERE subject='square_free_numbers' AND system='mathlib4' AND identity='Squarefree' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html' WHERE subject='permutations' AND system='sage' AND identity='Permutations(n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/subset.html' WHERE subject='subsets' AND system='sage' AND identity='Subsets(n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html' WHERE subject='integer_partitions' AND system='sage' AND identity='Partitions(n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition.html' WHERE subject='set_partitions' AND system='sage' AND identity='SetPartitions(n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/composition.html' WHERE subject='integer_compositions' AND system='sage' AND identity='Compositions(n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/alternating_sign_matrix.html' WHERE subject='alternating_sign_matrices' AND system='sage' AND identity='AlternatingSignMatrices(n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/core.html' WHERE subject='core_partitions' AND system='sage' AND identity='Cores(k, n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/plane_partition.html' WHERE subject='plane_partitions' AND system='sage' AND identity='PlanePartitions(n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/skew_partition.html' WHERE subject='skew_partitions' AND system='sage' AND identity='SkewPartitions(n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/tableau.html' WHERE subject='standard_tableaux' AND system='sage' AND identity='StandardTableaux(n)' AND url IS NULL;
UPDATE base_reference SET url = 'https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/tableau.html' WHERE subject='semistandard_tableaux' AND system='sage' AND identity='SemistandardTableaux(n)' AND url IS NULL;

-- ── tail enrichment (issue #24, 2026-08-29): mathlib4 / sage pointers for collections the OEIS layer covers but that had
-- no mathlib/sage anchor. Each identity source-verified (mathlib4 docs / sage combinat docs), not harvested from memory.
-- Most of the remaining tail is integer sequences (Lucas/Pell/Padovan/Perrin/Jacobsthal/Tribonacci, semiprime/sphenic/
-- powerful/practical families, centered + pyramidal figurates, the non-Dyck lattice paths) with NO faithful mathlib/sage
-- declaration — those stay OEIS-only (see the close-out list); fidelity over coverage.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','abundant_numbers','mathlib4','Nat.Abundant','https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/FactorisationProperties.html',''),
  ('collection','boxed_plane_partitions','sage','PlanePartitions([a, b, c])','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/plane_partition.html','plane partitions fitting an a×b×c box; sage''s PlanePartitions([a,b,c]) is the same box-confined set (our carrier stores the (a,b,c) bound)'),
  ('collection','lucas_numbers','sage','sage.combinat.combinat.lucas_number2(n, 1, -1)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html','L(n) via lucas_number2 with (P, Q) = (1, −1); sage has no bare Lucas function, this is the parameterized Lucas-of-the-second-kind'),
  ('collection','pentagonal_numbers','sage','sage.combinat.combinat.polygonal_number(5, n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html','s=5 fixed for the pentagonal case; their n = our r'),
  ('collection','hexagonal_numbers','sage','sage.combinat.combinat.polygonal_number(6, n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html','s=6 fixed for the hexagonal case; their n = our r'),
  ('collection','heptagonal_numbers','sage','sage.combinat.combinat.polygonal_number(7, n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html','s=7 fixed for the heptagonal case; their n = our r'),
  ('collection','octagonal_numbers','sage','sage.combinat.combinat.polygonal_number(8, n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/combinat.html','s=8 fixed for the octagonal case; their n = our r'),
  ('collection','gray_codes','sage','sage.combinat.gray_codes','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/gray_codes.html','a module of loopless Gray-code SWITCH generators (Knuth Algorithm H), not an element class; product([2]*n) yields the binary reflected code = our carrier'),
  ('collection','lehmer_codes','sage','sage.combinat.permutation.from_lehmer_code','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html','the encode/decode pair to_lehmer_code / from_lehmer_code, not an enumerated class; our collection is every length-n Lehmer code (subexcedant vector)');

-- ── wikipedia pointers (issue #249, wikipedia slice, 2026-09-03): the clearest ~25 well-known collections that had NO
-- wikipedia reference at all. Each URL WebFetch-verified against the live article (title + opening definition matches
-- the collection). standard_tableaux and semistandard_tableaux share one article (Young tableau covers both flavors
-- under one page). dyck_paths points at "Dyck language" — the dedicated "Dyck path" title is itself a redirect to
-- Catalan number (already used for catalan_numbers), so the word-formalism article is the more useful distinct pointer.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','permutations',            'wikipedia','Permutation',NULL,''),
  ('collection','derangements',            'wikipedia','Derangement',NULL,''),
  ('collection','involutions',             'wikipedia','Involution (mathematics)',NULL,''),
  ('collection','integer_partitions',      'wikipedia','Partition (number theory)',NULL,''),
  ('collection','set_partitions',          'wikipedia','Partition of a set',NULL,''),
  ('collection','dyck_paths',              'wikipedia','Dyck language',NULL,'titled "Dyck language" (the word/bracket formalism); the dedicated "Dyck path" title redirects to Catalan number'),
  ('collection','catalan_numbers',         'wikipedia','Catalan number',NULL,''),
  ('collection','bell_numbers',            'wikipedia','Bell number',NULL,''),
  ('collection','motzkin_numbers',         'wikipedia','Motzkin number',NULL,''),
  ('collection','narayana_numbers',        'wikipedia','Narayana number',NULL,''),
  ('collection','integer_compositions',    'wikipedia','Composition (combinatorics)',NULL,''),
  ('collection','binary_trees',            'wikipedia','Binary tree',NULL,''),
  ('collection','standard_tableaux',       'wikipedia','Young tableau',NULL,'the article covers both standard and semistandard tableaux under one page'),
  ('collection','semistandard_tableaux',   'wikipedia','Young tableau',NULL,'the article covers both standard and semistandard tableaux under one page'),
  ('collection','parking_functions',       'wikipedia','Parking function',NULL,''),
  ('collection','lehmer_codes',            'wikipedia','Lehmer code',NULL,''),
  ('collection','subsets',                 'wikipedia','Power set',NULL,''),
  ('collection','k_subsets',               'wikipedia','Combination',NULL,''),
  ('collection','multisets',               'wikipedia','Multiset',NULL,''),
  ('collection','perfect_matchings',       'wikipedia','Perfect matching',NULL,''),
  ('collection','gray_codes',              'wikipedia','Gray code',NULL,''),
  ('collection','alternating_sign_matrices','wikipedia','Alternating sign matrix',NULL,''),
  ('collection','fibonacci_numbers',       'wikipedia','Fibonacci sequence',NULL,''),
  ('collection','factorial_numbers',       'wikipedia','Factorial',NULL,''),
  ('collection','non_crossing_partitions', 'wikipedia','Noncrossing partition',NULL,'');

UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Permutation' WHERE subject='permutations' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Derangement' WHERE subject='derangements' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Involution_(mathematics)' WHERE subject='involutions' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Partition_(number_theory)' WHERE subject='integer_partitions' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Partition_of_a_set' WHERE subject='set_partitions' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Dyck_language' WHERE subject='dyck_paths' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Catalan_number' WHERE subject='catalan_numbers' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Bell_number' WHERE subject='bell_numbers' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Motzkin_number' WHERE subject='motzkin_numbers' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Narayana_number' WHERE subject='narayana_numbers' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Composition_(combinatorics)' WHERE subject='integer_compositions' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Binary_tree' WHERE subject='binary_trees' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Young_tableau' WHERE subject='standard_tableaux' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Young_tableau' WHERE subject='semistandard_tableaux' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Parking_function' WHERE subject='parking_functions' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Lehmer_code' WHERE subject='lehmer_codes' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Power_set' WHERE subject='subsets' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Combination' WHERE subject='k_subsets' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Multiset' WHERE subject='multisets' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Perfect_matching' WHERE subject='perfect_matchings' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Gray_code' WHERE subject='gray_codes' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Alternating_sign_matrix' WHERE subject='alternating_sign_matrices' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Fibonacci_sequence' WHERE subject='fibonacci_numbers' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Factorial' WHERE subject='factorial_numbers' AND system='wikipedia' AND url IS NULL;
UPDATE base_reference SET url = 'https://en.wikipedia.org/wiki/Noncrossing_partition' WHERE subject='non_crossing_partitions' AND system='wikipedia' AND url IS NULL;

-- ── sage pointers (issue #249, sage slice, 2026-09-03): the clearest ~20 existing collections with an obvious sage
-- combinat class that had NO sage reference yet. Each identity WebFetch-verified against the live sagemath combinat
-- docs (class/function/method actually exists with the stated signature). Several sage classes take ONE fixed shape
-- or a single alphabet size where ours enumerates the whole n-indexed family — those carry a delta explaining the
-- union/specialization, same discipline as the existing tail-enrichment batch. Skipped as unconfirmable: involutions,
-- endofunctions, finsets, multisets, motzkin/schroeder/prufer/rook-placement families, labeled_trees/forests,
-- primitive_binary_strings (no is_primitive() found), self-conjugate keyword (method-based, not a keyword — used
-- anyway via the conjugate() involution), binary/k_bracelets (no sage Bracelets class).
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','derangements','sage','Derangements(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/derangements.html',''),
  ('collection','k_subsets','sage','Subsets(n, k)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/subset.html',''),
  ('collection','baxter_permutations','sage','BaxterPermutations(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/baxter_permutations.html',''),
  ('collection','cyclic_permutations','sage','sage.combinat.permutation.CyclicPermutations(mset)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html','sage returns linear arrangements of mset up to rotation ("the same as necklaces"), one representative per class; ours is the single-n-cycle PERMUTATION itself (a bijection [n]→[n] whose functional graph is one n-cycle) — same count (n−1)!, different representation'),
  ('collection','lyndon_words','sage','LyndonWords(2, n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/words/lyndon_word.html','fixed binary alphabet — k_lyndon_words(base,size) already anchors the general (alphabet,length) LyndonWords(e,k) signature; here e=2 is pinned'),
  ('collection','non_crossing_matchings','sage','sage.combinat.perfect_matching.PerfectMatching.is_noncrossing','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/perfect_matching.html','predicate method, not a dedicated class — filter PerfectMatchings(k) by .is_noncrossing(); k=2n, matching the existing perfect_matchings delta (sage parameterizes by ground-set size, ours by pair-count)'),
  ('collection','ternary_gray_codes','sage','sage.combinat.gray_codes.product([3]*n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/gray_codes.html','a SWITCH generator, not an element class (same pattern as gray_codes → product([2]*n)); product([3]*n) walks the reflected ternary Gray code = our carrier'),
  ('collection','self_conjugate_partitions','sage','sage.combinat.partition.Partition.conjugate','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/partition.html','no dedicated self-conjugate filter in Partitions() — our collection is the fixed points of the conjugate() involution on Partitions(n)'),
  ('collection','fubini_numbers','sage','OrderedSetPartitions(n)','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/set_partition_ordered.html','no dedicated fubini/ordered-Bell function in sage — a(n) = OrderedSetPartitions(n).cardinality()'),
  ('collection','even_permutations','sage','sage.groups.perm_gps.permgroup_named.AlternatingGroup(n)','https://doc.sagemath.org/html/en/reference/groups/sage/groups/perm_gps/permgroup_named.html','a GROUP object (order n!/2), not a plain combinatorial class — the underlying permutation set is our collection'),
  ('collection','permutations_avoiding_123','sage','Permutations(n, avoiding=[1,2,3])','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html',''),
  ('collection','permutations_avoiding_132','sage','Permutations(n, avoiding=[1,3,2])','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html',''),
  ('collection','permutations_avoiding_213','sage','Permutations(n, avoiding=[2,1,3])','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html',''),
  ('collection','permutations_avoiding_231','sage','Permutations(n, avoiding=[2,3,1])','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html',''),
  ('collection','permutations_avoiding_312','sage','Permutations(n, avoiding=[3,1,2])','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html',''),
  ('collection','permutations_avoiding_321','sage','Permutations(n, avoiding=[3,2,1])','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/permutation.html',''),
  ('collection','syt_two_row','sage','sage.combinat.tableau.StandardTableaux','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/tableau.html','sage''s StandardTableaux(shape) takes ONE partition; ours unions every ≤2-row shape at fixed n — Σ_{a=⌈n/2⌉}^{n} StandardTableaux([a, n−a])'),
  ('collection','syt_two_column','sage','sage.combinat.tableau.StandardTableaux','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/tableau.html','the conjugate family of syt_two_row — unions StandardTableaux(λ) over every ≤2-column shape λ at fixed n, one shape at a time in sage'),
  ('collection','syt_hook_shape','sage','sage.combinat.tableau.StandardTableaux','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/tableau.html','sage''s StandardTableaux(shape) takes ONE partition; ours unions every hook shape (a,1ᵇ) at fixed n — Σ_{b=0}^{n−1} StandardTableaux([n−b] ++ [1]*b)'),
  ('collection','standard_tableau_pairs','sage','sage.combinat.rsk.RSK','https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/rsk.html','RSK(σ, check_standard=True) maps a permutation to its (P,Q) SYT pair; our collection is that map''s codomain at fixed n — every same-shape SYT pair, the image of RSK over Permutations(n)');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','sage slice (#249): at least 85 collections now carry a verified sage pointer','eq','true','floor not exact pin — the batch may grow later',$q$
    SELECT (count(DISTINCT subject) >= 85)::text FROM base_reference WHERE subject_kind='collection' AND system='sage' $q$),
  ('references','derangements resolves a sage pointer (Derangements(n))','eq','sage:Derangements(n)','a core collection that was mathlib/wikipedia-only now carries a sage anchor',$q$
    SELECT system||':'||identity FROM base_reference WHERE subject='derangements' AND system='sage' $q$),
  ('references','the six pattern-avoiding permutation families each resolve a sage Permutations(n, avoiding=...) pointer','eq','6','one row per pattern, all under sage.combinat.permutation',$q$
    SELECT count(*)::text FROM base_reference WHERE system='sage' AND subject LIKE 'permutations_avoiding_%' $q$),
  ('references','every sage base_reference row added in this slice carries a resolved url','eq','0','no NEW sage pointer left url-less (older tail-enrichment rows keep 3 pre-existing NULLs, untouched here)',$q$
    SELECT count(*)::text FROM base_reference WHERE system='sage' AND url IS NULL
      AND subject IN ('derangements','k_subsets','baxter_permutations','cyclic_permutations','lyndon_words',
        'non_crossing_matchings','ternary_gray_codes','self_conjugate_partitions','fubini_numbers','even_permutations',
        'permutations_avoiding_123','permutations_avoiding_132','permutations_avoiding_213','permutations_avoiding_231',
        'permutations_avoiding_312','permutations_avoiding_321','syt_two_row','syt_two_column','syt_hook_shape',
        'standard_tableau_pairs') $q$);

-- ── multiset operation anchors (issue #18): the lifted Multiset notation layer's ops → Mathlib.Data.Multiset ──
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('operation','multiset_add', 'mathlib4','Multiset.instAdd','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Multiset/Defs.html','additive union s + t: multiplicities add'),
  ('operation','multiset_card','mathlib4','Multiset.card',   'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Multiset/Defs.html',''),
  ('operation','multiset_mem', 'mathlib4','Multiset.Mem',    'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Multiset/Defs.html','e ∈ s'),
  ('operation','multiset_le',  'mathlib4','Multiset.instLE', 'https://leanprover-community.github.io/mathlib4_docs/Mathlib/Data/Multiset/Defs.html','sub-multiset order a ≤ b');

-- relation backfill (issue: fubini_numbers → sage OrderedSetPartitions(n) read like an isomorphism but is only a
-- cardinality coincidence; a handful of other sage rows are a predicate FILTER on a bigger sage class, not the
-- class itself — neither shape should read with the same authority as a genuine order-isomorphism like
-- set_compositions → OrderedSetPartitions(n)). wikipedia rows are all soft/grounding, not structural claims.
UPDATE base_reference SET relation = 'conceptual' WHERE system = 'wikipedia';
UPDATE base_reference SET relation = 'aggregate'  WHERE subject = 'fubini_numbers' AND system = 'sage';
UPDATE base_reference SET relation = 'partial'    WHERE system = 'sage' AND subject IN
  ('non_crossing_partitions','non_nesting_partitions','non_crossing_matchings','self_conjugate_partitions','even_permutations');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','every base_reference.system is a known system','eq','0','system ∈ {mathlib4, sage, oeis, wolfram, sympy, findstat, wikipedia, matlab} — no stray backends creep in',$q$
    SELECT count(*)::text FROM base_reference WHERE system NOT IN ('mathlib4','sage','oeis','wolfram','sympy','findstat','wikipedia','matlab') $q$),
  ('references','every base_reference.relation is a known relation','eq','0','relation ∈ {isomorphic, partial, aggregate, conceptual}',$q$
    SELECT count(*)::text FROM base_reference WHERE relation NOT IN ('isomorphic','partial','aggregate','conceptual') $q$),
  ('references','fubini_numbers → sage OrderedSetPartitions(n) is an aggregate coincidence, not an isomorphism','eq','aggregate','a(n) = OrderedSetPartitions(n).cardinality(), unlike the genuine order-isomorphism set_compositions → OrderedSetPartitions(n)',$q$
    SELECT relation FROM base_reference WHERE subject='fubini_numbers' AND system='sage' AND identity='OrderedSetPartitions(n)' $q$),
  ('references','set_compositions → sage OrderedSetPartitions(n) stays a genuine isomorphism','eq','isomorphic','the contrasting case to fubini_numbers — same sage class, a real order-isomorphism this time',$q$
    SELECT relation FROM base_reference WHERE subject='set_compositions' AND system='sage' AND identity='OrderedSetPartitions(n)' $q$),
  ('references','no base_reference row has an empty identity','eq','0','the hard pointer is never blank',$q$
    SELECT count(*)::text FROM base_reference WHERE identity IS NULL OR btrim(identity) = '' $q$),
  ('references','the #24 tail enrichment anchors abundant_numbers at mathlib (Nat.Abundant)','eq','mathlib4:Nat.Abundant','a number-set collection that was OEIS-only now carries a proof-library pointer',$q$
    SELECT system||':'||identity FROM base_reference WHERE subject='abundant_numbers' AND system='mathlib4' $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','the finset mold points at mathlib Finset','eq','Finset','construction → alternate implementation',$q$
    SELECT identity FROM base_reference WHERE subject_kind='construction' AND subject='finset' AND system='mathlib4' $q$),
  ('references','subsets has BOTH a mathlib and a sage pointer','eq','mathlib4:Finset (Fin n)|sage:Subsets(n)','hard pointers to alternate implementations',$q$
    SELECT (SELECT system||':'||identity FROM base_reference WHERE subject='subsets' AND system='mathlib4') || '|' ||
           (SELECT system||':'||identity FROM base_reference WHERE subject='subsets' AND system='sage') $q$),
  ('references','deltas are recorded where the alternate does NOT match exactly','eq','true','the near-misses carry a mapping delta (containment — the delta set grows as pointers are enriched)',$q$
    SELECT (EXISTS (SELECT 1 FROM base_reference WHERE subject_kind='collection' AND subject='compositions_into_k_parts' AND system='mathlib4' AND delta <> '')
        AND EXISTS (SELECT 1 FROM base_reference WHERE subject_kind='collection' AND subject='standard_tableaux'          AND system='mathlib4' AND delta <> ''))::text $q$),
  ('references','enrichment landed: a collection with only a header hint now resolves (dyck_paths → catalan / DyckWords(n))','eq','mathlib4:catalan|sage:DyckWords(n)','harvested pointers, deduped + verified',$q$
    SELECT (SELECT system||':'||identity FROM base_reference WHERE subject='dyck_paths' AND system='mathlib4') || '|' ||
           (SELECT system||':'||identity FROM base_reference WHERE subject='dyck_paths' AND system='sage') $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','wikipedia slice (#249): at least 25 collections now carry a verified wikipedia pointer','eq','true','floor not exact pin — the batch may grow later',$q$
    SELECT (count(*) >= 25)::text FROM base_reference WHERE subject_kind='collection' AND system='wikipedia' $q$),
  ('references','every wikipedia base_reference row carries a resolved url','eq','0','no wikipedia pointer left url-less',$q$
    SELECT count(*)::text FROM base_reference WHERE system='wikipedia' AND url IS NULL $q$),
  ('references','permutations resolves a wikipedia pointer','eq','wikipedia:Permutation','the clearest core collection now has all three systems represented (sage/mathlib pending elsewhere in #249)',$q$
    SELECT system||':'||identity FROM base_reference WHERE subject='permutations' AND system='wikipedia' $q$);

-- ── mathlib4 pointers (issue #249, mathlib4 slice, 2026-09-03 — final slice, completing #249): existing collections
-- with a genuine Mathlib4 declaration that had NO mathlib reference yet. Each identity WebFetch-verified against the
-- live mathlib4_docs page (declaration exists with the stated name/signature) — mathlib's combinatorial-collection
-- coverage is thin, so this batch leans on number-theory predicates/functions that resolve exactly or via a counting
-- formula (same discipline as the existing tail-enrichment deltas). Skipped as unconfirmable: mersenne (no dedicated
-- MersennePrime predicate beyond Nat.Prime∘mersenne — used anyway, see delta), practical/arithmetic numbers, twin/
-- cousin/sexy/circular/emirp/palindromic/lucky/giuga/smith primes, amicable/happy/automorphic/kaprekar/untouchable/
-- narcissistic/idoneal/superabundant numbers, all figurate-number families (triangular/pronic/star/pyramidal/etc —
-- no named mathlib declaration), Delannoy/Schroeder/Motzkin path families, Stern's diatomic sequence (no Nat.stern in
-- mathlib4), Sophie Germain primes (only a ring-identity theorem shares the name, not a primality predicate),
-- perfect_matchings (SimpleGraph.Subgraph.IsPerfectMatching is graph-general, not a match for the K_2n carrier), and
-- involutions (Function.Involutive is generic, no permutation-specific declaration).
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('collection','derangements','mathlib4','derangements (Fin n)','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Derangements/Basic.html','exact: derangements α : Set (Equiv.Perm α), the permutations with no fixed point'),
  ('collection','carmichael_numbers','mathlib4','Nat.IsCarmichael','https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/CarmichaelNumber.html','exact: composite, squarefree, satisfies Korselt''s criterion — same predicate we implement'),
  ('collection','weird_numbers','mathlib4','Nat.Weird','https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/FactorisationProperties.html','exact: abundant and not pseudoperfect'),
  ('collection','semiperfect_numbers','mathlib4','Nat.Pseudoperfect','https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/FactorisationProperties.html','pseudoperfect is mathlib''s name for the semiperfect concept — same predicate (some subset of proper divisors sums to n)'),
  ('collection','primorial_numbers','mathlib4','Nat.primorial','https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/Primorial.html','mathlib''s primorial n = product of primes ≤ n (indexed by bound); ours is indexed by rank r = product of the FIRST r primes (A002110) — they agree at n = the r-th prime'),
  ('collection','mersenne_primes','mathlib4','mersenne','https://leanprover-community.github.io/mathlib4_docs/Mathlib/NumberTheory/LucasLehmer.html','mersenne p = 2^p − 1 is the number-family function, not a MersennePrime type; ours is the sub-sequence where Nat.Prime (mersenne p) holds'),
  ('collection','k_cycle_permutations','mathlib4','Nat.stirlingFirst','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Stirling.html','counting formula only — Nat.stirlingFirst n k = c(n,k), the unsigned Stirling number of the first kind; our fiber is the actual permutations with k cycles, mathlib''s is just their count'),
  ('collection','set_partitions_into_k_blocks','mathlib4','Nat.stirlingSecond','https://leanprover-community.github.io/mathlib4_docs/Mathlib/Combinatorics/Enumerative/Stirling.html','counting formula only — Nat.stirlingSecond n k = S(n,k); our fiber is the actual RGS partitions into k blocks, mathlib''s is just their count');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('references','mathlib4 slice (#249, final): at least 8 collections now carry a verified mathlib4 pointer beyond the pre-existing set','eq','true','floor not exact pin — the batch may grow later',$q$
    SELECT (count(*) >= 8)::text FROM base_reference WHERE subject_kind='collection' AND system='mathlib4'
      AND subject IN ('derangements','carmichael_numbers','weird_numbers','semiperfect_numbers','primorial_numbers','mersenne_primes','k_cycle_permutations','set_partitions_into_k_blocks') $q$),
  ('references','every mathlib4 pointer added in this slice carries a resolved url','eq','0','no NEW mathlib4 pointer left url-less',$q$
    SELECT count(*)::text FROM base_reference WHERE system='mathlib4' AND url IS NULL
      AND subject IN ('derangements','carmichael_numbers','weird_numbers','semiperfect_numbers','primorial_numbers','mersenne_primes','k_cycle_permutations','set_partitions_into_k_blocks') $q$),
  ('references','carmichael_numbers resolves an exact mathlib4 predicate (Nat.IsCarmichael)','eq','mathlib4:Nat.IsCarmichael','a number-set collection that was OEIS-only now carries a proof-library pointer',$q$
    SELECT system||':'||identity FROM base_reference WHERE subject='carmichael_numbers' AND system='mathlib4' $q$),
  ('references','weird_numbers and semiperfect_numbers both resolve to FactorisationProperties, partitioning the abundant numbers','eq','Nat.Weird|Nat.Pseudoperfect','the two collections our header notes as partitioning the abundant numbers both landed a mathlib pointer',$q$
    SELECT (SELECT identity FROM base_reference WHERE subject='weird_numbers' AND system='mathlib4') || '|' ||
           (SELECT identity FROM base_reference WHERE subject='semiperfect_numbers' AND system='mathlib4') $q$);
