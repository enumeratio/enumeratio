-- requires: tags
-- compositions-plus half of sqlsrc/tags.sql's editorial collection→tag rows (#283 phase 3 extraction) — split out
-- because base_collection_tag does not filter to existing base_collection rows: an orphaned row here would
-- break the count-cache guard (meta-collections.stats.sql) under core alone, same bug the polytopes/number-sets/
-- partitions-plus/permutations-plus/paths/tableaux/trees-graphs extractions hit. Tag DEFINITIONS (base_tag) stay
-- core; only the per-collection assignment rows for this pack's collections move.

INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  ('composition', 'compositions_into_k_parts'), ('composition', 'weak_compositions_into_k_parts'), ('composition', 'weak3_compositions'),
  ('composition', 'k_bounded_compositions'), ('composition', 'proper_compositions'), ('composition', 'odd_compositions'),
  ('composition', 'step_compositions'), ('composition', 'dyadic_compositions'), ('composition', 'carlitz_compositions'),
  ('composition', 'fibonacci_compositions'), ('composition', 'prime_compositions'), ('composition', 'tri_compositions'),
  ('composition', 'tetra_compositions'), ('composition', 'palindromic_compositions'),
  ('composition', 'triangular_composition'), ('composition', 'zigzag_composition'),
  ('set_partition', 'signed_set_compositions'), ('symmetric', 'signed_set_compositions')
) AS a(tag, collection);
