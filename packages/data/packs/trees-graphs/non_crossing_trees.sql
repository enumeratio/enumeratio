-- requires: realizer, utilities
-- non_crossing_trees — spanning trees on n+1 vertices labeled 0..n placed on a circle, whose edges (drawn as
-- straight chords) pairwise don't cross: no (a,b),(c,d) with a<c<b<d. n edges, single grade axis [n]. Counted by
-- the Fuss-Catalan-family closed form C(3n,n)/(2n+1) (OEIS A001764) — the ternary-tree count, realized here via an
-- entirely different combinatorial model (chord diagrams, not preorder words), asserted against the anchor below.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
-- edges flattened as sorted pairs a<b, pairs themselves sorted ascending — the canonical form (one carrier value
-- per tree). e.g. the path 0-1-2-3 is {0,1, 1,2, 2,3}, notation "01-12-23".
CREATE TYPE non_crossing_tree AS (edges int[]);
CREATE FUNCTION notation(t non_crossing_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg((t).edges[2*i-1]::text || (t).edges[2*i]::text, '-' ORDER BY i), '')
  FROM generate_series(1, coalesce(array_length((t).edges, 1), 0) / 2) i $$;

-- shared validity predicate — canonical pair order/range, pairwise non-crossing, and connected (n edges on n+1
-- vertices connected ⟺ a tree, since edge count already equals vertices−1). Used by both the floor filter and
-- contains_in_fiber.
CREATE FUNCTION non_crossing_tree_valid(edges int[], nn int) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    m int := coalesce(array_length(edges, 1), 0);
    parent int[]; i int; j int; a int; b int; a2 int; b2 int; c2 int; d2 int; ra int; rb int;
  BEGIN
    IF m <> 2 * nn THEN RETURN false; END IF;
    FOR i IN 1..nn LOOP
      a := edges[2*i-1]; b := edges[2*i];
      IF a IS NULL OR b IS NULL OR a < 0 OR b > nn OR a >= b THEN RETURN false; END IF;
      IF i > 1 AND (a < edges[2*i-3] OR (a = edges[2*i-3] AND b <= edges[2*i-2])) THEN RETURN false; END IF;
    END LOOP;
    FOR i IN 1..nn LOOP
      a2 := edges[2*i-1]; b2 := edges[2*i];
      FOR j IN i+1..nn LOOP
        c2 := edges[2*j-1]; d2 := edges[2*j];
        IF (a2 < c2 AND c2 < b2 AND b2 < d2) OR (c2 < a2 AND a2 < d2 AND d2 < b2) THEN RETURN false; END IF;
      END LOOP;
    END LOOP;
    parent := ARRAY(SELECT g FROM generate_series(0, nn) g);
    FOR i IN 1..nn LOOP
      a := edges[2*i-1]; b := edges[2*i];
      ra := a; WHILE parent[ra+1] <> ra LOOP ra := parent[ra+1]; END LOOP;
      rb := b; WHILE parent[rb+1] <> rb LOOP rb := parent[rb+1]; END LOOP;
      IF ra = rb THEN RETURN false; END IF;
      parent[ra+1] := rb;
    END LOOP;
    RETURN true;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: brute-force over all n-subsets of the C(n+1,2) possible chords (0..n), kept in canonical sorted-pair
-- order as they're built, filtered by non_crossing_tree_valid. Correct-but-naive; no fiber_unrank (no simple
-- product decomposition matches this emit order) — optional per the model, and selfcert's fiber_count vs
-- count(elements) differential is what matters here.
CREATE TYPE non_crossing_trees_fiber AS (n natural_number);
CREATE FUNCTION fiber_elements(f non_crossing_trees_fiber, element_limit int) RETURNS SETOF non_crossing_tree LANGUAGE sql STABLE AS $$
  WITH RECURSIVE all_edges AS (
      SELECT a, b, (row_number() OVER (ORDER BY a, b))::int AS idx
      FROM generate_series(0, (f).n::int) a, generate_series(0, (f).n::int) b
      WHERE a < b
    ),
    combos(edges, last_idx, cnt) AS (
        SELECT ARRAY[]::int[], 0, 0
      UNION ALL
        SELECT c.edges || ae.a || ae.b, ae.idx, c.cnt + 1
        FROM combos c JOIN all_edges ae ON ae.idx > c.last_idx
        WHERE c.cnt < (f).n::int
    )
  SELECT ROW(edges)::non_crossing_tree FROM combos
  WHERE cnt = (f).n::int AND non_crossing_tree_valid(edges, (f).n::int)
  ORDER BY edges ASC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f non_crossing_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT div(binomial(3 * (f).n::int, (f).n::int), (2 * (f).n::int + 1)::numeric) $$;   -- A001764

CREATE FUNCTION contains_in_fiber(f non_crossing_trees_fiber, v non_crossing_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT non_crossing_tree_valid((v).edges, (f).n::int) $$;

INSERT INTO base_collection VALUES ('non_crossing_trees', 'non_crossing_tree');
INSERT INTO base_grade VALUES ('non_crossing_trees', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f non_crossing_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'NCT(' || (f).n::int || ')' $$;
SELECT base_realize('non_crossing_trees');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('non_crossing_trees','cardinality anchor = A001764 for n=0..5','eq','1,1,3,12,55,273','C(3n,n)/(2n+1), the Fuss-Catalan ternary-tree count',$q$
    SELECT string_agg(cardinality(non_crossing_trees(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('non_crossing_trees','n=2: the 3 non-crossing trees on {0,1,2}, in order','eq','01-02,01-12,02-12','all 3 pairs of the triangle are trees; 3 vertices can never cross',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(non_crossing_trees(2)) e $q$),
  ('non_crossing_trees','n=0 ⇒ one single-vertex tree (no edges)','eq','1|','A001764(0)=1, empty notation',$q$
    SELECT count(*)::text || '|' || notation((unrank(non_crossing_trees(0), 0)).value) FROM elements(non_crossing_trees(0)) e $q$),
  ('non_crossing_trees','floor generates 55 trees at n=4 (independent of the accel)','eq','55','counted off the brute-force floor',$q$
    SELECT count(*)::text FROM elements(non_crossing_trees(4)) e $q$),
  ('non_crossing_trees','contains via <@: path 01-12-23 ∈ non_crossing_trees(3), a crossing set ∉','eq','true|false','generated from non_crossing_tree_valid',$q$
    SELECT (ROW(ARRAY[0,1,1,2,2,3])::non_crossing_tree <@ non_crossing_trees(3))::text || '|' ||
           (ROW(ARRAY[0,2,1,3,2,3])::non_crossing_tree <@ non_crossing_trees(3))::text $q$),
  ('non_crossing_trees','range handle: cardinality(non_crossing_trees(0,3)) = 17','eq','17','A001764(0..3) summed: 1+1+3+12',$q$
    SELECT cardinality(non_crossing_trees(0,3))::text $q$),
  ('non_crossing_trees','fibers(non_crossing_trees(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade range',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(non_crossing_trees(0,3)) f $q$);
