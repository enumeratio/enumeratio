-- requires: non_nesting_partitions, set_partitions.stats, realizer, utilities
-- non_nesting_partitions statistics — NOT new registrations: this collection shares the set_partition (RGS)
-- carrier with set_partitions, so base_stat_resolved (catalog-resolution.sql) already resolves every
-- set_partitions stat here automatically (own=false) — an explicit base_stat row would be a harmful duplicate
-- (see non_crossing_partitions.stats.sql, its dual). Examples only: the nesting-dual invariant, nestings=0 by
-- construction (verified below), while CROSSINGS still varies (0101={1,3}/{2,4} is non-nesting but crosses).

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_nesting_partitions','the set_partitions stats resolve here too (carrier inheritance, not a new registration)','eq','true','base_stat_resolved sees crossings on this collection without its own base_stat row',$q$
    SELECT EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'non_nesting_partitions' AND stat_id = 'crossings' AND NOT own)::text $q$),
  ('non_nesting_partitions','nestings is identically 0 over the whole floor at n=5 (the defining restriction)','eq','true','non_nesting_partitions ⇒ nestings=0, by construction',$q$
    SELECT bool_and(setpart_nestings((e).value) = 0)::text FROM elements(non_nesting_partitions(5)) e $q$),
  ('non_nesting_partitions','crossings is NOT identically 0: 0101={1,3}/{2,4} is non-nesting but crosses','eq','1','the nesting-restriction does not forbid crossing',$q$
    SELECT setpart_crossings(ROW(ARRAY[0,1,0,1])::set_partition)::text $q$),
  ('non_nesting_partitions','crossings distribution over non_nesting_partitions(4): 13 with 0, 1 with 1 (only 0101)','eq','0:13,1:1','the single crossing pair sits inside the 14-element non-nesting floor',$q$
    SELECT string_agg(k||':'||c, ',' ORDER BY k) FROM (SELECT setpart_crossings((e).value) k, count(*) c FROM elements(non_nesting_partitions(4)) e GROUP BY 1) t(k,c) $q$),
  ('non_nesting_partitions','blocks distribution over non_nesting_partitions(4): matches set_partitions(4) minus the excluded nesting 0110 (2 blocks)','eq','true','floor cross-check, not a memorized count',$q$
    SELECT (
      (SELECT count(*) FROM elements(non_nesting_partitions(4)) e WHERE setpart_blocks((e).value) = 2)
      = (SELECT count(*) FROM elements(set_partitions(4)) e WHERE setpart_blocks((e).value) = 2) - 1
    )::text $q$),
  ('non_nesting_partitions','block-shape stats on {1,3}/{2}/{4} = RGS 0102: blocks 3, largest 2, smallest 1, singletons 2','eq','3|2|1|2','a spot check on a non-nesting element',$q$
    SELECT setpart_blocks(ROW(ARRAY[0,1,0,2])::set_partition)::text || '|' ||
           setpart_largest_block(ROW(ARRAY[0,1,0,2])::set_partition)::text || '|' ||
           setpart_smallest_block(ROW(ARRAY[0,1,0,2])::set_partition)::text || '|' ||
           setpart_singleton_blocks(ROW(ARRAY[0,1,0,2])::set_partition)::text $q$);
