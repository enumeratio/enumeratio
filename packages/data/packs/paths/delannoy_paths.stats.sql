-- requires: delannoy_paths, realizer, utilities
-- delannoy_paths statistics — the first stats on this collection. Steps are E=0, N=1, D=2 (see delannoy_paths.sql).
-- diagonal_steps is the classic Delannoy grading (OEIS A008288 tabulates central Delannoy numbers by diagonal-step
-- count); returns/turns/peaks/height/area lean on the diagonal offset h(i) = y_i − x_i of the running position
-- after i steps (E: h −= 1, N: h += 1, D: h unchanged — D never moves a path off the diagonal it's already on).
-- Every path starts and ends at (0,0)/(n,n), i.e. h(0) = h(len) = 0, so height ≥ 0 always but area (its signed
-- running sum) can go negative when a path dips below the diagonal more than it rises above it.
-- north_steps is NOT registered: for this (n,n) collection it is always identical to east_steps (both count to
-- n − diagonal_steps), so it would just be a duplicate function, not a second stat.

-- ── statistics (carrier: delannoy_path(steps int[]) of {0=E, 1=N, 2=D}) ────────────────────────────────────
-- diagonal steps: the number of D steps — the classic Delannoy-triangle grading (A008288).
CREATE FUNCTION delannoy_diagonal_steps(p delannoy_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(count(*) FILTER (WHERE s = 2), 0)::int FROM unnest((p).steps) s $$;
-- east steps: the number of E steps (equals north_steps, both = n − diagonal_steps, on this (n,n) collection).
CREATE FUNCTION delannoy_east_steps(p delannoy_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(count(*) FILTER (WHERE s = 0), 0)::int FROM unnest((p).steps) s $$;
-- returns to the main diagonal: steps after which the running position is back on x=y (h=0). The final step is
-- always one, since every path ends at (n,n).
CREATE FUNCTION delannoy_returns(p delannoy_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (SELECT sum(CASE s WHEN 0 THEN -1 WHEN 1 THEN 1 ELSE 0 END) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q WHERE h = 0 $$;
-- turns / corners: adjacent unequal steps. E=(1,0), N=(0,1), D=(1,1) point in three distinct directions, so any
-- change of step type is a genuine change of direction in the plane.
CREATE FUNCTION delannoy_turns(p delannoy_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).steps, 1) i
   WHERE i < array_length((p).steps, 1) AND (p).steps[i] != (p).steps[i+1] $$;
-- peaks: a local max of the diagonal offset h — an N step (h += 1) immediately followed by an E step (h −= 1),
-- i.e. an NE factor. D holds h flat, so it can't open or close a peak.
CREATE FUNCTION delannoy_peaks(p delannoy_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).steps, 1) i
   WHERE i < array_length((p).steps, 1) AND (p).steps[i] = 1 AND (p).steps[i+1] = 0 $$;
-- height above the diagonal: the maximum running offset h = y−x. Always ≥ 0 since h starts and ends at 0.
CREATE FUNCTION delannoy_height(p delannoy_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(h), 0)::int FROM (SELECT sum(CASE s WHEN 0 THEN -1 WHEN 1 THEN 1 ELSE 0 END) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q $$;
-- area: the signed sum of h after every step — net area between the path and the diagonal. Can be negative (a
-- path spending more of itself below the diagonal than above it scores negative); sums to 0 over any whole fiber,
-- since swapping every E↔N step is a fiber-preserving involution that negates h pointwise.
CREATE FUNCTION delannoy_area(p delannoy_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(h), 0)::int FROM (SELECT sum(CASE s WHEN 0 THEN -1 WHEN 1 THEN 1 ELSE 0 END) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q $$;

-- ── register in base_stat ────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('delannoy_paths','diagonal_steps','delannoy_diagonal_steps','Number of diagonal steps','natural_numbers'),
  ('delannoy_paths','east_steps','delannoy_east_steps','Number of east steps','natural_numbers'),
  ('delannoy_paths','returns','delannoy_returns','Number of returns to the diagonal','natural_numbers'),
  ('delannoy_paths','turns','delannoy_turns','Number of turns','natural_numbers'),
  ('delannoy_paths','peaks','delannoy_peaks','Number of peaks','natural_numbers'),
  ('delannoy_paths','height','delannoy_height','Height above the diagonal','natural_numbers'),
  ('delannoy_paths','area','delannoy_area','Area (signed)','integer_numbers');

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
-- delannoy_paths(1) in rank order: EN,NE,D. delannoy_paths(2) in rank order (13 paths, from delannoy_paths.sql):
--   EENN,ENEN,ENNE,END,EDN,NEEN,NENE,NED,NNEE,NDE,DEN,DNE,DD
-- All values below were pulled straight off elements(delannoy_paths(n)) in this exact rank order and hand-checked
-- against the step encoding (E=0,N=1,D=2; h tracks y−x).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('delannoy_paths','diagonal steps: EN=0, D=1, DD=2','eq','0|1|2','count of D steps',$q$
    SELECT delannoy_diagonal_steps(ROW(ARRAY[0,1])::delannoy_path)::text || '|' ||
           delannoy_diagonal_steps(ROW(ARRAY[2])::delannoy_path)::text || '|' ||
           delannoy_diagonal_steps(ROW(ARRAY[2,2])::delannoy_path)::text $q$),
  ('delannoy_paths','diagonal steps over delannoy_paths(1) in rank order (EN,NE,D)','eq','0,0,1','the three n=1 paths',$q$
    SELECT string_agg(delannoy_diagonal_steps((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(delannoy_paths(1)) e $q$),
  ('delannoy_paths','diagonal steps over delannoy_paths(2) in rank order','eq','0,0,0,1,1,0,0,1,0,1,1,1,2','distribution 6,6,1 (k=0,1,2)',$q$
    SELECT string_agg(delannoy_diagonal_steps((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(delannoy_paths(2)) e $q$),
  ('delannoy_paths','diagonal steps distribution over delannoy_paths(2) is 6,6,1 (matches A008288 row n=2)','eq','6,6,1','#paths with 0,1,2 diagonal steps (sums to 13)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT delannoy_diagonal_steps((e).value) k, count(*) c FROM elements(delannoy_paths(2)) e GROUP BY 1) t(k,c) $q$),
  ('delannoy_paths','east steps: DD=0, EN=1, EE=2','eq','0|1|2','count of E steps',$q$
    SELECT delannoy_east_steps(ROW(ARRAY[2,2])::delannoy_path)::text || '|' ||
           delannoy_east_steps(ROW(ARRAY[0,1])::delannoy_path)::text || '|' ||
           delannoy_east_steps(ROW(ARRAY[0,0])::delannoy_path)::text $q$),
  ('delannoy_paths','east steps over delannoy_paths(2) equal north steps everywhere (fiber is n×n)','eq','true','east_steps ≡ north-count = n − diagonal_steps',$q$
    SELECT bool_and(delannoy_east_steps((e).value) =
      (SELECT count(*)::int FROM unnest(((e).value).steps) s WHERE s = 1))::text
      FROM elements(delannoy_paths(2)) e $q$),
  ('delannoy_paths','returns: EN=1, NE=1, D=1','eq','1|1|1','every n=1 path returns exactly once (at the last step)',$q$
    SELECT delannoy_returns(ROW(ARRAY[0,1])::delannoy_path)::text || '|' ||
           delannoy_returns(ROW(ARRAY[1,0])::delannoy_path)::text || '|' ||
           delannoy_returns(ROW(ARRAY[2])::delannoy_path)::text $q$),
  ('delannoy_paths','returns over delannoy_paths(2) in rank order','eq','1,2,2,2,1,2,2,2,1,1,2,2,2','touch-downs to x=y',$q$
    SELECT string_agg(delannoy_returns((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(delannoy_paths(2)) e $q$),
  ('delannoy_paths','returns distribution over delannoy_paths(2) is 4,9 (k=1,2)','eq','4,9','#paths with 1,2 returns (sums to 13)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT delannoy_returns((e).value) k, count(*) c FROM elements(delannoy_paths(2)) e GROUP BY 1) t(k,c) $q$),
  ('delannoy_paths','turns: EN=1 (one change), ENEN=3, DD=0 (no changes)','eq','1|3|0','count of adjacent unequal steps',$q$
    SELECT delannoy_turns(ROW(ARRAY[0,1])::delannoy_path)::text || '|' ||
           delannoy_turns(ROW(ARRAY[0,1,0,1])::delannoy_path)::text || '|' ||
           delannoy_turns(ROW(ARRAY[2,2])::delannoy_path)::text $q$),
  ('delannoy_paths','turns over delannoy_paths(2) in rank order','eq','1,3,2,2,2,2,3,2,1,2,2,2,0','direction changes per path',$q$
    SELECT string_agg(delannoy_turns((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(delannoy_paths(2)) e $q$),
  ('delannoy_paths','turns distribution over delannoy_paths(2) is 1,2,8,2 (k=0..3)','eq','1,2,8,2','#paths with 0,1,2,3 turns (sums to 13)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT delannoy_turns((e).value) k, count(*) c FROM elements(delannoy_paths(2)) e GROUP BY 1) t(k,c) $q$),
  ('delannoy_paths','peaks: NE=1 (a peak), EN=0, NENE=2','eq','0|1|2','count of N-then-E factors',$q$
    SELECT delannoy_peaks(ROW(ARRAY[0,1])::delannoy_path)::text || '|' ||
           delannoy_peaks(ROW(ARRAY[1,0])::delannoy_path)::text || '|' ||
           delannoy_peaks(ROW(ARRAY[1,0,1,0])::delannoy_path)::text $q$),
  ('delannoy_paths','peaks over delannoy_paths(2) in rank order','eq','0,1,1,0,0,1,2,1,1,0,0,1,0','local maxima of y−x',$q$
    SELECT string_agg(delannoy_peaks((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(delannoy_paths(2)) e $q$),
  ('delannoy_paths','peaks distribution over delannoy_paths(2) is 6,6,1 (k=0,1,2)','eq','6,6,1','#paths with 0,1,2 peaks (sums to 13)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT delannoy_peaks((e).value) k, count(*) c FROM elements(delannoy_paths(2)) e GROUP BY 1) t(k,c) $q$),
  ('delannoy_paths','height: EN=0 (dips first), NE=1 (rises then returns), NNEE=2','eq','0|1|2','max of y−x along the path',$q$
    SELECT delannoy_height(ROW(ARRAY[0,1])::delannoy_path)::text || '|' ||
           delannoy_height(ROW(ARRAY[1,0])::delannoy_path)::text || '|' ||
           delannoy_height(ROW(ARRAY[1,1,0,0])::delannoy_path)::text $q$),
  ('delannoy_paths','height over delannoy_paths(2) in rank order','eq','0,0,1,0,0,1,1,1,2,1,0,1,0','max diagonal offset per path',$q$
    SELECT string_agg(delannoy_height((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(delannoy_paths(2)) e $q$),
  ('delannoy_paths','height distribution over delannoy_paths(2) is 6,6,1 (k=0,1,2)','eq','6,6,1','#paths reaching height 0,1,2 (sums to 13)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT delannoy_height((e).value) k, count(*) c FROM elements(delannoy_paths(2)) e GROUP BY 1) t(k,c) $q$),
  ('delannoy_paths','area: EN=−1 (dips below), NE=1 (rises above), NNEE=4','eq','-1|1|4','signed sum of y−x after each step',$q$
    SELECT delannoy_area(ROW(ARRAY[0,1])::delannoy_path)::text || '|' ||
           delannoy_area(ROW(ARRAY[1,0])::delannoy_path)::text || '|' ||
           delannoy_area(ROW(ARRAY[1,1,0,0])::delannoy_path)::text $q$),
  ('delannoy_paths','area over delannoy_paths(2) in rank order','eq','-4,-2,0,-1,-2,0,2,1,4,2,-1,1,0','net signed area vs the diagonal',$q$
    SELECT string_agg(delannoy_area((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(delannoy_paths(2)) e $q$),
  ('delannoy_paths','area sums to 0 over delannoy_paths(1), (2) and (3): the E↔N mirror is area-negating','eq','0|0|0','fiber-wide cancellation',$q$
    SELECT (SELECT sum(delannoy_area((e).value)) FROM elements(delannoy_paths(1)) e)::text || '|' ||
           (SELECT sum(delannoy_area((e).value)) FROM elements(delannoy_paths(2)) e)::text || '|' ||
           (SELECT sum(delannoy_area((e).value)) FROM elements(delannoy_paths(3)) e)::text $q$),
  ('delannoy_paths','empty path (n=0): every stat is 0','eq','0|0|0|0|0|0|0','edge case, no steps',$q$
    SELECT delannoy_diagonal_steps((unrank(delannoy_paths(0),0)).value)::text || '|' ||
           delannoy_east_steps((unrank(delannoy_paths(0),0)).value)::text || '|' ||
           delannoy_returns((unrank(delannoy_paths(0),0)).value)::text || '|' ||
           delannoy_turns((unrank(delannoy_paths(0),0)).value)::text || '|' ||
           delannoy_peaks((unrank(delannoy_paths(0),0)).value)::text || '|' ||
           delannoy_height((unrank(delannoy_paths(0),0)).value)::text || '|' ||
           delannoy_area((unrank(delannoy_paths(0),0)).value)::text $q$);
