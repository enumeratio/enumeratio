-- requires: realizer, subsets, utilities
-- narayana_numbers — Dyck paths of semilength n with EXACTLY k peaks (a peak = an up-step immediately followed
-- by a down-step). Multi-grade chain [n (semilength), k (number of peaks)]; k defaults to its full range 1..n,
-- so narayana_numbers(n) unfolds fibers over k and the global order is (n, k, ordinality). The count of fiber
-- [n,k] is the Narayana number N(n,k) = C(n,k)·C(n,k-1)/n, and sum over k=1..n of N(n,k) = Catalan(n) — the
-- Narayana numbers refine the Catalan numbers by peak count. A fresh `narayana_dyck` carrier (distinct from
-- `dyck_path`, which is ungraded by peak count).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE narayana_dyck AS (steps int[]);                          -- ±1 word, length 2n; e.g. {1,1,-1,-1} = UUDD
CREATE FUNCTION notation(p narayana_dyck) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE WHEN s = 1 THEN 'U' ELSE 'D' END, '' ORDER BY o), '')
  FROM unnest((p).steps) WITH ORDINALITY AS t(s, o) $$;

CREATE FUNCTION narayana_number(n int, k int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$   -- N(n,k) = C(n,k)·C(n,k-1)/n
  SELECT CASE WHEN n = 0 THEN 0::numeric
         ELSE div(binomial(n, k)::numeric * binomial(n, k - 1)::numeric, n::numeric) END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: every Dyck path of semilength address[1] (grow prefixes, never below 0 — same technique as
-- dyck_paths), KEPT only when it has exactly address[2] peaks (adjacent U,D pair), emitted in lex order
-- (U < D; array DESC on the ±1 word == lex U<D, per dyck_paths).
CREATE TYPE narayana_numbers_fiber AS (n natural_number, k natural_number);   -- typed fiber; axes: n, k
CREATE FUNCTION fiber_elements(f narayana_numbers_fiber, element_limit int) RETURNS SETOF narayana_dyck LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, h, len) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.h + c.step, g.len + 1
      FROM gen g CROSS JOIN (VALUES (1), (-1)) AS c(step)
      WHERE g.len < 2 * (f).n::int
        AND g.h + c.step >= 0                                   -- stay ≥ 0 (also caps downs: h>0 ⇒ downs<n)
        AND (c.step = -1 OR (g.len + g.h) / 2 < (f).n::int)     -- an up is allowed only while ups used < n
  ),
  paths AS (SELECT steps FROM gen WHERE len = 2 * (f).n::int AND h = 0),
  peaks AS (
    SELECT p.steps,
           (SELECT count(*) FROM (
              SELECT s, lead(s) OVER (ORDER BY o) AS s2 FROM unnest(p.steps) WITH ORDINALITY AS t(s, o)
            ) q WHERE s = 1 AND s2 = -1) AS peak_count
    FROM paths p
  )
  SELECT ROW(steps)::narayana_dyck FROM peaks
  WHERE peak_count = (f).k::int
  ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f narayana_numbers_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT narayana_number((f).n::int, (f).k::int) $$;
-- contains: a valid Dyck path (±1 steps, length 2n, every prefix ≥ 0, total 0) with EXACTLY k peaks (a U·D adjacency)
CREATE FUNCTION contains_in_fiber(f narayana_numbers_fiber, v narayana_dyck) RETURNS boolean LANGUAGE sql STABLE AS $$
  WITH s AS (SELECT step, sum(step) OVER (ORDER BY o) AS pre, lead(step) OVER (ORDER BY o) AS nxt
             FROM unnest((v).steps) WITH ORDINALITY AS t(step, o))
  SELECT coalesce(array_length((v).steps, 1), 0) = 2 * (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) x WHERE x <> 1 AND x <> -1)
     AND coalesce((SELECT sum(step) FROM unnest((v).steps) step), 0) = 0
     AND coalesce((SELECT bool_and(pre >= 0) FROM s), true)
     AND (SELECT count(*) FROM s WHERE step = 1 AND nxt = -1) = (f).k::int $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('narayana_numbers', 'narayana_dyck');
INSERT INTO base_grade VALUES
  ('narayana_numbers', 1, 'n', NULL, NULL),
  ('narayana_numbers', 2, 'k', '1', 'g1');                          -- k ranges 1..n by default
SELECT base_realize('narayana_numbers');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('narayana_numbers','cardinality anchor: row n=4 over k=1..4 (accel)','eq','1,6,6,1','the Narayana triangle row n=4',$q$
    SELECT string_agg(cardinality(narayana_numbers(4,k))::text, ',' ORDER BY k) FROM generate_series(1,4) k $q$),
  ('narayana_numbers','row-sum: sum over k=1..4 of N(4,k) = Catalan(4)','eq','14','range handle sums the fibers',$q$
    SELECT cardinality(narayana_numbers(4))::text $q$),
  ('narayana_numbers','fiber [4,1] has exactly one path (the single peak)','eq','UUUUDDDD','N(4,1)=1',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(narayana_numbers(4,1)) e $q$),
  ('narayana_numbers','fiber [3,2] listed in lex order (U<D)','eq','UUDUDD,UUDDUD,UDUUDD','N(3,2)=3, the three 2-peak paths',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(narayana_numbers(3,2)) e $q$),
  ('narayana_numbers','every element of fiber [4,2] has exactly 2 peaks (structural invariant)','eq','true','count adjacent U,D pairs per path',$q$
    SELECT bool_and(
        (SELECT count(*) FROM (
           SELECT s, lead(s) OVER (ORDER BY o) AS s2
           FROM unnest(((e).value).steps) WITH ORDINALITY AS t(s, o)
         ) q WHERE s = 1 AND s2 = -1) = 2
      )::text FROM elements(narayana_numbers(4,2)) e $q$),
  ('narayana_numbers','fibers(narayana_numbers(4)) unfold to k = 1,2,3,4','eq','1,2,3,4','the second grade ranges 1..n',$q$
    SELECT string_agg((f).k::text, ',' ORDER BY (f).k) FROM fibers(narayana_numbers(4)) f $q$),
  ('narayana_numbers','multi-grade chain: fiber = (n,k) named axes','eq','4|2','unrank(...).fiber is (n=4,k=2)',$q$
    SELECT (unrank(narayana_numbers(4,2), 0)).fiber.n::text || '|' || (unrank(narayana_numbers(4,2), 0)).fiber.k::text $q$),
  ('narayana_numbers','cardinality(narayana_numbers(5,3)) = 20 (accel)','eq','20','N(5,3) = C(5,3)·C(5,2)/5 = 10·10/5',$q$
    SELECT cardinality(narayana_numbers(5,3))::text $q$),
  ('narayana_numbers','contains via <@: the 2-peak UUDUDD ∈ N(3,2); the 1-peak UUUDDD ∉ (it is N(3,1))','eq','true|false','a valid Dyck path with exactly k peaks',$q$
    SELECT (ROW(ARRAY[1,1,-1,1,-1,-1])::narayana_dyck <@ narayana_numbers(3,2))::text || '|' ||
           (ROW(ARRAY[1,1,1,-1,-1,-1])::narayana_dyck <@ narayana_numbers(3,2))::text $q$);
