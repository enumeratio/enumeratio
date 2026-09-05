-- requires: dyck_paths, realizer, utilities
-- colored_motzkin_paths — Motzkin paths of length n whose each horizontal (level) step carries one of r COLORS.
-- Two-grade chain [n (length), r (# colors)], r defaulting to 1..n. |colored_motzkin_paths(n,r)| =
-- Σ_j C(n,2j)·Catalan(j)·r^(n−2j) (choose the 2j up/down positions forming a Dyck path of semilength j; the other
-- n−2j level steps each pick a color). r=1 recovers the plain Motzkin numbers; r=2 gives Catalan(n+1) (2-colored
-- Motzkin ↔ Dyck of semilength n+1, [[OEIS:A000108]] shifted). Own carrier: parallel (steps, colors) arrays — steps
-- over U(+1)/H(0)/D(−1), colors[i] the color 0..r−1 of an H step (−1 on U/D). Bounded lattice-walk floor, ordered so
-- the letter order is U < H₀ < H₁ < … < D (lex-first path first).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE colored_motzkin_path AS (steps int[], colors int[]);       -- steps ±1/0; colors = H colour (−1 on U/D). {1,0,-1}/{-1,0,-1} = U H₀ D
CREATE FUNCTION notation(p colored_motzkin_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE s WHEN 1 THEN 'U' WHEN -1 THEN 'D' ELSE 'H' || c END, '' ORDER BY o), '')
  FROM unnest((p).steps, (p).colors) WITH ORDINALITY AS t(s, c, o) $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE colored_motzkin_paths_fiber AS (n natural_number, r natural_number);   -- axes: n (length), r (# H colors)
-- FLOOR: a length-n lattice walk carrying a per-step sort key so the emission order is the letter order
-- U < H₀ < … < H_{r−1} < D. key = (−step)·1000 + colour: U → −1000, H_c → c, D → 1000 (colours < 1000). At each
-- position try U, D, and every coloured H that keeps the path ≥ 0 and able to return to 0 in the steps that remain.
CREATE FUNCTION fiber_elements(f colored_motzkin_paths_fiber, element_limit int) RETURNS SETOF colored_motzkin_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE walk(pos, height, steps, colors, keys) AS (
    SELECT 0, 0, ARRAY[]::int[], ARRAY[]::int[], ARRAY[]::int[]
    UNION ALL
    SELECT w.pos + 1, w.height + s.step, w.steps || s.step, w.colors || s.color, w.keys || ((-s.step) * 1000 + s.keyc)
    FROM walk w, LATERAL (
        SELECT 1 AS step, -1 AS color, 0 AS keyc WHERE w.height + 1 <= (f).n::int - (w.pos + 1)     -- U (can descend back)
      UNION ALL
        SELECT -1, -1, 0 WHERE w.height >= 1                                                         -- D
      UNION ALL
        SELECT 0, c, c FROM generate_series(0, (f).r::int - 1) c WHERE w.height <= (f).n::int - (w.pos + 1)   -- H_c
    ) s
    WHERE w.pos < (f).n::int
  )
  SELECT ROW(steps, colors)::colored_motzkin_path FROM walk
  WHERE pos = (f).n::int AND height = 0
  ORDER BY keys LIMIT element_limit $$;
CREATE FUNCTION colored_motzkin_count(n int, r int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE total numeric := 0; j int; BEGIN
    FOR j IN 0..(n / 2) LOOP
      total := total + binomial(n, 2*j)::numeric * catalan(j) * pow_int(r, n - 2*j);   -- Dyck of semilength j, colored H's
    END LOOP;
    RETURN total;
  END $$;
CREATE FUNCTION fiber_count(f colored_motzkin_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT colored_motzkin_count((f).n::int, (f).r::int) $$;
CREATE FUNCTION contains_in_fiber(f colored_motzkin_paths_fiber, v colored_motzkin_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).steps, 1), 0) = (f).n::int
     AND array_length((v).steps, 1) IS NOT DISTINCT FROM array_length((v).colors, 1)                 -- parallel arrays
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (-1, 0, 1))
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps, (v).colors) AS t(s, c)                           -- H colored 0..r-1, U/D uncolored (-1)
                     WHERE (s = 0 AND (c < 0 OR c > (f).r::int - 1)) OR (s <> 0 AND c <> -1))
     AND (SELECT coalesce(sum(s), 0) FROM unnest((v).steps) s) = 0
     AND NOT EXISTS (SELECT 1 FROM (SELECT sum(s) OVER (ORDER BY o) h
                     FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q WHERE h < 0) $$;

INSERT INTO base_collection VALUES ('colored_motzkin_paths', 'colored_motzkin_path');
INSERT INTO base_grade VALUES ('colored_motzkin_paths', 1, 'n', NULL, NULL), ('colored_motzkin_paths', 2, 'r', '1', 'g1');   -- r ranges 1..n
CREATE FUNCTION fiber_symbol(f colored_motzkin_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'M_' || (f).r::int || '(' || (f).n::int || ')' $$;
SELECT base_realize('colored_motzkin_paths');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('colored_motzkin_paths','r=1 recovers the Motzkin numbers, n=0..6: 1,1,2,4,9,21,51','eq','1,1,2,4,9,21,51','one color = plain Motzkin paths',$q$
    SELECT string_agg(cardinality(colored_motzkin_paths(n,1))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('colored_motzkin_paths','r=2 gives Catalan(n+1), n=0..5: 1,2,5,14,42,132','eq','1,2,5,14,42,132','2-colored Motzkin ↔ Dyck of semilength n+1',$q$
    SELECT string_agg(cardinality(colored_motzkin_paths(n,2))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('colored_motzkin_paths','anchor M_2(3)=14 = Catalan(4)','eq','14','r=2 colors, length 3',$q$
    SELECT cardinality(colored_motzkin_paths(3,2))::text $q$),
  ('colored_motzkin_paths','M_1(3) in lex order: UHD first, HHH last','eq','UH0D|H0H0H0','r=1 (H rendered H0); rank 0 and rank 3',$q$
    SELECT notation((unrank(colored_motzkin_paths(3,1), 0)).value) || '|' ||
           notation((unrank(colored_motzkin_paths(3,1), 3)).value) $q$),
  ('colored_motzkin_paths','M_2(3): rank 0 = UH0D, rank 13 (last) = H1H1H1','eq','UH0D|H1H1H1','the letter order U < H0 < H1 < D (corpus anchors)',$q$
    SELECT notation((unrank(colored_motzkin_paths(3,2), 0)).value) || '|' ||
           notation((unrank(colored_motzkin_paths(3,2), 13)).value) $q$),
  ('colored_motzkin_paths','floor count = accel for r=2, n=0..5','eq','1,2,5,14,42,132','the generated floor, counted',$q$
    SELECT string_agg((SELECT count(*) FROM elements(colored_motzkin_paths(n,2)))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('colored_motzkin_paths','r=3 at n=2: 3 H-colors² + 1 UD = 10','eq','10','C(2,0)·1·3² + C(2,2)·1·3⁰',$q$
    SELECT cardinality(colored_motzkin_paths(2,3))::text $q$),
  ('colored_motzkin_paths','multi-grade chain: fiber = (n,r) named axes','eq','3|2','unrank(colored_motzkin_paths(3,2),0).fiber',$q$
    SELECT (unrank(colored_motzkin_paths(3,2), 0)).fiber.n::text || '|' || (unrank(colored_motzkin_paths(3,2), 0)).fiber.r::text $q$),
  ('colored_motzkin_paths','r RANGE: cardinality(colored_motzkin_paths(2)) sums r=1..2','eq','7','M_1(2)=2 + M_2(2)=5',$q$
    SELECT cardinality(colored_motzkin_paths(2))::text $q$),
  ('colored_motzkin_paths','every element stays ≥ 0, ends at 0, H-steps colored in range (n=3,r=2)','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(contains(colored_motzkin_paths(3,2), (e).value))::text FROM elements(colored_motzkin_paths(3,2)) e $q$),
  ('colored_motzkin_paths','contains via <@: UH0D ∈ M_2(3), UH2D ∉ (color 2 out of range for r=2)','eq','true|false','H color must be 0..r-1',$q$
    SELECT (ROW(ARRAY[1,0,-1], ARRAY[-1,0,-1])::colored_motzkin_path <@ colored_motzkin_paths(3,2))::text || '|' ||
           (ROW(ARRAY[1,0,-1], ARRAY[-1,2,-1])::colored_motzkin_path <@ colored_motzkin_paths(3,2))::text $q$);
