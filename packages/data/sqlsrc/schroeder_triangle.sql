-- requires: schroeder_paths, realizer, utilities, catalan_numbers, schroeder_numbers, triangle_slices
-- schroeder_triangle — the LARGE Schröder paths (schroeder_paths) refined by a second axis: k = the number of
-- flat (F) steps in the path. Multi-grade chain [n (semilength), k (#flats, 0..n)] — same refinement move as
-- narayana_numbers over dyck_paths (peaks) or set_partitions_into_k_blocks over set_partitions (block count).
-- #236: folded onto the `schroeder_path` carrier — schroeder_triangle_path was byte-identical (same {-1,0,1}
-- steps int[], same U/D/F notation, same lex-DESC order), so the bijection to schroeder_path is the identity
-- on the same representation. schroeder_triangle now inherits schroeder_paths' flat_steps/peaks/height stats
-- and its glyph for free (see schroeder_triangle.stats.sql, retired as redundant).
--
-- T(n,k) closed form, derived from the U/D-vs-F decomposition: a Schröder path with exactly k flats has the
-- other n−k steps forming a Dyck path of semilength (n−k) (removing the flats doesn't change validity/height),
-- and the k flats can sit in any k of the (n−k)·2 + k total step positions. So:
--   T(n,k) = C(2(n−k)+k, k) · Catalan(n−k) = C(2n−k, k) · Catalan(n−k),   0 ≤ k ≤ n
-- Column k=0 is pure Dyck paths ⇒ T(n,0) = Catalan(n); column k=n is the all-flat path ⇒ T(n,n) = 1. This is
-- also the standard bivariate-GF recurrence S(x,y) = 1 + xy·S(x,y) + x·S(x,y)² (y marks a flat step, the two
-- x·S·S branches mark a U…D wrap with no y) read off by coefficient: T(n,k) = T(n−1,k−1) + Σ_i Σ_j T(i,j)·
-- T(n−1−i,k−j) — the closed form above is the solved version of that convolution, used directly for fiber_count.
--
-- Row-sum: Σ_k T(n,k) is exactly cardinality(schroeder_paths(n)), the large Schröder number r(n) — schroeder_paths
-- and schroeder_numbers already carry that identity (A006318: 1,2,6,22,90,394,…), so this triangle's row-sum ties
-- to the REALIZED `schroeder_numbers` sequence. (The little Schröder / super-Catalan numbers s(n) — row sums of
-- the classic A033877 "Schröder's triangle" — are only realized here as dissections' per-fiber cardinality, not as
-- a standalone ungraded sequence collection, so that pairing is left for when/if such a collection exists.)

CREATE FUNCTION schroeder_triangle_count(n int, k int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN k < 0 OR k > n THEN 0::numeric
         ELSE binomial(2*n - k, k) * catalan_number(n - k) END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: grow every valid prefix (height h, x-position x; U/D width 1, F width 2, never dip below 0 — same
-- technique as schroeder_paths), keep the height-0 completions at x=2n, then filter to those with exactly
-- address[2] flat (0-coded) steps.
CREATE TYPE schroeder_triangle_fiber AS (n natural_number, k natural_number);   -- typed fiber; axes: n, k
CREATE FUNCTION fiber_elements(f schroeder_triangle_fiber, element_limit int) RETURNS SETOF schroeder_path LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, h, x) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.h + c.dh, g.x + c.dx
      FROM gen g CROSS JOIN (VALUES (1, 1, 1), (-1, -1, 1), (0, 0, 2)) AS c(step, dh, dx)
      WHERE g.x < 2 * (f).n::int
        AND g.h + c.dh >= 0
        AND g.x + c.dx <= 2 * (f).n::int
  ),
  paths AS (SELECT steps FROM gen WHERE x = 2 * (f).n::int AND h = 0),
  flats AS (SELECT p.steps, (SELECT count(*) FROM unnest(p.steps) s WHERE s = 0) AS flat_count FROM paths p)
  SELECT ROW(steps)::schroeder_path FROM flats
  WHERE flat_count = (f).k::int
  ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f schroeder_triangle_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT schroeder_triangle_count((f).n::int, (f).k::int) $$;

-- contains: a valid Schroeder path of semilength n (steps in {1,-1,0}, net height 0, x-width 2n, every prefix
-- height ≥ 0 — same as schroeder_paths.contains_in_fiber) with EXACTLY k flat (0-coded) steps.
CREATE FUNCTION contains_in_fiber(f schroeder_triangle_fiber, v schroeder_path) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (1, -1, 0))
     AND coalesce((SELECT sum(s) FROM unnest((v).steps) s), 0) = 0
     AND coalesce((SELECT sum(CASE WHEN s = 0 THEN 2 ELSE 1 END) FROM unnest((v).steps) s), 0) = 2 * (f).n::int
     AND coalesce((SELECT min(h) FROM (
           SELECT sum(s) OVER (ORDER BY o) h FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q), 0) >= 0
     AND coalesce((SELECT count(*) FROM unnest((v).steps) s WHERE s = 0), 0) = (f).k::int $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('schroeder_triangle', 'schroeder_path');
INSERT INTO base_grade VALUES
  ('schroeder_triangle', 1, 'n', NULL, NULL),
  ('schroeder_triangle', 2, 'k', '0', 'g1');                          -- k ranges 0..n by default
SELECT base_realize('schroeder_triangle');

-- register with the triangle-slicing machinery: row-sum recovers the REALIZED large Schröder sequence.
INSERT INTO base_triangle (collection, row_axis, col_axis, title, sequence) VALUES
  ('schroeder_triangle', 'n', 'k', 'Schröder triangle — large Schröder paths by number of flat steps — T(n,k)', 'schroeder_numbers');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('schroeder_triangle','row n=0..4, hand-verified against T(n,k)=C(2n−k,k)·Catalan(n−k)','eq',
   '1|1,1|2,3,1|5,10,6,1|14,35,30,10,1','rows via the accelerated cardinality',$q$
    SELECT string_agg(row_str, '|' ORDER BY n) FROM (
      SELECT n, string_agg(cardinality(schroeder_triangle(n,k))::text, ',' ORDER BY k) row_str
      FROM generate_series(0,4) n, LATERAL generate_series(0,n) k GROUP BY n) t $q$),
  ('schroeder_triangle','the floor at [2,1] generates exactly the 3 one-flat semilength-2 paths','eq','UFD,UDF,FUD','fixed order U(1)<F(0)<D(-1) per-step, matches schroeder_paths(2)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(schroeder_triangle(2,1)) e $q$),
  ('schroeder_triangle','row-sum recovers the large Schröder numbers r(n)=1,2,6,22,90,394 (n=0..5)','eq','1,2,6,22,90,394',
   'triangle_rowsum(schroeder_triangle, n) = cardinality(schroeder_paths(n)) = schroeder_numbers term n',$q$
    SELECT string_agg(triangle_rowsum('schroeder_triangle', n)::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('schroeder_triangle','row-sum matches the realized schroeder_numbers floor term-for-term (n=0..6)','eq','all-match','triangle ⟶ sequence alias identity, this pairing specifically',$q$
    SELECT coalesce(string_agg('n='||n, ', '), 'all-match') FROM generate_series(0,6) n
    WHERE triangle_rowsum('schroeder_triangle', n)::numeric IS DISTINCT FROM sequence_term('schroeder_numbers', n) $q$),
  ('schroeder_triangle','column k=0 is pure Dyck paths ⇒ Catalan numbers 1,1,2,5,14,42','eq','1,1,2,5,14,42','T(n,0) = Catalan(n), n=0..5',$q$
    SELECT string_agg(value::text, ',' ORDER BY row_index) FROM triangle_column('schroeder_triangle', 0, 5) $q$),
  ('schroeder_triangle','diagonal k=n (all-flat path) is always 1','eq','1,1,1,1,1,1','T(n,n) = 1, n=0..5',$q$
    SELECT string_agg(value::text, ',' ORDER BY row_index) FROM triangle_diagonal('schroeder_triangle', 0, 5) $q$),
  ('schroeder_triangle','every element of fiber [3,2] has exactly 2 flat steps (structural invariant, via the inherited schroeder_flat_steps stat)','eq','true','schroeder_triangle now shares schroeder_path''s carrier',$q$
    SELECT bool_and(schroeder_flat_steps((e).value) = 2)::text FROM elements(schroeder_triangle(3,2)) e $q$),
  ('schroeder_triangle','contains via <@: UFD ∈ T(2,1); UUDD ∉ T(2,1) (it is T(2,0))','eq','true|false','a valid path with exactly k flats',$q$
    SELECT (ROW(ARRAY[1,0,-1])::schroeder_path <@ schroeder_triangle(2,1))::text || '|' ||
           (ROW(ARRAY[1,1,-1,-1])::schroeder_path <@ schroeder_triangle(2,1))::text $q$),
  ('schroeder_triangle','#236: every schroeder_paths stat resolves on schroeder_triangle too (flat_steps, peaks, height)','eq','true','base_stat_resolved inheritance via the shared carrier',$q$
    SELECT (EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'schroeder_triangle' AND stat_id = 'flat_steps') AND
            EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'schroeder_triangle' AND stat_id = 'peaks') AND
            EXISTS (SELECT 1 FROM base_stat_resolved WHERE collection = 'schroeder_triangle' AND stat_id = 'height'))::text $q$);
