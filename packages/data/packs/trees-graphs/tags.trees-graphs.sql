-- requires: tags
-- trees-graphs half of sqlsrc/tags.sql's editorial collection→tag rows (#283 phase 3 extraction) — split out
-- because base_collection_tag does not filter to existing base_collection rows: an orphaned row here would break
-- the count-cache guard (meta-collections.stats.sql) under core alone, same bug the polytopes/number-sets/
-- partitions-plus/permutations-plus/paths extractions hit. Tag DEFINITIONS (base_tag) stay core; only the
-- per-collection assignment rows for this pack's collections move.

INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  ('tree', 'ordered_trees'), ('tree', 'plane_trees'), ('tree', 'labeled_trees'), ('tree', 'labeled_forests'),
  ('tree', 'rooted_unlabeled_trees'), ('tree', 'prufer_sequences'),
  ('word', 'independent_sets_cycle'),
  ('matching', 'perfect_matchings'), ('matching', 'non_crossing_matchings'), ('matching', 'non_nesting_matchings'),
  ('set_partition', 'non_crossing_partitions'), ('set_partition', 'non_nesting_partitions'),
  ('polytope', 'dissections')
) AS a(tag, collection);
