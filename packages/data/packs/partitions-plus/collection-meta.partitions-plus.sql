-- requires: collection-meta, odd_partitions, plane_partitions, boxed_plane_partitions
-- partitions-plus half of sqlsrc/collection-meta.sql's family-tree examples (#283 phase 3 extraction) — both
-- examples read base_collection_parent / base_collection for pack-owned collections.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('catalog','the family tree records specialization edges: odd_partitions restricts integer_partitions','eq','integer_partitions|is_odd_partition','base_restrict persists (parent, predicate) as data',$q$
    SELECT parent || '|' || predicate FROM base_collection_parent WHERE collection = 'odd_partitions' $q$),
  ('catalog','siblings share a carrier with NO restriction edge: plane_partitions / boxed_plane_partitions','eq','true','the shared carrier is their common ancestor, not a parent collection',$q$
    SELECT ((SELECT carrier FROM base_collection WHERE id='boxed_plane_partitions')
          = (SELECT carrier FROM base_collection WHERE id='plane_partitions')
       AND NOT EXISTS (SELECT 1 FROM base_collection_parent WHERE collection IN ('plane_partitions','boxed_plane_partitions')))::text $q$);
