-- requires: motzkin_paths, realizer, utilities
-- motzkin_paths statistics & maps — the classic Motzkin-word invariants: up steps (# of U), level steps (# of L),
-- height (max prefix sum), peaks (a U immediately followed by a D), and returns (prefix sums back on the axis).
-- REVERSE-COMPLEMENT (read the word right-to-left and negate every step, U↔D, L fixed) is a Motzkin involution —
-- it lands back in motzkin_paths on the same fiber (prefix sum of the image at k is S(n)-S(n-k) = S(n-k) >= 0).

-- ── statistics (carrier: motzkin_path(steps int[]) of +1/0/-1) ──────────────────────────────────────────
-- up steps: the number of +1 steps (equals the number of -1 steps).
CREATE FUNCTION motzkin_up_steps(p motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(count(*) FILTER (WHERE s = 1), 0)::int FROM unnest((p).steps) s $$;
-- level steps: the number of 0 (flat) steps.
CREATE FUNCTION motzkin_level_steps(p motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(count(*) FILTER (WHERE s = 0), 0)::int FROM unnest((p).steps) s $$;
-- height: the maximum prefix sum (how high the path rises above the axis).
CREATE FUNCTION motzkin_height(p motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(h), 0)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q $$;
-- peaks: a +1 immediately followed by a -1 (a UD factor).
CREATE FUNCTION motzkin_peaks(p motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).steps, 1) i
   WHERE i < array_length((p).steps, 1) AND (p).steps[i] = 1 AND (p).steps[i+1] = -1 $$;
-- returns: the number of steps after which the running height is back on the axis (each maximal arch ends in one).
CREATE FUNCTION motzkin_returns(p motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q WHERE h = 0 $$;
-- flat steps at height 0: L steps taken while the running height (before the step) is already 0.
CREATE FUNCTION motzkin_flat_steps_at_zero(p motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (SELECT s, sum(s) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q WHERE s = 0 AND coalesce(h, 0) = 0 $$;
-- humps: ground-level peaks — a UD factor whose U step starts at height 0. A stricter cousin of peaks (a peak
-- like the second UD in UUDD sits at height 1, not a hump); Motzkin paths with no humps are counted by the
-- Riordan numbers (A005043).
CREATE FUNCTION motzkin_humps(p motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).steps, 1) i
   WHERE i < array_length((p).steps, 1) AND (p).steps[i] = 1 AND (p).steps[i+1] = -1
     AND (SELECT coalesce(sum((p).steps[j]), 0) FROM generate_series(1, i-1) j) = 0 $$;
-- longest flat run: the length of the longest maximal run of consecutive L (level) steps.
CREATE FUNCTION motzkin_longest_flat_run(p motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(cnt), 0)::int FROM (
    SELECT count(*) cnt FROM (
      SELECT o - row_number() OVER (ORDER BY o) AS g
      FROM unnest((p).steps) WITH ORDINALITY AS t(s, o) WHERE s = 0) z
    GROUP BY g) q $$;
-- area: the sum of the running height after every step — the area between the path and the axis.
CREATE FUNCTION motzkin_area(p motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(h), 0)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q $$;

-- ── map → motzkin_paths ─────────────────────────────────────────────────────────────────────────────────
-- reverse-complement: read the word right-to-left and negate every step, w'(i) = -w(n+1-i). U↔D, L stays L. A
-- Motzkin path stays a Motzkin path (an involution on each fiber).
CREATE FUNCTION motzkin_reverse_complement(p motzkin_path) RETURNS motzkin_path LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(SELECT -(p).steps[array_length((p).steps, 1) + 1 - i]
                   FROM generate_subscripts((p).steps, 1) i))::motzkin_path $$;

-- ── register in base_stat / base_map ────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('motzkin_paths','up_steps','motzkin_up_steps','Number of up steps','natural_numbers'),
  ('motzkin_paths','level_steps','motzkin_level_steps','Number of level steps','natural_numbers'),
  ('motzkin_paths','height','motzkin_height','Height','natural_numbers'),
  ('motzkin_paths','peaks','motzkin_peaks','Number of peaks','natural_numbers'),
  ('motzkin_paths','returns','motzkin_returns','Number of returns','natural_numbers'),
  ('motzkin_paths','flat_steps_at_zero','motzkin_flat_steps_at_zero','Flat steps at height 0','natural_numbers'),
  ('motzkin_paths','humps','motzkin_humps','Number of humps','natural_numbers'),
  ('motzkin_paths','longest_flat_run','motzkin_longest_flat_run','Longest flat run','natural_numbers'),
  ('motzkin_paths','area','motzkin_area','Area','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('motzkin_paths','reverse_complement','motzkin_reverse_complement','motzkin_paths','Reverse-complement',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- motzkin_paths(3) in rank order: LLL,LUD,UDL,ULD; motzkin_paths(4) has 9 paths, (5) has 21.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('motzkin_paths','up steps: LLL=0, UDL=1, UUDD=2','eq','0|1|2','count of U steps',$q$
    SELECT motzkin_up_steps(ROW(ARRAY[0,0,0])::motzkin_path)::text || '|' ||
           motzkin_up_steps(ROW(ARRAY[1,-1,0])::motzkin_path)::text || '|' ||
           motzkin_up_steps(ROW(ARRAY[1,1,-1,-1])::motzkin_path)::text $q$),
  ('motzkin_paths','up steps distribution over motzkin_paths(4) is 1,6,2','eq','1,6,2','#paths with 0,1,2 up steps (sums to 9)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_up_steps((e).value) k, count(*) c FROM elements(motzkin_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','up steps distribution over motzkin_paths(5) is 1,10,10','eq','1,10,10','#paths with 0,1,2 up steps (sums to 21)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_up_steps((e).value) k, count(*) c FROM elements(motzkin_paths(5)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','level steps: LLL=3, UDL=1, UUDD=0','eq','3|1|0','count of L steps',$q$
    SELECT motzkin_level_steps(ROW(ARRAY[0,0,0])::motzkin_path)::text || '|' ||
           motzkin_level_steps(ROW(ARRAY[1,-1,0])::motzkin_path)::text || '|' ||
           motzkin_level_steps(ROW(ARRAY[1,1,-1,-1])::motzkin_path)::text $q$),
  ('motzkin_paths','level steps distribution over motzkin_paths(4) is 2,6,1','eq','2,6,1','#paths with 0,2,4 level steps (odd counts absent; sums to 9)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_level_steps((e).value) k, count(*) c FROM elements(motzkin_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','height: LLL=0, UDUD=1, UUDD=2','eq','0|1|2','max prefix sum',$q$
    SELECT motzkin_height(ROW(ARRAY[0,0,0])::motzkin_path)::text || '|' ||
           motzkin_height(ROW(ARRAY[1,-1,1,-1])::motzkin_path)::text || '|' ||
           motzkin_height(ROW(ARRAY[1,1,-1,-1])::motzkin_path)::text $q$),
  ('motzkin_paths','height distribution over motzkin_paths(4) is 1,7,1','eq','1,7,1','#paths of height 0,1,2 (sums to 9)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_height((e).value) k, count(*) c FROM elements(motzkin_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','height distribution over motzkin_paths(5) is 1,15,5','eq','1,15,5','#paths of height 0,1,2 (sums to 21)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_height((e).value) k, count(*) c FROM elements(motzkin_paths(5)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','peaks: UD=1, UUDD=1, UDUD=2, LLL=0','eq','1|1|2|0','count of UD factors',$q$
    SELECT motzkin_peaks(ROW(ARRAY[1,-1])::motzkin_path)::text || '|' ||
           motzkin_peaks(ROW(ARRAY[1,1,-1,-1])::motzkin_path)::text || '|' ||
           motzkin_peaks(ROW(ARRAY[1,-1,1,-1])::motzkin_path)::text || '|' ||
           motzkin_peaks(ROW(ARRAY[0,0,0])::motzkin_path)::text $q$),
  ('motzkin_paths','peaks distribution over motzkin_paths(4) is 4,4,1','eq','4,4,1','#paths with 0,1,2 peaks (sums to 9)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_peaks((e).value) k, count(*) c FROM elements(motzkin_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','peaks distribution over motzkin_paths(5) is 8,10,3','eq','8,10,3','#paths with 0,1,2 peaks (sums to 21)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_peaks((e).value) k, count(*) c FROM elements(motzkin_paths(5)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','returns: LLL=3, UDL=2, UD=1','eq','3|2|1','touch-downs to the axis',$q$
    SELECT motzkin_returns(ROW(ARRAY[0,0,0])::motzkin_path)::text || '|' ||
           motzkin_returns(ROW(ARRAY[1,-1,0])::motzkin_path)::text || '|' ||
           motzkin_returns(ROW(ARRAY[1,-1])::motzkin_path)::text $q$),
  ('motzkin_paths','returns distribution over motzkin_paths(4) is 2,3,3,1','eq','2,3,3,1','#paths with 1,2,3,4 returns (sums to 9)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_returns((e).value) k, count(*) c FROM elements(motzkin_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','returns distribution over motzkin_paths(5) is 4,6,6,4,1','eq','4,6,6,4,1','#paths with 1..5 returns (sums to 21)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_returns((e).value) k, count(*) c FROM elements(motzkin_paths(5)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','empty path (n=0): every stat is 0','eq','0|0|0|0|0','edge case, no steps',$q$
    SELECT motzkin_up_steps((unrank(motzkin_paths(0),0)).value)::text || '|' ||
           motzkin_level_steps((unrank(motzkin_paths(0),0)).value)::text || '|' ||
           motzkin_height((unrank(motzkin_paths(0),0)).value)::text || '|' ||
           motzkin_peaks((unrank(motzkin_paths(0),0)).value)::text || '|' ||
           motzkin_returns((unrank(motzkin_paths(0),0)).value)::text $q$),
  ('motzkin_paths','reverse-complement: UDL ↦ LUD; LLL and ULD are fixed','eq','LUD|LLL|ULD','mirror-and-negate (U↔D, L fixed)',$q$
    SELECT notation(motzkin_reverse_complement(ROW(ARRAY[1,-1,0])::motzkin_path)) || '|' ||
           notation(motzkin_reverse_complement(ROW(ARRAY[0,0,0])::motzkin_path)) || '|' ||
           notation(motzkin_reverse_complement(ROW(ARRAY[1,0,-1])::motzkin_path)) $q$),
  ('motzkin_paths','reverse-complement over motzkin_paths(3) in rank order','eq','LLL,UDL,LUD,ULD','image of each of the 4 paths (LLL,LUD,UDL,ULD)',$q$
    SELECT string_agg(notation(motzkin_reverse_complement((e).value)), ',' ORDER BY ordinality(e)) FROM elements(motzkin_paths(3)) e $q$),
  ('motzkin_paths','reverse-complement is an involution on motzkin_paths(5)','eq','true','applying it twice is the identity',$q$
    SELECT bool_and(((motzkin_reverse_complement(motzkin_reverse_complement((e).value))).steps) = ((e).value).steps)::text
      FROM elements(motzkin_paths(5)) e $q$),
  ('motzkin_paths','reverse-complement image renders in the codomain (motzkin_paths) form','eq','LUD','render_value on a motzkin_path image',$q$
    SELECT render_value(motzkin_reverse_complement(ROW(ARRAY[1,-1,0])::motzkin_path)) $q$),
  ('motzkin_paths','flat steps at height 0: LLL=3, LUD=1, UDL=1, ULD=0','eq','3|1|1|0','L steps taken while already on the axis',$q$
    SELECT motzkin_flat_steps_at_zero(ROW(ARRAY[0,0,0])::motzkin_path)::text || '|' ||
           motzkin_flat_steps_at_zero(ROW(ARRAY[0,1,-1])::motzkin_path)::text || '|' ||
           motzkin_flat_steps_at_zero(ROW(ARRAY[1,-1,0])::motzkin_path)::text || '|' ||
           motzkin_flat_steps_at_zero(ROW(ARRAY[1,0,-1])::motzkin_path)::text $q$),
  ('motzkin_paths','flat-steps-at-zero distribution over motzkin_paths(4) is 3,2,3,1','eq','3,2,3,1','#paths with 0,1,2,4 such flats (sums to 9)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_flat_steps_at_zero((e).value) k, count(*) c FROM elements(motzkin_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','humps: LLL=0, LUD=1, UDL=1, ULD=0','eq','0|1|1|0','ground-level UD peaks (U step starts at height 0)',$q$
    SELECT motzkin_humps(ROW(ARRAY[0,0,0])::motzkin_path)::text || '|' ||
           motzkin_humps(ROW(ARRAY[0,1,-1])::motzkin_path)::text || '|' ||
           motzkin_humps(ROW(ARRAY[1,-1,0])::motzkin_path)::text || '|' ||
           motzkin_humps(ROW(ARRAY[1,0,-1])::motzkin_path)::text $q$),
  ('motzkin_paths','humps vs peaks differ on UUDD: peaks=1 (the UD at height 1), humps=0 (not ground-level)','eq','1|0','a peak that is not a hump',$q$
    SELECT motzkin_peaks(ROW(ARRAY[1,1,-1,-1])::motzkin_path)::text || '|' ||
           motzkin_humps(ROW(ARRAY[1,1,-1,-1])::motzkin_path)::text $q$),
  ('motzkin_paths','humps distribution over motzkin_paths(4) is 5,3,1','eq','5,3,1','#paths with 0,1,2 humps (sums to 9)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_humps((e).value) k, count(*) c FROM elements(motzkin_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','longest flat run: LLL=3, LUD=1, UDL=1, ULD=1','eq','3|1|1|1','longest island of consecutive L steps',$q$
    SELECT motzkin_longest_flat_run(ROW(ARRAY[0,0,0])::motzkin_path)::text || '|' ||
           motzkin_longest_flat_run(ROW(ARRAY[0,1,-1])::motzkin_path)::text || '|' ||
           motzkin_longest_flat_run(ROW(ARRAY[1,-1,0])::motzkin_path)::text || '|' ||
           motzkin_longest_flat_run(ROW(ARRAY[1,0,-1])::motzkin_path)::text $q$),
  ('motzkin_paths','longest-flat-run distribution over motzkin_paths(4) is 2,3,3,1','eq','2,3,3,1','#paths with longest run 0,1,2,4 (sums to 9)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_longest_flat_run((e).value) k, count(*) c FROM elements(motzkin_paths(4)) e GROUP BY 1) t(k,c) $q$),
  ('motzkin_paths','area: LLL=0, LUD=1, UDL=1, ULD=2','eq','0|1|1|2','sum of the height after each step',$q$
    SELECT motzkin_area(ROW(ARRAY[0,0,0])::motzkin_path)::text || '|' ||
           motzkin_area(ROW(ARRAY[0,1,-1])::motzkin_path)::text || '|' ||
           motzkin_area(ROW(ARRAY[1,-1,0])::motzkin_path)::text || '|' ||
           motzkin_area(ROW(ARRAY[1,0,-1])::motzkin_path)::text $q$),
  ('motzkin_paths','area distribution over motzkin_paths(4) is 1,3,3,1,1','eq','1,3,3,1,1','#paths with area 0,1,2,3,4 (sums to 9)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT motzkin_area((e).value) k, count(*) c FROM elements(motzkin_paths(4)) e GROUP BY 1) t(k,c) $q$);
