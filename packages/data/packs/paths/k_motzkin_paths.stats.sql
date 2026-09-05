-- requires: k_motzkin_paths, realizer, utilities
-- k_motzkin_paths statistics — level_steps counts the H (0-code) steps directly (the same quantity the k grade
-- already fixes per-fiber, but useful when GROUPing an ungraded k_motzkin_paths(n) row-set by it); peaks/height
-- read off the U(+1)/D(-1) steps exactly as dyck_peaks/dyck_height do, ignoring any interleaved H steps.

-- ── statistics (carrier: k_motzkin_path(steps int[]) of {-1,0,1}) ──────────────────────────────────────
-- level_steps: the number of horizontal (H, 0-coded) steps.
CREATE FUNCTION k_motzkin_level_steps(p k_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((p).steps) s WHERE s = 0 $$;
-- peaks: an up-step immediately followed by a down-step (an H step in between breaks the adjacency).
CREATE FUNCTION k_motzkin_peaks(p k_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).steps,1) i
   WHERE i < array_length((p).steps,1) AND (p).steps[i] = 1 AND (p).steps[i+1] = -1 $$;
-- height: the maximum running height reached (0 for the empty path).
CREATE FUNCTION k_motzkin_height(p k_motzkin_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(h), 0)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('k_motzkin_paths','level_steps','k_motzkin_level_steps','Level steps','natural_numbers'),
  ('k_motzkin_paths','peaks','k_motzkin_peaks','Peaks','natural_numbers'),
  ('k_motzkin_paths','height','k_motzkin_height','Height','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- k_motzkin_paths(3,1) in lex order (from k_motzkin_paths.sql's own example): UHD, UDH, HUD.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_motzkin_paths','level_steps is exactly k across every element of a (n,k) fiber','eq','true','the grade IS the H-step count',$q$
    SELECT bool_and(k_motzkin_level_steps((e).value) = 2)::text FROM elements(k_motzkin_paths(6,2)) e $q$),
  ('k_motzkin_paths','level_steps over k_motzkin_paths(3,1) in lex order is 1,1,1','eq','1,1,1','each has exactly one H (that IS the k=1 fiber)',$q$
    SELECT string_agg(k_motzkin_level_steps((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(k_motzkin_paths(3,1)) e $q$),
  ('k_motzkin_paths','peaks over k_motzkin_paths(3,1) in lex order (UHD,UDH,HUD) is 0,1,1','eq','0,1,1','UHD has no adjacent U,D (H splits them); UDH and HUD each have one',$q$
    SELECT string_agg(k_motzkin_peaks((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(k_motzkin_paths(3,1)) e $q$),
  ('k_motzkin_paths','height over k_motzkin_paths(3,1) in lex order is 1,1,1','eq','1,1,1','a single U before any D caps every path at height 1',$q$
    SELECT string_agg(k_motzkin_height((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(k_motzkin_paths(3,1)) e $q$),
  ('k_motzkin_paths','the all-H path HHH has 0 peaks and 0 height','eq','0|0|3','k_motzkin_paths(3,3), the single all-level path',$q$
    SELECT k_motzkin_peaks((unrank(k_motzkin_paths(3,3),0)).value)::text || '|' ||
           k_motzkin_height((unrank(k_motzkin_paths(3,3),0)).value)::text || '|' ||
           k_motzkin_level_steps((unrank(k_motzkin_paths(3,3),0)).value)::text $q$),
  ('k_motzkin_paths','empty path (n=0,k=0): every stat is 0','eq','0|0|0','edge case, no steps',$q$
    SELECT k_motzkin_level_steps((unrank(k_motzkin_paths(0,0),0)).value)::text || '|' ||
           k_motzkin_peaks((unrank(k_motzkin_paths(0,0),0)).value)::text || '|' ||
           k_motzkin_height((unrank(k_motzkin_paths(0,0),0)).value)::text $q$);
