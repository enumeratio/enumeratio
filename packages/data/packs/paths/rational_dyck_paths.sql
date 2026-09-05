-- requires: realizer, utilities, dyck_paths
-- rational_dyck_paths(a,b) — (a,b)-Dyck paths: lattice paths from (0,0) to (b,a) using unit East/North steps
-- that stay weakly above the diagonal line from (0,0) to (b,a) (i.e. at every prefix with x Easts and y Norths,
-- b·y ≥ a·x). Two integer axes [a,b], a,b assumed COPRIME (the classical setting — non-coprime pairs are not
-- asserted here). dyck_paths(n) IS the case (a,b) = (n, n+1): C(2n+1,n)/(2n+1) = Catalan(n), verified below.
-- Count = the rational Catalan number Cat(a,b) = C(a+b,a)/(a+b). Own carrier (E/N alphabet, distinct from the
-- ±1 dyck_path word — the box is asymmetric so the two axes are genuinely not interchangeable).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE rational_dyck_path AS (steps int[]);                     -- alphabet 0=East, 1=North; length a+b
CREATE FUNCTION notation(p rational_dyck_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE s WHEN 0 THEN 'E' WHEN 1 THEN 'N' END, '' ORDER BY o), '')
  FROM unnest((p).steps) WITH ORDINALITY AS t(s, o) $$;

CREATE FUNCTION rational_catalan(a int, b int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$   -- Cat(a,b) = C(a+b,a)/(a+b), a,b coprime
  -- degenerate (0,0): outside the coprime family (gcd(0,0) undefined), but the box collapses to (0,0) and the
  -- single length-0 word satisfies the diagonal condition vacuously — one path, not a division by zero (#258).
  SELECT CASE WHEN a + b = 0 THEN 1 ELSE div(binomial(a + b, a), (a + b)::numeric) END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE rational_dyck_paths_fiber AS (a natural_number, b natural_number);   -- axes: a (rows/Norths), b (cols/Easts)
-- FLOOR: every E/N word from (0,0) to (b,a) staying weakly above the diagonal b·y ≥ a·x, in lex order N<E (array
-- DESC on the 0/1 word puts 1=N before 0=E). A North step is always safe (only raises y, moving further above the
-- diagonal); an East step is safe only while b·y ≥ a·(x+1) — checked BEFORE taking it.
CREATE FUNCTION fiber_elements(f rational_dyck_paths_fiber, element_limit int) RETURNS SETOF rational_dyck_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, x, y) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.x + CASE WHEN c.step = 0 THEN 1 ELSE 0 END, g.y + CASE WHEN c.step = 1 THEN 1 ELSE 0 END
      FROM gen g CROSS JOIN (VALUES (1), (0)) AS c(step)
      WHERE (c.step = 1 AND g.y < (f).a::int)
         OR (c.step = 0 AND g.x < (f).b::int AND (f).b::int * g.y >= (f).a::int * (g.x + 1))
  )
  SELECT ROW(steps)::rational_dyck_path FROM gen
  WHERE x = (f).b::int AND y = (f).a::int
  ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f rational_dyck_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT rational_catalan((f).a::int, (f).b::int) $$;

-- contains: v is an (a,b)-Dyck path iff length a+b, exactly a Norths and b Easts, and every prefix stays
-- weakly above the diagonal (b·y ≥ a·x at each step).
CREATE FUNCTION contains_in_fiber(f rational_dyck_paths_fiber, v rational_dyck_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).steps, 1), 0) = (f).a::int + (f).b::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (0, 1))
     AND coalesce((SELECT sum(s) FROM unnest((v).steps) s), 0) = (f).a::int
     AND NOT EXISTS (SELECT 1 FROM (
           SELECT sum(CASE WHEN s = 1 THEN 1 ELSE 0 END) OVER (ORDER BY o) AS y,
                  sum(CASE WHEN s = 0 THEN 1 ELSE 0 END) OVER (ORDER BY o) AS x
           FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q
         WHERE (f).b::int * y < (f).a::int * x) $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('rational_dyck_paths', 'rational_dyck_path');
INSERT INTO base_grade VALUES ('rational_dyck_paths', 1, 'a', NULL, NULL), ('rational_dyck_paths', 2, 'b', NULL, NULL);
CREATE FUNCTION fiber_symbol(f rational_dyck_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Dyck(' || (f).a::int || ',' || (f).b::int || ')' $$;
SELECT base_realize('rational_dyck_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('rational_dyck_paths','cardinality anchor: Cat(2,3)=2, Cat(3,4)=5, Cat(3,5)=7, Cat(2,5)=3','eq','2|5|7|3','C(a+b,a)/(a+b) on coprime pairs',$q$
    SELECT cardinality(rational_dyck_paths(2,3))::text || '|' || cardinality(rational_dyck_paths(3,4))::text || '|' ||
           cardinality(rational_dyck_paths(3,5))::text || '|' || cardinality(rational_dyck_paths(2,5))::text $q$),
  ('rational_dyck_paths','degenerate fiber (0,0): one empty path, no division by zero (#258)','eq','1|1','fiber_count matches the naive floor count',$q$
    SELECT cardinality(rational_dyck_paths(0,0))::text || '|' || (SELECT count(*)::text FROM elements(rational_dyck_paths(0,0))) $q$),
  ('rational_dyck_paths','(a,b)=(n,n+1) recovers ordinary Catalan for n=0..5','eq','1,1,2,5,14,42','the classical dyck_paths ⊂ rational family',$q$
    SELECT string_agg(cardinality(rational_dyck_paths(n, n+1))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('rational_dyck_paths','(a,b)=(n,n+1) matches dyck_paths(n) cardinality exactly, n=0..5','eq','true','same count as the classical carrier',$q$
    SELECT bool_and(cardinality(rational_dyck_paths(n, n+1)) = cardinality(dyck_paths(n)))::text FROM generate_series(0,5) n $q$),
  ('rational_dyck_paths','floor generates 2 paths at (2,3), matching the accel','eq','2','independent of the closed form',$q$
    SELECT count(*)::text FROM elements(rational_dyck_paths(2,3)) e $q$),
  ('rational_dyck_paths','the two (2,3)-Dyck paths in lex order (N<E)','eq','NNEEE,NENEE','weakly above the diagonal 3y ≥ 2x',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(rational_dyck_paths(2,3)) e $q$),
  ('rational_dyck_paths','every generated path ends at (b,a) using only E/N and stays above the diagonal','eq','true','structural check, no contains fn',$q$
    SELECT bool_and(
        (SELECT count(*) FILTER (WHERE x = 1) FROM unnest(((e).value).steps) x) = 3
        AND (SELECT count(*) FILTER (WHERE x = 0) FROM unnest(((e).value).steps) x) = 4
        AND NOT EXISTS (SELECT 1 FROM (
              SELECT sum(CASE WHEN s = 1 THEN 1 ELSE 0 END) OVER (ORDER BY o) AS y,
                     sum(CASE WHEN s = 0 THEN 1 ELSE 0 END) OVER (ORDER BY o) AS x
              FROM unnest(((e).value).steps) WITH ORDINALITY AS t(s, o)) q WHERE 4 * y < 3 * x)
      )::text FROM elements(rational_dyck_paths(3,4)) e $q$),
  ('rational_dyck_paths','contains via <@: NNEEE ∈ rational_dyck_paths(2,3), EENNE ∉ (dips below the diagonal)','eq','true|false','the box + diagonal condition',$q$
    SELECT (ROW(ARRAY[1,1,0,0,0])::rational_dyck_path <@ rational_dyck_paths(2,3))::text || '|' ||
           (ROW(ARRAY[0,0,1,1,0])::rational_dyck_path <@ rational_dyck_paths(2,3))::text $q$),
  ('rational_dyck_paths','fibers(rational_dyck_paths(3,5)) is the single point fiber [3,5]','eq','3|5','both axes bound to points',$q$
    SELECT (f).a::text || '|' || (f).b::text FROM fibers(rational_dyck_paths(3,5)) f $q$),
  ('rational_dyck_paths','element carries a TYPED point fiber + ordinality','eq','2|3|1','unrank(rational_dyck_paths(2,3),1)',$q$
    SELECT (unrank(rational_dyck_paths(2,3), 1)).fiber.a::text || '|' || (unrank(rational_dyck_paths(2,3), 1)).fiber.b::text ||
           '|' || ordinality(unrank(rational_dyck_paths(2,3), 1))::text $q$);
