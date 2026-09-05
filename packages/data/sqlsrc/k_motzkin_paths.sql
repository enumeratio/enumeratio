-- requires: dyck_paths, realizer, utilities
-- k_motzkin_paths — Motzkin paths of length n with EXACTLY k horizontal (level) steps: a word over U(+1)/H(0)/D(−1)
-- whose prefix sums stay ≥ 0 and end at 0, with k of the steps being H. Two-grade chain [n (length), k (# H steps)],
-- k defaulting to 0..n, so k_motzkin_paths(n) unfolds fibers over k and the global order is (n, k, ordinality). This
-- is the H-refinement of motzkin_paths (the Motzkin triangle [[OEIS:A055151]]): |k_motzkin_paths(n,k)| =
-- C(n,k)·Catalan((n−k)/2) (choose the k H-positions; the other n−k steps are a Dyck path of semilength (n−k)/2), and
-- summing over k recovers Motzkin(n). Own U/H/D step-word carrier + a bounded lattice walk floor.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE k_motzkin_path AS (steps int[]);                           -- +1 up, 0 level(H), -1 down; e.g. {1,0,-1} = UHD
CREATE FUNCTION notation(p k_motzkin_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE s WHEN 1 THEN 'U' WHEN -1 THEN 'D' ELSE 'H' END, '' ORDER BY o), '')
  FROM unnest((p).steps) WITH ORDINALITY AS t(s, o) $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE k_motzkin_paths_fiber AS (n natural_number, k natural_number);   -- axes: n (length), k (# H steps)
-- FLOOR: a bounded lattice walk of length n. At each step try U/H/D; keep steps that stay ≥ 0, can still descend
-- back to 0 in the remaining positions, and neither exceed k H-steps nor leave too little room for the rest. Emit in
-- lex order U<H<D (array DESC — the U-word carries the larger value at the first difference).
CREATE FUNCTION fiber_elements(f k_motzkin_paths_fiber, element_limit int) RETURNS SETOF k_motzkin_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE walk(pos, height, hused, steps) AS (
    SELECT 0, 0, 0, ARRAY[]::int[]
    UNION ALL
    SELECT pos + 1, height + step, hused + (step = 0)::int, steps || step
    FROM walk, (VALUES (1), (0), (-1)) AS s(step)
    WHERE pos < (f).n::int
      AND height + step >= 0
      AND height + step <= (f).n::int - (pos + 1)                 -- must be able to descend back to 0
      AND hused + (step = 0)::int <= (f).k::int                   -- never exceed k H-steps
      AND (f).k::int - (hused + (step = 0)::int) <= (f).n::int - (pos + 1)   -- leave room for the remaining H-steps
  )
  SELECT ROW(steps)::k_motzkin_path FROM walk
  WHERE pos = (f).n::int AND height = 0 AND hused = (f).k::int
  ORDER BY steps DESC LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f k_motzkin_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int - (f).k::int < 0 OR ((f).n::int - (f).k::int) % 2 <> 0 THEN 0::numeric
              ELSE binomial((f).n::int, (f).k::int)::numeric * catalan(((f).n::int - (f).k::int) / 2) END $$;
CREATE FUNCTION contains_in_fiber(f k_motzkin_paths_fiber, v k_motzkin_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).steps, 1), 0) = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (-1, 0, 1))
     AND (SELECT count(*) FILTER (WHERE s = 0) FROM unnest((v).steps) s) = (f).k::int          -- exactly k H-steps
     AND (SELECT coalesce(sum(s), 0) FROM unnest((v).steps) s) = 0
     AND NOT EXISTS (SELECT 1 FROM (SELECT sum(s) OVER (ORDER BY o) h
                     FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q WHERE h < 0) $$;

INSERT INTO base_collection VALUES ('k_motzkin_paths', 'k_motzkin_path');
INSERT INTO base_grade VALUES ('k_motzkin_paths', 1, 'n', NULL, NULL), ('k_motzkin_paths', 2, 'k', '0', 'g1');   -- k ranges 0..n
CREATE FUNCTION fiber_symbol(f k_motzkin_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'M(' || (f).n::int || ',' || (f).k::int || ')' $$;
SELECT base_realize('k_motzkin_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_motzkin_paths','anchor M(3,1)=3: length-3 Motzkin paths with exactly 1 H step','eq','3','C(3,1)·Catalan(1)',$q$
    SELECT cardinality(k_motzkin_paths(3,1))::text $q$),
  ('k_motzkin_paths','M(3,1) in lex order U<H<D: UHD, UDH, HUD','eq','UHD,UDH,HUD','rank 0 UHD … rank 2 HUD (corpus anchors)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(k_motzkin_paths(3,1)) e $q$),
  ('k_motzkin_paths','fibers sum to Motzkin(n): Σ_k M(n,k) for n=0..6 = 1,1,2,4,9,21,51','eq','1,1,2,4,9,21,51','the k-refinement telescopes to Motzkin',$q$
    SELECT string_agg(cardinality(k_motzkin_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('k_motzkin_paths','Motzkin triangle row n=4 over k=0..4: 2,0,6,0,1','eq','2,0,6,0,1','C(4,k)·Catalan((4-k)/2), 0 when parity fails',$q$
    SELECT string_agg(cardinality(k_motzkin_paths(4,k))::text, ',' ORDER BY k) FROM generate_series(0,4) k $q$),
  ('k_motzkin_paths','k=0 slice = the Dyck paths (all U/D): M(4,0)=Catalan(2)=2','eq','2','no H steps ⇒ a Dyck path of semilength n/2',$q$
    SELECT cardinality(k_motzkin_paths(4,0))::text $q$),
  ('k_motzkin_paths','k=n slice = the single all-H path: M(3,3)=1','eq','1|HHH','every step level',$q$
    SELECT cardinality(k_motzkin_paths(3,3))::text || '|' || notation((unrank(k_motzkin_paths(3,3), 0)).value) $q$),
  ('k_motzkin_paths','floor count = accel across the n=4 row','eq','2,0,6,0,1','the generated floor, counted',$q$
    SELECT string_agg((SELECT count(*) FROM elements(k_motzkin_paths(4,k)))::text, ',' ORDER BY k) FROM generate_series(0,4) k $q$),
  ('k_motzkin_paths','every element has exactly k H steps and stays ≥ 0 (n=5,k=1)','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and((SELECT count(*) FILTER (WHERE s=0) FROM unnest(((e).value).steps) s) = 1
                AND (SELECT min(h) FROM (SELECT sum(s) OVER (ORDER BY o) h
                     FROM unnest(((e).value).steps) WITH ORDINALITY AS t(s,o)) q) >= 0)::text
      FROM elements(k_motzkin_paths(5,1)) e $q$),
  ('k_motzkin_paths','multi-grade chain: fiber = (n,k) named axes','eq','3|1','unrank(k_motzkin_paths(3,1),0).fiber',$q$
    SELECT (unrank(k_motzkin_paths(3,1), 0)).fiber.n::text || '|' || (unrank(k_motzkin_paths(3,1), 0)).fiber.k::text $q$),
  ('k_motzkin_paths','global order = (n,k,ordinality): k_motzkin_paths(2)','eq','UD|HH','k ascending (k=0 then k=2), lex within',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY e) FROM elements(k_motzkin_paths(2)) e $q$),
  ('k_motzkin_paths','contains via <@: UHD ∈ (3,1), HHH ∉ (3,1) (3 H steps), UD ∉ (3,1) (wrong length)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[1,0,-1])::k_motzkin_path <@ k_motzkin_paths(3,1))::text || '|' ||
           (ROW(ARRAY[0,0,0])::k_motzkin_path <@ k_motzkin_paths(3,1))::text || '|' ||
           (ROW(ARRAY[1,-1])::k_motzkin_path <@ k_motzkin_paths(3,1))::text $q$);
