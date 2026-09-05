-- requires: realizer
-- dissections — the non-crossing diagonal sets of the (n+2)-gon: the FACES of the associahedron for binary_trees(n).
-- A triangulation (the maximal dissection, n−1 diagonals) is a vertex; the empty dissection (no diagonals) is the
-- whole body. count = the little Schröder / super-Catalan numbers s(n) = 1,1,3,11,45,197. Carried as (diagonals, m):
-- diagonals = the sorted diagonal codes i·m+j (0≤i<j≤m−1, j−i≥2, not the base side (0,m−1)), m = the polygon size n+2.

-- ── diagonal helpers ─────────────────────────────────────────────────────────────────────────────────
-- two diagonals (a,b),(c,d) (each i·m+j, i<j) CROSS iff their endpoints interleave: a<c<b<d or c<a<d<b.
CREATE FUNCTION diagonals_cross(c1 int, c2 int, m int) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (c1 / m < c2 / m AND c2 / m < c1 % m AND c1 % m < c2 % m)
      OR (c2 / m < c1 / m AND c1 / m < c2 % m AND c2 % m < c1 % m) $$;
-- little Schröder s(n): (n+1)·s(n) = (6n−3)·s(n−1) − (n−2)·s(n−2), s(0)=s(1)=1.
CREATE FUNCTION little_schroeder(n int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a numeric := 1; b numeric := 1; c numeric; i int;
  BEGIN
    IF n <= 1 THEN RETURN 1; END IF;
    FOR i IN 2..n LOOP c := round(((6*i - 3) * b - (i - 2) * a) / (i + 1)); a := b; b := c; END LOOP;
    RETURN b;
  END $$;

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE dissection AS (diagonals int[], m int);
CREATE FUNCTION notation(d dissection) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg((c / (d).m) || '-' || (c % (d).m), ',' ORDER BY c), '{}') FROM unnest((d).diagonals) c $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- every non-crossing subset of the (n+2)-gon's diagonals, grown by adding each diagonal (in code order) only when
-- it crosses none already chosen — so each dissection is generated exactly once.
CREATE TYPE dissections_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f dissections_fiber, element_limit int) RETURNS SETOF dissection LANGUAGE sql STABLE AS $$
  WITH RECURSIVE
    dg AS (SELECT array_agg(i * ((f).n::int + 2) + j ORDER BY i * ((f).n::int + 2) + j) AS all_diags
           FROM generate_series(0, (f).n::int + 1) i, generate_series(0, (f).n::int + 1) j
           WHERE i < j AND j - i >= 2 AND NOT (i = 0 AND j = (f).n::int + 1)),
    gen(chosen, k) AS (
      SELECT ARRAY[]::int[], 1
      UNION ALL
      SELECT CASE WHEN b.inc THEN gen.chosen || (dg.all_diags)[gen.k] ELSE gen.chosen END, gen.k + 1
      FROM gen, dg, LATERAL (VALUES (false), (true)) b(inc)
      WHERE gen.k <= coalesce(array_length(dg.all_diags, 1), 0)
        AND (NOT b.inc OR NOT EXISTS (
              SELECT 1 FROM unnest(gen.chosen) e WHERE diagonals_cross(e, (dg.all_diags)[gen.k], (f).n::int + 2))))
  SELECT ROW(gen.chosen, (f).n::int + 2)::dissection FROM gen, dg
   WHERE gen.k = coalesce(array_length(dg.all_diags, 1), 0) + 1
   ORDER BY coalesce(array_length(gen.chosen, 1), 0), gen.chosen
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f dissections_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT little_schroeder((f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f dissections_fiber, v dissection) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).m = (f).n::int + 2
     AND NOT EXISTS (SELECT 1 FROM unnest((v).diagonals) c
                     WHERE c / (v).m >= c % (v).m OR c % (v).m - c / (v).m < 2 OR (c / (v).m = 0 AND c % (v).m = (v).m - 1))
     AND NOT EXISTS (SELECT 1 FROM unnest((v).diagonals) c1, unnest((v).diagonals) c2 WHERE c1 < c2 AND diagonals_cross(c1, c2, (v).m))
     AND (v).diagonals = ARRAY(SELECT c FROM unnest((v).diagonals) c ORDER BY c) $$;

-- ── declare it as DATA + realize ─────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('dissections', 'dissection');
INSERT INTO base_grade VALUES ('dissections', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f dissections_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'D(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('dissections');

-- the face structure: the number of diagonals, and the associahedron face dimension = (n−1) − #diagonals (a
-- triangulation is a vertex, the empty dissection the whole body).
CREATE FUNCTION dissection_diagonal_count(d dissection) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((d).diagonals, 1), 0) $$;
CREATE FUNCTION dissection_face_dim(d dissection) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT ((d).m - 3) - coalesce(array_length((d).diagonals, 1), 0) $$;
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('dissections','diagonals','dissection_diagonal_count','Number of diagonals','natural_numbers'),
  ('dissections','face_dim','dissection_face_dim','Associahedron face dimension','natural_numbers');

-- ── associahedron realization (Loday) ────────────────────────────────────────────────────────────────
-- Loday's coordinate of a TRIANGULATION (a vertex): recurse over the polygon from the base edge — the triangle on
-- arc [lo,hi] has a unique apex k, contributing (leaves left)·(leaves right) = (k−lo)·(hi−k) in infix order. This
-- is exactly binary_tree_loday_point through the triangulation ↔ binary-tree bijection, computed on the polygon.
CREATE FUNCTION dissection_edge(diags int[], m int, a int, b int) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT b = a + 1 OR (a * m + b) = ANY(diags) $$;                                  -- a polygon side, or a chosen diagonal
CREATE FUNCTION dissection_loday_rec(diags int[], m int, lo int, hi int) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE k int;
  BEGIN
    IF hi = lo + 1 THEN RETURN '{}'::int[]; END IF;                                 -- a single edge = a leaf
    SELECT kk INTO k FROM generate_series(lo + 1, hi - 1) kk                        -- the unique apex of the base triangle
      WHERE dissection_edge(diags, m, lo, kk) AND dissection_edge(diags, m, kk, hi) LIMIT 1;
    RETURN dissection_loday_rec(diags, m, lo, k) || ((k - lo) * (hi - k)) || dissection_loday_rec(diags, m, k, hi);
  END $$;
CREATE FUNCTION dissection_loday_point(d dissection) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN dissection_face_dim(d) = 0 THEN dissection_loday_rec((d).diagonals, (d).m, 0, (d).m - 1)
              ELSE '{}'::int[] END $$;                                              -- the centre coordinate is exact on the vertices
-- face containment for the generic viewer: dissection `big` contains the (dim-0) vertex `small` iff the
-- triangulation small refines big — small's diagonals include all of big's.
CREATE FUNCTION dissection_face_contains(big dissection, small dissection) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (big).diagonals <@ (small).diagonals $$;

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('dissections','COUNT anchor: little Schröder s(n) for n=1..5','eq','1,3,11,45,197','dissections of the (n+2)-gon',$q$
    SELECT string_agg(cardinality(dissections(n))::text, ',' ORDER BY n) FROM generate_series(1,5) n $q$),
  ('dissections','the floor generates exactly little_schroeder(4) = 45 dissections of the hexagon','eq','45|45','count(floor) = the accel',$q$
    SELECT (SELECT count(*) FROM elements(dissections(4)) e)::text || '|' || cardinality(dissections(4))::text $q$),
  ('dissections','associahedron f-vector by face dimension: K_5 (n=4) is 14,21,9,1','eq','14,21,9,1','14 vertices, 21 edges, 9 faces, 1 body',$q$
    SELECT string_agg(cnt::text, ',' ORDER BY d) FROM (
      SELECT dissection_face_dim((e).value) d, count(*) cnt FROM elements(dissections(4)) e GROUP BY 1) t(d, cnt) $q$),
  ('dissections','the pentagon K_4 (n=3): 5 vertices, 5 edges, 1 body','eq','5,5,1','f-vector by dimension',$q$
    SELECT string_agg(cnt::text, ',' ORDER BY d) FROM (
      SELECT dissection_face_dim((e).value) d, count(*) cnt FROM elements(dissections(3)) e GROUP BY 1) t(d, cnt) $q$),
  ('dissections','vertices (dim 0) = triangulations = Catalan(n): 1,2,5,14,42','eq','1,2,5,14,42','the 0-faces per n=1..5',$q$
    SELECT string_agg(v::text, ',' ORDER BY n) FROM generate_series(1,5) n,
      LATERAL (SELECT count(*) v FROM elements(dissections(n)) e WHERE dissection_face_dim((e).value) = 0) t $q$),
  ('dissections','contains: a crossing pair is not a valid dissection of the hexagon','eq','true|false','{0-2} valid; {0-2,1-3}... 0-3,1-4 cross',$q$
    SELECT contains(dissections(4), ROW(ARRAY[0*6+2], 6)::dissection)::text || '|' ||
           contains(dissections(4), ROW(ARRAY[0*6+3, 1*6+4], 6)::dissection)::text $q$);
