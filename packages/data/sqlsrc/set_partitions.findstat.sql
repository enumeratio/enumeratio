-- requires: set_partitions.stats, set_partitions, references, realizer
-- set_partitions — FindStat sweep wave 2 (issue #263). Cross-references confirmed against findstat.org's own
-- definition + Values table; value-examples compute OUR value_fn on FindStat's own objects and assert FindStat's
-- values (the gate is the oracle). Carrier is the RGS (restricted growth string, 0-based, first-appearance order):
-- {{1},{2},{3}} = [0,1,2]; {{1,3},{2}} = [0,1,0]; {{1,3},{2,4}} = [0,1,0,1]; {{1,4},{2,3}} = [0,1,1,0].
--
-- CONFIRMED:
--   blocks    St000105  "number of blocks in the set partition"
--   crossings St000232  "number of i<i'<j<j' with i,j consecutive in one block, i',j' consecutive in another"
--   nestings  St000233  "number of i<i'<j'<j with i,j consecutive in one block, i',j' consecutive in another"
-- Both crossings and nestings use FindStat's consecutive-entries-in-a-block arc convention, matching
-- setpart_crossings/setpart_nestings (set_partitions.stats.sql). Other stats (singleton_blocks, smallest_block,
-- last_block_size, blocks_size_two, blocks_at_least_two, largest_block) left NULL — no St-number confirmed here.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','set_partitions.blocks',    'findstat','St000105','https://www.findstat.org/St000105',''),
  ('stat','set_partitions.crossings', 'findstat','St000232','https://www.findstat.org/St000232',''),
  ('stat','set_partitions.nestings',  'findstat','St000233','https://www.findstat.org/St000233','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_partitions','blocks (St000105): {{1},{2},{3}}=3, {{1,3},{2}}=2, {{1,2,3}}=1','eq','3|2|1','findstat.org St000105 Values table',$q$
    SELECT setpart_blocks(ROW(ARRAY[0,1,2])::set_partition)::text || '|' ||
           setpart_blocks(ROW(ARRAY[0,1,0])::set_partition)::text || '|' ||
           setpart_blocks(ROW(ARRAY[0,0,0])::set_partition)::text $q$),
  ('set_partitions','crossings (St000232): {{1,3},{2,4}}=1, {{1,4},{2,3}}=0','eq','1|0','the smallest crossing vs the smallest nesting',$q$
    SELECT setpart_crossings(ROW(ARRAY[0,1,0,1])::set_partition)::text || '|' ||
           setpart_crossings(ROW(ARRAY[0,1,1,0])::set_partition)::text $q$),
  ('set_partitions','nestings (St000233): {{1,4},{2,3}}=1, {{1,3},{2,4}}=0','eq','1|0','crossings/nestings are the mirror pair',$q$
    SELECT setpart_nestings(ROW(ARRAY[0,1,1,0])::set_partition)::text || '|' ||
           setpart_nestings(ROW(ARRAY[0,1,0,1])::set_partition)::text $q$),
  ('references','the three new set_partitions findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 3 AND array_agg(r.subject) @> ARRAY['set_partitions.blocks','set_partitions.crossings','set_partitions.nestings'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('set_partitions.blocks','set_partitions.crossings','set_partitions.nestings')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='set_partitions' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
