-- requires: set_compositions, signed_subsets, dissections, realizer, utilities
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
    FROM elements(associahedron(3)) e WHERE dissection_face_dim((e).value) = 0 $q$);
