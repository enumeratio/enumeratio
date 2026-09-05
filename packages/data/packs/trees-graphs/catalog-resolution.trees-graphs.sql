-- requires: catalog-resolution, non_crossing_partitions
-- trees-graphs half of sqlsrc/catalog-resolution.sql's carrier-inheritance examples (#283 phase 3 extraction) —
-- non_crossing_partitions inherits its set_partition-carrier stats + maps for free (own = false).

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('catalog','non_crossing_partitions inherits set_partitions stats + maps via the shared carrier','eq','true','resolved stats include blocks; resolved maps include shape',$q$
    SELECT (EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'non_crossing_partitions' AND stat_id = 'blocks') AND
            EXISTS (SELECT 1 FROM base_map_resolved WHERE collection = 'non_crossing_partitions' AND map_id = 'shape'))::text $q$);
