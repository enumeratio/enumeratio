-- requires: tags
-- permutations-plus half of sqlsrc/tags.sql's editorial collection→tag rows (#283 phase 3 extraction) — split
-- out because base_collection_tag does not filter to existing base_collection rows: an orphaned row here would
-- break the count-cache guard (meta-collections.stats.sql) under core alone, same bug the polytopes/number-sets
-- extractions hit (see packs/number-sets/tags.number-sets.sql for the precedent). Tag DEFINITIONS (base_tag)
-- stay core; only the per-collection assignment rows for permutations-plus collections move.

INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  -- permutation family (permutations_avoiding_*/vexillary_permutations/separable_permutations are base_restrict
  -- rows INSIDE pattern_avoiding_permutations.sql, sharing this pack via that file)
  ('permutation', 'permutations_avoiding_123'), ('permutation', 'permutations_avoiding_132'),
  ('permutation', 'permutations_avoiding_213'), ('permutation', 'permutations_avoiding_231'),
  ('permutation', 'permutations_avoiding_312'), ('permutation', 'permutations_avoiding_321'),
  ('permutation', 'vexillary_permutations'), ('permutation', 'separable_permutations'),
  ('permutation', 'alternating_permutations'), ('permutation', 'grassmannian_permutations'),
  ('permutation', 'cograssmannian_permutations'), ('permutation', 'connected_permutations'),
  ('permutation', 'cyclic_permutations'), ('permutation', 'affine_permutations'),
  ('permutation', 'decorated_permutations'), ('permutation', 'lehmer_codes'),
  ('permutation', 'baxter_permutations'), ('permutation', 'simple_permutations'),
  ('permutation', 'non_crossing_permutations'), ('permutation', 'k_colored_permutations'),
  ('permutation', 'k_cycle_permutations'), ('permutation', 'k_descent_permutations'),
  ('permutation', 'boolean_permutations'), ('permutation', 'smooth_permutations'),
  -- selections
  ('selection', 'arrangements'),
  -- signed / symmetric
  ('symmetric', 'signed_permutations'), ('symmetric', 'k_colored_permutations'),
  -- functions
  ('function', 'endofunctions'), ('function', 'subexcedant_seqs'), ('function', 'surjections'),
  ('function', 'surjections_onto_k'), ('function', 'parking_functions'), ('function', 'non_decreasing_parking_functions')
) AS a(tag, collection);
