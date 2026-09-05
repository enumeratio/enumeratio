-- requires: realizer, utilities
-- recursive_trees (a.k.a. increasing trees) — rooted trees on n labeled vertices {1..n} where the root is
-- unlabeled-shape-wise arbitrary but labels strictly INCREASE away from the root (every child's label exceeds
-- its parent's). Equivalently: a parent-array function parent(i) ∈ {1,...,i-1} for i=2..n (parent(1) = root,
-- the vertex labeled 1, which is forced to be the root since nothing can be its parent). Every such assignment
-- is independent (i-1 choices for i), giving count = ∏_{i=2}^n (i-1) = (n-1)! (n=0,1 both count as 1, by
-- convention). Carrier: a parent-array carrier (no existing carrier stores a parent array — labeled_tree stores
-- a Prüfer sequence instead, per the audit's "no bespoke carrier when a parent fits" rule this was checked first).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE rooted_labeled_tree AS (parent int[]);         -- length n; parent[1] = 0 (root sentinel); parent[i] ∈ 1..i-1
CREATE FUNCTION notation(t rooted_labeled_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '(' || array_to_string((t).parent, ',') || ')' $$;

-- odometer decode: digit for position i (i=n downto 2) has RADIX i-1 (i choices for vertex i's parent), least-
-- significant digit (position n) extracted first — same "peel off mod/div" shape as labeled_tree_unrank, just a
-- variable radix per digit instead of a fixed one.
CREATE FUNCTION recursive_tree_unrank(n int, ord bigint) RETURNS rooted_labeled_tree LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE res int[] := array_fill(0, ARRAY[GREATEST(n,0)]); x numeric := ord; i int; d int; radix int;
  BEGIN
    IF n < 1 THEN RETURN ROW(res)::rooted_labeled_tree; END IF;
    res[1] := 0;                                            -- vertex 1 is always the root
    FOR i IN REVERSE n..2 LOOP
      radix := i - 1;
      d := mod(x, radix)::int; x := div(x, radix);
      res[i] := d + 1;
    END LOOP;
    RETURN ROW(res)::rooted_labeled_tree;
  END $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
CREATE TYPE recursive_trees_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_count(f recursive_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT factorial(GREATEST((f).n::int - 1, 0)) $$;
CREATE FUNCTION fiber_elements(f recursive_trees_fiber, element_limit int) RETURNS SETOF rooted_labeled_tree LANGUAGE sql STABLE AS $$
  SELECT recursive_tree_unrank((f).n::int, ord::int)
  FROM generate_series(0, least(fiber_count(f), element_limit::numeric) - 1) ord LIMIT element_limit $$;
CREATE FUNCTION contains_in_fiber(f recursive_trees_fiber, v rooted_labeled_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).parent, 1), 0) = (f).n::int
     AND ((f).n::int = 0 OR (v).parent[1] = 0)
     AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).parent, 1) i
                      WHERE i > 1 AND ((v).parent[i] < 1 OR (v).parent[i] > i - 1)) $$;

-- direct unrank (capability layer 3): the ord-th element via the mixed-radix odometer decode.
CREATE FUNCTION fiber_unrank(f recursive_trees_fiber, rank rank_index) RETURNS rooted_labeled_tree LANGUAGE sql IMMUTABLE AS $fu$ SELECT recursive_tree_unrank((f).n::int, rank) $fu$;
INSERT INTO base_collection VALUES ('recursive_trees', 'rooted_labeled_tree');
INSERT INTO base_grade VALUES ('recursive_trees', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f recursive_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'RT(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('recursive_trees');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('recursive_trees','cardinality anchors n=0..6: 1,1,1,2,6,24,120 ((n-1)!)','eq','1,1,1,2,6,24,120','closed-form accel',$q$
    SELECT string_agg(cardinality(recursive_trees(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('recursive_trees','n=1: the lone root, no parent choices','eq','(0)','vertex 1 alone',$q$
    SELECT notation((unrank(recursive_trees(1), 0)).value) $q$),
  ('recursive_trees','n=3 odometer order: 2 trees, parent(3) ∈ {1,2}, parent(2)=1 forced','eq','(0,1,1),(0,1,2)','(n-1)! = 2',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(recursive_trees(3)) e $q$),
  ('recursive_trees','floor generates 24 trees at n=5 (independent of the (n-1)! accel)','eq','24','counted off the floor',$q$
    SELECT count(*)::text FROM elements(recursive_trees(5)) e $q$),
  ('recursive_trees','every generated parent array satisfies parent(1)=0 and 1<=parent(i)<i for i>1','eq','true','structural check, no contains fn',$q$
    SELECT bool_and(
        (v).parent[1] = 0
        AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).parent,1) i WHERE i > 1 AND ((v).parent[i] < 1 OR (v).parent[i] >= i))
      )::text FROM (SELECT (e).value v FROM elements(recursive_trees(4)) e) s $q$),
  ('recursive_trees','element carries a TYPED point fiber + ordinality','eq','4|3','unrank(recursive_trees(4), 3)',$q$
    SELECT (unrank(recursive_trees(4), 3)).fiber.n::text || '|' || ordinality(unrank(recursive_trees(4), 3))::text $q$),
  ('recursive_trees','contains via <@: (0,1,1) is a valid n=3 tree, (0,1,3) is not (parent(3)=3 ⊀ 3)','eq','true|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[0,1,1])::rooted_labeled_tree <@ recursive_trees(3))::text || '|' ||
           (ROW(ARRAY[0,1,3])::rooted_labeled_tree <@ recursive_trees(3))::text $q$);
