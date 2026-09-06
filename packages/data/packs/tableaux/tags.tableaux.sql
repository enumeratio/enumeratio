-- requires: tags
-- tableaux half of sqlsrc/tags.sql's editorial collection→tag rows (#283 phase 3 lane 2 extraction) — split out
-- because base_collection_tag does not filter to existing base_collection rows: an orphaned row here would break
-- the count-cache guard (meta-collections.stats.sql) under core alone, same bug the polytopes/number-sets/
-- partitions-plus/permutations-plus/paths/trees-graphs extractions hit. Tag DEFINITIONS (base_tag) stay core; only
-- the per-collection assignment rows for this pack's collections move.

INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  ('permutation', 'rook_placements'),
  ('tableau', 'semistandard_tableaux'), ('tableau', 'gelfand_tsetlin'),
  ('tableau', 'syt_two_row'), ('tableau', 'syt_two_column'), ('tableau', 'syt_hook_shape'),
  ('matrix', 'alternating_sign_matrices')
) AS a(tag, collection);
