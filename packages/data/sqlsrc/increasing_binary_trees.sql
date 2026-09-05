-- requires: permutations, realizer, utilities
-- increasing_binary_trees — binary trees (each node has an optional LEFT and optional RIGHT child, distinguished,
-- unlike full binary_trees where every node has 0 or 2 children) on n nodes labeled 1..n such that every child's
-- label exceeds its parent's (heap-ordered). Count = n! — NOT the Catalan-many shapes × labelings one might expect;
-- summed over all Catalan(n) shapes, the number of valid increasing labelings totals exactly n!, which is precisely
-- the classical BIJECTION with permutations (Stanley EC1, §1.3): given a permutation w = w_1...w_n, let m be the
-- position of its minimum entry; the root is labeled w_m, its left subtree is recursively built from w_1..w_{m-1}
-- and its right subtree from w_{m+1}..w_n. The root always gets the smallest label in its range (increasing away
-- from the root, by induction), and the INORDER traversal of the resulting tree recovers w exactly — so inorder
-- traversal is the inverse map. Carrier stores (root, left[], right[]) with left/right indexed BY LABEL (0 = no
-- child); this is a genuinely different structure from `binary_tree` (full/external-leaf shape), so a new carrier
-- is warranted per the audit's carrier-reuse rule.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE increasing_binary_tree AS (root int, left_child int[], right_child int[]);   -- left[i]/right[i] = child label of node i (0 = none)
CREATE FUNCTION notation(t increasing_binary_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'root=' || (t).root || ' L=(' || array_to_string((t).left_child, ',') || ') R=(' || array_to_string((t).right_child, ',') || ')' $$;

-- forward: recursively split the value range at its minimum; threads the (growing) left/right label-indexed
-- arrays through the recursion (plpgsql arrays are value types, so they're passed in and returned, not mutated
-- by reference). Returns the label chosen as the root of THIS sub-range.
CREATE FUNCTION increasing_binary_tree_build(vals int[], left_in int[], right_in int[], OUT root int, OUT left_out int[], OUT right_out int[]) LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m int := coalesce(array_length(vals, 1), 0); min_pos int; min_val int; lres record; rres record;
          l int[] := left_in; r int[] := right_in;
  BEGIN
    IF m = 0 THEN root := 0; left_out := l; right_out := r; RETURN; END IF;
    SELECT i INTO min_pos FROM generate_subscripts(vals, 1) i ORDER BY vals[i] ASC LIMIT 1;
    min_val := vals[min_pos];
    SELECT * INTO lres FROM increasing_binary_tree_build(vals[1:min_pos-1], l, r);
    l := lres.left_out; r := lres.right_out;
    SELECT * INTO rres FROM increasing_binary_tree_build(vals[min_pos+1:m], l, r);
    l := rres.left_out; r := rres.right_out;
    l[min_val] := lres.root; r[min_val] := rres.root;
    root := min_val; left_out := l; right_out := r;
  END $$;

CREATE FUNCTION increasing_binary_tree_from_permutation(p int[]) RETURNS increasing_binary_tree LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length(p, 1), 0); res record;
  BEGIN
    SELECT * INTO res FROM increasing_binary_tree_build(p, array_fill(0, ARRAY[n]), array_fill(0, ARRAY[n]));
    RETURN ROW(res.root, res.left_out, res.right_out)::increasing_binary_tree;
  END $$;

-- inverse: inorder traversal (left, node, right) — recursion only ever follows label > current index (heap
-- property, checked by contains_in_fiber before this is trusted on untrusted input), so it terminates.
CREATE FUNCTION increasing_binary_tree_inorder(node int, l int[], r int[]) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE out int[];
  BEGIN
    IF node = 0 THEN RETURN '{}'::int[]; END IF;
    out := increasing_binary_tree_inorder(l[node], l, r);
    out := out || node;
    out := out || increasing_binary_tree_inorder(r[node], l, r);
    RETURN out;
  END $$;
CREATE FUNCTION increasing_binary_tree_to_permutation(t increasing_binary_tree) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(increasing_binary_tree_inorder((t).root, (t).left_child, (t).right_child))::permutation $$;

-- ── the engines a collection provides ────────────────────────────────────────────────────────────────
-- FLOOR: borrow permutations' own lex floor and push it through the forward bijection — order-preserving by
-- construction (rank r of increasing_binary_trees(n) = the tree built from permutation rank r of permutations(n)).
CREATE TYPE increasing_binary_trees_fiber AS (n natural_number);   -- typed fiber; axis: n
CREATE FUNCTION fiber_count(f increasing_binary_trees_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT factorial((f).n::int) $$;
CREATE FUNCTION fiber_elements(f increasing_binary_trees_fiber, element_limit int) RETURNS SETOF increasing_binary_tree LANGUAGE sql STABLE AS $$
  SELECT increasing_binary_tree_from_permutation((permutation_unrank_lex((f).n::int, ord)).image)
  FROM generate_series(0, (least(fiber_count(f), element_limit::numeric) - 1)::bigint) ord LIMIT element_limit $$;

-- contains: verify the heap invariant directly on the arrays (child label strictly exceeds its parent's INDEX,
-- so no cycle is possible — this is checked BEFORE any recursive traversal ever runs on untrusted input), then
-- that every label 1..n except the declared root appears as a child EXACTLY once (this plus the heap invariant
-- forces a single connected tree: following any node's "who is my parent" chain strictly decreases, so it must
-- terminate at the one non-child label, i.e. the root).
CREATE FUNCTION contains_in_fiber(f increasing_binary_trees_fiber, v increasing_binary_tree) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).n::int = 0 THEN (v).root = 0 AND coalesce(array_length((v).left_child,1),0) = 0 AND coalesce(array_length((v).right_child,1),0) = 0
  ELSE
    coalesce(array_length((v).left_child, 1), 0) = (f).n::int
    AND coalesce(array_length((v).right_child, 1), 0) = (f).n::int
    AND (v).root BETWEEN 1 AND (f).n::int
    AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).left_child, 1) i WHERE (v).left_child[i] != 0 AND ((v).left_child[i] <= i OR (v).left_child[i] > (f).n::int))
    AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).right_child, 1) i WHERE (v).right_child[i] != 0 AND ((v).right_child[i] <= i OR (v).right_child[i] > (f).n::int))
    AND (SELECT array_agg(x ORDER BY x) FROM (
           SELECT unnest((v).left_child) x UNION ALL SELECT unnest((v).right_child) x) t WHERE x != 0)
        = ARRAY(SELECT g FROM generate_series(1, (f).n::int) g WHERE g != (v).root ORDER BY g)
  END $$;

CREATE FUNCTION fiber_symbol(f increasing_binary_trees_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'IBT(' || (f).n::int || ')' $$;   -- corpus symbol
INSERT INTO base_collection VALUES ('increasing_binary_trees', 'increasing_binary_tree');
INSERT INTO base_grade VALUES ('increasing_binary_trees', 1, 'n', NULL, NULL);
SELECT base_realize('increasing_binary_trees');

-- ── the bijection with permutations (a base_map worth registering, per the ticket) ──────────────────────
CREATE FUNCTION increasing_binary_tree_to_permutation_map(t increasing_binary_tree) RETURNS permutation LANGUAGE sql IMMUTABLE AS $$
  SELECT increasing_binary_tree_to_permutation(t) $$;
CREATE FUNCTION permutation_to_increasing_binary_tree(p permutation) RETURNS increasing_binary_tree LANGUAGE sql IMMUTABLE AS $$
  SELECT increasing_binary_tree_from_permutation((p).image) $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope, inverse, is_bijection) VALUES
  ('increasing_binary_trees','to_permutation','increasing_binary_tree_to_permutation_map','permutations','Inorder traversal → permutation','collection','from_permutation',true),
  ('permutations','from_permutation','permutation_to_increasing_binary_tree','increasing_binary_trees','Minimum-splitting recursion → increasing binary tree','collection','to_permutation',true);

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('increasing_binary_trees','cardinality anchors n=0..6: 1,1,2,6,24,120,720 (n!)','eq','1,1,2,6,24,120,720','closed-form accel',$q$
    SELECT string_agg(cardinality(increasing_binary_trees(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('increasing_binary_trees','n=1: the lone root, no children','eq','root=1 L=(0) R=(0)','vertex 1 alone',$q$
    SELECT notation((unrank(increasing_binary_trees(1), 0)).value) $q$),
  ('increasing_binary_trees','floor generates 24 trees at n=4 (independent of the n! accel)','eq','24','counted off the floor',$q$
    SELECT count(*)::text FROM elements(increasing_binary_trees(4)) e $q$),
  ('increasing_binary_trees','a worked instance: permutation 312 ↦ the tree with root=1, left child 3, right child 2','eq','root=1 L=(3,0,0) R=(2,0,0)','1 is the min, splits {3} left / {2} right',$q$
    SELECT notation(permutation_to_increasing_binary_tree(ROW(ARRAY[3,1,2])::permutation)) $q$),
  ('increasing_binary_trees','every generated tree satisfies the heap invariant: child label > parent index, on n=5','eq','true','structural check, no contains fn',$q$
    SELECT bool_and(
        NOT EXISTS (SELECT 1 FROM generate_subscripts((v).left_child,1) i WHERE (v).left_child[i] != 0 AND (v).left_child[i] <= i)
        AND NOT EXISTS (SELECT 1 FROM generate_subscripts((v).right_child,1) i WHERE (v).right_child[i] != 0 AND (v).right_child[i] <= i)
      )::text FROM (SELECT (e).value v FROM elements(increasing_binary_trees(5)) e) s $q$),
  ('increasing_binary_trees','round-trips: to_permutation(from_permutation(p)) = p, over permutations(n), n=0..6','eq','true','inorder ∘ build = id — the bijection, verified',$q$
    SELECT bool_and(increasing_binary_tree_to_permutation(permutation_to_increasing_binary_tree((e).value)) = (e).value)::text
    FROM generate_series(0,6) n, LATERAL elements(permutations(n)) e $q$),
  ('increasing_binary_trees','round-trips the other way: from_permutation(to_permutation(t)) = t, over increasing_binary_trees(n), n=0..6','eq','true','build ∘ inorder = id on the trees',$q$
    SELECT bool_and(permutation_to_increasing_binary_tree(increasing_binary_tree_to_permutation((e).value)) = (e).value)::text
    FROM generate_series(0,6) n, LATERAL elements(increasing_binary_trees(n)) e $q$),
  ('increasing_binary_trees','both directions are declared bijections with each other as inverse','eq','to_permutation:t|from_permutation:t','scope=collection, is_bijection, paired inverses',$q$
    SELECT 'to_permutation:' || left((is_bijection AND inverse='from_permutation')::text,1) || '|' ||
           'from_permutation:' || left((SELECT (is_bijection AND inverse='to_permutation')::text FROM base_map WHERE collection='permutations' AND map_id='from_permutation'),1)
    FROM base_map WHERE collection='increasing_binary_trees' AND map_id='to_permutation' $q$),
  ('increasing_binary_trees','contains via <@: the 312-derived tree is a valid n=3 tree; a mislabeled variant is not','eq','true|false','generated from contains_in_fiber',$q$
    SELECT (permutation_to_increasing_binary_tree(ROW(ARRAY[3,1,2])::permutation) <@ increasing_binary_trees(3))::text || '|' ||
           (ROW(1, ARRAY[0,0,0], ARRAY[0,0,0])::increasing_binary_tree <@ increasing_binary_trees(3))::text $q$);
