-- requires: distinct_partitions, integer_partitions.rank_crank, realizer, utilities
-- distinct_partitions statistics — NOT new registrations: this collection shares the integer_partition carrier
-- with integer_partitions, so base_stat_resolved (catalog-resolution.sql) already resolves every carrier-typed
-- integer_partitions stat here automatically (own=false) — an explicit base_stat row would be a harmful
-- duplicate (see grand_dyck_paths.stats.sql for the invariant this would break). Examples only. The defining
-- restriction (no two parts equal) forces the inherited `multiplicity_of_largest_part` stat to exactly 1 on
-- every element — its range collapses from 1..length(v) on the unrestricted parent down to the single value 1
-- here (the largest part can never repeat when all parts are distinct).

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('distinct_partitions','the integer_partitions stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees hook_product on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'distinct_partitions' AND stat_id = 'hook_product' AND NOT own)::text $q$),
  ('distinct_partitions','largest_part/length/corners on 4+2 (n=6, a distinct-part partition)','eq','4|2|2','carrier-typed partition_ stat fns run on a distinct_partitions element',$q$
    SELECT partition_largest(ROW(ARRAY[4,2])::integer_partition)::text || '|' ||
           partition_length(ROW(ARRAY[4,2])::integer_partition)::text || '|' ||
           partition_distinct_parts(ROW(ARRAY[4,2])::integer_partition)::text $q$),
  ('distinct_partitions','the inherited multiplicity_of_largest_part stat is forced to 1 on every element — no part can repeat here','eq','true','sibling-specific range collapse: multiplicity ranges up on integer_partitions but is identically 1 here',$q$
    SELECT bool_and(partition_multiplicity_of_largest_part((e).value) = 1)::text FROM generate_series(1,10) n, LATERAL elements(distinct_partitions(n)) e $q$);
