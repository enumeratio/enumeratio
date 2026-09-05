-- requires: dyck_paths, dyck_paths.stats, realizer, utilities
-- dyck_paths — four more classic invariants (#226): major index of the path word, initial rise, the count of
-- touch points on the axis, and hills (ground-level peaks — the same predicate fine_paths restricts away). Plus
-- the q,t-Catalan data: the symmetry Σ q^area t^dinv = Σ q^dinv t^area (Garsia–Haiman) and the area~bounce
-- equidistribution, both checked for every n ≤ 5 (dyck_paths.stats.sql only checked n=4).

-- major index: sum of the positions i where step i is U and step i+1 is D (a peak) — the Mahonian-style
-- descent-weighted statistic of the path word, read as a sequence over {U,D}.
CREATE FUNCTION dyck_major_index(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(o), 0)::int FROM generate_subscripts((d).steps, 1) o
   WHERE o < array_length((d).steps, 1) AND (d).steps[o] = 1 AND (d).steps[o+1] = -1 $$;

-- initial rise: the length of the leading run of U steps (0 for the empty path or a path starting with D —
-- the latter never occurs in dyck_paths, but the function is total).
CREATE FUNCTION dyck_initial_rise(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(min(o) - 1, array_length((d).steps, 1), 0)::int
  FROM generate_subscripts((d).steps, 1) o WHERE (d).steps[o] = -1 $$;

-- number of touch points: how many times the path touches the axis, counting BOTH the start (0) and every
-- return — one more than `returns` (which counts only the returns after the start).
CREATE FUNCTION dyck_touch_points(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT dyck_returns(d) + 1 $$;

-- hills: ground-level peaks — a UD factor whose U starts at height 0 (fine_paths is exactly the restriction to
-- paths with zero hills).
CREATE FUNCTION dyck_hills(d dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (
    SELECT s, lead(s) OVER (ORDER BY o) AS s2, sum(s) OVER (ORDER BY o) - s AS pre
    FROM unnest((d).steps) WITH ORDINALITY AS t(s, o)
  ) q WHERE s = 1 AND s2 = -1 AND pre = 0 $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('dyck_paths','major_index','dyck_major_index','Major index','natural_numbers'),
  ('dyck_paths','initial_rise','dyck_initial_rise','Initial rise','natural_numbers'),
  ('dyck_paths','number_of_touch_points','dyck_touch_points','Number of touch points','natural_numbers'),
  ('dyck_paths','hills','dyck_hills','Number of hills','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- dyck_paths(3) in rank order: UUUDDD,UUDUDD,UUDDUD,UDUUDD,UDUDUD.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dyck_paths','major index over dyck_paths(3) in rank order is 3,6,7,5,9','eq','3,6,7,5,9','sum of peak positions per path',$q$
    SELECT string_agg(dyck_major_index((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','major index: UUDD=2 (peak at position 2), UDUD=4 (peaks at 1,3), UUDDUD=7 (peaks at 2,5)','eq','2|4|7','peak positions summed',$q$
    SELECT dyck_major_index(ROW(ARRAY[1,1,-1,-1])::dyck_path)::text || '|' ||
           dyck_major_index(ROW(ARRAY[1,-1,1,-1])::dyck_path)::text || '|' ||
           dyck_major_index(ROW(ARRAY[1,1,-1,-1,1,-1])::dyck_path)::text $q$),
  ('dyck_paths','initial rise over dyck_paths(3) in rank order is 3,2,2,1,1','eq','3,2,2,1,1','length of the leading U-run per path',$q$
    SELECT string_agg(dyck_initial_rise((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','initial rise: UUDD=2, UDUD=1, empty path=0','eq','2|1|0','leading run of U steps',$q$
    SELECT dyck_initial_rise(ROW(ARRAY[1,1,-1,-1])::dyck_path)::text || '|' ||
           dyck_initial_rise(ROW(ARRAY[1,-1,1,-1])::dyck_path)::text || '|' ||
           dyck_initial_rise((unrank(dyck_paths(0),0)).value)::text $q$),
  ('dyck_paths','touch points = returns + 1 for every path in dyck_paths(4)','eq','true','identity by construction, checked structurally',$q$
    SELECT bool_and(dyck_touch_points((e).value) = dyck_returns((e).value) + 1)::text FROM elements(dyck_paths(4)) e $q$),
  ('dyck_paths','touch points over dyck_paths(3) in rank order is 2,2,3,3,4','eq','2,2,3,3,4','axis touches including the start',$q$
    SELECT string_agg(dyck_touch_points((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  ('dyck_paths','hills over dyck_paths(3) in rank order is 0,0,1,1,3','eq','0,0,1,1,3','ground-level peaks per path (UDUDUD has 3, one per arch)',$q$
    SELECT string_agg(dyck_hills((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(dyck_paths(3)) e $q$),
  -- (the fine_paths cross-check example moved to packs/paths/dyck_paths.stats2.paths.sql — fine_paths is a
  -- `paths`-pack collection, #283 phase 3)
  ('dyck_paths','empty path (n=0): all four new stats are 0','eq','0|0|0|0','edge case, no steps',$q$
    SELECT dyck_major_index((unrank(dyck_paths(0),0)).value)::text || '|' ||
           dyck_initial_rise((unrank(dyck_paths(0),0)).value)::text || '|' ||
           (dyck_touch_points((unrank(dyck_paths(0),0)).value) - 1)::text || '|' ||
           dyck_hills((unrank(dyck_paths(0),0)).value)::text $q$),
  -- q,t-Catalan data: Σ q^area t^dinv = Σ q^dinv t^area (Garsia–Haiman symmetry), checked for n=0..5 by comparing
  -- the (area,dinv) multiset to its transpose (encoded as area*1000+dinv, well clear of collisions at n≤5).
  ('dyck_paths','q,t-Catalan symmetry Σq^area·t^dinv = Σq^dinv·t^area holds for n=0..5','eq','true','Garsia–Haiman: swapping (area,dinv) preserves the multiset',$q$
    SELECT bool_and(
      (SELECT array_agg(k ORDER BY k) FROM (SELECT dyck_area((e).value)*1000 + dyck_dinv((e).value) k FROM elements(dyck_paths(n)) e) t1)
      =
      (SELECT array_agg(k ORDER BY k) FROM (SELECT dyck_dinv((e).value)*1000 + dyck_area((e).value) k FROM elements(dyck_paths(n)) e) t2)
    )::text FROM generate_series(0,5) n $q$),
  ('dyck_paths','area is equidistributed with bounce for n=0..5 (the q,t-Catalan symmetric-function identity, statistic form)','eq','true','same distribution, not just same total, at every n',$q$
    SELECT bool_and(
      (SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT dyck_area((e).value) k, count(*) c FROM elements(dyck_paths(n)) e GROUP BY 1) t)
      =
      (SELECT string_agg(c::text, ',' ORDER BY k) FROM (SELECT dyck_bounce((e).value) k, count(*) c FROM elements(dyck_paths(n)) e GROUP BY 1) t)
    )::text FROM generate_series(0,5) n $q$);
