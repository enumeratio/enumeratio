-- requires: realizer
-- schroeder_paths — large Schroeder paths: lattice paths from (0,0) to (2n,0) using steps U=(1,1), D=(1,-1),
-- and F=(2,0) (a flat step of width 2), never going below the x-axis. Single grade [n]; semilength n counts the
-- large Schroeder numbers 1,2,6,22,90,394 for n=0..5 (n=0 is the single empty path). Provides the floor (paths
-- in a fixed total order) + a contains engine; no fiber_count accel (cardinality counts the floor — that IS the
-- check against the anchor sequence). base_realize generates handle/fiber/element + constructor (incl. the
-- (lo,hi) range form) + the full surface.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE schroeder_path AS (steps int[]);                          -- {1,-1,0} word; 1=U -1=D 0=F (F has x-width 2)
CREATE FUNCTION notation(p schroeder_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE WHEN s = 1 THEN 'U' WHEN s = -1 THEN 'D' ELSE 'F' END, '' ORDER BY o), '')
  FROM unnest((p).steps) WITH ORDINALITY AS t(s, o) $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: every Schroeder path of semilength address[1]. Grow all valid prefixes tracking (height h, x-position
-- x): U -> (h+1, x+1); D (only if h>0) -> (h-1, x+1); F -> (h, x+2); never let h<0 or x exceed 2n. Keep the
-- height-0 completions at x = 2n. Step codes double as height deltas (U=1, D=-1, F=0), so cumulative sum of
-- the steps array IS the running height — used again in the invariant example and contains_in_fiber below.
-- Array DESC on the step-code word == fixed lex order U(1) before F(0) before D(-1) at the first differing step.
CREATE TYPE schroeder_paths_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f schroeder_paths_fiber, element_limit int) RETURNS SETOF schroeder_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, h, x) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.h + c.dh, g.x + c.dx
      FROM gen g CROSS JOIN (VALUES (1, 1, 1), (-1, -1, 1), (0, 0, 2)) AS c(step, dh, dx)
      WHERE g.x < 2 * (f).n::int                     -- still short of the target; keep extending
        AND g.h + c.dh >= 0                          -- never dip below the x-axis (also gates D: needs h>0)
        AND g.x + c.dx <= 2 * (f).n::int             -- never overshoot the target width
  )
  SELECT ROW(steps)::schroeder_path FROM gen
  WHERE x = 2 * (f).n::int AND h = 0
  ORDER BY steps DESC LIMIT element_limit $$;

-- contains: v is a Schroeder path of semilength n iff every step is in {1,-1,0}, the steps net to height 0,
-- the x-widths (1,1,2 resp.) sum to 2n, and no prefix's running height (= running sum of steps) goes < 0.
CREATE FUNCTION contains_in_fiber(f schroeder_paths_fiber, v schroeder_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (1, -1, 0))
     AND coalesce((SELECT sum(s) FROM unnest((v).steps) s), 0) = 0
     AND coalesce((SELECT sum(CASE WHEN s = 0 THEN 2 ELSE 1 END) FROM unnest((v).steps) s), 0) = 2 * (f).n::int
     AND coalesce((SELECT min(h) FROM (
           SELECT sum(s) OVER (ORDER BY o) h FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q), 0) >= 0 $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('schroeder_paths', 'schroeder_path');
INSERT INTO base_grade VALUES ('schroeder_paths', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f schroeder_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Sch(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('schroeder_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('schroeder_paths','cardinality anchor = large Schroeder numbers for n=0..5 (floor count)','eq','1,2,6,22,90,394','no accel — the floor IS the count',$q$
    SELECT string_agg(cardinality(schroeder_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('schroeder_paths','n=0 ⇒ one empty path','eq','1|','Schroeder(0)=1, the empty word',$q$
    SELECT count(*)::text || '|' || notation((unrank(schroeder_paths(0), 0)).value) FROM elements(schroeder_paths(0)) e $q$),
  ('schroeder_paths','semilength 2 in fixed order (U<F<D)','eq','UUDD,UFD,UDUD,UDF,FUD,FF','the six paths',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(schroeder_paths(2)) e $q$),
  ('schroeder_paths','floor generates 22 paths at n=3 (cardinality via counting)','eq','22','independent hand-count of the sequence',$q$
    SELECT count(*)::text FROM elements(schroeder_paths(3)) e $q$),
  ('schroeder_paths','every generated path ends at height 0 and never dips below 0','eq','true','structural check: step codes double as height deltas',$q$
    SELECT bool_and(
        (SELECT sum(x) FROM unnest(((e).value).steps) x) = 0
        AND (SELECT min(h) FROM (SELECT sum(x) OVER (ORDER BY o) h
             FROM unnest(((e).value).steps) WITH ORDINALITY AS t(x, o)) q) >= 0
      )::text FROM elements(schroeder_paths(3)) e $q$),
  ('schroeder_paths','range handle: cardinality(schroeder_paths(0,3)) = 31','eq','31','1+2+6+22 summed over fibers',$q$
    SELECT cardinality(schroeder_paths(0,3))::text $q$),
  ('schroeder_paths','fibers(schroeder_paths(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(schroeder_paths(0,3)) f $q$),
  ('schroeder_paths','unrank first/last of semilength 2','eq','UUDD|FF','ranks 0 and 5',$q$
    SELECT notation((unrank(schroeder_paths(2), 0)).value) || '|' ||
           notation((unrank(schroeder_paths(2), 5)).value) $q$),
  ('schroeder_paths','element carries a TYPED point fiber + ordinality','eq','2|1','unrank(schroeder_paths(2),1)',$q$
    SELECT (unrank(schroeder_paths(2), 1)).fiber.n::text || '|' || ordinality(unrank(schroeder_paths(2), 1))::text $q$),
  ('schroeder_paths','contains: UFD ∈ schroeder_paths(2), UUFD ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[1,0,-1])::schroeder_path <@ schroeder_paths(2))::text || '|' ||
           (ROW(ARRAY[1,1,0,-1])::schroeder_path <@ schroeder_paths(2))::text $q$);
