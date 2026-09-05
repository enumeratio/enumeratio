-- requires: dyck_paths, realizer
-- ordered_trees — ordered (plane) rooted trees with n edges (n+1 nodes). Bijective with Dyck paths of semilength n
-- / balanced-parenthesis words of length 2n: a depth-first walk of the tree emits '(' on descending into a child
-- and ')' on returning to the parent. Carrier stores that walk as an int[] of +1 (open) / -1 (close) steps.
-- Single grade [n]. Provides the floor (trees in DFS/lex order, open-before-close) + a Catalan count accel + a
-- contains engine; base_realize generates handle/fiber/element + constructor (incl. the (lo,hi) range form).

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE ordered_tree AS (steps int[]);                             -- ±1 word, length 2n; e.g. {1,1,-1,-1} = (())
CREATE FUNCTION notation(t ordered_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(string_agg(CASE WHEN s = 1 THEN '(' ELSE ')' END, '' ORDER BY o), '')
  FROM unnest((t).steps) WITH ORDINALITY AS s(s, o) $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: every ordered tree with address[1] edges, emitted as its DFS open/close word in lex order with
-- '(' (descend) before ')' (return). Grow all valid prefixes (never let open-depth go < 0, never exceed n
-- opens); keep the balanced, depth-0 completions — same shape as the Dyck-path floor, tree-framed.
CREATE TYPE ordered_trees_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_elements(f ordered_trees_fiber, element_limit int) RETURNS SETOF ordered_tree LANGUAGE sql STABLE AS $$
  WITH RECURSIVE gen(steps, depth, len) AS (
      SELECT ARRAY[]::int[], 0, 0
    UNION ALL
      SELECT g.steps || c.step, g.depth + c.step, g.len + 1
      FROM gen g CROSS JOIN (VALUES (1), (-1)) AS c(step)
      WHERE g.len < 2 * (f).n::int
        AND g.depth + c.step >= 0                                    -- stay ≥ 0 (also caps closes: depth>0 ⇒ closes<n)
        AND (c.step = -1 OR (g.len + g.depth) / 2 < (f).n::int)      -- an open is allowed only while opens used < n
  )
  SELECT ROW(steps)::ordered_tree FROM gen
  WHERE len = 2 * (f).n::int AND depth = 0
  ORDER BY steps DESC LIMIT element_limit $$;

CREATE FUNCTION fiber_count(f ordered_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT catalan((f).n::int) $$;

-- contains: v is an ordered tree with n edges iff its word has length 2n, every step ±1, ends at depth 0, and
-- no prefix goes below depth 0.
CREATE FUNCTION contains_in_fiber(f ordered_trees_fiber, v ordered_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).steps, 1), 0) = 2 * (f).n::int
     AND NOT EXISTS (SELECT 1 FROM unnest((v).steps) s WHERE s NOT IN (1, -1))
     AND coalesce((SELECT sum(s) FROM unnest((v).steps) s), 0) = 0
     AND coalesce((SELECT min(h) FROM (
           SELECT sum(s) OVER (ORDER BY o) h FROM unnest((v).steps) WITH ORDINALITY AS t(s, o)) q), 0) >= 0 $$;

-- declare it as DATA + realize
INSERT INTO base_collection VALUES ('ordered_trees', 'ordered_tree');
INSERT INTO base_grade VALUES ('ordered_trees', 1, 'n', NULL, NULL);
SELECT base_realize('ordered_trees');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ordered_trees','cardinality anchor = Catalan for n=0..5 (accel)','eq','1,1,2,5,14,42','C(2n,n)/(n+1)',$q$
    SELECT string_agg(cardinality(ordered_trees(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('ordered_trees','n=0 ⇒ one single-node tree (empty word)','eq','1|','Catalan(0)=1, just the root',$q$
    SELECT count(*)::text || '|' || notation((unrank(ordered_trees(0), 0)).value) FROM elements(ordered_trees(0)) e $q$),
  ('ordered_trees','n=2 in lex order (open before close)','eq','(()),()()','the two 2-edge trees',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(ordered_trees(2)) e $q$),
  ('ordered_trees','n=3 in lex order (open before close)','eq','((())),(()()),(())(),()(()),()()()','the five 3-edge trees',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(ordered_trees(3)) e $q$),
  ('ordered_trees','floor generates 14 trees at n=4 (cardinality via counting)','eq','14','independent of the Catalan accel',$q$
    SELECT count(*)::text FROM elements(ordered_trees(4)) e $q$),
  ('ordered_trees','floor generates 42 trees at n=5','eq','42','the floor, counted',$q$
    SELECT count(*)::text FROM elements(ordered_trees(5)) e $q$),
  ('ordered_trees','every generated word stays balanced (≥0 depth, ends at 0)','eq','true','structural check, no contains fn',$q$
    SELECT bool_and(
        (SELECT sum(x) FROM unnest(((e).value).steps) x) = 0
        AND (SELECT min(h) FROM (SELECT sum(x) OVER (ORDER BY o) h
             FROM unnest(((e).value).steps) WITH ORDINALITY AS t(x, o)) q) >= 0
      )::text FROM elements(ordered_trees(4)) e $q$),
  ('ordered_trees','cardinality(ordered_trees(5)) = 42 (accel)','eq','42','closed-form Catalan',$q$
    SELECT cardinality(ordered_trees(5))::text $q$),
  ('ordered_trees','range handle: cardinality(ordered_trees(0,3)) = 9','eq','9','C0+C1+C2+C3 summed over fibers',$q$
    SELECT cardinality(ordered_trees(0,3))::text $q$),
  ('ordered_trees','fibers(ordered_trees(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(ordered_trees(0,3)) f $q$),
  ('ordered_trees','unrank first/last of n=3','eq','((()))|()()()','ranks 0 and 4',$q$
    SELECT notation((unrank(ordered_trees(3), 0)).value) || '|' ||
           notation((unrank(ordered_trees(3), 4)).value) $q$),
  ('ordered_trees','element carries a TYPED point fiber + ordinality','eq','3|1','unrank(ordered_trees(3),1)',$q$
    SELECT (unrank(ordered_trees(3), 1)).fiber.n::text || '|' || ordinality(unrank(ordered_trees(3), 1))::text $q$),
  ('ordered_trees','global order across fibers = (n, ordinality): ordered_trees(1,2)','eq','()|(())|()()','n ascending, lex within',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY e) FROM elements(ordered_trees(1,2)) e $q$),
  ('ordered_trees','contains: (()) ∈ ordered_trees(2), )(() ∉ (via <@)','eq','true|false','generated contains + operator',$q$
    SELECT (ROW(ARRAY[1,1,-1,-1])::ordered_tree <@ ordered_trees(2))::text || '|' ||
           (ROW(ARRAY[-1,1,1,-1])::ordered_tree <@ ordered_trees(2))::text $q$);
