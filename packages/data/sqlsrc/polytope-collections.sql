-- requires: set_compositions, signed_subsets, dissections, subsets, simplex, realizer, utilities
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

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
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
           simplex_face_contains(ROW(ARRAY[1,2], 3)::finset, ROW(ARRAY[3], 3)::finset)::text $q$);
