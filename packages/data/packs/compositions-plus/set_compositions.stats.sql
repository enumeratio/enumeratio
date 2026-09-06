-- requires: set_compositions, set_partitions, realizer, utilities
-- set_compositions statistics + a map. Carrier = set_composition(labels int[]), labels[i] = the 1-based index of
-- the (ordered) block containing i; used labels are exactly {1..k}. Block-shape statistics: number of blocks (= k),
-- largest / smallest block size, first / last block size, number of singleton blocks, number of blocks of size ≥ 2,
-- and word descents (positions i with labels[i] > labels[i+1], the same notion as surjections_descents — the labels
-- word IS a surjection word). Plus a forgetful map to set_partitions (drop the block order, relabel blocks by first
-- appearance into a restricted growth string). Distributions verified vs sage's OrderedSetPartitions(n).

-- ── statistics ─────────────────────────────────────────────────────────────────────────────────────────
-- number of blocks: the largest label used (blocks are 1..k by construction). 0 for the empty composition.
CREATE FUNCTION set_composition_number_of_blocks(c set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(x) FROM unnest((c).labels) x), 0)::int $$;
-- largest block: the size of the biggest block (max multiplicity of a label).
CREATE FUNCTION set_composition_largest_block(c set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(cnt) FROM (SELECT count(*) cnt FROM unnest((c).labels) v GROUP BY v) t), 0)::int $$;
-- smallest block: the size of the smallest block (min multiplicity of a label).
CREATE FUNCTION set_composition_smallest_block(c set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT min(cnt) FROM (SELECT count(*) cnt FROM unnest((c).labels) v GROUP BY v) t), 0)::int $$;
-- first block size: the size of block 1 (the first block in the ordering) = the multiplicity of label 1.
CREATE FUNCTION set_composition_first_block_size(c set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((c).labels) x WHERE x = 1 $$;
-- last block size: the size of block k (the last block in the ordering) = the multiplicity of the largest label.
CREATE FUNCTION set_composition_last_block_size(c set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((c).labels) x WHERE x = (SELECT max(y) FROM unnest((c).labels) y) $$;
-- number of singleton blocks: blocks with exactly one element.
CREATE FUNCTION set_composition_number_of_singletons(c set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(*) FROM (SELECT count(*) cnt FROM unnest((c).labels) v GROUP BY v) t WHERE cnt = 1), 0)::int $$;
-- number of blocks of size ≥ 2: the complement count (#blocks − #singletons).
CREATE FUNCTION set_composition_blocks_at_least_2(c set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(*) FROM (SELECT count(*) cnt FROM unnest((c).labels) v GROUP BY v) t WHERE cnt >= 2), 0)::int $$;
-- descents: positions i with labels[i] > labels[i+1] — the labels word IS a surjection word, same definition as
-- surjection_descents (surjections.stats.sql).
CREATE FUNCTION set_composition_descents(c set_composition) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((c).labels, 1) i
   WHERE i < array_length((c).labels, 1) AND (c).labels[i] > (c).labels[i+1] $$;

-- ── map → set_partitions ───────────────────────────────────────────────────────────────────────────────
-- to_set_partition: forget the block order. Relabel blocks by the position of their least element (i.e. by first
-- appearance while scanning 1..n) into a restricted growth string, the canonical set_partition carrier.
CREATE FUNCTION set_composition_to_set_partition(c set_composition) RETURNS set_partition LANGUAGE sql IMMUTABLE AS $$
  WITH pos AS (SELECT i, (c).labels[i] AS lbl FROM generate_subscripts((c).labels, 1) i),
       fp  AS (SELECT lbl, min(i) AS f FROM pos GROUP BY lbl),
       rk  AS (SELECT lbl, (dense_rank() OVER (ORDER BY f) - 1)::int AS r FROM fp)
  SELECT ROW(ARRAY(SELECT rk.r FROM pos JOIN rk USING (lbl) ORDER BY pos.i))::set_partition $$;

-- ── register (collection, stat_id, value_fn, title, codomain) / (…, map_id, mapping_fn, codomain, title, findstat) ──
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('set_compositions','number_of_blocks','set_composition_number_of_blocks','Number of blocks','natural_numbers'),
  ('set_compositions','largest_block','set_composition_largest_block','Largest block','natural_numbers'),
  ('set_compositions','smallest_block','set_composition_smallest_block','Smallest block','natural_numbers'),
  ('set_compositions','first_block_size','set_composition_first_block_size','First block size','natural_numbers'),
  ('set_compositions','last_block_size','set_composition_last_block_size','Last block size','natural_numbers'),
  ('set_compositions','number_of_singletons','set_composition_number_of_singletons','Number of singleton blocks','natural_numbers'),
  ('set_compositions','blocks_at_least_2','set_composition_blocks_at_least_2','Number of blocks of size ≥ 2','natural_numbers'),
  ('set_compositions','descents','set_composition_descents','Descents','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('set_compositions','to_set_partition','set_composition_to_set_partition','set_partitions','To set partition',NULL);

-- ── examples ───────────────────────────────────────────────────────────────────────────────────────────
-- set_compositions(n) is the Fubini fiber (n=3 ⇒ 13, n=4 ⇒ 75). Distributions grouped ascending by value match
-- sage's OrderedSetPartitions(n): they emit a count per PRESENT value (so smallest_block skips absent values).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('set_compositions','stats on {1,2}|{3} (labels 1,1,2): blocks=2, largest=2, smallest=1, first=2, last=1, singletons=1, ≥2=1, descents=0','eq','2|2|1|2|1|1|1|0','a two-block composition',$q$
    SELECT set_composition_number_of_blocks(ROW(ARRAY[1,1,2])::set_composition)::text || '|' ||
           set_composition_largest_block(ROW(ARRAY[1,1,2])::set_composition)::text || '|' ||
           set_composition_smallest_block(ROW(ARRAY[1,1,2])::set_composition)::text || '|' ||
           set_composition_first_block_size(ROW(ARRAY[1,1,2])::set_composition)::text || '|' ||
           set_composition_last_block_size(ROW(ARRAY[1,1,2])::set_composition)::text || '|' ||
           set_composition_number_of_singletons(ROW(ARRAY[1,1,2])::set_composition)::text || '|' ||
           set_composition_blocks_at_least_2(ROW(ARRAY[1,1,2])::set_composition)::text || '|' ||
           set_composition_descents(ROW(ARRAY[1,1,2])::set_composition)::text $q$),
  ('set_compositions','stats on {3}|{1,2} (labels 2,2,1): blocks=2, largest=2, smallest=1, first=1, last=2, singletons=1, ≥2=1, descents=1','eq','2|2|1|1|2|1|1|1','same shape, block order reversed ⇒ first/last swap and a descent appears',$q$
    SELECT set_composition_number_of_blocks(ROW(ARRAY[2,2,1])::set_composition)::text || '|' ||
           set_composition_largest_block(ROW(ARRAY[2,2,1])::set_composition)::text || '|' ||
           set_composition_smallest_block(ROW(ARRAY[2,2,1])::set_composition)::text || '|' ||
           set_composition_first_block_size(ROW(ARRAY[2,2,1])::set_composition)::text || '|' ||
           set_composition_last_block_size(ROW(ARRAY[2,2,1])::set_composition)::text || '|' ||
           set_composition_number_of_singletons(ROW(ARRAY[2,2,1])::set_composition)::text || '|' ||
           set_composition_blocks_at_least_2(ROW(ARRAY[2,2,1])::set_composition)::text || '|' ||
           set_composition_descents(ROW(ARRAY[2,2,1])::set_composition)::text $q$),
  ('set_compositions','empty composition (n=0): every stat is 0','eq','0|0|0|0|0|0|0|0','edge case, no elements',$q$
    SELECT set_composition_number_of_blocks((unrank(set_compositions(0),0)).value)::text || '|' ||
           set_composition_largest_block((unrank(set_compositions(0),0)).value)::text || '|' ||
           set_composition_smallest_block((unrank(set_compositions(0),0)).value)::text || '|' ||
           set_composition_first_block_size((unrank(set_compositions(0),0)).value)::text || '|' ||
           set_composition_last_block_size((unrank(set_compositions(0),0)).value)::text || '|' ||
           set_composition_number_of_singletons((unrank(set_compositions(0),0)).value)::text || '|' ||
           set_composition_blocks_at_least_2((unrank(set_compositions(0),0)).value)::text || '|' ||
           set_composition_descents((unrank(set_compositions(0),0)).value)::text $q$),
  ('set_compositions','number_of_blocks distribution over set_compositions(3) is 1,6,6 (k=1,2,3)','eq','1,6,6','ordered surjections by image size, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_number_of_blocks((e).value) k, count(*) c FROM elements(set_compositions(3)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','number_of_blocks distribution over set_compositions(4) is 1,14,36,24 (k=1..4)','eq','1,14,36,24','sum = 75 = Fubini(4), vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_number_of_blocks((e).value) k, count(*) c FROM elements(set_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','largest_block distribution over set_compositions(3) is 6,6,1 (k=1,2,3)','eq','6,6,1','biggest block size, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_largest_block((e).value) k, count(*) c FROM elements(set_compositions(3)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','largest_block distribution over set_compositions(4) is 24,42,8,1 (k=1..4)','eq','24,42,8,1','biggest block size, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_largest_block((e).value) k, count(*) c FROM elements(set_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','smallest_block distribution over set_compositions(3) is 12,1 (values 1,3)','eq','12,1','only sizes 1 and 3 occur, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_smallest_block((e).value) k, count(*) c FROM elements(set_compositions(3)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','smallest_block distribution over set_compositions(4) is 68,6,1 (values 1,2,4)','eq','68,6,1','value 3 never occurs, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_smallest_block((e).value) k, count(*) c FROM elements(set_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','first_block_size distribution over set_compositions(3) is 9,3,1 (k=1,2,3)','eq','9,3,1','size of the first block, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_first_block_size((e).value) k, count(*) c FROM elements(set_compositions(3)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','first_block_size distribution over set_compositions(4) is 52,18,4,1 (k=1..4)','eq','52,18,4,1','size of the first block, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_first_block_size((e).value) k, count(*) c FROM elements(set_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','last_block_size distribution over set_compositions(3) is 9,3,1 (k=1,2,3)','eq','9,3,1','size of the last block, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_last_block_size((e).value) k, count(*) c FROM elements(set_compositions(3)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','last_block_size distribution over set_compositions(4) is 52,18,4,1 (k=1..4)','eq','52,18,4,1','same distribution as first_block_size (reversal is a bijection), vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_last_block_size((e).value) k, count(*) c FROM elements(set_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','number_of_singletons distribution over set_compositions(3) is 1,6,6 (values 0,1,3)','eq','1,6,6','0 for the single 3-block, 1 for two-block shapes, 3 for all-singleton perms, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_number_of_singletons((e).value) k, count(*) c FROM elements(set_compositions(3)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','number_of_singletons distribution over set_compositions(4) is 7,8,36,24 (values 0,1,2,4)','eq','7,8,36,24','value 3 never occurs, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_number_of_singletons((e).value) k, count(*) c FROM elements(set_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','blocks_at_least_2 distribution over set_compositions(3) is 6,7 (k=0,1)','eq','6,7','at most one block can be non-singleton when n=3, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_blocks_at_least_2((e).value) k, count(*) c FROM elements(set_compositions(3)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','blocks_at_least_2 distribution over set_compositions(4) is 24,45,6 (k=0,1,2)','eq','24,45,6','vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_blocks_at_least_2((e).value) k, count(*) c FROM elements(set_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','descents distribution over set_compositions(3) is 4,8,1 (k=0,1,2)','eq','4,8,1','#{i : labels[i] > labels[i+1]}, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_descents((e).value) k, count(*) c FROM elements(set_compositions(3)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','descents distribution over set_compositions(4) is 8,42,24,1 (k=0..3)','eq','8,42,24,1','same word-descent notion as surjections_descents, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT set_composition_descents((e).value) k, count(*) c FROM elements(set_compositions(4)) e GROUP BY 1) t(k,c) $q$),
  ('set_compositions','to_set_partition: {1,2}|{3} ↦ 001, {3}|{1,2} ↦ 001, {1}|{2}|{3} ↦ 012','eq','001|001|012','forget the order, relabel by first appearance',$q$
    SELECT render_value(set_composition_to_set_partition(ROW(ARRAY[1,1,2])::set_composition)) || '|' ||
           render_value(set_composition_to_set_partition(ROW(ARRAY[2,2,1])::set_composition)) || '|' ||
           render_value(set_composition_to_set_partition(ROW(ARRAY[1,2,3])::set_composition)) $q$),
  ('set_compositions','to_set_partition over set_compositions(3) in rank order (RGS images)','eq','000,001,010,011,011,010,001,012,012,012,012,012,012','image of each of the 13 ordered set partitions',$q$
    SELECT string_agg(render_value(set_composition_to_set_partition((e).value)), ',' ORDER BY ordinality(e)) FROM elements(set_compositions(3)) e $q$),
  ('set_compositions','to_set_partition collapses set_compositions(3) onto the 5 set partitions of {1,2,3} (Bell(3))','eq','5','distinct images = Bell(3)',$q$
    SELECT count(DISTINCT render_value(set_composition_to_set_partition((e).value)))::text FROM elements(set_compositions(3)) e $q$);
