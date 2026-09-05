-- requires: integer_partitions.rank_crank, distinct_partitions, self_conjugate_partitions, square_partitions, triangular_partitions, bounded_part_partitions, largest_part_partitions, box_confined_partitions, k_part_partitions, realizer, utilities
-- partitions_restrictions — NOT new stats: every sibling collection below shares the integer_partition carrier
-- with integer_partitions, and base_stat_resolved (catalog-resolution.sql) already resolves ANY carrier-typed
-- stat for every collection sharing that carrier — see the existing 'square_partitions inherits the
-- integer_partition stats' catalog example. Registering these directly in base_stat would be a harmful
-- DUPLICATE (it flips `own` to true and breaks that very invariant — caught the hard way while drafting this
-- file). So this file adds NO base_stat rows, only examples that exercise the classic partition stats (length,
-- largest_part, distinct_parts, durfee_square, Dyson rank, Andrews-Garvan crank, is_self_conjugate) on each
-- sibling's own restricted floor, confirming both that they resolve there and that their defining invariants hold.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('distinct_partitions','the integer_partitions stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees dyson_rank on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'distinct_partitions' AND stat_id = 'dyson_rank' AND NOT own)::text $q$),
  ('distinct_partitions','dyson_rank = largest_part − length over the floor at n=9 (identity, not a memorized value)','eq','true','rank is DEFINED this way; exercised on the restricted floor via the inherited stat',$q$
    SELECT bool_and(partition_dyson_rank((e).value) = partition_largest((e).value) - partition_length((e).value))::text
      FROM elements(distinct_partitions(9)) e $q$),

  ('self_conjugate_partitions','is_self_conjugate is identically 1 over the whole floor at n=9 (the defining restriction)','eq','true','every element of this collection IS self-conjugate, by construction',$q$
    SELECT bool_and(partition_is_self_conjugate_stat((e).value) = 1)::text FROM elements(self_conjugate_partitions(9)) e $q$),
  ('self_conjugate_partitions','a self-conjugate partition has length = largest_part, over the floor at n=9','eq','true','conjugation swaps rows/columns; self-conjugate ⇒ the diagram is symmetric, so #rows = #columns',$q$
    SELECT bool_and(partition_length((e).value) = partition_largest((e).value))::text FROM elements(self_conjugate_partitions(9)) e $q$),

  ('square_partitions','distinct_parts ≤ length always, over the floor at n=30','eq','true','distinct part SIZES can never exceed the number of parts',$q$
    SELECT bool_and(partition_distinct_parts((e).value) <= partition_length((e).value))::text FROM elements(square_partitions(30)) e $q$),

  ('triangular_partitions','distinct_parts ≤ length always, over the floor at n=15','eq','true','distinct part SIZES can never exceed the number of parts',$q$
    SELECT bool_and(partition_distinct_parts((e).value) <= partition_length((e).value))::text FROM elements(triangular_partitions(15)) e $q$),

  ('bounded_part_partitions','every part is ≤ k, so largest_part ≤ k over fiber [8,3]','eq','true','the defining bound, cross-checked via the inherited largest_part stat',$q$
    SELECT bool_and(partition_largest((e).value) <= 3)::text FROM elements(bounded_part_partitions(8,3)) e $q$),

  ('largest_part_partitions','largest_part is identically m over fiber [8,3] (the defining axis)','eq','true','cross-checked via the inherited largest_part stat',$q$
    SELECT bool_and(partition_largest((e).value) = 3)::text FROM elements(largest_part_partitions(8,3)) e $q$),

  ('box_confined_partitions','every part is ≤ max_part and there are ≤ parts of them, over fiber [3,4] (3 parts, box height 4)','eq','true','the defining box, cross-checked via inherited length/largest_part',$q$
    SELECT bool_and(partition_length((e).value) <= 3 AND partition_largest((e).value) <= 4)::text
      FROM elements(box_confined_partitions(3,4)) e $q$),

  ('k_part_partitions','length is identically k over fiber [8,3] (the defining axis)','eq','true','cross-checked via the inherited length stat',$q$
    SELECT bool_and(partition_length((e).value) = 3)::text FROM elements(k_part_partitions(8,3)) e $q$),
  ('k_part_partitions','crank equals largest_part whenever there are no parts equal to 1, over fiber [8,3]','eq','true','crank definition: ω=0 ⇒ crank = largest part',$q$
    SELECT bool_and(partition_parts_equal_one((e).value) > 0 OR partition_crank((e).value) = partition_largest((e).value))::text
      FROM elements(k_part_partitions(8,3)) e $q$);
