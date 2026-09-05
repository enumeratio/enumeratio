-- requires: core_partitions.stats, core_partitions, references, realizer
-- core_partitions — FindStat sweep wave 2 (issue #263). Confirmed with findstat.org's Statistic Finder: FindStat's
-- Cores object is the pair (partition, k) — a k-core — so our elements were submitted as [[parts], k]; the value
-- match is independent of k (size sums the parts). Carrier is `parts int[]`.
--
-- CONFIRMED:
--   size  St000190  "the size of a core: the integer that the core partitions" (= sum of parts)
--
-- DELIBERATELY OMITTED (Finder returned no exact match): largest_part, number_of_parts, distinct_parts,
--   durfee_square — left NULL.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','core_partitions.size','findstat','St000190','https://www.findstat.org/St000190','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('core_partitions','size (St000190): [2]=2, [3,1]=4, [4,2]=6, [2,1,1]=4','eq','2|4|6|4','findstat.org St000190 Values table',$q$
    SELECT core_partition_size(ROW(ARRAY[2])::core_partition)::text || '|' ||
           core_partition_size(ROW(ARRAY[3,1])::core_partition)::text || '|' ||
           core_partition_size(ROW(ARRAY[4,2])::core_partition)::text || '|' ||
           core_partition_size(ROW(ARRAY[2,1,1])::core_partition)::text $q$),
  ('references','findstat ref resolves for core_partitions.size (St000190)','eq','St000190','the identity strip pointer for a real base_stat row',$q$
    SELECT identity FROM base_reference WHERE subject_kind='stat' AND subject='core_partitions.size' AND system='findstat' $q$);
