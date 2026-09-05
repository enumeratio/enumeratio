-- requires: schroeder_paths, realizer, utilities
-- schroeder_paths statistics — flat_steps counts the F (0-code) steps; peaks/height read off the U(+1)/D(-1) steps
-- exactly as dyck_peaks/dyck_height do (an interleaved F step breaks a U,D adjacency, same as k_motzkin's H).
-- flat_steps is also the statistic schroeder_triangle refines schroeder_paths by (schroeder_triangle grades on a
-- fresh carrier so it can't reuse schroeder_paths' fiber_elements; this stat lets plain schroeder_paths(n) GROUP BY
-- it and agree with the triangle's fiber counts — see triangle_refines.sql).

-- ── statistics (carrier: schroeder_path(steps int[]) of {-1,0,1}) ──────────────────────────────────────
-- flat_steps: the number of flat (F, 0-coded, x-width 2) steps.
CREATE FUNCTION schroeder_flat_steps(p schroeder_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((p).steps) s WHERE s = 0 $$;
-- peaks: an up-step immediately followed by a down-step.
CREATE FUNCTION schroeder_peaks(p schroeder_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_subscripts((p).steps,1) i
   WHERE i < array_length((p).steps,1) AND (p).steps[i] = 1 AND (p).steps[i+1] = -1 $$;
-- height: the maximum running height reached (0 for the empty path).
CREATE FUNCTION schroeder_height(p schroeder_path) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(h), 0)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((p).steps) WITH ORDINALITY AS t(s, o)) q $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('schroeder_paths','flat_steps','schroeder_flat_steps','Flat steps','natural_numbers'),
  ('schroeder_paths','peaks','schroeder_peaks','Peaks','natural_numbers'),
  ('schroeder_paths','height','schroeder_height','Height','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- schroeder_paths(2) in fixed order (from schroeder_paths.sql's own example): UUDD,UFD,UDUD,UDF,FUD,FF.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('schroeder_paths','flat_steps over schroeder_paths(2) in fixed order is 0,1,0,1,1,2','eq','0,1,0,1,1,2','count of 0-coded steps per path',$q$
    SELECT string_agg(schroeder_flat_steps((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(schroeder_paths(2)) e $q$),
  ('schroeder_paths','peaks over schroeder_paths(2) in fixed order is 1,0,2,1,1,0','eq','1,0,2,1,1,0','UDUD has 2 peaks; UUDD/UDF/FUD have 1; UFD/FF have 0',$q$
    SELECT string_agg(schroeder_peaks((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(schroeder_paths(2)) e $q$),
  ('schroeder_paths','height over schroeder_paths(2) in fixed order is 2,1,1,1,1,0','eq','2,1,1,1,1,0','UUDD alone climbs to 2; FF never leaves the axis',$q$
    SELECT string_agg(schroeder_height((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(schroeder_paths(2)) e $q$),
  ('schroeder_paths','the all-flat path at n=3 (FFF) has 0 peaks, 0 height, 3 flats','eq','0|0|3','the flattest possible path',$q$
    SELECT schroeder_peaks(ROW(ARRAY[0,0,0])::schroeder_path)::text || '|' ||
           schroeder_height(ROW(ARRAY[0,0,0])::schroeder_path)::text || '|' ||
           schroeder_flat_steps(ROW(ARRAY[0,0,0])::schroeder_path)::text $q$),
  ('schroeder_paths','empty path (n=0): every stat is 0','eq','0|0|0','edge case, no steps',$q$
    SELECT schroeder_flat_steps((unrank(schroeder_paths(0),0)).value)::text || '|' ||
           schroeder_peaks((unrank(schroeder_paths(0),0)).value)::text || '|' ||
           schroeder_height((unrank(schroeder_paths(0),0)).value)::text $q$),
  -- flat_steps ties schroeder_paths to the Schröder triangle (the #220 refinement).
  ('schroeder_paths','flat_steps distribution over schroeder_paths(3) is 5,10,6,1 — the Schröder triangle row T(3,·)','eq','5,10,6,1','k=0..3 flat-step counts',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT schroeder_flat_steps((e).value) k, count(*) c FROM elements(schroeder_paths(3)) e GROUP BY 1) t(k,c) $q$),
  ('schroeder_paths','k=0 column (no flats) is pure Dyck paths: distribution over schroeder_paths(3) has 5 zero-flat paths','eq','5','matches Catalan(3)=5',$q$
    SELECT count(*)::text FROM elements(schroeder_paths(3)) e WHERE schroeder_flat_steps((e).value) = 0 $q$);
