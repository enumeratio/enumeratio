-- requires: colored_motzkin_paths, realizer, utilities
-- colored_motzkin_paths statistics — the plain Motzkin invariants (up steps, level steps, height, peaks, returns,
-- flat-steps-at-zero) carry over unchanged from the uncolored steps array; color_sum is the one genuinely new
-- statistic, summing the H-step colors (0..r-1) — a per-element number even though r itself varies by fiber, so
-- it stands in for "level steps by color" without hard-coding a color count.

-- ── statistics (carrier: colored_motzkin_path(steps int[], colors int[])) ──────────────────────────────
-- up steps: the number of +1 steps (equals the number of -1 steps).
CREATE FUNCTION colored_motzkin_up_steps(p colored_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(count(*) FILTER (WHERE s = 1), 0)::int FROM unnest((p).steps) s $$;
-- level steps: the number of 0 (H, level) steps, of any color.
CREATE FUNCTION colored_motzkin_level_steps(p colored_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(count(*) FILTER (WHERE s = 0), 0)::int FROM unnest((p).steps) s $$;
-- color sum: the sum of the H-step colors (U/D contribute nothing — their color slot is the -1 placeholder).
CREATE FUNCTION colored_motzkin_color_sum(p colored_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(c) FILTER (WHERE s = 0), 0)::int FROM unnest((p).steps, (p).colors) t(s, c) $$;
-- height: the maximum prefix sum (how high the path rises above the axis).
CREATE FUNCTION colored_motzkin_height(p colored_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(h), 0)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q $$;
-- peaks: a +1 immediately followed by a -1 (a UD factor), any H color in between disqualifies it.
CREATE FUNCTION colored_motzkin_peaks(p colored_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).steps, 1) i
   WHERE i < array_length((p).steps, 1) AND (p).steps[i] = 1 AND (p).steps[i+1] = -1 $$;
-- returns: the number of steps after which the running height is back on the axis (each maximal arch ends in one).
CREATE FUNCTION colored_motzkin_returns(p colored_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q WHERE h = 0 $$;
-- flat steps at height 0: H steps (of any color) taken while the running height (before the step) is already 0.
CREATE FUNCTION colored_motzkin_flat_steps_at_zero(p colored_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (SELECT s, sum(s) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q WHERE s = 0 AND coalesce(h, 0) = 0 $$;

-- ── register in base_stat ────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('colored_motzkin_paths','up_steps','colored_motzkin_up_steps','Number of up steps','natural_numbers'),
  ('colored_motzkin_paths','level_steps','colored_motzkin_level_steps','Number of level steps','natural_numbers'),
  ('colored_motzkin_paths','color_sum','colored_motzkin_color_sum','Sum of level-step colors','natural_numbers'),
  ('colored_motzkin_paths','height','colored_motzkin_height','Height','natural_numbers'),
  ('colored_motzkin_paths','peaks','colored_motzkin_peaks','Number of peaks','natural_numbers'),
  ('colored_motzkin_paths','returns','colored_motzkin_returns','Number of returns','natural_numbers'),
  ('colored_motzkin_paths','flat_steps_at_zero','colored_motzkin_flat_steps_at_zero','Flat steps at height 0','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- colored_motzkin_paths(3,2) in rank order (14 elements, corpus anchor from colored_motzkin_paths.sql):
-- 0 UH0D  1 UH1D  2 UDH0  3 UDH1  4 H0UD  5 H0H0H0  6 H0H0H1  7 H0H1H0  8 H0H1H1
-- 9 H1UD  10 H1H0H0  11 H1H0H1  12 H1H1H0  13 H1H1H1
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('colored_motzkin_paths','up steps: UH0D=1, UDH0=1, H0H1H1=0','eq','1|1|0','count of U steps, color-blind',$q$
    SELECT colored_motzkin_up_steps(ROW(ARRAY[1,0,-1], ARRAY[-1,0,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_up_steps(ROW(ARRAY[1,-1,0], ARRAY[-1,-1,0])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_up_steps(ROW(ARRAY[0,0,0], ARRAY[0,1,1])::colored_motzkin_path)::text $q$),
  ('colored_motzkin_paths','up steps distribution over colored_motzkin_paths(3,2) is 0:8, 1:6','eq','0,8|1,6','sums to 14',$q$
    SELECT string_agg(k || ',' || c, '|' ORDER BY k)
      FROM (SELECT colored_motzkin_up_steps((e).value) k, count(*) c FROM elements(colored_motzkin_paths(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('colored_motzkin_paths','level steps: UH0D=1, UDH0=1, H0H1H1=3','eq','1|1|3','count of H steps, any color',$q$
    SELECT colored_motzkin_level_steps(ROW(ARRAY[1,0,-1], ARRAY[-1,0,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_level_steps(ROW(ARRAY[1,-1,0], ARRAY[-1,-1,0])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_level_steps(ROW(ARRAY[0,0,0], ARRAY[0,1,1])::colored_motzkin_path)::text $q$),
  ('colored_motzkin_paths','level steps distribution over colored_motzkin_paths(3,2) is 1:6, 3:8','eq','1,6|3,8','sums to 14',$q$
    SELECT string_agg(k || ',' || c, '|' ORDER BY k)
      FROM (SELECT colored_motzkin_level_steps((e).value) k, count(*) c FROM elements(colored_motzkin_paths(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('colored_motzkin_paths','color sum: UH0D=0, UH1D=1, H0H1H1=2, H1H1H1=3','eq','0|1|2|3','sum of H-step colors (U/D contribute 0)',$q$
    SELECT colored_motzkin_color_sum(ROW(ARRAY[1,0,-1], ARRAY[-1,0,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_color_sum(ROW(ARRAY[1,0,-1], ARRAY[-1,1,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_color_sum(ROW(ARRAY[0,0,0], ARRAY[0,1,1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_color_sum(ROW(ARRAY[0,0,0], ARRAY[1,1,1])::colored_motzkin_path)::text $q$),
  ('colored_motzkin_paths','color sum distribution over colored_motzkin_paths(3,2) is 0:4, 1:6, 2:3, 3:1','eq','0,4|1,6|2,3|3,1','sums to 14',$q$
    SELECT string_agg(k || ',' || c, '|' ORDER BY k)
      FROM (SELECT colored_motzkin_color_sum((e).value) k, count(*) c FROM elements(colored_motzkin_paths(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('colored_motzkin_paths','color sum distribution over colored_motzkin_paths(2,3) is 0:2, 1:2, 2:3, 3:2, 4:1','eq','0,2|1,2|2,3|3,2|4,1','r=3 colors 0..2, sums to 10',$q$
    SELECT string_agg(k || ',' || c, '|' ORDER BY k)
      FROM (SELECT colored_motzkin_color_sum((e).value) k, count(*) c FROM elements(colored_motzkin_paths(2,3)) e GROUP BY 1) t(k,c) $q$),
  ('colored_motzkin_paths','height: UH0D=1, H0UD=1, H0H1H1=0','eq','1|1|0','max prefix sum, color-blind',$q$
    SELECT colored_motzkin_height(ROW(ARRAY[1,0,-1], ARRAY[-1,0,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_height(ROW(ARRAY[0,1,-1], ARRAY[0,-1,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_height(ROW(ARRAY[0,0,0], ARRAY[0,1,1])::colored_motzkin_path)::text $q$),
  ('colored_motzkin_paths','height distribution over colored_motzkin_paths(3,2) is 0:8, 1:6','eq','0,8|1,6','sums to 14',$q$
    SELECT string_agg(k || ',' || c, '|' ORDER BY k)
      FROM (SELECT colored_motzkin_height((e).value) k, count(*) c FROM elements(colored_motzkin_paths(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('colored_motzkin_paths','peaks: UH0D=0 (H0 splits U/D), UDH0=1, H0UD=1','eq','0|1|1','UD factor, an H color in between disqualifies it',$q$
    SELECT colored_motzkin_peaks(ROW(ARRAY[1,0,-1], ARRAY[-1,0,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_peaks(ROW(ARRAY[1,-1,0], ARRAY[-1,-1,0])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_peaks(ROW(ARRAY[0,1,-1], ARRAY[0,-1,-1])::colored_motzkin_path)::text $q$),
  ('colored_motzkin_paths','peaks distribution over colored_motzkin_paths(3,2) is 0:10, 1:4','eq','0,10|1,4','sums to 14',$q$
    SELECT string_agg(k || ',' || c, '|' ORDER BY k)
      FROM (SELECT colored_motzkin_peaks((e).value) k, count(*) c FROM elements(colored_motzkin_paths(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('colored_motzkin_paths','returns: UH0D=1, UDH0=2, H0H1H1=3','eq','1|2|3','touch-downs to the axis',$q$
    SELECT colored_motzkin_returns(ROW(ARRAY[1,0,-1], ARRAY[-1,0,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_returns(ROW(ARRAY[1,-1,0], ARRAY[-1,-1,0])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_returns(ROW(ARRAY[0,0,0], ARRAY[0,1,1])::colored_motzkin_path)::text $q$),
  ('colored_motzkin_paths','returns distribution over colored_motzkin_paths(3,2) is 1:2, 2:4, 3:8','eq','1,2|2,4|3,8','sums to 14',$q$
    SELECT string_agg(k || ',' || c, '|' ORDER BY k)
      FROM (SELECT colored_motzkin_returns((e).value) k, count(*) c FROM elements(colored_motzkin_paths(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('colored_motzkin_paths','flat steps at height 0: UH0D=0, UDH0=1, H0UD=1, H0H1H1=3','eq','0|1|1|3','H steps taken while already on the axis',$q$
    SELECT colored_motzkin_flat_steps_at_zero(ROW(ARRAY[1,0,-1], ARRAY[-1,0,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_flat_steps_at_zero(ROW(ARRAY[1,-1,0], ARRAY[-1,-1,0])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_flat_steps_at_zero(ROW(ARRAY[0,1,-1], ARRAY[0,-1,-1])::colored_motzkin_path)::text || '|' ||
           colored_motzkin_flat_steps_at_zero(ROW(ARRAY[0,0,0], ARRAY[0,1,1])::colored_motzkin_path)::text $q$),
  ('colored_motzkin_paths','flat-steps-at-zero distribution over colored_motzkin_paths(3,2) is 0:2, 1:4, 3:8','eq','0,2|1,4|3,8','sums to 14',$q$
    SELECT string_agg(k || ',' || c, '|' ORDER BY k)
      FROM (SELECT colored_motzkin_flat_steps_at_zero((e).value) k, count(*) c FROM elements(colored_motzkin_paths(3,2)) e GROUP BY 1) t(k,c) $q$),
  ('colored_motzkin_paths','empty path (n=0,r=1): every stat is 0','eq','0|0|0|0|0|0|0','edge case, no steps',$q$
    SELECT colored_motzkin_up_steps((unrank(colored_motzkin_paths(0,1),0)).value)::text || '|' ||
           colored_motzkin_level_steps((unrank(colored_motzkin_paths(0,1),0)).value)::text || '|' ||
           colored_motzkin_color_sum((unrank(colored_motzkin_paths(0,1),0)).value)::text || '|' ||
           colored_motzkin_height((unrank(colored_motzkin_paths(0,1),0)).value)::text || '|' ||
           colored_motzkin_peaks((unrank(colored_motzkin_paths(0,1),0)).value)::text || '|' ||
           colored_motzkin_returns((unrank(colored_motzkin_paths(0,1),0)).value)::text || '|' ||
           colored_motzkin_flat_steps_at_zero((unrank(colored_motzkin_paths(0,1),0)).value)::text $q$);
