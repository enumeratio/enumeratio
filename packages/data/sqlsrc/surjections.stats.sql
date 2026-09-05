-- requires: surjections, realizer, utilities, integer_compositions
-- surjection statistics & maps — a surjection word w over 1..k (a surjection [n] ↠ [k], equivalently an ordered set
-- partition of [n]) carries the obvious block invariants: image_size (= k = number of blocks = max letter), and the
-- largest/smallest fiber (block) size, plus word descents. TO_COMPOSITION reads off the fiber sizes in block order
-- (|f⁻¹(1)|,…,|f⁻¹(k)|), a composition of n — the shape of the ordered set partition.

-- ── statistics (carrier: surjection(values int[]), a word over 1..k using every letter) ─────────────────
-- image size = k = number of blocks = the largest letter (letters are exactly 1..k, contiguous).
CREATE FUNCTION surjection_image_size(x surjection) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(v) FROM unnest((x).values) v), 0) $$;
-- largest fiber: the size of the biggest preimage f⁻¹(j) — the largest block.
CREATE FUNCTION surjection_largest_fiber(x surjection) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT max(c) FROM (SELECT count(*) c FROM unnest((x).values) v GROUP BY v) t), 0)::int $$;
-- smallest fiber: the size of the smallest preimage f⁻¹(j) — the smallest block.
CREATE FUNCTION surjection_smallest_fiber(x surjection) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT min(c) FROM (SELECT count(*) c FROM unnest((x).values) v GROUP BY v) t), 0)::int $$;
-- descents: positions i with w_i > w_{i+1}.
CREATE FUNCTION surjection_descents(x surjection) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((x).values, 1) i
   WHERE i < array_length((x).values, 1) AND (x).values[i] > (x).values[i+1] $$;

-- ── map → integer_compositions ──────────────────────────────────────────────────────────────────────────
-- to_composition: the fiber sizes in block order, |f⁻¹(1)|,…,|f⁻¹(k)| — a composition of n (each part positive,
-- since every letter is used). This is the underlying-shape (block-size) map of the ordered set partition.
CREATE FUNCTION surjection_to_composition(x surjection) RETURNS composition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT count(*)::int FROM unnest((x).values) v GROUP BY v ORDER BY v))::composition $$;

-- ── register in base_stat / base_map ────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('surjections','image_size','surjection_image_size','Image size','natural_numbers'),
  ('surjections','largest_fiber','surjection_largest_fiber','Largest fiber','natural_numbers'),
  ('surjections','smallest_fiber','surjection_smallest_fiber','Smallest fiber','natural_numbers'),
  ('surjections','descents','surjection_descents','Descents','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('surjections','to_composition','surjection_to_composition','integer_compositions','To composition',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- surjections(3) has 13 words (Fubini), surjections(4) has 75. Distributions derived independently via sage's
-- OrderedSetPartitions(n) (same fiber: |OrderedSetPartitions(n)| = Fubini(n)). Rank order of surjections(3):
-- 111,112,121,122,211,212,221,123,132,213,231,312,321.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('surjections','image_size: 111→1, 121→2, 123→3','eq','1|2|3','k = number of distinct letters = number of blocks',$q$
    SELECT surjection_image_size(ROW(ARRAY[1,1,1])::surjection)::text || '|' ||
           surjection_image_size(ROW(ARRAY[1,2,1])::surjection)::text || '|' ||
           surjection_image_size(ROW(ARRAY[1,2,3])::surjection)::text $q$),
  ('surjections','image_size over surjections(3) is the surjection triangle row 1,6,6 (k!·S(3,k))','eq','1,6,6','#words using exactly k letters, k=1,2,3 (A019538)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT surjection_image_size((e).value) k, count(*) c FROM elements(surjections(3)) e GROUP BY 1) t(k,c) $q$),
  ('surjections','image_size over surjections(4) is the surjection triangle row 1,14,36,24','eq','1,14,36,24','k!·S(4,k), k=1..4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT surjection_image_size((e).value) k, count(*) c FROM elements(surjections(4)) e GROUP BY 1) t(k,c) $q$),
  ('surjections','largest_fiber: 111→3, 121→2, 123→1','eq','3|2|1','size of the biggest preimage (largest block)',$q$
    SELECT surjection_largest_fiber(ROW(ARRAY[1,1,1])::surjection)::text || '|' ||
           surjection_largest_fiber(ROW(ARRAY[1,2,1])::surjection)::text || '|' ||
           surjection_largest_fiber(ROW(ARRAY[1,2,3])::surjection)::text $q$),
  ('surjections','largest_fiber over surjections(4): distribution 24,42,8,1','eq','24,42,8,1','#words with largest block 1,2,3,4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT surjection_largest_fiber((e).value) k, count(*) c FROM elements(surjections(4)) e GROUP BY 1) t(k,c) $q$),
  ('surjections','smallest_fiber: 111→3, 121→1, 123→1','eq','3|1|1','size of the smallest preimage (smallest block)',$q$
    SELECT surjection_smallest_fiber(ROW(ARRAY[1,1,1])::surjection)::text || '|' ||
           surjection_smallest_fiber(ROW(ARRAY[1,2,1])::surjection)::text || '|' ||
           surjection_smallest_fiber(ROW(ARRAY[1,2,3])::surjection)::text $q$),
  ('surjections','smallest_fiber over surjections(3): 12 words with a singleton block, 1 all-equal','eq','12,1','distribution over present keys 1,3 (no word of 3 has min block 2)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT surjection_smallest_fiber((e).value) k, count(*) c FROM elements(surjections(3)) e GROUP BY 1) t(k,c) $q$),
  ('surjections','descents: 321→2, 121→1, 123→0','eq','2|1|0','#{ i : w_i > w_{i+1} }',$q$
    SELECT surjection_descents(ROW(ARRAY[3,2,1])::surjection)::text || '|' ||
           surjection_descents(ROW(ARRAY[1,2,1])::surjection)::text || '|' ||
           surjection_descents(ROW(ARRAY[1,2,3])::surjection)::text $q$),
  ('surjections','descents over surjections(4): distribution 8,42,24,1','eq','8,42,24,1','#words with 0,1,2,3 descents (sums to 75)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT surjection_descents((e).value) k, count(*) c FROM elements(surjections(4)) e GROUP BY 1) t(k,c) $q$),
  ('surjections','empty word (n=0): every stat is 0','eq','0|0|0|0','edge case, no letters',$q$
    SELECT surjection_image_size((unrank(surjections(0),0)).value)::text || '|' ||
           surjection_largest_fiber((unrank(surjections(0),0)).value)::text || '|' ||
           surjection_smallest_fiber((unrank(surjections(0),0)).value)::text || '|' ||
           surjection_descents((unrank(surjections(0),0)).value)::text $q$),
  ('surjections','to_composition: 121 ↦ 2+1, 212 ↦ 1+2','eq','2+1|1+2','block sizes in order (|f⁻¹(1)|,…)',$q$
    SELECT notation(surjection_to_composition(ROW(ARRAY[1,2,1])::surjection)) || '|' ||
           notation(surjection_to_composition(ROW(ARRAY[2,1,2])::surjection)) $q$),
  ('surjections','to_composition over surjections(3) in rank order','eq','3,2+1,2+1,1+2,2+1,1+2,1+2,1+1+1,1+1+1,1+1+1,1+1+1,1+1+1,1+1+1','the block-size shape of each of the 13 words',$q$
    SELECT string_agg(notation(surjection_to_composition((e).value)), ',' ORDER BY ordinality(e)) FROM elements(surjections(3)) e $q$),
  ('surjections','to_composition image renders in the codomain (integer_compositions) form','eq','2+1','render_value on a composition image',$q$
    SELECT render_value(surjection_to_composition(ROW(ARRAY[1,2,1])::surjection)) $q$),
  ('surjections','to_composition always lands on a composition of n over surjections(4)','eq','true','Σ parts = n for every word',$q$
    SELECT bool_and((SELECT coalesce(sum(p),0) FROM unnest((surjection_to_composition((e).value)).parts) p) = 4)::text
      FROM elements(surjections(4)) e $q$);
