-- requires: set_compositions, signed_subsets, dissections, subsets, simplex, k_subsets, permutations, signed_permutations, realizer, utilities
-- The polytopes as their OWN collections, in bijection with their combinatorial representatives. A set composition
-- is the natural combinatorial object; the `permutahedron` face is the geometric one — same data, distinct role.
-- Each polytope collection is an ORDER-ISOMORPHIC SIBLING of its representative (it borrows the representative's
-- carrier, floor, count and rank), so it inherits every stat / repr / map on that carrier for free (carrier-level
-- inheritance) — including the permutahedron/cross-polytope coordinate and face dimension — and it carries the
-- polytope realization (base_polytope) plus a map back to the representative. The map is what lets the viewer label
-- a face through the representative's presentations (block notation, the signed set, …) and hop onward (a
-- permutahedron vertex → its permutation, and so on).

-- ── permutahedron = the faces of P_n (≅ set_compositions) ───────────────────────────────────────────────
CREATE TYPE permutahedron_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows set_compositions' floor)
CREATE FUNCTION fiber_elements(f permutahedron_fiber, element_limit int) RETURNS SETOF set_composition LANGUAGE sql STABLE AS $$
  SELECT fiber_elements(ROW((f).n)::set_compositions_fiber, element_limit) $$;
CREATE FUNCTION fiber_count(f permutahedron_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT fiber_count(ROW((f).n)::set_compositions_fiber) $$;
CREATE FUNCTION contains_in_fiber(f permutahedron_fiber, v set_composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::set_compositions_fiber, v) $$;
INSERT INTO base_collection VALUES ('permutahedron', 'set_composition');
INSERT INTO base_grade VALUES ('permutahedron', 1, 'n', NULL, NULL);
SELECT base_realize('permutahedron');
INSERT INTO base_polytope (collection, dim_fn, point_fn, contains_fn, title) VALUES
  ('permutahedron','set_composition_face_dim','set_composition_permutahedron_point','set_composition_face_contains','Permutahedron');
CREATE FUNCTION set_composition_id(c set_composition) RETURNS set_composition LANGUAGE sql IMMUTABLE AS $$ SELECT c $$;  -- order-iso ⇒ identity
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('permutahedron','set_composition','set_composition_id','set_compositions','Set composition',NULL);

-- ── cross_polytope = the faces of β_n / the octahedron (≅ signed_subsets) ────────────────────────────────
CREATE TYPE cross_polytope_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows signed_subsets' floor)
CREATE FUNCTION fiber_elements(f cross_polytope_fiber, element_limit int) RETURNS SETOF signed_subset LANGUAGE sql STABLE AS $$
  SELECT fiber_elements(ROW((f).n)::signed_subsets_fiber, element_limit) $$;
CREATE FUNCTION fiber_count(f cross_polytope_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT fiber_count(ROW((f).n)::signed_subsets_fiber) $$;
CREATE FUNCTION contains_in_fiber(f cross_polytope_fiber, v signed_subset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::signed_subsets_fiber, v) $$;
INSERT INTO base_collection VALUES ('cross_polytope', 'signed_subset');
INSERT INTO base_grade VALUES ('cross_polytope', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f cross_polytope_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'β' || to_unicode_subscript((f).n) $$;   -- corpus symbol
SELECT base_realize('cross_polytope');
INSERT INTO base_polytope (collection, dim_fn, point_fn, contains_fn, title) VALUES
  ('cross_polytope','signed_subset_face_dim','signed_subset_point','signed_subset_face_contains','Cross-polytope');
CREATE FUNCTION signed_subset_id(s signed_subset) RETURNS signed_subset LANGUAGE sql IMMUTABLE AS $$ SELECT s $$;
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('cross_polytope','signed_subset','signed_subset_id','signed_subsets','Signed subset',NULL);

-- ── associahedron = the faces of the associahedron (≅ dissections) ──────────────────────────────────────
CREATE TYPE associahedron_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows dissections' floor)
CREATE FUNCTION fiber_elements(f associahedron_fiber, element_limit int) RETURNS SETOF dissection LANGUAGE sql STABLE AS $$
  SELECT fiber_elements(ROW((f).n)::dissections_fiber, element_limit) $$;
CREATE FUNCTION fiber_count(f associahedron_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT fiber_count(ROW((f).n)::dissections_fiber) $$;
CREATE FUNCTION contains_in_fiber(f associahedron_fiber, v dissection) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::dissections_fiber, v) $$;
INSERT INTO base_collection VALUES ('associahedron', 'dissection');
INSERT INTO base_grade VALUES ('associahedron', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f associahedron_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'K' || to_unicode_subscript((f).n) $$;   -- corpus symbol
SELECT base_realize('associahedron');
INSERT INTO base_polytope (collection, dim_fn, point_fn, contains_fn, title) VALUES
  ('associahedron','dissection_face_dim','dissection_loday_point','dissection_face_contains','Associahedron');
CREATE FUNCTION dissection_id(d dissection) RETURNS dissection LANGUAGE sql IMMUTABLE AS $$ SELECT d $$;  -- order-iso ⇒ identity
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('associahedron','dissection','dissection_id','dissections','Dissection',NULL);

-- ── hypercube = the faces of [0,1]^n — the SAME (coords,n) carrier as the cross-polytope, dual reading ────
-- No new collection: this row lives directly on `signed_subsets`, reusing its 3^n signed-subset carrier (#232
-- chunk 1). An axis named in `coords` is now FIXED (+k ⇒ that axis = 1, −k ⇒ that axis = 0); an axis absent is
-- FREE (the face spans that whole edge). dim = n − |coords| (the free axes): a vertex fixes every axis (dim 0),
-- the unconstrained coords={} face is the whole cube (dim n) — the reverse of the cross-polytope's dim, on the
-- identical data. This is the classical fact that the n-cube's face lattice and the n-cross-polytope's face
-- lattice share one 3^n-element indexing set (fix/free per axis vs. signed-support), just read in dual directions.
CREATE FUNCTION signed_subset_hypercube_face_dim(s signed_subset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (s).n - coalesce(array_length((s).coords, 1), 0) $$;
-- coordinate: a fixed axis takes its 0/1 value; a free axis reports the face's base corner (0) — always an actual
-- vertex of the face, exact and integer (no barycentre needed for the generic viewer).
CREATE FUNCTION signed_subset_hypercube_point(s signed_subset) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY(SELECT coalesce((SELECT (c > 0)::int FROM unnest((s).coords) c WHERE abs(c) = k), 0)
               FROM generate_series(1, (s).n) k) $$;
-- face-poset containment: `big`'s fixed axes must be a subset of `small`'s (small refines big) — the dual
-- direction of the cross-polytope's contains_fn, on the same <@ primitive.
CREATE FUNCTION signed_subset_hypercube_face_contains(big signed_subset, small signed_subset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (big).coords <@ (small).coords $$;
INSERT INTO base_polytope (collection, dim_fn, point_fn, contains_fn, title) VALUES
  ('signed_subsets','signed_subset_hypercube_face_dim','signed_subset_hypercube_point','signed_subset_hypercube_face_contains','Hypercube');

-- ── simplex = the faces of Δ_{n−1} (already exists as `simplex`, ≅ non-empty subsets) ──────────────────────
-- No new collection here either: `simplex` was missing from base_polytope (only permutahedron/associahedron/
-- cross_polytope were registered) — this fills that gap on its existing finset carrier. dim_fn already exists
-- (`simplex_face_dim`, |S|−1); only point_fn and contains_fn are new.
-- coordinate: the 0/1 membership indicator over the n axes — exact; singletons (vertices) land on the standard
-- basis e_i, a higher face's indicator is the (unscaled) sum of the vertices it spans.
CREATE FUNCTION simplex_point(s finset) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY(SELECT (k = ANY((s).members))::int FROM generate_series(1, (s).n) k) $$;
-- face-poset containment: simplex faces are ordered by plain set inclusion.
CREATE FUNCTION simplex_face_contains(big finset, small finset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (small).members <@ (big).members $$;
INSERT INTO base_polytope (collection, dim_fn, point_fn, contains_fn, title) VALUES
  ('simplex','simplex_face_dim','simplex_point','simplex_face_contains','Simplex');

-- ── hypersimplex = the faces of Δ(k,n) — reuses k_subsets(n,k)'s finset carrier directly (#232 chunk 2) ──────
-- No new collection: this row lives on `k_subsets`, whose elements ARE the hypersimplex's vertices (the 0/1
-- indicator vectors of weight k). Vertices only for now — dim_fn is a flat 0 for every realized element, and
-- contains_fn collapses to identity; the richer nested-subset face lattice (matroid-polytope faces above the
-- vertex level) is deferred to a later chunk.
CREATE FUNCTION k_subset_hypersimplex_face_dim(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 0 $$;   -- only vertices are realized (chunk 2 scope)
-- coordinate: the plain 0/1 membership indicator over the n axes — exactly a vertex of Δ(k,n).
CREATE FUNCTION k_subset_hypersimplex_point(s finset) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY(SELECT (k = ANY((s).members))::int FROM generate_series(1, (s).n) k) $$;
-- face-poset containment collapses to identity while only dim-0 vertices are realized.
CREATE FUNCTION k_subset_hypersimplex_face_contains(big finset, small finset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT big = small $$;
INSERT INTO base_polytope (collection, dim_fn, point_fn, contains_fn, title) VALUES
  ('k_subsets','k_subset_hypersimplex_face_dim','k_subset_hypersimplex_point','k_subset_hypersimplex_face_contains','Hypersimplex');
-- Johnson-graph adjacency: two k-subsets are adjacent vertices of Δ(k,n) iff they differ by a single swap (one
-- element out, one in) — |A∩B| = k−1. Standard fact: Δ(k,n)'s graph IS the Johnson graph J(n,k).
CREATE FUNCTION k_subset_hypersimplex_adjacent(a finset, b finset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (a).n = (b).n
     AND coalesce(array_length((a).members,1),0) = coalesce(array_length((b).members,1),0)
     AND (SELECT count(*) FROM unnest((a).members) m WHERE m = ANY((b).members))
       = coalesce(array_length((a).members,1),0) - 1 $$;

-- ── Birkhoff polytope B_n = the faces of the permutation-matrix polytope — reuses permutations(n)'s permutation
-- carrier directly (#232 chunk 2). Vertices only (dim_fn flat 0, contains_fn identity): the full face lattice of
-- B_n (doubly-stochastic-matrix support structure) is a richer condition, deferred to a later chunk.
CREATE FUNCTION permutation_birkhoff_face_dim(p permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 0 $$;
-- coordinate: the flattened n² permutation matrix (row-major); 1 where column = image[row], else 0.
CREATE FUNCTION permutation_birkhoff_point(p permutation) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY(SELECT (col = (p).image[row])::int
               FROM generate_series(1, coalesce(array_length((p).image,1),0)) row,
                    generate_series(1, coalesce(array_length((p).image,1),0)) col
               ORDER BY row, col) $$;
CREATE FUNCTION permutation_birkhoff_face_contains(big permutation, small permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT big = small $$;
INSERT INTO base_polytope (collection, dim_fn, point_fn, contains_fn, title) VALUES
  ('permutations','permutation_birkhoff_face_dim','permutation_birkhoff_point','permutation_birkhoff_face_contains','Birkhoff polytope');
-- transposition adjacency: permutations differing at EXACTLY two positions are adjacent vertices of B_n (their
-- difference support is a single 2-cycle — one cycle — which is Balinski & Russakoff's edge criterion). This is
-- a SAFE FLOOR on B_n's true edge set: longer-cycle differences are edges too (a richer condition, deferred) —
-- per the ticket, we compute this floor rather than guess the full edge count.
CREATE FUNCTION permutation_birkhoff_adjacent(a permutation, b permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT count(*) FROM generate_subscripts((a).image,1) i WHERE (a).image[i] <> (b).image[i]) = 2 $$;

-- ── type-B permutahedron = the faces of the hyperoctahedral zonotope — reuses signed_permutations(n)'s carrier
-- directly (#232 chunk 3). Vertices only for now (dim_fn flat 0, contains_fn identity), mirroring the Birkhoff/
-- hypersimplex vertex-only pattern (#232 chunk 2): the natural combinatorial face representative for the richer
-- face lattice is `signed_set_compositions` (a signed ordered set partition — the type-B analog of how
-- set_compositions represents permutahedron faces), but wiring that face structure onto this polytope row is
-- deferred to a later chunk.
CREATE FUNCTION signed_permutation_typeb_face_dim(p signed_permutation) RETURNS int LANGUAGE sql IMMUTABLE AS $$ SELECT 0 $$;
-- coordinate: the signed one-line vector itself — already an exact integer point (the view projects it).
CREATE FUNCTION signed_permutation_typeb_point(p signed_permutation) RETURNS int[] LANGUAGE sql IMMUTABLE AS $$ SELECT (p).image $$;
CREATE FUNCTION signed_permutation_typeb_face_contains(big signed_permutation, small signed_permutation) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT big = small $$;
INSERT INTO base_polytope (collection, dim_fn, point_fn, contains_fn, title) VALUES
  ('signed_permutations','signed_permutation_typeb_face_dim','signed_permutation_typeb_point','signed_permutation_typeb_face_contains','Type-B permutahedron');
-- edge floor: two Coxeter-generator families are safe (proven) edges of the type-B permutahedron zonotope — a single
-- sign flip on one entry (differ at exactly 1 position, same |value|), or a transposition of two entries with their
-- signs traveling with them (differ at exactly 2 positions, each swapped value matching the other's). Other zonotope
-- generators (e.g. e_i+e_j) likely add more edges — deferred, per the ticket's "compute a floor, don't guess" rule.
CREATE FUNCTION signed_permutation_typeb_adjacent(a signed_permutation, b signed_permutation) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE ai int[] := (a).image; bi int[] := (b).image; diffs int[]; d int;
  BEGIN
    SELECT array_agg(i ORDER BY i) INTO diffs FROM generate_subscripts(ai,1) i WHERE ai[i] <> bi[i];
    d := coalesce(array_length(diffs, 1), 0);
    IF d = 1 THEN RETURN abs(ai[diffs[1]]) = abs(bi[diffs[1]]);                                    -- single sign flip
    ELSIF d = 2 THEN RETURN ai[diffs[1]] = bi[diffs[2]] AND ai[diffs[2]] = bi[diffs[1]];           -- a transposition
    ELSE RETURN false;
    END IF;
  END $$;

-- ── cyclohedron = the faces of the type-B associahedron / Bott–Taubes polytope W_n (#232 chunk 4) ──────────
-- W_n's vertices are the CENTRALLY SYMMETRIC triangulations of a (2n+2)-gon (Simion's model) — the fixed polytope of
-- the associahedron's own 180°-rotation involution, so it reuses `dissection` (m = 2n+2, i.e. dissections' own axis
-- at 2n) as its carrier, filtered to the diagonal sets invariant under that rotation, at every level (not just
-- vertices — a partial CS dissection is a higher face, exactly as for the associahedron).
CREATE FUNCTION dissection_diagonal_rotate(c int, m int) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT least(a, b) * m + greatest(a, b)
  FROM (SELECT (c / m + m / 2) % m AS a, (c % m + m / 2) % m AS b) t $$;
CREATE FUNCTION dissection_centrally_symmetric(d dissection) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (d).diagonals = ARRAY(
    SELECT dissection_diagonal_rotate(c, (d).m) FROM unnest((d).diagonals) c
     ORDER BY dissection_diagonal_rotate(c, (d).m)) $$;
CREATE TYPE cyclohedron_fiber AS (n natural_number);   -- typed fiber; axis: n = the polytope's OWN dimension (W_n)
-- The floor generates the CS dissections DIRECTLY, by choosing rotation ORBITS rather than by generating every
-- dissection of the (2n+2)-gon and filtering (#307). Filtering meant paying little_schroeder(2n) — 103,049 at
-- n=4 — to keep 321 of them, so enumeration outran the watchdog past n=4 and the accel could only ever be
-- certified on the tiny fibers. Same include/exclude shape as dissections' own floor, one step per orbit: a
-- diagonal's orbit under the half-turn is itself (a main diagonal) or a pair, and a CS dissection is exactly a
-- union of orbits that stays non-crossing. Each is therefore generated once, and the closing ORDER BY is the
-- same (size, then the diagonal array) the filtered scan produced, so the enumeration order is unchanged.
CREATE FUNCTION fiber_elements(f cyclohedron_fiber, element_limit int) RETURNS SETOF dissection LANGUAGE sql STABLE AS $$
  WITH RECURSIVE
    orb AS (   -- one row per orbit, in code order; `diags` is the orbit expanded (1 diagonal if central, else 2)
      SELECT row_number() OVER (ORDER BY key) AS idx, diags FROM (
        SELECT DISTINCT least(c, dissection_diagonal_rotate(c, 2 * (f).n::int + 2)) AS key,
               CASE WHEN dissection_diagonal_rotate(c, 2 * (f).n::int + 2) = c THEN ARRAY[c]
                    ELSE ARRAY[least(c, dissection_diagonal_rotate(c, 2 * (f).n::int + 2)),
                               greatest(c, dissection_diagonal_rotate(c, 2 * (f).n::int + 2))] END AS diags
          FROM (SELECT i * (2 * (f).n::int + 2) + j AS c
                  FROM generate_series(0, 2 * (f).n::int + 1) i, generate_series(0, 2 * (f).n::int + 1) j
                 WHERE i < j AND j - i >= 2 AND NOT (i = 0 AND j = 2 * (f).n::int + 1)) t) u),
    total AS (SELECT coalesce(max(idx), 0)::int AS n_orb FROM orb),
    gen(chosen, k) AS (
      SELECT ARRAY[]::int[], 1
       UNION ALL
      SELECT CASE WHEN b.inc THEN (SELECT array_agg(x ORDER BY x) FROM unnest(gen.chosen || o.diags) x)
                  ELSE gen.chosen END,
             gen.k + 1
        FROM gen, total, LATERAL (SELECT diags FROM orb WHERE idx = gen.k) o, LATERAL (VALUES (false), (true)) b(inc)
       WHERE gen.k <= total.n_orb
         AND (NOT b.inc OR NOT EXISTS (          -- the orbit must cross nothing chosen, nor itself
               SELECT 1 FROM unnest(o.diags) nd, unnest(gen.chosen || o.diags) e
                WHERE nd <> e AND diagonals_cross(nd, e, 2 * (f).n::int + 2))))
  SELECT ROW(gen.chosen, 2 * (f).n::int + 2)::dissection FROM gen, total
   WHERE gen.k = total.n_orb + 1
   ORDER BY coalesce(array_length(gen.chosen, 1), 0), gen.chosen
   LIMIT element_limit $$;
-- The f-vector in closed form (#307). A face of W_n is a centrally symmetric partial dissection, identified by
-- which diagonal ORBITS it uses (dissection_symmetry_orbit_count, below), and the faces using exactly k of them
-- number C(n,k)·C(n+k,k). So the k=n term is C(2n,n), the CS triangulations, i.e. the vertices; and the whole sum
-- is the central Delannoy number A001850 (1, 3, 13, 63, 321, …) — the identity Σ_k C(n,k)C(n+k,k) = D(n,n).
--
-- This replaces a fiber_count that was the naive scan itself: it enumerated every dissection of a (2n+2)-gon and
-- filtered. That is not an accelerator — the differential compared a scan against itself, expensively, and past
-- n=4 it outran the selfcert watchdog so the collection certified nothing at all.
CREATE FUNCTION cyclohedron_face_count(n int, k int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT binomial(n, k) * binomial(n + k, k) $$;   -- faces of W_n using exactly k diagonal orbits
CREATE FUNCTION fiber_count(f cyclohedron_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(cyclohedron_face_count((f).n::int, k)), 0) FROM generate_series(0, (f).n::int) k $$;
CREATE FUNCTION contains_in_fiber(f cyclohedron_fiber, v dissection) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW(2 * (f).n)::dissections_fiber, v) AND dissection_centrally_symmetric(v) $$;
INSERT INTO base_collection VALUES ('cyclohedron', 'dissection');
INSERT INTO base_grade VALUES ('cyclohedron', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f cyclohedron_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'W' || to_unicode_subscript((f).n) $$;   -- corpus symbol
SELECT base_realize('cyclohedron');
-- face dimension: n minus the number of diagonal ORBITS used (a fixed/central diagonal is its own orbit; every
-- other diagonal pairs with its rotate-image) — a CS triangulation (max orbits = n) is a vertex (dim 0), the empty
-- dissection (0 orbits) is the whole body (dim n). n itself is recovered from m = 2n+2, so this needs no extra param.
CREATE FUNCTION dissection_symmetry_orbit_count(d dissection) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(DISTINCT least(c, dissection_diagonal_rotate(c, (d).m))) FROM unnest((d).diagonals) c $$;
CREATE FUNCTION dissection_cyclohedron_face_dim(d dissection) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT ((d).m / 2 - 1) - dissection_symmetry_orbit_count(d) $$;
-- point_fn and contains_fn are the SAME dissection_loday_point / dissection_face_contains the associahedron uses —
-- legitimate reuse, not a shortcut: a CS triangulation is still an ordinary triangulation (dissection_face_dim(d)=0
-- holds regardless of symmetry), so Loday's recursive apex coordinate is exact on it, and face refinement is still
-- plain diagonal-set inclusion.
INSERT INTO base_polytope (collection, dim_fn, point_fn, contains_fn, title) VALUES
  ('cyclohedron','dissection_cyclohedron_face_dim','dissection_loday_point','dissection_face_contains','Cyclohedron');
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('cyclohedron','dissection','dissection_id','dissections','Dissection',NULL);
-- edge floor: two CS triangulations differing by EXACTLY one diagonal on each side (symmetric difference of size 2)
-- — necessarily a swap of the fixed/central diagonal for another (any other diagonal moves in a symmetric PAIR, so
-- flipping just one would break central symmetry and give symmetric difference ≥ 4). This central-diagonal flip is
-- always legal (the quadrilateral it sits in is itself symmetry-invariant), so it is a SAFE, PROVEN floor — the
-- richer paired-diagonal-flip edges (more of them, for n≥3) are deferred, per the ticket's "compute a floor" rule.
CREATE FUNCTION dissection_cyclohedron_adjacent(a dissection, b dissection) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (a).m = (b).m
     AND (SELECT count(*) FROM unnest((a).diagonals) x WHERE NOT (x = ANY((b).diagonals)))
       + (SELECT count(*) FROM unnest((b).diagonals) x WHERE NOT (x = ANY((a).diagonals))) = 2 $$;

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('cyclohedron','face count is the central Delannoy number: 1,3,13,63,321 for n=0..4 (#307 accel)','eq','1,3,13,63,321',
   'Σ_k C(n,k)C(n+k,k) = D(n,n), A001850 — closed form, no dissection scan',
   $q$ SELECT string_agg(cardinality(cyclohedron(n))::text, ',' ORDER BY n) FROM generate_series(0,4) n $q$),
  ('cyclohedron','the closed form agrees with enumerating the faces, n=0..6','eq','true',
   'the differential this accel exists to make possible — previously a scan compared against itself, and only reachable to n=4',
   $q$ SELECT bool_and(cardinality(cyclohedron(n)) = (SELECT count(*) FROM elements(ROW(n)::cyclohedron_fiber, 2147483647) e))
         FROM generate_series(0,6) n $q$),
  ('cyclohedron','the orbit floor still yields genuine CS dissections of the (2n+2)-gon','eq','true',
   'it no longer goes through the parent to get there, so this pins that it produces the same things: every face centrally symmetric and a member of dissections(2n)',
   $q$ SELECT bool_and(dissection_centrally_symmetric((e).value) AND ((e).value <@ dissections(10)))
         FROM elements(cyclohedron(5)) e $q$),
  ('cyclohedron','the f-vector by orbit count at n=4: 1,20,90,140,70','eq','1,20,90,140,70',
   'C(n,k)C(n+k,k) per k, checked against the enumerated faces grouped by their orbit count',
   $q$ SELECT string_agg(cnt::text, ',' ORDER BY k) FROM (
         SELECT dissection_symmetry_orbit_count((e).value) k, count(*) cnt
           FROM elements(cyclohedron(4)) e GROUP BY 1) g $q$),
  ('cyclohedron','the closed form reproduces that f-vector','eq','true','cyclohedron_face_count(4,k) == the grouped enumeration',
   $q$ SELECT bool_and(cyclohedron_face_count(4, k) = cnt) FROM (
         SELECT dissection_symmetry_orbit_count((e).value) k, count(*) cnt
           FROM elements(cyclohedron(4)) e GROUP BY 1) g $q$),
  ('cyclohedron','vertices are the k=n term, C(2n,n): 1,2,6,20,70','eq','1,2,6,20,70',
   'the CS triangulations of a (2n+2)-gon — the faces using every orbit',
   $q$ SELECT string_agg(cyclohedron_face_count(n, n)::text, ',' ORDER BY n) FROM generate_series(0,4) n $q$),
  ('permutahedron','the permutahedron is a distinct collection, in bijection with set_compositions','eq','75|75','same cardinality (order-iso sibling); Fubini(4)',$q$
    SELECT cardinality(permutahedron(4))::text || '|' || cardinality(set_compositions(4))::text $q$),
  ('permutahedron','it carries the polytope (set_compositions no longer does)','eq','true|false','base_polytope moved onto the geometric collection',$q$
    SELECT EXISTS(SELECT 1 FROM base_polytope WHERE collection='permutahedron')::text || '|' ||
           EXISTS(SELECT 1 FROM base_polytope WHERE collection='set_compositions')::text $q$),
  ('permutahedron','the face_dim tally over permutahedron(3) is the hexagon f-vector 6,6,1 (inherited stat)','eq','6,6,1','carrier inheritance carries face_dim across',$q$
    SELECT string_agg(cnt::text, ',' ORDER BY d) FROM (
      SELECT set_composition_face_dim((e).value) d, count(*) cnt FROM elements(permutahedron(3)) e GROUP BY 1) t(d, cnt) $q$),
  ('permutahedron','the representative map sends a face to its set composition (identity on the carrier)','eq','1,2|3','render the set_compositions image of a permutahedron face',$q$
    SELECT render_value(set_composition_id(ROW(ARRAY[1,1,2])::set_composition)) $q$),
  ('cross_polytope','cross_polytope(3) is the octahedron: f-vector 6,12,8,1, and it maps to signed_subsets','eq','6,12,8,1|true','distinct collection carrying the cross-polytope',$q$
    SELECT (SELECT string_agg(cnt::text, ',' ORDER BY d) FROM (
             SELECT signed_subset_face_dim((e).value) d, count(*) cnt FROM elements(cross_polytope(3)) e GROUP BY 1) t(d, cnt)) || '|' ||
           EXISTS(SELECT 1 FROM base_map WHERE collection='cross_polytope' AND codomain='signed_subsets')::text $q$),
  ('associahedron','associahedron(4) = K_5: 45 faces, f-vector 14,21,9,1, mapping to dissections','eq','14,21,9,1|true','the associahedron as its own collection',$q$
    SELECT (SELECT string_agg(cnt::text, ',' ORDER BY d) FROM (
             SELECT dissection_face_dim((e).value) d, count(*) cnt FROM elements(associahedron(4)) e GROUP BY 1) t(d, cnt)) || '|' ||
           EXISTS(SELECT 1 FROM base_map WHERE collection='associahedron' AND codomain='dissections')::text $q$),
  ('associahedron','a vertex (triangulation) of associahedron(3) carries a Loday centre on the hyperplane Σ=6','eq','true','the point_fn is exact on the vertices',$q$
    SELECT bool_and((SELECT sum(x) FROM unnest(dissection_loday_point((e).value)) x) = 6)::text
    FROM elements(associahedron(3)) e WHERE dissection_face_dim((e).value) = 0 $q$),
  ('signed_subsets','the hypercube is now registered in base_polytope, on the SAME collection as the cross-polytope (#232)','eq','true|Hypercube','a second polytope row can share a carrier/collection with a different reading',$q$
    SELECT EXISTS(SELECT 1 FROM base_polytope WHERE collection='signed_subsets')::text || '|' ||
           (SELECT title FROM base_polytope WHERE collection='signed_subsets') $q$),
  ('signed_subsets','cube f-vector over signed_subsets(3): 8 vertices, 12 edges, 6 square faces, 1 body','eq','8,12,6,1','the dual reading of the same 3^3 carrier',$q$
    SELECT string_agg(cnt::text, ',' ORDER BY d) FROM (
      SELECT signed_subset_hypercube_face_dim((e).value) d, count(*) cnt FROM elements(signed_subsets(3)) e GROUP BY 1) t(d, cnt) $q$),
  ('signed_subsets','known cube floors hold for n=1..5: vertices 2^n, edges n·2^(n−1)','eq','2,4,8,16,32|1,4,12,32,80','vertex/edge counts via the dim_fn, not hardcoded beyond small n',$q$
    SELECT string_agg(v::text, ',' ORDER BY n) || '|' || string_agg(ed::text, ',' ORDER BY n) FROM (
      SELECT n,
             (SELECT count(*) FROM elements(signed_subsets(n)) e WHERE signed_subset_hypercube_face_dim((e).value) = 0) v,
             (SELECT count(*) FROM elements(signed_subsets(n)) e WHERE signed_subset_hypercube_face_dim((e).value) = 1) ed
      FROM generate_series(1,5) n) t $q$),
  ('signed_subsets','the cube''s vertex point_fn is the plain 0/1 corner; a free axis on a higher face reports its base corner (0)','eq','(1,0,0)|(0,1,1)|(1,1,0)','vertex {+1,-2,-3}, vertex {-1,2,3}, and the edge {1,2} (axis 3 free)',$q$
    SELECT '(' || array_to_string(signed_subset_hypercube_point(ROW(ARRAY[1,-2,-3], 3)::signed_subset), ',') || ')|(' ||
                 array_to_string(signed_subset_hypercube_point(ROW(ARRAY[-1,2,3], 3)::signed_subset), ',') || ')|(' ||
                 array_to_string(signed_subset_hypercube_point(ROW(ARRAY[1,2], 3)::signed_subset), ',') || ')' $q$),
  ('signed_subsets','cube face containment: the edge {1,2} (axis 3 free) contains vertex {1,2,3}, not the axis-2-flipped vertex {1,-2,3}','eq','true|false','contains_fn: big.coords ⊆ small.coords',$q$
    SELECT signed_subset_hypercube_face_contains(ROW(ARRAY[1,2], 3)::signed_subset, ROW(ARRAY[1,2,3], 3)::signed_subset)::text || '|' ||
           signed_subset_hypercube_face_contains(ROW(ARRAY[1,2], 3)::signed_subset, ROW(ARRAY[1,-2,3], 3)::signed_subset)::text $q$),
  ('simplex','the simplex now carries the polytope registration (previously only permutahedron/associahedron/cross_polytope did)','eq','true|Simplex','base_polytope row filled in for the pre-existing collection (#232)',$q$
    SELECT EXISTS(SELECT 1 FROM base_polytope WHERE collection='simplex')::text || '|' ||
           (SELECT title FROM base_polytope WHERE collection='simplex') $q$),
  ('simplex','Δ_{n−1} vertex/edge floors for n=3..6: vertices = n, edges = C(n,2)','eq','3,4,5,6|3,6,10,15','via the (pre-existing) dim_fn, floors not exact-count pins',$q$
    SELECT string_agg(v::text, ',' ORDER BY n) || '|' || string_agg(ed::text, ',' ORDER BY n) FROM (
      SELECT n,
             (SELECT count(*) FROM elements(simplex(n)) e WHERE simplex_face_dim((e).value) = 0) v,
             (SELECT count(*) FROM elements(simplex(n)) e WHERE simplex_face_dim((e).value) = 1) ed
      FROM generate_series(3,6) n) t $q$),
  ('simplex','the simplex point_fn is the 0/1 membership indicator: vertex {2} of Δ2 is e2, the top face {1,2,3} sums all three','eq','(0,1,0)|(1,1,1)','point_fn on a vertex vs. the whole body',$q$
    SELECT '(' || array_to_string(simplex_point(ROW(ARRAY[2], 3)::finset), ',') || ')|(' ||
                 array_to_string(simplex_point(ROW(ARRAY[1,2,3], 3)::finset), ',') || ')' $q$),
  ('simplex','simplex face containment: edge {1,2} contains vertex {1}, not vertex {3}','eq','true|false','contains_fn: small.members ⊆ big.members',$q$
    SELECT simplex_face_contains(ROW(ARRAY[1,2], 3)::finset, ROW(ARRAY[1], 3)::finset)::text || '|' ||
           simplex_face_contains(ROW(ARRAY[1,2], 3)::finset, ROW(ARRAY[3], 3)::finset)::text $q$),
  ('k_subsets','the hypersimplex is now registered in base_polytope, directly on k_subsets (#232 chunk 2)','eq','true|Hypersimplex','a polytope row can live on a pre-existing multi-graded collection, no new collection needed',$q$
    SELECT EXISTS(SELECT 1 FROM base_polytope WHERE collection='k_subsets')::text || '|' ||
           (SELECT title FROM base_polytope WHERE collection='k_subsets') $q$),
  ('k_subsets','hypersimplex vertex floors: Δ(k,5) vertex count = C(5,k) for k=1..4','eq','5,10,10,5','vertices = elements of k_subsets(5,k), exact for small n',$q$
    SELECT string_agg(cardinality(k_subsets(5,k))::text, ',' ORDER BY k) FROM generate_series(1,4) k $q$),
  ('k_subsets','the hypersimplex point_fn is the 0/1 indicator: {1,3} of Δ(2,4) is (1,0,1,0)','eq','(1,0,1,0)','vertex coordinate, exact',$q$
    SELECT '(' || array_to_string(k_subset_hypersimplex_point(ROW(ARRAY[1,3], 4)::finset), ',') || ')' $q$),
  ('k_subsets','hypersimplex face containment collapses to identity at vertex level: {1,3} contains itself, not {1,4}','eq','true|false','contains_fn: vertex-only realization (chunk 2 scope)',$q$
    SELECT k_subset_hypersimplex_face_contains(ROW(ARRAY[1,3],4)::finset, ROW(ARRAY[1,3],4)::finset)::text || '|' ||
           k_subset_hypersimplex_face_contains(ROW(ARRAY[1,3],4)::finset, ROW(ARRAY[1,4],4)::finset)::text $q$),
  ('k_subsets','Johnson-graph adjacency: {1,2} and {1,3} of Δ(2,4) differ by one swap (adjacent); {1,2} and {3,4} do not','eq','true|false','k_subset_hypersimplex_adjacent, exact on two chosen pairs',$q$
    SELECT k_subset_hypersimplex_adjacent(ROW(ARRAY[1,2],4)::finset, ROW(ARRAY[1,3],4)::finset)::text || '|' ||
           k_subset_hypersimplex_adjacent(ROW(ARRAY[1,2],4)::finset, ROW(ARRAY[3,4],4)::finset)::text $q$),
  ('k_subsets','edge floor for Δ(2,5): J(5,2) has at least 30 edges (10 vertices × degree 2·3, halved) — computed via the adjacency predicate over all vertex pairs, not guessed','eq','true','vertices+edges only (chunk 2); nested-subset faces deferred',$q$
    SELECT ((SELECT count(*) FROM elements(k_subsets(5,2)) e1, elements(k_subsets(5,2)) e2
              WHERE ordinality(e1) < ordinality(e2) AND k_subset_hypersimplex_adjacent((e1).value, (e2).value)) >= 30)::text $q$),
  ('permutations','the Birkhoff polytope is now registered in base_polytope, directly on permutations (#232 chunk 2)','eq','true|Birkhoff polytope','a polytope row can live on a pre-existing collection, no new collection needed',$q$
    SELECT EXISTS(SELECT 1 FROM base_polytope WHERE collection='permutations')::text || '|' ||
           (SELECT title FROM base_polytope WHERE collection='permutations') $q$),
  ('permutations','Birkhoff vertex floors: B_n vertex count = n! for n=1..4','eq','1,2,6,24','vertices = elements of permutations(n), exact for small n',$q$
    SELECT string_agg(cardinality(permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,4) n $q$),
  ('permutations','the Birkhoff point_fn is the flattened n² permutation matrix: 213 of S_3 is the row-major 0/1 matrix','eq','(0,1,0,1,0,0,0,0,1)','vertex coordinate, exact',$q$
    SELECT '(' || array_to_string(permutation_birkhoff_point(ROW(ARRAY[2,1,3])::permutation), ',') || ')' $q$),
  ('permutations','Birkhoff face containment collapses to identity at vertex level: 213 contains itself, not 123','eq','true|false','contains_fn: vertex-only realization (chunk 2 scope)',$q$
    SELECT permutation_birkhoff_face_contains(ROW(ARRAY[2,1,3])::permutation, ROW(ARRAY[2,1,3])::permutation)::text || '|' ||
           permutation_birkhoff_face_contains(ROW(ARRAY[2,1,3])::permutation, ROW(ARRAY[1,2,3])::permutation)::text $q$),
  ('permutations','transposition adjacency: 213 differs from 123 at exactly 2 positions (adjacent); 231 differs at all 3 (not caught by this floor predicate)','eq','true|false','permutation_birkhoff_adjacent, exact on two chosen pairs',$q$
    SELECT permutation_birkhoff_adjacent(ROW(ARRAY[2,1,3])::permutation, ROW(ARRAY[1,2,3])::permutation)::text || '|' ||
           permutation_birkhoff_adjacent(ROW(ARRAY[2,3,1])::permutation, ROW(ARRAY[1,2,3])::permutation)::text $q$),
  ('permutations','edge floor for B_4: transposition-adjacent pairs number at least 72 = 4!·C(4,2)/2 — a proven-correct floor on B_4''s true edge count (longer-cycle edges add more, deferred), computed not guessed','eq','true','vertices+edges only (chunk 2); full face lattice deferred',$q$
    SELECT ((SELECT count(*) FROM elements(permutations(4)) e1, elements(permutations(4)) e2
              WHERE ordinality(e1) < ordinality(e2) AND permutation_birkhoff_adjacent((e1).value,(e2).value)) >= 72)::text $q$),
  ('signed_permutations','the type-B permutahedron is now registered in base_polytope, directly on signed_permutations (#232 chunk 3)','eq','true|Type-B permutahedron','a polytope row can live on a pre-existing collection, no new collection needed',$q$
    SELECT EXISTS(SELECT 1 FROM base_polytope WHERE collection='signed_permutations')::text || '|' ||
           (SELECT title FROM base_polytope WHERE collection='signed_permutations') $q$),
  ('signed_permutations','type-B permutahedron vertex floors: |B_n| = 2^n·n! for n=1..4','eq','2,8,48,384','vertices = elements of signed_permutations(n), exact for small n',$q$
    SELECT string_agg(cardinality(signed_permutations(n))::text, ',' ORDER BY n) FROM generate_series(1,4) n $q$),
  ('signed_permutations','the type-B point_fn is the signed one-line vector itself: -2,1,-3 renders as (-2,1,-3)','eq','(-2,1,-3)','vertex coordinate, exact',$q$
    SELECT '(' || array_to_string(signed_permutation_typeb_point(ROW(ARRAY[-2,1,-3])::signed_permutation), ',') || ')' $q$),
  ('signed_permutations','type-B face containment collapses to identity at vertex level: -2,1,-3 contains itself, not 1,2,3','eq','true|false','contains_fn: vertex-only realization (chunk 3 scope)',$q$
    SELECT signed_permutation_typeb_face_contains(ROW(ARRAY[-2,1,-3])::signed_permutation, ROW(ARRAY[-2,1,-3])::signed_permutation)::text || '|' ||
           signed_permutation_typeb_face_contains(ROW(ARRAY[-2,1,-3])::signed_permutation, ROW(ARRAY[1,2,3])::signed_permutation)::text $q$),
  ('signed_permutations','type-B adjacency: -2,1,-3 ~ -2,1,3 (one sign flip); -2,1,-3 ~ 1,-2,-3 (a transposition); -2,1,-3 ≁ 3,-2,1 (differs at all 3, not caught by this floor)','eq','true|true|false','signed_permutation_typeb_adjacent, exact on three chosen pairs',$q$
    SELECT signed_permutation_typeb_adjacent(ROW(ARRAY[-2,1,-3])::signed_permutation, ROW(ARRAY[-2,1,3])::signed_permutation)::text || '|' ||
           signed_permutation_typeb_adjacent(ROW(ARRAY[-2,1,-3])::signed_permutation, ROW(ARRAY[1,-2,-3])::signed_permutation)::text || '|' ||
           signed_permutation_typeb_adjacent(ROW(ARRAY[-2,1,-3])::signed_permutation, ROW(ARRAY[3,-2,1])::signed_permutation)::text $q$),
  ('signed_permutations','type-B permutahedron edge floor for n=3: at least 144 = 48·(3+C(3,2))/2 adjacent pairs (sign-flip + transposition generators), computed not guessed','eq','true','vertices+edges only (chunk 3); other zonotope generators would only add more edges',$q$
    SELECT ((SELECT count(*) FROM elements(signed_permutations(3)) e1, elements(signed_permutations(3)) e2
              WHERE ordinality(e1) < ordinality(e2) AND signed_permutation_typeb_adjacent((e1).value,(e2).value)) >= 144)::text $q$),
  ('cyclohedron','the cyclohedron is now registered in base_polytope (#232 chunk 4 — polytope batch complete)','eq','true|Cyclohedron','base_polytope row for the new collection',$q$
    SELECT EXISTS(SELECT 1 FROM base_polytope WHERE collection='cyclohedron')::text || '|' ||
           (SELECT title FROM base_polytope WHERE collection='cyclohedron') $q$),
  ('cyclohedron','vertex count W_n = C(2n,n), the type-B Catalan / central-binomial family, for n=1..4 — computed against the closed form, not guessed','eq','true,true,true,true','count(dim-0 faces) of cyclohedron(n) vs. binomial(2n,n)',$q$
    SELECT string_agg(
      ((SELECT count(*) FROM elements(cyclohedron(n)) e WHERE dissection_cyclohedron_face_dim((e).value) = 0) = binomial(2*n, n))::text,
      ',' ORDER BY n) FROM generate_series(1,4) n $q$),
  ('cyclohedron','it maps back to dissections (its underlying carrier''s parent collection), like the associahedron','eq','true','base_map row present',$q$
    SELECT EXISTS(SELECT 1 FROM base_map WHERE collection='cyclohedron' AND codomain='dissections')::text $q$),
  ('cyclohedron','a CS vertex of cyclohedron(2) (the hexagon, m=6) carries a Loday centre on the hyperplane Σ=C(m-1,2)=10','eq','true','the point_fn is exact on the vertices, reused from the associahedron',$q$
    SELECT bool_and((SELECT sum(x) FROM unnest(dissection_loday_point((e).value)) x) = 10)::text
    FROM elements(cyclohedron(2)) e WHERE dissection_cyclohedron_face_dim((e).value) = 0 $q$),
  ('cyclohedron','contains: the hexagon triangulation {0-2,0-3,3-5} is centrally symmetric (central diagonal 0-3, pair 0-2/3-5); the fan {0-2,0-3,0-4} is not','eq','true|false','contains_in_fiber layers the CS predicate over the parent dissections membership',$q$
    SELECT contains(cyclohedron(2), ROW(ARRAY[0*6+2, 0*6+3, 3*6+5], 6)::dissection)::text || '|' ||
           contains(cyclohedron(2), ROW(ARRAY[0*6+2, 0*6+3, 0*6+4], 6)::dissection)::text $q$),
  ('cyclohedron','edge floor for W_3 (octagon-based, 20 vertices): at least 10 = V/2 central-diagonal-swap edges (every CS triangulation has exactly one central-flip neighbor), computed via an adjacency self-join over the dim-0 faces, not guessed','eq','true','vertices + central-flip edges only; paired-diagonal-flip edges (more of them) deferred',$q$
    SELECT ((SELECT count(*) FROM elements(cyclohedron(3)) e1, elements(cyclohedron(3)) e2
              WHERE ordinality(e1) < ordinality(e2)
                AND dissection_cyclohedron_face_dim((e1).value) = 0 AND dissection_cyclohedron_face_dim((e2).value) = 0
                AND dissection_cyclohedron_adjacent((e1).value, (e2).value)) >= 10)::text $q$);
