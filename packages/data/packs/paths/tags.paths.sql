-- requires: tags
-- paths half of sqlsrc/tags.sql's editorial collection→tag rows (#283 phase 3 extraction) — split out because
-- base_collection_tag does not filter to existing base_collection rows: an orphaned row here would break the
-- count-cache guard (meta-collections.stats.sql) under core alone, same bug the polytopes/number-sets/
-- partitions-plus/permutations-plus extractions hit. Tag DEFINITIONS (base_tag) stay core; only the
-- per-collection assignment rows for this pack's collections move.

INSERT INTO base_collection_tag_manual (tag, collection)
SELECT tag, collection FROM (VALUES
  ('path', 'k_dyck_paths'), ('path', 'motzkin_paths'), ('path', 'k_motzkin_paths'), ('path', 'colored_motzkin_paths'),
  ('path', 'schroeder_paths'), ('path', 'delannoy_paths'), ('path', 'riordan_paths'), ('path', 'ballot_sequences')
) AS a(tag, collection);
