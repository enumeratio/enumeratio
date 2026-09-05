-- requires: self_conjugate_partitions, integer_partitions.rank_crank, realizer, utilities
-- self_conjugate_partitions statistics — NOT new registrations: this collection shares the integer_partition
-- carrier with integer_partitions, so base_stat_resolved (catalog-resolution.sql) already resolves every
-- carrier-typed integer_partitions stat here automatically (own=false) — an explicit base_stat row would be a
-- harmful duplicate (see grand_dyck_paths.stats.sql for the invariant this would break). Examples only. The
-- defining restriction forces the inherited `is_self_conjugate` stat to exactly 1 on every element — its
-- range collapses from 0/1 on the unrestricted parent down to the single value 1 here.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('self_conjugate_partitions','the integer_partitions stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees crank on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'self_conjugate_partitions' AND stat_id = 'crank' AND NOT own)::text $q$),
  ('self_conjugate_partitions','largest_part/length/durfee_square on 4+2+1+1 (n=8, a self-conjugate partition)','eq','4|4|2','carrier-typed partition_ stat fns run on a self_conjugate_partitions element',$q$
    SELECT partition_largest(ROW(ARRAY[4,2,1,1])::integer_partition)::text || '|' ||
           partition_length(ROW(ARRAY[4,2,1,1])::integer_partition)::text || '|' ||
           partition_durfee_square(ROW(ARRAY[4,2,1,1])::integer_partition)::text $q$),
  ('self_conjugate_partitions','the inherited is_self_conjugate stat is forced to 1 on every element — the defining restriction, not a coincidence','eq','true','sibling-specific range collapse: is_self_conjugate is 0/1 on integer_partitions but identically 1 here',$q$
    SELECT bool_and(partition_is_self_conjugate_stat((e).value) = 1)::text FROM generate_series(0,9) n, LATERAL elements(self_conjugate_partitions(n)) e $q$);
