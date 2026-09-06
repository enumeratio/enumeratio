-- requires: generating_functions, distinct_partitions
-- distinct_partitions is NOT a species (#274) — its counting sequence q(n) is the rational-free product ∏(1+q^k),
-- an ogf, re-filed to base_generating_function like the other number sequences. #283 phase 3 made distinct_partitions
-- a partitions-plus-pack collection, so its ogf row lives here (a core file can't reference a pack collection); the
-- gf_distinct_partition_ogf builder stays in core generating_functions.sql. Named explicitly in requires because
-- distinct_partitions is realized via base_restrict (no literal base_collection tag for requires-tag to pull in).
INSERT INTO base_generating_function (collection, stat_id, kind, builder, arity, note, findstat, num, den) VALUES
  ('distinct_partitions', NULL, 'ogf', 'gf_distinct_partition_ogf', 1, '∏_{k≥1} (1+q^k) — partitions into distinct parts; q(n) (not a species, #274)', NULL, NULL, NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('generating_functions','∏(1+q^k) IS the distinct-partition-counting ogf: coefficients == |distinct_partitions(m)| for m=0..6 (#274: re-filed off base_species, not a species)','eq','true','the ogf differential against cardinality',$q$
    SELECT gf_agrees('distinct_partitions',NULL,6)::text $q$);
