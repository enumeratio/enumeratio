-- requires: realizer
-- The tag vocabulary + editorial collection→tag assignments + the read view. Tags are ORGANIZATIONAL buckets (the
-- family/kind a collection sits in) — the layer the categories.sql comment reserved. Distinct from base_trait
-- (capabilities a collection HAS): a tag is what a collection IS-A. `implies` closes the graph (figurate ⇒
-- integer_sequence ⇒ number; every fine combinatorial family ⇒ combinatorial), so a collection tagged with a leaf
-- surfaces under every ancestor too. integer_sequence/infinite are DERIVED from the carrier/unbounded; the rest are
-- editorial rows below. The explorer filters the collection list by these.

INSERT INTO base_tag (id, title, description, implies) VALUES
  -- roots + type
  ('number',            'Number',            'A kind of number.',                                                  '{}'),
  ('integer_sequence',  'Integer sequence',  'Elements are single integers — an OEIS-style sequence.',            '{number}'),
  ('infinite',          'Infinite',          'Unbounded: endlessly many elements.',                                '{}'),
  ('combinatorial',     'Combinatorial',     'A structured combinatorial object.',                                 '{}'),
  ('internal',          'Internal',          'Library machinery surfaced as a collection.',                        '{}'),
  -- number families
  ('figurate',          'Figurate',          'Counts dots in a geometric arrangement (polygonal, centered, pyramidal).', '{integer_sequence}'),
  ('prime_family',      'Primes',            'Defined by primality — primes and prime-configuration sequences.',   '{integer_sequence}'),
  ('factorization',     'Factorization',     'Defined by the shape of the prime factorization.',                   '{}'),
  ('divisor',           'Divisor sums',      'Defined by the divisor/aliquot sum σ(n).',                           '{integer_sequence}'),
  ('recurrence',        'Recurrence',        'Defined by a linear recurrence.',                                    '{integer_sequence}'),
  ('counting_sequence', 'Counting sequence', 'Counts a family of combinatorial objects.',                          '{}'),
  ('digit_based',       'Digit-based',       'Defined by a base-10 digit property.',                               '{integer_sequence}'),
  ('modular',           'Modular',           'Lives in the ring ℤ/nℤ.',                                            '{number}'),
  -- combinatorial families
  ('partition',         'Partitions',        'A partition of an integer into parts.',                              '{combinatorial}'),
  ('composition',       'Compositions',      'An ordered sum (composition) of an integer.',                        '{combinatorial}'),
  ('permutation',       'Permutations',      'A permutation or permutation class.',                                '{combinatorial}'),
  ('path',              'Lattice paths',     'A lattice path (Dyck, Motzkin, Schröder, …).',                       '{combinatorial}'),
  ('tree',              'Trees',             'A tree or forest.',                                                  '{combinatorial}'),
  ('tableau',           'Tableaux',          'A Young tableau or Gelfand–Tsetlin pattern.',                        '{combinatorial}'),
  ('word',              'Words',             'A word or string over an alphabet.',                                 '{combinatorial}'),
  ('matching',          'Matchings',         'A matching / chord diagram.',                                        '{combinatorial}'),
  ('set_partition',     'Set partitions',    'A partition of a set into blocks (ordered or not).',                 '{combinatorial}'),
  ('selection',         'Selections',        'A selection from an alphabet — subset, word, arrangement.',          '{combinatorial}'),
  ('polytope',          'Polytopes',         'Elements are the faces of a polytope.',                              '{combinatorial}'),
  ('symmetric',         'Signed & symmetric','A signed (type B / hyperoctahedral) object.',                        '{combinatorial}'),
  ('matrix',            'Matrices',          'Elements are matrices.',                                             '{combinatorial}'),
  ('function',          'Functions',         'Elements are functions.',                                            '{combinatorial}'),
  ('species',           'Species',           'A combinatorial species read in atomic (E/X/C/L) notation.',         '{combinatorial}');

-- collection → tag (editorial). Leaf tags only; ancestors follow from `implies` in the view. integer_sequence and
-- infinite are NOT listed — they derive from carrier='numeric' / unbounded.
-- The figurate/prime_family/factorization/divisor/digit_based rows for number-sets collections live in
-- packs/number-sets/tags.number-sets.sql (#283 phase 3 extraction) — base_collection_tag does not filter to
-- existing base_collection rows, so an orphaned row here would break the count-cache guard under core alone
-- (the same bug the polytopes extraction hit — see meta-collections.stats.sql). Same reason the permutation/
-- symmetric/function/clean-batch rows for permutations-plus collections live in
-- packs/permutations-plus/tags.permutations-plus.sql.
INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  -- figurate (core-owned members only)
  ('figurate', 'triangular_numbers'), ('figurate', 'square_numbers'), ('figurate', 'cube_numbers'),
  -- primes (core-owned members only)
  ('prime_family', 'prime_numbers'), ('prime_family', 'primorial_numbers'),
  -- factorization shape (core-owned members only)
  ('factorization', 'integer_factorizations'),
  -- recurrences
  ('recurrence', 'fibonacci_numbers'), ('recurrence', 'lucas_numbers'), ('recurrence', 'pell_numbers'),
  ('recurrence', 'jacobsthal_numbers'), ('recurrence', 'padovan_sequence'), ('recurrence', 'perrin_sequence'),
  ('recurrence', 'tribonacci_numbers'), ('recurrence', 'stern_diatomic_sequence'),
  -- counting sequences
  ('counting_sequence', 'catalan_numbers'), ('counting_sequence', 'bell_numbers'), ('counting_sequence', 'motzkin_numbers'),
  ('counting_sequence', 'schroeder_numbers'), ('counting_sequence', 'central_delannoy_numbers'),
  ('counting_sequence', 'partition_numbers'), ('counting_sequence', 'factorial_numbers'), ('counting_sequence', 'narayana_numbers'),
  ('counting_sequence', 'double_factorial_numbers'),
  -- other numbers
  ('number', 'rational_numbers'), ('number', 'cardinal_numbers'), ('number', 'integer_numbers'),
  ('number', 'gaussian_integers'), ('number', 'omega_ordinals'), ('modular', 'modular_residues'), ('modular', 'multicomplex_numbers'),
  ('number', 'fractional_numbers'), ('number', 'gaussian_rationals'), ('number', 'gaussian_fractionals'),
  -- partitions (the pack-owned partition families' tag rows moved to tags.partitions-plus.sql, #283)
  ('partition', 'integer_partitions'),
  -- compositions
  ('composition', 'integer_compositions'), ('composition', 'compositions_into_k_parts'), ('composition', 'weak_compositions_into_k_parts'), ('composition', 'weak3_compositions'),
  ('composition', 'k_bounded_compositions'), ('composition', 'proper_compositions'), ('composition', 'odd_compositions'),
  ('composition', 'step_compositions'), ('composition', 'dyadic_compositions'), ('composition', 'carlitz_compositions'),
  ('composition', 'fibonacci_compositions'), ('composition', 'prime_compositions'), ('composition', 'tri_compositions'),
  ('composition', 'tetra_compositions'), ('composition', 'palindromic_compositions'),
  -- permutations (core-owned members only — the rest are in packs/permutations-plus/tags.permutations-plus.sql;
  -- permutations_avoiding_*/vexillary_permutations/separable_permutations are base_restrict rows INSIDE
  -- pattern_avoiding_permutations.sql, which moved with that file, #283 phase 3)
  ('permutation', 'permutations'), ('permutation', 'derangements'),
  ('permutation', 'involutions'), ('permutation', 'even_permutations'),
  ('permutation', 'rook_placements'),
  -- lattice paths (core-owned members only — the rest are in packs/paths/tags.paths.sql, #283 phase 3)
  ('path', 'dyck_paths'), ('path', 'narayana_numbers'),
  -- trees
  ('tree', 'binary_trees'), ('tree', 'ordered_trees'), ('tree', 'plane_trees'), ('tree', 'labeled_trees'), ('tree', 'labeled_forests'), ('tree', 'rooted_unlabeled_trees'),
  -- tableaux
  ('tableau', 'standard_tableaux'), ('tableau', 'semistandard_tableaux'), ('tableau', 'gelfand_tsetlin'),
  -- words / strings
  ('word', 'words'), ('word', 'k_necklaces'), ('word', 'k_bracelets'), ('word', 'k_lyndon_words'), ('word', 'binary_words'), ('word', 'binary_palindromes'), ('word', 'primitive_binary_strings'), ('word', 'lyndon_words'), ('word', 'independent_sets_cycle'), ('word', 'binary_necklaces'), ('word', 'binary_bracelets'), ('word', 'gray_codes'), ('word', 'ascent_sequences'),
  ('word', 'restricted_growth_strings'),
  -- matchings
  ('matching', 'perfect_matchings'), ('matching', 'non_crossing_matchings'), ('matching', 'non_nesting_matchings'),
  -- set partitions
  ('set_partition', 'set_partitions'), ('set_partition', 'set_partitions_into_k_blocks'), ('set_partition', 'non_crossing_partitions'), ('set_partition', 'non_nesting_partitions'),
  ('set_partition', 'set_compositions'), ('set_partition', 'restricted_growth_strings'), ('set_partition', 'signed_set_compositions'),
  -- selections (arrangements moved to packs/permutations-plus/tags.permutations-plus.sql)
  ('selection', 'subsets'), ('selection', 'k_subsets'), ('selection', 'multisets'), ('selection', 'finsets'), ('selection', 'sparse_subsets'), ('selection', 'signed_subsets'),
  -- polytope faces (associahedron/cross_polytope/permutahedron moved to packs/polytopes/tags.polytopes.sql — #283
  -- phase 2.2, they're that pack's own collections; dissections stays here, it's core)
  ('polytope', 'dissections'),
  -- signed / symmetric (signed_permutations/k_colored_permutations moved to permutations-plus)
  ('symmetric', 'signed_subsets'), ('symmetric', 'signed_set_compositions'),
  -- matrices
  ('matrix', 'alternating_sign_matrices'),
  -- functions: entirely permutations-plus (endofunctions/subexcedant_seqs/surjections*/parking_functions*) — see
  -- packs/permutations-plus/tags.permutations-plus.sql
  -- ordered_factorizations is partitions-plus — see packs/partitions-plus/tags.partitions-plus.sql
  -- internal machinery
  ('internal', 'glyphs'),
  -- the base object of the composition tower — the atoms of [n] (≅ the underlying set of ℤ/nℤ)
  ('combinatorial', 'finite_set_elements'),
  -- ── clean-batch port (numbers precursor) ──────────────────────────────────────────────────────────────
  -- (boolean_permutations/smooth_permutations moved to packs/permutations-plus/tags.permutations-plus.sql)
  ('word', 'fib_strings'), ('word', 'tri_strings'), ('word', 'lucas_strings'),
  ('tableau', 'syt_two_row'), ('tableau', 'syt_two_column'), ('tableau', 'syt_hook_shape'),
  ('composition', 'triangular_composition'),
  -- species notation
  ('species', 'singleton_species'),
  -- base_restrict / borrow-carrier ports (backlog #1)
  ('composition', 'zigzag_composition'),
  ('tree', 'prufer_sequences'),
  -- simplex's tags moved to packs/polytopes/tags.polytopes.sql — #283 phase 2.2, it's that pack's own collection
  -- partition_algebra's tag row moved to tags.partitions-plus.sql — #283 phase 3, it's that pack's own collection
  ('selection', 'boolean_algebra')
) AS a(tag, collection);

-- collection → tag: the editorial rows ∪ the derived (carrier/unbounded) tags, closed transitively over implies.
CREATE VIEW base_collection_tag AS
WITH RECURSIVE seed(collection, tag) AS (
            SELECT collection, tag FROM base_collection_tag_manual
  UNION ALL SELECT id, 'integer_sequence' FROM base_collection WHERE carrier = 'numeric'
  UNION ALL SELECT id, 'infinite'         FROM base_collection WHERE unbounded
),
closure(collection, tag) AS (
  SELECT collection, tag FROM seed
  UNION
  SELECT cl.collection, i.imp
  FROM closure cl JOIN base_tag t ON t.id = cl.tag
       CROSS JOIN LATERAL unnest(t.implies) AS i(imp)
)
SELECT DISTINCT collection, tag FROM closure;
