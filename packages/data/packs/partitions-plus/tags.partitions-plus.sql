-- requires: tags
-- partitions-plus half of sqlsrc/tags.sql's editorial collection→tag rows (#283 phase 3 extraction) — split out
-- because base_collection_tag does not filter to existing base_collection rows: an orphaned row here would
-- break the count-cache guard (meta-collections.stats.sql) under core alone, same bug the polytopes/number-sets
-- extractions hit (see packs/polytopes/tags.polytopes.sql / packs/number-sets/tags.number-sets.sql for the
-- precedent). Tag DEFINITIONS (base_tag) stay core; only the per-collection assignment rows for this pack's
-- collections move.

INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  ('partition', 'distinct_partitions'), ('partition', 'odd_partitions'),
  ('partition', 'self_conjugate_partitions'), ('partition', 'bounded_part_partitions'), ('partition', 'box_confined_partitions'), ('partition', 'k_part_partitions'),
  ('partition', 'largest_part_partitions'), ('partition', 'core_partitions'), ('partition', 'plane_partitions'),
  ('partition', 'boxed_plane_partitions'),
  ('partition', 'skew_partitions'), ('partition', 'square_partitions'), ('partition', 'triangular_partitions'),
  ('partition', 'multiplicative_partitions'),
  ('partition', 'prime_partition'),
  ('combinatorial', 'ordered_factorizations'),
  ('set_partition', 'partition_algebra')
) AS a(tag, collection);
