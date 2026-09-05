-- requires: realizer
-- signed_subsets — the faces of the cross-polytope β_n (the octahedron at n=3). A signed subset of {1..n} chooses,
-- for each axis k, absent / +k / −k; there are 3^n of them. The empty set is the whole body; a size-m signed
-- subset is an (m−1)-face spanning the vertices ±e_k it names. The 2n dim-0 faces (signed singletons ±e_k) are the
-- polytope's vertices. Carried as (coords, n): coords = the signed nonzero values sorted by |value|, n = the axis
-- count (kept on the element so the body knows its dimension and the coordinate knows how many axes to fill).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE signed_subset AS (coords int[], n int);
CREATE FUNCTION notation(s signed_subset) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '{' || coalesce(array_to_string((s).coords, ','), '') || '}' $$;   -- {} = the body; {1,-3} = +e1,−e3

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE signed_subsets_fiber AS (n natural_number);   -- typed fiber; axis: n
-- every choice of absent / +k / −k per axis k = 1..n, grown as a prefix; coords keep the present signed values.
CREATE FUNCTION fiber_elements(f signed_subsets_fiber, element_limit int) RETURNS SETOF signed_subset LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(coords, k) AS (
    SELECT ARRAY[]::int[], 0
    UNION ALL
    SELECT CASE d WHEN 0 THEN gen.coords WHEN 1 THEN gen.coords || (gen.k + 1) ELSE gen.coords || (-(gen.k + 1)) END, gen.k + 1
    FROM gen, generate_series(0, 2) d
    WHERE gen.k < (f).n::int)
  SELECT ROW(coords, (f).n::int)::signed_subset FROM gen WHERE k = (f).n::int ORDER BY coords LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f signed_subsets_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT trunc(3::numeric ^ (f).n::int) $$;
CREATE FUNCTION contains_in_fiber(f signed_subsets_fiber, v signed_subset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).n = (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).coords) c WHERE abs(c) < 1 OR abs(c) > (f).n::int)   -- axes in range
     AND (SELECT count(DISTINCT abs(c)) = count(*) FROM unnest((v).coords) c)                       -- distinct axes
     AND (v).coords = ARRAY(SELECT c FROM unnest((v).coords) c ORDER BY abs(c)) $$;                 -- sorted by |value|

-- ── declare it as DATA + realize ─────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('signed_subsets', 'signed_subset');
INSERT INTO base_grade VALUES ('signed_subsets', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f signed_subsets_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '3^[' || (f).n::int || ']' $$;   -- corpus symbol

-- direct unrank — the floor's ORDER BY coords sorts variable-length int[] arrays by pg's array comparison (shorter
-- is less when it's a genuine prefix; otherwise the first differing element decides). For axes m..n, let S(m) be
-- the (recursively defined) sorted coordinate-array set built from axes m..n: S(n+1) = {[]}; S(m) = S(m+1) (axis m
-- absent) ∪ {[-m]++s : s∈S(m+1)} ∪ {[+m]++s : s∈S(m+1)}. Since every element of S(m+1) either is [] or starts with
-- some ±j, j>m (so |±j| > |±m| for the ± m branches), a short comparison argument shows S(m) sorts as 5 CONTIGUOUS
-- blocks: [the empty array] < [elements of S(m+1) starting negative] < [-m branch, ALL of it] < [+m branch, ALL of
-- it] < [elements of S(m+1) starting positive] — i.e. E(m) < Neg(m) < (-m)+S(m+1) < (+m)+S(m+1) < Pos(m), where
-- Neg/Pos(m) are themselves the (recursively) first-entry-negative/positive halves of S(m), size (3^(n-m+1)-1)/2
-- each by symmetry. Unranking descends this 5-way split axis by axis (verified by hand against n=2's 9-element order).
CREATE FUNCTION signed_subset_unrank(n int, m int, ord bigint) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE sizeS numeric; sizeNeg numeric; sizeNextNeg numeric; sizeNextS numeric; r numeric := ord;
  BEGIN
    IF m > n THEN RETURN ARRAY[]::int[]; END IF;
    sizeS := trunc(3::numeric ^ (n - m + 1));
    sizeNeg := (sizeS - 1) / 2;
    IF r = 0 THEN RETURN ARRAY[]::int[]; END IF;                        -- E(m): the empty array
    r := r - 1;
    sizeNextS := trunc(3::numeric ^ (n - m));                           -- |S(m+1)|
    sizeNextNeg := (sizeNextS - 1) / 2;                                 -- |Neg(m+1)|
    IF r < sizeNeg THEN                                                -- Neg(m) = Neg(m+1) ++ ((-m)+S(m+1))
      IF r < sizeNextNeg THEN RETURN signed_subset_unrank(n, m + 1, (r + 1)::bigint);            -- Neg(m+1)
      ELSE RETURN ARRAY[-m] || signed_subset_unrank(n, m + 1, (r - sizeNextNeg)::bigint); END IF; -- (-m)+S(m+1)
    ELSE                                                                -- Pos(m) = ((+m)+S(m+1)) ++ Pos(m+1)
      r := r - sizeNeg;
      IF r < sizeNextS THEN RETURN ARRAY[m] || signed_subset_unrank(n, m + 1, r::bigint);         -- (+m)+S(m+1)
      ELSE RETURN signed_subset_unrank(n, m + 1, (1 + sizeNextNeg + (r - sizeNextS))::bigint); END IF; -- Pos(m+1)
    END IF;
  END $$;
CREATE FUNCTION fiber_unrank(f signed_subsets_fiber, rank rank_index) RETURNS signed_subset LANGUAGE sql IMMUTABLE AS $fu$
  SELECT ROW(signed_subset_unrank((f).n::int, 1, rank::bigint), (f).n::int)::signed_subset $fu$;
SELECT base_realize('signed_subsets');

-- ── cross-polytope realization ───────────────────────────────────────────────────────────────────────
-- dimension: the body (empty) is the whole n-polytope; a size-m signed subset is an (m−1)-face.
CREATE FUNCTION signed_subset_face_dim(s signed_subset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(array_length((s).coords, 1), 0) = 0 THEN (s).n ELSE array_length((s).coords, 1) - 1 END $$;
-- coordinate: the signed indicator over the n axes (+1 / −1 / 0). Exact and integer; the vertices land on ±e_k.
CREATE FUNCTION signed_subset_point(s signed_subset) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY(SELECT coalesce((SELECT sign(c)::int FROM unnest((s).coords) c WHERE abs(c) = k), 0)
               FROM generate_series(1, (s).n) k) $$;
-- face-poset containment: the body contains every vertex; a proper face contains the (dim-0) vertex `small` iff
-- small's signed coordinate is one of its own.
CREATE FUNCTION signed_subset_face_contains(big signed_subset, small signed_subset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((big).coords, 1), 0) = 0 OR (small).coords <@ (big).coords $$;

INSERT INTO base_repr (collection, repr, render_fn, title, canonical) VALUES
  ('signed_subsets','coordinates','signed_subset_point','Signed indicator (±1/0 per axis)',false);
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('signed_subsets','face_dim','signed_subset_face_dim','Cross-polytope face dimension','natural_numbers');
-- the polytope realization is carried by the SEPARATE `cross_polytope` collection (polytope-collections.sql).

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('signed_subsets','COUNT anchor: 3^n for n=0..4','eq','1,3,9,27,81','cardinality per fiber',$q$
    SELECT string_agg(cardinality(signed_subsets(n))::text, ',' ORDER BY n) FROM generate_series(0,4) n $q$),
  ('signed_subsets','a signed singleton is a vertex (dim 0), the body dim 3, a size-2 subset an edge','eq','0|3|1','dims of {1}, {} (body), {1,-2} in n=3',$q$
    SELECT signed_subset_face_dim(ROW(ARRAY[1], 3)::signed_subset)::text || '|' ||
           signed_subset_face_dim(ROW(ARRAY[]::int[], 3)::signed_subset)::text || '|' ||
           signed_subset_face_dim(ROW(ARRAY[1,-2], 3)::signed_subset)::text $q$),
  ('signed_subsets','coordinate: +e1 = (1,0,0), −e3 = (0,0,-1), {1,-3} = (1,0,-1), body = (0,0,0)','eq','(1,0,0)|(0,0,-1)|(1,0,-1)|(0,0,0)','the signed indicator',$q$
    SELECT '(' || array_to_string(signed_subset_point(ROW(ARRAY[1], 3)::signed_subset), ',') || ')|(' ||
                 array_to_string(signed_subset_point(ROW(ARRAY[-3], 3)::signed_subset), ',') || ')|(' ||
                 array_to_string(signed_subset_point(ROW(ARRAY[1,-3], 3)::signed_subset), ',') || ')|(' ||
                 array_to_string(signed_subset_point(ROW(ARRAY[]::int[], 3)::signed_subset), ',') || ')' $q$),
  ('signed_subsets','β_3 f-vector: 6 vertices, 12 edges, 8 triangular faces, 1 body','eq','6,12,8,1','faces by dimension over signed_subsets(3) = the octahedron',$q$
    SELECT string_agg(cnt::text, ',' ORDER BY d) FROM (
      SELECT signed_subset_face_dim((e).value) d, count(*) cnt FROM elements(signed_subsets(3)) e GROUP BY 1) t(d, cnt) $q$),
  ('signed_subsets','the octahedron edge {1,2} spans vertices +e1 and +e2; the body contains every vertex','eq','true|true|false','face containment (vertex incidence)',$q$
    SELECT signed_subset_face_contains(ROW(ARRAY[1,2], 3)::signed_subset, ROW(ARRAY[1], 3)::signed_subset)::text || '|' ||
           signed_subset_face_contains(ROW(ARRAY[]::int[], 3)::signed_subset, ROW(ARRAY[-2], 3)::signed_subset)::text || '|' ||
           signed_subset_face_contains(ROW(ARRAY[1,2], 3)::signed_subset, ROW(ARRAY[3], 3)::signed_subset)::text $q$),
  ('signed_subsets','contains: {1,-2} ∈ signed_subsets(3); {1,4} ∉ (axis 4 out of range); {2,1} ∉ (not |value|-sorted)','eq','true|false|false','generated from contains_in_fiber',$q$
    SELECT contains(signed_subsets(3), ROW(ARRAY[1,-2], 3)::signed_subset)::text || '|' ||
           contains(signed_subsets(3), ROW(ARRAY[1,4], 3)::signed_subset)::text || '|' ||
           contains(signed_subsets(3), ROW(ARRAY[2,1], 3)::signed_subset)::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('signed_subsets','fiber_unrank(signed_subsets(3), 0..26) are all members (accel floor)','eq','true','the 5-way recursive split unrank lands inside 3^3=27 for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(signed_subsets(3)) f), ord::rank_index) <@ signed_subsets(3))::text
      FROM generate_series(0, cardinality(signed_subsets(3))::int - 1) ord $q$);
