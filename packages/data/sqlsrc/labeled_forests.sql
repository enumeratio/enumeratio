-- requires: labeled_trees, realizer, utilities
-- labeled_forests — rooted forests on n labeled vertices {1..n}. Single grade [n]; |labeled_forests(n)| = (n+1)^(n-1)
-- ([[OEIS:A000272]] shifted). SUPER-ROOT TRICK: a rooted forest on {1..n} is exactly a labeled tree on {1..n, n+1}
-- once we adjoin a new vertex n+1 joined to every root — so forests on n vertices ARE labeled_trees on n+1 vertices,
-- and we BORROW that collection's Prüfer carrier + floor verbatim. The carrier is the length-(n-1) Prüfer sequence of
-- the super-root tree; the map back to labeled_trees is the identity on the shared carrier.

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE labeled_forests_fiber AS (n natural_number);   -- typed fiber; axis: n = number of labeled vertices
-- FLOOR / COUNT / CONTAINS: delegate to labeled_trees at n+1 (the super-root tree). `t` is a bare whole-row alias so
-- the Prüfer carrier stays a composite; the emission order carries through, matching labeled_trees(n+1) exactly.
CREATE FUNCTION fiber_elements(f labeled_forests_fiber, element_limit int) RETURNS SETOF labeled_tree LANGUAGE sql STABLE AS $$
  SELECT t FROM fiber_elements(ROW((f).n::int + 1)::labeled_trees_fiber, element_limit) t LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f labeled_forests_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT fiber_count(ROW((f).n::int + 1)::labeled_trees_fiber) $$;   -- Cayley on n+1 vertices = (n+1)^(n-1)
CREATE FUNCTION contains_in_fiber(f labeled_forests_fiber, v labeled_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n::int + 1)::labeled_trees_fiber, v) $$;   -- a valid super-root Prüfer sequence

CREATE FUNCTION labeled_tree_id(t labeled_tree) RETURNS labeled_tree LANGUAGE sql IMMUTABLE AS $$ SELECT t $$;

INSERT INTO base_collection VALUES ('labeled_forests', 'labeled_tree');
INSERT INTO base_grade VALUES ('labeled_forests', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f labeled_forests_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'F(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('labeled_forests');

-- the super-root bijection: a forest on {1..n} IS its labeled tree on {1..n+1} (identity on the shared Prüfer carrier)
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('labeled_forests', 'super_root_tree', 'labeled_tree_id', 'labeled_trees', 'As the super-root labeled tree', NULL);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('labeled_forests','cardinality (n+1)^(n-1) for n=0..5: 1,1,3,16,125,1296','eq','1,1,3,16,125,1296','rooted forests on n vertices [[OEIS:A000272]] shifted',$q$
    SELECT string_agg(cardinality(labeled_forests(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('labeled_forests','n=0,1: the single empty/one-vertex forest','eq','1|1','(1)^(-1)=1 and (2)^0=1',$q$
    SELECT cardinality(labeled_forests(0))::text || '|' || cardinality(labeled_forests(1))::text $q$),
  ('labeled_forests','anchor F(3)=16 = 4^2 (super-root tree on 4 vertices, Cayley)','eq','16|true','equals cardinality(labeled_trees(4))',$q$
    SELECT cardinality(labeled_forests(3))::text || '|' ||
           (cardinality(labeled_forests(3)) = cardinality(labeled_trees(4)))::text $q$),
  ('labeled_forests','n=2: the 3 forests as super-root Prüfer sequences (1),(2),(3)','eq','(1),(2),(3)','borrowed from labeled_trees(3)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(labeled_forests(2)) e $q$),
  ('labeled_forests','rank 0 of n=2 = Prüfer (1); rank 2 = Prüfer (3)','eq','(1)|(3)','matches labeled_trees(3) ranks',$q$
    SELECT notation((unrank(labeled_forests(2), 0)).value) || '|' ||
           notation((unrank(labeled_forests(2), 2)).value) $q$),
  ('labeled_forests','order-isomorphic to labeled_trees(n+1): same carrier, same order (n=3)','eq','true','the super-root identity map',$q$
    SELECT (ARRAY(SELECT notation((e).value) FROM elements(labeled_forests(3)) e ORDER BY e)
          = ARRAY(SELECT notation((e).value) FROM elements(labeled_trees(4)) e ORDER BY e))::text $q$),
  ('labeled_forests','floor count = accel for n=1..5','eq','1,3,16,125,1296','the generated floor, counted',$q$
    SELECT string_agg((SELECT count(*) FROM elements(labeled_forests(n)))::text, ',' ORDER BY n) FROM generate_series(1,5) n $q$),
  ('labeled_forests','element carries a TYPED point fiber + ordinality','eq','3|5','unrank(labeled_forests(3),5)',$q$
    SELECT (unrank(labeled_forests(3), 5)).fiber.n::text || '|' || ordinality(unrank(labeled_forests(3), 5))::text $q$),
  ('labeled_forests','range handle: cardinality(labeled_forests(1,3)) = 20 = 1+3+16','eq','20','fibers unfold over n=1..3',$q$
    SELECT cardinality(labeled_forests(1,3))::text $q$),
  ('labeled_forests','contains via <@: (2,2) is a super-root Prüfer of n=3 (over {1..4}), (2,5) is not','eq','true|false','length n-1 over {1..n+1}',$q$
    SELECT (ROW(ARRAY[2,2])::labeled_tree <@ labeled_forests(3))::text || '|' ||
           (ROW(ARRAY[2,5])::labeled_tree <@ labeled_forests(3))::text $q$);
