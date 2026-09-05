-- requires: subsets, realizer, utilities
-- simplex — the abstract (n−1)-simplex Δ_{n−1}: its faces are exactly the NON-EMPTY subsets of [n], 2ⁿ−1 of them
-- (A000225). A base_restrict of subsets dropping ∅ (the empty finset is the dimension −1 empty face, omitted here so
-- every face is drawable). A face S has dimension |S|−1: singletons are the vertices (dim 0), pairs the edges, the
-- whole [n] the top cell. The polytope reading of the subsets carrier; sibling of boolean_algebra (the full 2^[n]).

CREATE FUNCTION is_simplex_face(s finset) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((s).members, 1), 0) > 0 $$;   -- non-empty: ∅ is the (omitted) dim −1 face
CREATE FUNCTION simplex_face_dim(s finset) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((s).members, 1), 0) - 1 $$;   -- dim = |S|−1

SELECT base_restrict('simplex', 'subsets', 'is_simplex_face');
CREATE FUNCTION fiber_symbol(f simplex_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Δ_' || ((f).n::int - 1) $$;   -- corpus symbol
SELECT wire_set_notation('simplex');

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('simplex','dimension','simplex_face_dim','Face dimension (|S|−1)','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('simplex','face count = 2ⁿ−1 for n=1..6 (A000225)','eq','1,3,7,15,31,63','non-empty subsets = faces of Δ_{n−1}',$q$
    SELECT string_agg(cardinality(simplex(n))::text, ',' ORDER BY n) FROM generate_series(1,6) n $q$),
  ('simplex','faces of Δ₂ (the triangle on {1,2,3}), (dim, colex) order','eq','100,010,001,110,101,011,111','3 vertices, 3 edges, 1 filled triangle (length-3 bit registers)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(simplex(3)) e $q$),
  ('simplex','face-count by dimension over Δ₃ = the binomials C(4,k+1)','eq','4,6,4,1','4 vertices, 6 edges, 4 triangles, 1 cell',$q$
    SELECT string_agg(c::text, ',' ORDER BY d) FROM (
      SELECT simplex_face_dim((e).value) d, count(*) c FROM elements(simplex(4)) e GROUP BY 1) s $q$),
  ('simplex','∅ is excluded (the dim −1 face): |simplex(3)| = |B(3)| − 1','eq','7','2³−1 vs the full Boolean 2³',$q$
    SELECT cardinality(simplex(3))::text $q$),
  ('simplex','contains via <@: {1,2} ∈ simplex(3) (an edge), {} ∉ (∅ dropped)','eq','true|false','the empty face is not enumerated',$q$
    SELECT (ROW(ARRAY[1,2], 3)::finset <@ simplex(3))::text || '|' || (ROW('{}'::int[], 3)::finset <@ simplex(3))::text $q$);
