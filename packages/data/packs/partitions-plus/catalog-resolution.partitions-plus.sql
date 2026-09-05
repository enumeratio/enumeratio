-- requires: catalog-resolution, square_partitions
-- partitions-plus half of sqlsrc/catalog-resolution.sql's carrier-inheritance examples (#283 phase 3 extraction) —
-- square_partitions inherits its integer_partition-carrier stats for free (own = false).

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('catalog','square_partitions inherits the integer_partition stats (all marked inherited)','eq','true|false','any resolved stats (a floor — the carrier may gain more) | any own?',$q$
    SELECT (SELECT count(*) > 0 FROM base_stat_resolved WHERE collection = 'square_partitions')::text || '|' ||
           (SELECT bool_or(own)::text FROM base_stat_resolved WHERE collection = 'square_partitions') $q$);
