-- requires: k_dyck_paths, realizer, utilities
-- k_dyck_paths statistics — the Fuss-Catalan analogues of the classic Dyck peaks/returns/height: a step is +(k-1)
-- (up) or -1 (down), so "peak"/"return" read off the SIGN of the step, not a literal ±1 value.

-- ── statistics (carrier: k_dyck_path(steps int[])) ──────────────────────────────────────────────────────
-- peaks: an up-step immediately followed by a down-step.
CREATE FUNCTION k_dyck_peaks(p k_dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).steps,1) i
   WHERE i < array_length((p).steps,1) AND (p).steps[i] > 0 AND (p).steps[i+1] < 0 $$;
-- returns: number of steps at which the running height is back on the axis (each maximal arch ends in one).
CREATE FUNCTION k_dyck_returns(p k_dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q WHERE h = 0 $$;
-- height: the maximum running height reached (0 for the empty path).
CREATE FUNCTION k_dyck_height(p k_dyck_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(h), 0)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('k_dyck_paths','peaks','k_dyck_peaks','Peaks','natural_numbers'),
  ('k_dyck_paths','returns','k_dyck_returns','Number of returns','natural_numbers'),
  ('k_dyck_paths','height','k_dyck_height','Height','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- k_dyck_paths(2,3): UDDUDD, UDUDDD, UUDDDD (from k_dyck_paths.sql's own example, rank order).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_dyck_paths','peaks over k_dyck_paths(2,3) in rank order is 2,2,1','eq','2,2,1','UDDUDD, UDUDDD each have 2 peaks; UUDDDD (double-rise) has 1',$q$
    SELECT string_agg(k_dyck_peaks((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(k_dyck_paths(2,3)) e $q$),
  ('k_dyck_paths','peaks(UUDDDD, k=3) = 1: one up immediately followed by a down','eq','1','a single peak at the top',$q$
    SELECT k_dyck_peaks(ROW(ARRAY[2,2,-1,-1,-1,-1])::k_dyck_path)::text $q$),
  ('k_dyck_paths','returns over k_dyck_paths(2,3) in rank order is 2,1,1','eq','2,1,1','UDDUDD touches the axis twice (a double arch); the other two only at the end',$q$
    SELECT string_agg(k_dyck_returns((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(k_dyck_paths(2,3)) e $q$),
  ('k_dyck_paths','height over k_dyck_paths(2,3) in rank order is 2,3,4','eq','2,3,4','UUDDDD climbs to 4 (two ups of rise 2 before any down)',$q$
    SELECT string_agg(k_dyck_height((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(k_dyck_paths(2,3)) e $q$),
  ('k_dyck_paths','k=2 matches ordinary dyck_paths peaks/height at n=4 (rank 0 = UUUUDDDD-shape chain)','eq','true','the k=2 slice IS ordinary Dyck, stat-for-stat',$q$
    SELECT bool_and(k_dyck_peaks((e).value) = dyck_peaks(ROW(((e).value).steps)::dyck_path)
               AND k_dyck_height((e).value) = dyck_height(ROW(((e).value).steps)::dyck_path))::text
      FROM elements(k_dyck_paths(4,2)) e $q$),
  ('k_dyck_paths','empty path (n=0): every stat is 0','eq','0|0|0','edge case, no steps',$q$
    SELECT k_dyck_peaks((unrank(k_dyck_paths(0,3),0)).value)::text || '|' ||
           k_dyck_returns((unrank(k_dyck_paths(0,3),0)).value)::text || '|' ||
           k_dyck_height((unrank(k_dyck_paths(0,3),0)).value)::text $q$);
