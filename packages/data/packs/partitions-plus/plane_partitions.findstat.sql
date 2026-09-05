-- requires: plane_partitions.stats, plane_partitions, references, realizer
-- plane_partitions — FindStat sweep wave 2 (issue #263). Every statistic confirmed with findstat.org's Statistic
-- Finder: our value_fn's values over plane_partitions(1..4) were submitted and each St-number is the one whose
-- definition AND per-object values match ours (distribution-only matches were rejected by pointwise comparison).
-- Carrier is (entries int[], shape int[]); FindStat's object is the row matrix, so [[2,1]] = (entries {2,1}, shape
-- {2}), [[1],[1]] = (entries {1,1}, shape {1,1}). Value-examples are the gate oracle.
--
-- CONFIRMED (all five plane-partition statistics):
--   trace         St001919  "trace of a plane partition: sum of the diagonal entries"
--   largest_part  St001447  "height of the base box of a plane partition" (= the largest entry)
--   num_parts     St001922  "number of parts of a plane partition"
--   num_rows      St001446  "number of rows in the plane partition"
--   num_columns   St001460  "number of columns of a plane partition"
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','plane_partitions.trace',       'findstat','St001919','https://www.findstat.org/St001919',''),
  ('stat','plane_partitions.largest_part','findstat','St001447','https://www.findstat.org/St001447',''),
  ('stat','plane_partitions.num_parts',   'findstat','St001922','https://www.findstat.org/St001922',''),
  ('stat','plane_partitions.num_rows',    'findstat','St001446','https://www.findstat.org/St001446',''),
  ('stat','plane_partitions.num_columns', 'findstat','St001460','https://www.findstat.org/St001460','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('plane_partitions','trace (St001919): [[2]]=2, [[3]]=3, [[1,1]]=1, [[2,1]]=2','eq','2|3|1|2','findstat.org St001919 Values table',$q$
    SELECT plane_partitions_trace(ROW(ARRAY[2],ARRAY[1])::plane_partition)::text || '|' ||
           plane_partitions_trace(ROW(ARRAY[3],ARRAY[1])::plane_partition)::text || '|' ||
           plane_partitions_trace(ROW(ARRAY[1,1],ARRAY[2])::plane_partition)::text || '|' ||
           plane_partitions_trace(ROW(ARRAY[2,1],ARRAY[2])::plane_partition)::text $q$),
  ('plane_partitions','largest_part (St001447): [[2]]=2, [[3]]=3, [[4]]=4, [[2,1]]=2','eq','2|3|4|2','findstat.org St001447 (height of the base box)',$q$
    SELECT plane_partitions_largest_part(ROW(ARRAY[2],ARRAY[1])::plane_partition)::text || '|' ||
           plane_partitions_largest_part(ROW(ARRAY[3],ARRAY[1])::plane_partition)::text || '|' ||
           plane_partitions_largest_part(ROW(ARRAY[4],ARRAY[1])::plane_partition)::text || '|' ||
           plane_partitions_largest_part(ROW(ARRAY[2,1],ARRAY[2])::plane_partition)::text $q$),
  ('plane_partitions','num_parts (St001922): [[2]]=1, [[1,1]]=2, [[2,1]]=2, [[1,1,1]]=3','eq','1|2|2|3','findstat.org St001922 Values table',$q$
    SELECT plane_partitions_num_parts(ROW(ARRAY[2],ARRAY[1])::plane_partition)::text || '|' ||
           plane_partitions_num_parts(ROW(ARRAY[1,1],ARRAY[2])::plane_partition)::text || '|' ||
           plane_partitions_num_parts(ROW(ARRAY[2,1],ARRAY[2])::plane_partition)::text || '|' ||
           plane_partitions_num_parts(ROW(ARRAY[1,1,1],ARRAY[3])::plane_partition)::text $q$),
  ('plane_partitions','num_rows (St001446): [[2]]=1, [[1],[1]]=2, [[1],[1],[1]]=3, [[2,1]]=1','eq','1|2|3|1','findstat.org St001446 Values table',$q$
    SELECT plane_partitions_num_rows(ROW(ARRAY[2],ARRAY[1])::plane_partition)::text || '|' ||
           plane_partitions_num_rows(ROW(ARRAY[1,1],ARRAY[1,1])::plane_partition)::text || '|' ||
           plane_partitions_num_rows(ROW(ARRAY[1,1,1],ARRAY[1,1,1])::plane_partition)::text || '|' ||
           plane_partitions_num_rows(ROW(ARRAY[2,1],ARRAY[2])::plane_partition)::text $q$),
  ('plane_partitions','num_columns (St001460): [[2]]=1, [[1,1]]=2, [[1,1,1]]=3, [[2,1]]=2','eq','1|2|3|2','findstat.org St001460 Values table',$q$
    SELECT plane_partitions_num_columns(ROW(ARRAY[2],ARRAY[1])::plane_partition)::text || '|' ||
           plane_partitions_num_columns(ROW(ARRAY[1,1],ARRAY[2])::plane_partition)::text || '|' ||
           plane_partitions_num_columns(ROW(ARRAY[1,1,1],ARRAY[3])::plane_partition)::text || '|' ||
           plane_partitions_num_columns(ROW(ARRAY[2,1],ARRAY[2])::plane_partition)::text $q$),
  ('references','the five new plane_partitions findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 5 AND array_agg(r.subject) @> ARRAY['plane_partitions.trace','plane_partitions.largest_part','plane_partitions.num_parts','plane_partitions.num_rows','plane_partitions.num_columns'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject LIKE 'plane_partitions.%'
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='plane_partitions' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
