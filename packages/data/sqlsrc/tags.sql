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
INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  -- figurate
  ('figurate', 'triangular_numbers'), ('figurate', 'square_numbers'), ('figurate', 'pentagonal_numbers'),
  ('figurate', 'hexagonal_numbers'), ('figurate', 'heptagonal_numbers'), ('figurate', 'octagonal_numbers'),
  ('figurate', 'centered_triangular_numbers'), ('figurate', 'centered_square_numbers'), ('figurate', 'centered_hexagonal_numbers'),
  ('figurate', 'star_numbers'), ('figurate', 'pronic_numbers'), ('figurate', 'cube_numbers'),
  ('figurate', 'tetrahedral_numbers'), ('figurate', 'square_pyramidal_numbers'), ('figurate', 'pentatope_numbers'),
  -- primes
  ('prime_family', 'prime_numbers'), ('prime_family', 'twin_primes'), ('prime_family', 'cousin_primes'),
  ('prime_family', 'sexy_primes'), ('prime_family', 'safe_primes'), ('prime_family', 'sophie_germain_primes'),
  ('prime_family', 'semiprime_numbers'), ('prime_family', 'squarefree_semiprimes'), ('prime_family', 'k_almost_primes'),
  ('prime_family', 'prime_power_numbers'), ('prime_family', 'primorial_numbers'),
  -- factorization shape
  ('factorization', 'semiprime_numbers'), ('factorization', 'squarefree_semiprimes'), ('factorization', 'sphenic_numbers'),
  ('factorization', 'square_free_numbers'), ('factorization', 'powerful_numbers'), ('factorization', 'perfect_power_numbers'),
  ('factorization', 'achilles_numbers'), ('factorization', 'prime_power_numbers'), ('factorization', 'k_almost_primes'),
  ('factorization', 'integer_factorizations'),
  -- divisor sums
  ('divisor', 'abundant_numbers'), ('divisor', 'deficient_numbers'), ('divisor', 'perfect_numbers'),
  ('divisor', 'amicable_numbers'), ('divisor', 'practical_numbers'), ('divisor', 'arithmetic_numbers'),
  -- recurrences
  ('recurrence', 'fibonacci_numbers'), ('recurrence', 'lucas_numbers'), ('recurrence', 'pell_numbers'),
  ('recurrence', 'jacobsthal_numbers'), ('recurrence', 'padovan_sequence'), ('recurrence', 'perrin_sequence'),
  ('recurrence', 'tribonacci_numbers'), ('recurrence', 'stern_diatomic_sequence'),
  -- counting sequences
  ('counting_sequence', 'catalan_numbers'), ('counting_sequence', 'bell_numbers'), ('counting_sequence', 'motzkin_numbers'),
  ('counting_sequence', 'schroeder_numbers'), ('counting_sequence', 'central_delannoy_numbers'),
  ('counting_sequence', 'partition_numbers'), ('counting_sequence', 'factorial_numbers'), ('counting_sequence', 'narayana_numbers'),
  ('counting_sequence', 'double_factorial_numbers'),
  -- digit-based
  ('digit_based', 'happy_numbers'), ('digit_based', 'kaprekar_numbers'), ('digit_based', 'narcissistic_numbers'),
  ('digit_based', 'automorphic_numbers'), ('digit_based', 'evil_numbers'), ('digit_based', 'odious_numbers'),
  ('digit_based', 'pernicious_numbers'), ('digit_based', 'smith_numbers'), ('digit_based', 'harshad_numbers'),
  ('digit_based', 'thue_morse_numbers'),
  -- other numbers
  ('number', 'rational_numbers'), ('number', 'cardinal_numbers'), ('number', 'integer_numbers'),
  ('number', 'gaussian_integers'), ('number', 'omega_ordinals'), ('modular', 'modular_residues'), ('modular', 'multicomplex_numbers'),
  ('number', 'fractional_numbers'), ('number', 'gaussian_rationals'), ('number', 'gaussian_fractionals'),
  -- partitions
  ('partition', 'integer_partitions'), ('partition', 'distinct_partitions'), ('partition', 'odd_partitions'),
  ('partition', 'self_conjugate_partitions'), ('partition', 'bounded_part_partitions'), ('partition', 'box_confined_partitions'), ('partition', 'k_part_partitions'),
  ('partition', 'largest_part_partitions'), ('partition', 'core_partitions'), ('partition', 'plane_partitions'),
  ('partition', 'boxed_plane_partitions'),
  ('partition', 'skew_partitions'), ('partition', 'square_partitions'), ('partition', 'triangular_partitions'),
  ('partition', 'multiplicative_partitions'),
  -- compositions
  ('composition', 'integer_compositions'), ('composition', 'compositions_into_k_parts'), ('composition', 'weak_compositions_into_k_parts'), ('composition', 'weak3_compositions'),
  ('composition', 'k_bounded_compositions'), ('composition', 'proper_compositions'), ('composition', 'odd_compositions'),
  ('composition', 'step_compositions'), ('composition', 'dyadic_compositions'), ('composition', 'carlitz_compositions'),
  ('composition', 'fibonacci_compositions'), ('composition', 'prime_compositions'), ('composition', 'tri_compositions'),
  ('composition', 'tetra_compositions'), ('composition', 'palindromic_compositions'),
  -- permutations
  ('permutation', 'permutations'), ('permutation', 'alternating_permutations'), ('permutation', 'grassmannian_permutations'), ('permutation', 'cograssmannian_permutations'), ('permutation', 'connected_permutations'), ('permutation', 'cyclic_permutations'), ('permutation', 'derangements'), ('permutation', 'permutations_avoiding_123'), ('permutation', 'permutations_avoiding_132'), ('permutation', 'permutations_avoiding_213'), ('permutation', 'permutations_avoiding_231'), ('permutation', 'permutations_avoiding_312'), ('permutation', 'permutations_avoiding_321'), ('permutation', 'vexillary_permutations'), ('permutation', 'separable_permutations'),
  ('permutation', 'involutions'), ('permutation', 'even_permutations'), ('permutation', 'affine_permutations'),
  ('permutation', 'decorated_permutations'), ('permutation', 'lehmer_codes'), ('permutation', 'rook_placements'),
  ('permutation', 'baxter_permutations'), ('permutation', 'simple_permutations'), ('permutation', 'non_crossing_permutations'),
  ('permutation', 'k_colored_permutations'), ('permutation', 'k_cycle_permutations'), ('permutation', 'k_descent_permutations'),
  -- lattice paths
  ('path', 'dyck_paths'), ('path', 'k_dyck_paths'), ('path', 'motzkin_paths'), ('path', 'k_motzkin_paths'), ('path', 'colored_motzkin_paths'), ('path', 'schroeder_paths'), ('path', 'delannoy_paths'),
  ('path', 'riordan_paths'), ('path', 'ballot_sequences'), ('path', 'narayana_numbers'),
  -- trees
  ('tree', 'binary_trees'), ('tree', 'ordered_trees'), ('tree', 'plane_trees'), ('tree', 'labeled_trees'), ('tree', 'labeled_forests'),
  -- tableaux
  ('tableau', 'standard_tableaux'), ('tableau', 'semistandard_tableaux'), ('tableau', 'gelfand_tsetlin'),
  -- words / strings
  ('word', 'words'), ('word', 'k_necklaces'), ('word', 'k_bracelets'), ('word', 'k_lyndon_words'), ('word', 'binary_words'), ('word', 'binary_palindromes'), ('word', 'primitive_binary_strings'), ('word', 'lyndon_words'), ('word', 'independent_sets_cycle'), ('word', 'binary_necklaces'), ('word', 'binary_bracelets'), ('word', 'gray_codes'), ('word', 'ascent_sequences'),
  ('word', 'restricted_growth_strings'),
  -- matchings
  ('matching', 'perfect_matchings'), ('matching', 'non_crossing_matchings'), ('matching', 'non_nesting_matchings'),
  -- set partitions
  ('set_partition', 'set_partitions'), ('set_partition', 'set_partitions_into_k_blocks'), ('set_partition', 'non_crossing_partitions'), ('set_partition', 'non_nesting_partitions'),
  ('set_partition', 'set_compositions'), ('set_partition', 'restricted_growth_strings'),
  -- selections
  ('selection', 'subsets'), ('selection', 'k_subsets'), ('selection', 'multisets'), ('selection', 'finsets'), ('selection', 'sparse_subsets'), ('selection', 'signed_subsets'), ('selection', 'arrangements'),
  -- polytope faces
  ('polytope', 'associahedron'), ('polytope', 'cross_polytope'), ('polytope', 'permutahedron'), ('polytope', 'dissections'),
  -- signed / symmetric
  ('symmetric', 'signed_permutations'), ('symmetric', 'signed_subsets'), ('symmetric', 'k_colored_permutations'),
  -- matrices
  ('matrix', 'alternating_sign_matrices'),
  -- functions
  ('function', 'endofunctions'), ('function', 'subexcedant_seqs'), ('function', 'surjections'), ('function', 'surjections_onto_k'), ('function', 'parking_functions'),
  ('function', 'non_decreasing_parking_functions'),
  -- misc combinatorial without a finer family
  ('combinatorial', 'ordered_factorizations'),
  -- internal machinery
  ('internal', 'glyphs'),
  -- the base object of the composition tower — the atoms of [n] (≅ the underlying set of ℤ/nℤ)
  ('combinatorial', 'finite_set_elements'),
  -- ── clean-batch port (numbers precursor) ──────────────────────────────────────────────────────────────
  ('permutation', 'boolean_permutations'), ('permutation', 'smooth_permutations'),
  ('word', 'fib_strings'), ('word', 'tri_strings'), ('word', 'lucas_strings'),
  ('tableau', 'syt_two_row'), ('tableau', 'syt_two_column'), ('tableau', 'syt_hook_shape'),
  ('partition', 'prime_partition'), ('composition', 'triangular_composition'),
  -- species notation
  ('species', 'singleton_species'),
  -- base_restrict / borrow-carrier ports (backlog #1)
  ('composition', 'zigzag_composition'),
  ('word', 'calkin_wilf_paths'), ('word', 'stern_brocot_paths'), ('word', 'hyperbinary_representations'), ('recurrence', 'hyperbinary_representations'), ('tree', 'prufer_sequences'),
  ('selection', 'boolean_algebra'), ('selection', 'simplex'), ('polytope', 'simplex'),
  ('set_partition', 'partition_algebra')
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
