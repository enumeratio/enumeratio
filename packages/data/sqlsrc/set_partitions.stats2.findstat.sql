-- requires: set_partitions.stats, set_partitions, references, realizer
-- set_partitions — FindStat sweep wave 3 (issue #326), deeper STAT coverage. Three block-size statistics get their
-- FindStat ids, confirmed with findstat.org's Statistic Finder (pointwise + definition; each was picked past the
-- distribution-only matches the Finder also lists). Carrier RGS.
--   largest_block     St001062  "the maximal size of a block of a set partition"
--   singleton_blocks  St000247  "the number of singleton blocks of a set partition"
--   smallest_block    St001075  "the minimal size of a block of a set partition"
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','set_partitions.largest_block',   'findstat','St001062','https://www.findstat.org/St001062',''),
  ('stat','set_partitions.singleton_blocks','findstat','St000247','https://www.findstat.org/St000247',''),
  ('stat','set_partitions.smallest_block',  'findstat','St001075','https://www.findstat.org/St001075','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_partitions','largest_block (St001062): {{1,2,3}}=3, {{1,3},{2}}=2, {{1},{2},{3}}=1','eq','3|2|1','findstat.org St001062 Values table',$q$
    SELECT setpart_largest_block(ROW(ARRAY[0,0,0])::set_partition)::text || '|' ||
           setpart_largest_block(ROW(ARRAY[0,1,0])::set_partition)::text || '|' ||
           setpart_largest_block(ROW(ARRAY[0,1,2])::set_partition)::text $q$),
  ('set_partitions','singleton_blocks (St000247): {{1},{2},{3}}=3, {{1,3},{2}}=1, {{1,2,3}}=0','eq','3|1|0','findstat.org St000247 Values table',$q$
    SELECT setpart_singleton_blocks(ROW(ARRAY[0,1,2])::set_partition)::text || '|' ||
           setpart_singleton_blocks(ROW(ARRAY[0,1,0])::set_partition)::text || '|' ||
           setpart_singleton_blocks(ROW(ARRAY[0,0,0])::set_partition)::text $q$),
  ('set_partitions','smallest_block (St001075): {{1,2,3}}=3, {{1,3},{2}}=1, {{1},{2},{3}}=1','eq','3|1|1','findstat.org St001075 Values table',$q$
    SELECT setpart_smallest_block(ROW(ARRAY[0,0,0])::set_partition)::text || '|' ||
           setpart_smallest_block(ROW(ARRAY[0,1,0])::set_partition)::text || '|' ||
           setpart_smallest_block(ROW(ARRAY[0,1,2])::set_partition)::text $q$),
  ('references','the three new set_partitions stat findstat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 3 AND array_agg(r.subject) @> ARRAY['set_partitions.largest_block','set_partitions.singleton_blocks','set_partitions.smallest_block'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('set_partitions.largest_block','set_partitions.singleton_blocks','set_partitions.smallest_block')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='set_partitions' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
