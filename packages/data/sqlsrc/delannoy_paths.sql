-- requires: realizer
-- delannoy_paths — central Delannoy paths: lattice paths from (0,0) to (n,n) using steps E=(1,0), N=(0,1), and
-- D=(1,1) (diagonal). The count is the central Delannoy number: 1,3,13,63,321,1683 for n=0..5 (n=0 is the single
-- empty path). Single grade [n]. Provides the floor (paths in lex order, E<N<D) + a contains engine (no closed-form
-- accel: cardinality counts the floor); base_realize generates handle/fiber/element + constructor (incl. the
-- (lo,hi) range form) + the full surface.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE delannoy_path AS (steps int[]);                          -- alphabet 0=E, 1=N, 2=D; e.g. {2,0,1} = DEN
CREATE FUNCTION notation(p delannoy_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE s WHEN 0 THEN 'E' WHEN 1 THEN 'N' WHEN 2 THEN 'D' END, '' ORDER BY o), '')
  FROM unnest((p).steps) WITH ORDINALITY AS t(s, o) $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE delannoy_paths_fiber AS (n natural_number);   -- typed fiber; axis: n
-- FLOOR: every path from (0,0) to (n,n) over {E,N,D}, emitted in lex order (E<N<D, i.e. steps ASC). Grow all
-- valid prefixes tracking position (x,y); E advances x, N advances y, D advances both — each only while it
-- keeps that coordinate ≤ n. A prefix is a leaf exactly when x=n and y=n (no move stays in bounds from there),
-- so filtering on the endpoint also selects exactly the completed paths.
CREATE FUNCTION fiber_elements(f delannoy_paths_fiber, element_limit int) RETURNS SETOF delannoy_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, x, y) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step,
             g.x + CASE WHEN c.step IN (0, 2) THEN 1 ELSE 0 END,
             g.y + CASE WHEN c.step IN (1, 2) THEN 1 ELSE 0 END
      FROM gen g CROSS JOIN (VALUES (0), (1), (2)) AS c(step)
      WHERE (c.step = 0 AND g.x < (f).n::int)
         OR (c.step = 1 AND g.y < (f).n::int)
         OR (c.step = 2 AND g.x < (f).n::int AND g.y < (f).n::int)
  )
  SELECT ROW(steps)::delannoy_path FROM gen
  WHERE x = (f).n::int AND y = (f).n::int
  ORDER BY steps ASC LIMIT element_limit $$;

-- contains: v reaches (n,n) from the origin using only E/N/D moves, and never overshoots n on either axis
-- along the way (equivalently: every prefix's x,y ≤ n, and the final x,y = n — steps are non-decreasing so
-- no lower-bound check is needed).
CREATE FUNCTION contains_in_fiber(f delannoy_paths_fiber, v delannoy_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (0, 1, 2))
     AND coalesce((SELECT max(x) FROM (
           SELECT sum(CASE WHEN s IN (0, 2) THEN 1 ELSE 0 END) OVER (ORDER BY o) x
           FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q), 0) <= (f).n::int
     AND coalesce((SELECT max(y) FROM (
           SELECT sum(CASE WHEN s IN (1, 2) THEN 1 ELSE 0 END) OVER (ORDER BY o) y
           FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q), 0) <= (f).n::int
     AND coalesce((SELECT sum(CASE WHEN s IN (0, 2) THEN 1 ELSE 0 END) FROM unnest((v).steps) s), 0) = (f).n::int
     AND coalesce((SELECT sum(CASE WHEN s IN (1, 2) THEN 1 ELSE 0 END) FROM unnest((v).steps) s), 0) = (f).n::int
$$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('delannoy_paths', 'delannoy_path');
INSERT INTO base_grade VALUES ('delannoy_paths', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f delannoy_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'D(' || (f).n::int || ',' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('delannoy_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('delannoy_paths','cardinality anchor = central Delannoy numbers for n=0..5 (floor count, no accel)','eq','1,3,13,63,321,1683','1,3,13,63,321,1683',$q$
    SELECT string_agg(cardinality(delannoy_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('delannoy_paths','n=0 ⇒ one empty path','eq','1|','the empty word, no steps needed',$q$
    SELECT count(*)::text || '|' || notation((unrank(delannoy_paths(0), 0)).value) FROM elements(delannoy_paths(0)) e $q$),
  ('delannoy_paths','n=2 in lex order (E<N<D): 13 paths','eq','EENN,ENEN,ENNE,END,EDN,NEEN,NENE,NED,NNEE,NDE,DEN,DNE,DD','the thirteen paths',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(delannoy_paths(2)) e $q$),
  ('delannoy_paths','floor generates 63 paths at n=3 (cardinality via counting)','eq','63','independent check of the anchor',$q$
    SELECT count(*)::text FROM elements(delannoy_paths(3), 1000) e $q$),
  ('delannoy_paths','every generated path ends at (n,n) using only E/N/D','eq','true','structural check across the n=2 fiber',$q$
    SELECT bool_and(
        (SELECT sum(CASE WHEN x IN (0,2) THEN 1 ELSE 0 END) FROM unnest(((e).value).steps) x) = 2
        AND (SELECT sum(CASE WHEN x IN (1,2) THEN 1 ELSE 0 END) FROM unnest(((e).value).steps) x) = 2
        AND NOT EXISTS (SELECT 1 FROM unnest(((e).value).steps) x WHERE x NOT IN (0,1,2))
      )::text FROM elements(delannoy_paths(2)) e $q$),
  ('delannoy_paths','range handle: cardinality(delannoy_paths(0,3)) = 1+3+13+63 = 80','eq','80','summed over fibers',$q$
    SELECT cardinality(delannoy_paths(0,3))::text $q$),
  ('delannoy_paths','fibers(delannoy_paths(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(delannoy_paths(0,3)) f $q$),
  ('delannoy_paths','unrank first/last of n=2','eq','EENN|DD','ranks 0 and 12',$q$
    SELECT notation((unrank(delannoy_paths(2), 0)).value) || '|' ||
           notation((unrank(delannoy_paths(2), 12)).value) $q$),
  ('delannoy_paths','element carries a TYPED point fiber + ordinality','eq','2|1','unrank(delannoy_paths(2),1)',$q$
    SELECT (unrank(delannoy_paths(2), 1)).fiber.n::text || '|' || ordinality(unrank(delannoy_paths(2), 1))::text $q$),
  ('delannoy_paths','contains: DD ∈ delannoy_paths(2), EE ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[2,2])::delannoy_path <@ delannoy_paths(2))::text || '|' ||
           (ROW(ARRAY[0,0])::delannoy_path <@ delannoy_paths(2))::text $q$);
