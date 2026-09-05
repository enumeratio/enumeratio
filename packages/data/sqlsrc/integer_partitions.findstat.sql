-- requires: integer_partitions.stats, references, realizer
-- integer_partitions — FindStat sweep wave 2 (issue #263). Adds the Durfee-square cross-reference (the crank /
-- dyson_rank / corners / distinct_parts / hook_product / number_of_standard_tableaux ids already exist).
-- Confirmed against findstat.org's own definition + Values table; the value-example is the oracle.
--
-- CONFIRMED:
--   durfee_square  St000183  "side length of the Durfee square: s = max{ i | λ_i ≥ i }" — matches
--                            partition_durfee_square exactly (integer_partitions.stats.sql).
--
-- DELIBERATELY OMITTED (near-miss / no confirmed match — do NOT fabricate):
--   even_parts  — an in-code comment claimed St000256, but St000256 is "number of parts from which one can
--                 subtract 2 and still get a partition" ([2,2] → 1, not 2). NOT number of even parts. Left NULL.
--   odd_parts   — an in-code comment claimed St000257, but St000257 is "number of distinct parts occurring at
--                 least twice" ([1,1] → 1, not 2). NOT number of odd parts. Left NULL.
--   parts_equal_one, multiplicity_of_largest_part, perimeter, sum_of_hook_lengths, is_self_conjugate,
--   arm_of_first_cell, leg_of_first_cell — no St-number confirmed against findstat.org here; left NULL.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','integer_partitions.durfee_square','findstat','St000183','https://www.findstat.org/St000183','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('integer_partitions','durfee_square (St000183): [2,2]=2, [3,2,1]=2, [3,1]=1, [1,1,1]=1','eq','2|2|1|1','findstat.org St000183 Values table',$q$
    SELECT partition_durfee_square(ROW(ARRAY[2,2])::integer_partition)::text || '|' ||
           partition_durfee_square(ROW(ARRAY[3,2,1])::integer_partition)::text || '|' ||
           partition_durfee_square(ROW(ARRAY[3,1])::integer_partition)::text || '|' ||
           partition_durfee_square(ROW(ARRAY[1,1,1])::integer_partition)::text $q$),
  ('references','findstat ref resolves for integer_partitions.durfee_square (St000183)','eq','St000183','the identity strip pointer for a real base_stat row',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='integer_partitions.durfee_square' AND system='findstat' $q$);
