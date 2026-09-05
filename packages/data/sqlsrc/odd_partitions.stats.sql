-- requires: odd_partitions, integer_partitions.rank_crank, realizer, utilities
-- odd_partitions statistics — NOT new registrations: this collection shares the integer_partition carrier
-- with integer_partitions, so base_stat_resolved (catalog-resolution.sql) already resolves every carrier-typed
-- integer_partitions stat here automatically (own=false) — an explicit base_stat row would be a harmful
-- duplicate (see grand_dyck_paths.stats.sql for the invariant this would break). Examples only. The defining
-- restriction forces the inherited `even_parts` stat to exactly 0 on every element — every part is odd, so
-- there is nothing left for even_parts to count; its range collapses from 0..length(v) on the unrestricted
-- parent down to the single value 0 here.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('odd_partitions','the integer_partitions stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees odd_parts on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'odd_partitions' AND stat_id = 'odd_parts' AND NOT own)::text $q$),
  ('odd_partitions','largest_part/distinct_parts/odd_parts on 3+1+1 (n=5, an odd-part partition)','eq','3|2|3','carrier-typed partition_ stat fns run on an odd_partitions element',$q$
    SELECT partition_largest(ROW(ARRAY[3,1,1])::integer_partition)::text || '|' ||
           partition_distinct_parts(ROW(ARRAY[3,1,1])::integer_partition)::text || '|' ||
           partition_odd_parts(ROW(ARRAY[3,1,1])::integer_partition)::text $q$),
  ('odd_partitions','the inherited even_parts stat is forced to 0 on every element — the defining restriction, not a coincidence','eq','true','sibling-specific range collapse: even_parts ranges up on integer_partitions but is identically 0 here',$q$
    SELECT bool_and(partition_even_parts((e).value) = 0)::text FROM generate_series(0,10) n, LATERAL elements(odd_partitions(n)) e $q$);
