-- requires: perfect_matchings, set_partitions, realizer, utilities
-- perfect_matchings statistics + a map. Carrier = perfect_matching(pairs int[]) flattened as [a1,b1,a2,b2,…],
-- each ai<bi, pairs sorted ascending by ai. Arc-diagram statistics on the n arcs (a,b): crossings, nestings,
-- short pairs, and the widest arc. Plus a map to set_partitions (each pair becomes a two-element block).

-- ── statistics ─────────────────────────────────────────────────────────────────────────────────────────
-- crossings: pairs of arcs (a,b),(c,d) that cross, i.e. a<c<b<d. Pairs are sorted by opener so i<j ⇒ a_i<a_j.
CREATE FUNCTION perfect_matchings_crossings(m perfect_matching) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int
    FROM generate_series(1, coalesce(array_length((m).pairs,1),0)/2) i,
         generate_series(1, coalesce(array_length((m).pairs,1),0)/2) j
   WHERE i < j
     AND (m).pairs[2*j-1] < (m).pairs[2*i]        -- opener_j < closer_i  (c < b)
     AND (m).pairs[2*i]   < (m).pairs[2*j] $$;     -- closer_i < closer_j  (b < d)

-- nestings: pairs of arcs (a,b),(c,d) with one nested inside the other, i.e. a<c<d<b.
CREATE FUNCTION perfect_matchings_nestings(m perfect_matching) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int
    FROM generate_series(1, coalesce(array_length((m).pairs,1),0)/2) i,
         generate_series(1, coalesce(array_length((m).pairs,1),0)/2) j
   WHERE i < j
     AND (m).pairs[2*j] < (m).pairs[2*i] $$;       -- closer_j < closer_i  (d < b), openers ordered by sort

-- short pairs: arcs (a,b) with b = a+1 (a pair of adjacent points).
CREATE FUNCTION perfect_matchings_short_pairs(m perfect_matching) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int
    FROM generate_series(1, coalesce(array_length((m).pairs,1),0)/2) i
   WHERE (m).pairs[2*i] = (m).pairs[2*i-1] + 1 $$;

-- widest arc: the maximum span b - a over all pairs (0 for the empty matching).
CREATE FUNCTION perfect_matchings_widest_arc(m perfect_matching) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max((m).pairs[2*i] - (m).pairs[2*i-1]), 0)::int
    FROM generate_series(1, coalesce(array_length((m).pairs,1),0)/2) i $$;

-- ── map ────────────────────────────────────────────────────────────────────────────────────────────────
-- to_set_partition: each arc becomes a two-element block. Pairs are sorted by opener, so pair i is the i-th
-- block to appear when scanning 1..2n; its restricted-growth label is therefore i-1 for both of its elements.
CREATE FUNCTION perfect_matchings_to_set_partition(m perfect_matching) RETURNS set_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT (SELECT i - 1
              FROM generate_series(1, coalesce(array_length((m).pairs,1),0)/2) i
             WHERE (m).pairs[2*i-1] = v OR (m).pairs[2*i] = v)
      FROM generate_series(1, coalesce(array_length((m).pairs,1),0)) v
     ORDER BY v))::set_partition $$;

-- ── register ───────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('perfect_matchings','crossings','perfect_matchings_crossings','Number of crossings','natural_numbers'),
  ('perfect_matchings','nestings','perfect_matchings_nestings','Number of nestings','natural_numbers'),
  ('perfect_matchings','short_pairs','perfect_matchings_short_pairs','Number of short pairs','natural_numbers'),
  ('perfect_matchings','widest_arc','perfect_matchings_widest_arc','Widest arc','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('perfect_matchings','to_set_partition','perfect_matchings_to_set_partition','set_partitions','To set partition',NULL);

-- ── examples ───────────────────────────────────────────────────────────────────────────────────────────
-- The n=2 fiber is ordered (1,2)(3,4), (1,3)(2,4), (1,4)(2,3); distributions over n=3 verified against sage's
-- PerfectMatchings(6). Crossings, nestings and short pairs are all equidistributed here (5,6,3,1).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('perfect_matchings','crossings over the ordered n=2 fiber','eq','0,1,0','only (1,3)(2,4) crosses',$q$
    SELECT string_agg(perfect_matchings_crossings((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(perfect_matchings(2)) e $q$),
  ('perfect_matchings','crossings distribution over n=3 is 5,6,3,1 (k=0..3)','eq','5,6,3,1','grouped counts, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perfect_matchings_crossings((e).value) k, count(*) c FROM elements(perfect_matchings(3)) e GROUP BY 1) t(k,c) $q$),
  ('perfect_matchings','nestings over the ordered n=2 fiber','eq','0,0,1','only (1,4)(2,3) nests',$q$
    SELECT string_agg(perfect_matchings_nestings((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(perfect_matchings(2)) e $q$),
  ('perfect_matchings','nestings distribution over n=3 is 5,6,3,1 (k=0..3)','eq','5,6,3,1','equidistributed with crossings, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perfect_matchings_nestings((e).value) k, count(*) c FROM elements(perfect_matchings(3)) e GROUP BY 1) t(k,c) $q$),
  ('perfect_matchings','short pairs over the ordered n=2 fiber','eq','2,0,1','(1,2)(3,4) has 2; (1,4)(2,3) has 1',$q$
    SELECT string_agg(perfect_matchings_short_pairs((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(perfect_matchings(2)) e $q$),
  ('perfect_matchings','short-pairs distribution over n=3 is 5,6,3,1 (k=0..3)','eq','5,6,3,1','grouped counts, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perfect_matchings_short_pairs((e).value) k, count(*) c FROM elements(perfect_matchings(3)) e GROUP BY 1) t(k,c) $q$),
  ('perfect_matchings','widest arc over the ordered n=2 fiber','eq','1,2,3','spans of the outer arc',$q$
    SELECT string_agg(perfect_matchings_widest_arc((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(perfect_matchings(2)) e $q$),
  ('perfect_matchings','widest-arc distribution over n=3 is 1,2,4,5,3 (k=1..5)','eq','1,2,4,5,3','grouped counts, vs sage',$q$
    SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT perfect_matchings_widest_arc((e).value) k, count(*) c FROM elements(perfect_matchings(3)) e GROUP BY 1) t(k,c) $q$),
  ('perfect_matchings','to_set_partition over the ordered n=2 fiber','eq','0011,0101,0110','each pair a block; RGS in codomain form via render_value',$q$
    SELECT string_agg(render_value(perfect_matchings_to_set_partition((e).value)), ',' ORDER BY ordinality(e)) FROM elements(perfect_matchings(2)) e $q$),
  ('perfect_matchings','to_set_partition: (1,4)(2,3) ↦ the set partition {1,4}/{2,3}','eq','0110','a single nesting matching',$q$
    SELECT render_value(perfect_matchings_to_set_partition(ROW(ARRAY[1,4,2,3])::perfect_matching)) $q$),
  ('perfect_matchings','to_set_partition images over n=3 are all set partitions of {1..6} into 3 blocks','eq','true','6 elements, block labels 0..2',$q$
    SELECT bool_and(array_length(((perfect_matchings_to_set_partition((e).value)).rgs),1) = 6
                AND (SELECT max(x) FROM unnest((perfect_matchings_to_set_partition((e).value)).rgs) x) = 2)::text
      FROM elements(perfect_matchings(3)) e $q$);
