-- requires: set_partitions, integer_compositions, realizer, utilities
-- more set_partitions statistics + a map. Carrier is the RGS (restricted growth string); block g = the positions
-- whose rgs value is g, blocks numbered 0,1,2,… in first-appearance order. Existing stats: blocks, largest_block.

-- ── statistics (carrier set_partition, rgs int[]) ───────────────────────────────────────────────────────
-- number of singleton blocks: blocks whose size (count of positions with that rgs value) is exactly 1.
CREATE FUNCTION setpart_singleton_blocks(x set_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(*) FROM (SELECT count(*) c FROM unnest((x).rgs) v GROUP BY v) t WHERE t.c = 1), 0)::int $$;

-- number of blocks of size two.
CREATE FUNCTION setpart_blocks_size_two(x set_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(*) FROM (SELECT count(*) c FROM unnest((x).rgs) v GROUP BY v) t WHERE t.c = 2), 0)::int $$;

-- smallest block size (0 on the empty partition).
CREATE FUNCTION setpart_smallest_block(x set_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT min(c) FROM (SELECT count(*) c FROM unnest((x).rgs) v GROUP BY v) t), 0)::int $$;

-- number of elements in the last block: the size of the highest-numbered block (max rgs value = the block whose
-- first element appears last). 0 on the empty partition.
CREATE FUNCTION setpart_last_block_size(x set_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(*) FROM unnest((x).rgs) v WHERE v = (SELECT max(w) FROM unnest((x).rgs) w)), 0)::int $$;

-- number of non-singleton blocks (size ≥ 2). Distinct from `blocks_size_two` (exactly 2); this counts every block
-- with an opener/closer pair — equivalently blocks − singleton_blocks, but named for its own classic reading.
CREATE FUNCTION setpart_blocks_at_least_two(x set_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(*) FROM (SELECT count(*) c FROM unnest((x).rgs) v GROUP BY v) t WHERE t.c >= 2), 0)::int $$;

-- ── crossings and nestings — the standard arc diagram ──────────────────────────────────────────────────
-- Each block {p1<p2<...<pk} contributes arcs between CONSECUTIVE members only: (p1,p2),(p2,p3),...  — the same
-- standard representation `non_nesting_partitions.is_non_nesting` builds (singleton blocks contribute no arc; two
-- arcs from the same block always share an endpoint so never cross or nest each other). Two arcs (i1,j1), (i2,j2)
-- with i1<i2 CROSS when i1<i2<j1<j2, and NEST when i1<i2<j2<j1 (arc 2 strictly inside arc 1). This is the classic
-- Chen–Deng–Du–Stanley–Yan cr/ne pair; crossings and nestings are equidistributed over set_partitions(n) (verified
-- below at n=4, and by construction at n=6: an alternating partition is all-crossing, its "onion" analogue all-nesting).
CREATE FUNCTION setpart_crossings(x set_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  WITH arc AS (
    SELECT i, (SELECT min(j) FROM generate_subscripts((x).rgs,1) j WHERE j > i AND (x).rgs[j] = (x).rgs[i]) AS j
    FROM generate_subscripts((x).rgs,1) i
  ), arcs AS (SELECT i, j FROM arc WHERE j IS NOT NULL)
  SELECT count(*)::int FROM arcs a, arcs b WHERE a.i < b.i AND b.i < a.j AND a.j < b.j $$;

CREATE FUNCTION setpart_nestings(x set_partition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  WITH arc AS (
    SELECT i, (SELECT min(j) FROM generate_subscripts((x).rgs,1) j WHERE j > i AND (x).rgs[j] = (x).rgs[i]) AS j
    FROM generate_subscripts((x).rgs,1) i
  ), arcs AS (SELECT i, j FROM arc WHERE j IS NOT NULL)
  SELECT count(*)::int FROM arcs a, arcs b WHERE a.i < b.i AND b.j < a.j $$;

-- ── a map: block sizes in first-appearance order, as an integer composition of n ────────────────────────
-- the ordered analogue of `shape` (which sorts the block sizes): here the sizes stay in block-index order 0,1,2,…
CREATE FUNCTION setpart_block_sizes(x set_partition) RETURNS composition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT count(*)::int FROM unnest((x).rgs) v GROUP BY v ORDER BY v))::composition $$;

-- ── register ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('set_partitions','singleton_blocks','setpart_singleton_blocks','Number of singleton blocks','natural_numbers'),
  ('set_partitions','blocks_size_two','setpart_blocks_size_two','Number of blocks of size two','natural_numbers'),
  ('set_partitions','smallest_block','setpart_smallest_block','Smallest block','natural_numbers'),
  ('set_partitions','last_block_size','setpart_last_block_size','Number of elements in the last block','natural_numbers'),
  ('set_partitions','blocks_at_least_two','setpart_blocks_at_least_two','Number of blocks of size at least two','natural_numbers'),
  ('set_partitions','crossings','setpart_crossings','Number of crossings','natural_numbers'),
  ('set_partitions','nestings','setpart_nestings','Number of nestings','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('set_partitions','block_sizes','setpart_block_sizes','integer_compositions','Block sizes',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_partitions','singleton_blocks distribution over set_partitions(4)','eq','0:4,1:4,2:6,4:1','k:count; note 3 is impossible (3 singletons force a 4th)',$q$
    SELECT string_agg(k||':'||c, ',' ORDER BY k) FROM (SELECT setpart_singleton_blocks((e).value) k, count(*) c FROM elements(set_partitions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_partitions','blocks_size_two distribution over set_partitions(4)','eq','0:6,1:6,2:3','k:count over the 15 partitions of [4]',$q$
    SELECT string_agg(k||':'||c, ',' ORDER BY k) FROM (SELECT setpart_blocks_size_two((e).value) k, count(*) c FROM elements(set_partitions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_partitions','smallest_block distribution over set_partitions(4)','eq','1:11,2:3,4:1','k:count; 3 impossible, the single all-in-one block gives 4',$q$
    SELECT string_agg(k||':'||c, ',' ORDER BY k) FROM (SELECT setpart_smallest_block((e).value) k, count(*) c FROM elements(set_partitions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_partitions','last_block_size distribution over set_partitions(4)','eq','1:9,2:4,3:1,4:1','k:count over the 15 partitions of [4]',$q$
    SELECT string_agg(k||':'||c, ',' ORDER BY k) FROM (SELECT setpart_last_block_size((e).value) k, count(*) c FROM elements(set_partitions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_partitions','stats on {1}/{2,3} (RGS 011): singletons|size2|smallest|last','eq','1|1|1|2','one singleton {1} and one pair {2,3}; last block {2,3} has 2 elements',$q$
    SELECT setpart_singleton_blocks(ROW(ARRAY[0,1,1])::set_partition)::text || '|' ||
           setpart_blocks_size_two(ROW(ARRAY[0,1,1])::set_partition)::text || '|' ||
           setpart_smallest_block(ROW(ARRAY[0,1,1])::set_partition)::text || '|' ||
           setpart_last_block_size(ROW(ARRAY[0,1,1])::set_partition)::text $q$),
  ('set_partitions','block_sizes map over set_partitions(3) in rank order','eq','3,2+1,2+1,1+2,1+1+1','ordered block sizes (000,001,010,011,012); 011 gives 1+2 not 2+1',$q$
    SELECT string_agg(notation(setpart_block_sizes((e).value)), ',' ORDER BY ordinality(e)) FROM elements(set_partitions(3)) e $q$),
  ('set_partitions','block_sizes is ordered, unlike shape: {1}/{2,3} vs {1,3}/{2}','eq','1+2|2+1','RGS 011 ↦ 1+2, RGS 010 ↦ 2+1 (both have shape 2+1)',$q$
    SELECT notation(setpart_block_sizes(ROW(ARRAY[0,1,1])::set_partition)) || '|' ||
           notation(setpart_block_sizes(ROW(ARRAY[0,1,0])::set_partition)) $q$),
  ('set_partitions','blocks_at_least_two distribution over set_partitions(4)','eq','0:1,1:11,2:3','k:count; 0 only for all-singleton 0123, 1 the plurality, 2 for the three partitions into two size-2 blocks',$q$
    SELECT string_agg(k||':'||c, ',' ORDER BY k) FROM (SELECT setpart_blocks_at_least_two((e).value) k, count(*) c FROM elements(set_partitions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_partitions','blocks_at_least_two = blocks − singleton_blocks: checked on {1,3}/{2}/{4} (RGS 0102)','eq','1','one non-singleton block ({1,3}), two singletons ({2},{4})',$q$
    SELECT setpart_blocks_at_least_two(ROW(ARRAY[0,1,0,2])::set_partition)::text $q$),
  ('set_partitions','crossings/nestings over set_partitions(3): all zero — 4 distinct positions are needed for either','eq','true','no crossing or nesting is possible below n=4',$q$
    SELECT bool_and(setpart_crossings((e).value) = 0 AND setpart_nestings((e).value) = 0)::text FROM elements(set_partitions(3)) e $q$),
  ('set_partitions','the first crossing appears at n=4: {1,3}/{2,4} (RGS 0101) has 1 crossing, 0 nestings','eq','1|0','arcs (1,3) and (2,4) interleave: 1<2<3<4',$q$
    SELECT setpart_crossings(ROW(ARRAY[0,1,0,1])::set_partition)::text || '|' ||
           setpart_nestings(ROW(ARRAY[0,1,0,1])::set_partition)::text $q$),
  ('set_partitions','the first nesting appears at n=4: {1,4}/{2,3} (RGS 0110) has 0 crossings, 1 nesting','eq','0|1','arc (2,3) sits strictly inside arc (1,4)',$q$
    SELECT setpart_crossings(ROW(ARRAY[0,1,1,0])::set_partition)::text || '|' ||
           setpart_nestings(ROW(ARRAY[0,1,1,0])::set_partition)::text $q$),
  ('set_partitions','crossings and nestings are EQUIDISTRIBUTED over set_partitions(4): both 14 zeros + 1 one','eq','0:14,1:1|0:14,1:1','the Chen–Deng–Du–Stanley–Yan symmetry, the smallest case that shows it',$q$
    SELECT (SELECT string_agg(k||':'||c,',' ORDER BY k) FROM (SELECT setpart_crossings((e).value) k, count(*) c FROM elements(set_partitions(4)) e GROUP BY 1) t(k,c)) || '|' ||
           (SELECT string_agg(k||':'||c,',' ORDER BY k) FROM (SELECT setpart_nestings((e).value) k, count(*) c FROM elements(set_partitions(4)) e GROUP BY 1) t(k,c)) $q$),
  ('set_partitions','crossings count PAIRS, not just existence: alternating {1,3,5}/{2,4} of [5] (RGS 01010) has 2','eq','2|0','arcs (1,3),(3,5) each cross (2,4); consecutive same-block arcs (1,3)-(3,5) share an endpoint, never cross',$q$
    SELECT setpart_crossings(ROW(ARRAY[0,1,0,1,0])::set_partition)::text || '|' ||
           setpart_nestings(ROW(ARRAY[0,1,0,1,0])::set_partition)::text $q$),
  ('set_partitions','crossing/nesting duality at n=6: the alternating partition is all-crossing (3), its "onion" is all-nesting (3)','eq','3|0|0|3','{1,3,5}/{2,4,6} (RGS 010101) vs {1,6}/{2,5}/{3,4} (RGS 012210) — same shape, mirrored diagram',$q$
    SELECT setpart_crossings(ROW(ARRAY[0,1,0,1,0,1])::set_partition)::text || '|' ||
           setpart_nestings(ROW(ARRAY[0,1,0,1,0,1])::set_partition)::text || '|' ||
           setpart_crossings(ROW(ARRAY[0,1,2,2,1,0])::set_partition)::text || '|' ||
           setpart_nestings(ROW(ARRAY[0,1,2,2,1,0])::set_partition)::text $q$);
