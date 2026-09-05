-- requires: non_crossing_partitions, set_partitions.stats, realizer, utilities
-- non_crossing_partitions statistics — NOT new registrations: this collection shares the set_partition (RGS)
-- carrier with set_partitions, so base_stat_resolved (catalog-resolution.sql) already resolves every
-- set_partitions stat here automatically — see the existing 'non_crossing_partitions inherits set_partitions
-- stats' catalog example. An explicit base_stat row would be a harmful duplicate. This file is examples only,
-- confirming the interesting carried-over invariant: crossings=0 by construction (verified below), while
-- NESTINGS is still free to vary (0110={1,4}/{2,3} is non-crossing but nests).

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_crossing_partitions','the set_partitions stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees nestings on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'non_crossing_partitions' AND stat_id = 'nestings' AND NOT own)::text $q$),
  ('non_crossing_partitions','crossings is identically 0 over the whole floor at n=5 (the defining restriction)','eq','true','non_crossing_partitions ⇒ crossings=0, by construction',$q$
    SELECT bool_and(setpart_crossings((e).value) = 0)::text FROM elements(non_crossing_partitions(5)) e $q$),
  ('non_crossing_partitions','nestings is NOT identically 0: 0110={1,4}/{2,3} is non-crossing but nests','eq','1','the crossing-restriction does not forbid nesting',$q$
    SELECT setpart_nestings(ROW(ARRAY[0,1,1,0])::set_partition)::text $q$),
  ('non_crossing_partitions','nestings distribution over non_crossing_partitions(4): 13 with 0, 1 with 1 (only 0110)','eq','0:13,1:1','the single nesting pair sits inside the 14-element non-crossing floor',$q$
    SELECT string_agg(k||':'||c, ',' ORDER BY k) FROM (SELECT setpart_nestings((e).value) k, count(*) c FROM elements(non_crossing_partitions(4)) e GROUP BY 1) t(k,c) $q$),
  ('non_crossing_partitions','blocks distribution over non_crossing_partitions(4): matches set_partitions(4) minus the excluded crossing 0101 (2 blocks)','eq','true','floor cross-check, not a memorized count',$q$
    SELECT (
      (SELECT count(*) FROM elements(non_crossing_partitions(4)) e WHERE setpart_blocks((e).value) = 2)
      = (SELECT count(*) FROM elements(set_partitions(4)) e WHERE setpart_blocks((e).value) = 2) - 1
    )::text $q$),
  ('non_crossing_partitions','block-shape stats on {1,3}/{2}/{4} = RGS 0102: blocks 3, largest 2, smallest 1, singletons 2','eq','3|2|1|2','a spot check on a non-crossing element',$q$
    SELECT setpart_blocks(ROW(ARRAY[0,1,0,2])::set_partition)::text || '|' ||
           setpart_largest_block(ROW(ARRAY[0,1,0,2])::set_partition)::text || '|' ||
           setpart_smallest_block(ROW(ARRAY[0,1,0,2])::set_partition)::text || '|' ||
           setpart_singleton_blocks(ROW(ARRAY[0,1,0,2])::set_partition)::text $q$);
