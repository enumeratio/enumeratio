-- requires: ordered_trees, realizer, utilities, dyck_paths, integer_partitions
-- ordered_trees statistics & maps — invariants read straight off the DFS ±1 word (open before close): number of
-- leaves (an "()" = a childless node; Narayana-distributed), height (max depth = max prefix sum), root degree
-- (number of returns to level 0, = the root's children) and number of internal (non-leaf) nodes. Also: leftmost/
-- rightmost path length (always-first-child / always-last-child root→leaf walk — the latter via a reverse+flip
-- reflection trick), even/odd-depth node counts, max degree, and unary-node count (nodes with exactly one
-- child, off a shared per-node children-count helper). Two maps: the word IS a Dyck path (the classic
-- bijection), and the multiset of root-subtree sizes (in edges) is a partition of n.

-- ── statistics (carrier: ordered_tree(steps int[]) of ±1, length 2n) ────────────────────────────────────
-- leaves: a node with no children, i.e. an open immediately followed by a close ("()"). The lone single-node
-- tree (n=0, empty word) is itself a leaf ⇒ 1. For n≥1 this is the peak count; leaves are Narayana-distributed.
CREATE FUNCTION ordered_trees_leaves(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(array_length((t).steps, 1), 0) = 0 THEN 1 ELSE (
    SELECT count(*)::int FROM generate_subscripts((t).steps, 1) i
     WHERE i < array_length((t).steps, 1) AND (t).steps[i] = 1 AND (t).steps[i+1] = -1) END $$;

-- height: the maximum depth reached = the longest root-to-leaf edge count = the max running prefix sum.
CREATE FUNCTION ordered_trees_height(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(h), 0)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((t).steps) WITH ORDINALITY AS q(s, o)) z $$;

-- root degree: the number of children of the root = the number of returns to level 0 (each closes one subtree).
CREATE FUNCTION ordered_trees_root_degree(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM (SELECT sum(s) OVER (ORDER BY o) h
    FROM unnest((t).steps) WITH ORDINALITY AS q(s, o)) z WHERE h = 0 $$;

-- internal nodes: the non-leaf nodes = (n+1 total nodes) − leaves. Complement of leaves; also Narayana-distributed.
CREATE FUNCTION ordered_trees_internal_nodes(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (coalesce(array_length((t).steps, 1), 0) / 2 + 1) - ordered_trees_leaves(t) $$;

-- leftmost path: length (edges) of the root→leaf path that always takes the first child. That's exactly the
-- DFS's leading run of opens: descending into "first child" repeatedly is what DFS preorder does until it hits
-- a node with no children, i.e. the first close.
CREATE FUNCTION ordered_trees_leftmost_path(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(min(i) - 1, coalesce(array_length((t).steps, 1), 0))::int
    FROM generate_subscripts((t).steps, 1) i WHERE (t).steps[i] = -1 $$;

-- rightmost path: length of the root→leaf path that always takes the LAST child. Reversing the word and
-- flipping open/close mirrors the tree (reverses child order at every level), turning "always last child" into
-- "always first child" — so this is leftmost_path applied to that mirrored word, read directly off the original
-- via index reflection (no array copy needed): r_i = -steps[L-i+1], find the leading run of opens in r.
CREATE FUNCTION ordered_trees_rightmost_path(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(min(i) - 1, coalesce(array_length((t).steps, 1), 0))::int
    FROM generate_subscripts((t).steps, 1) i
   WHERE (t).steps[array_length((t).steps, 1) - i + 1] = 1 $$;

-- node depths: the root sits at depth 0; every other node is created by an open step, at the depth reached
-- right after that step (the running prefix sum). even/odd depth counts partition the n+1 nodes by depth parity.
CREATE FUNCTION ordered_trees_even_depth_nodes(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT 1 + coalesce((SELECT count(*) FROM (SELECT s, sum(s) OVER (ORDER BY o) h
    FROM unnest((t).steps) WITH ORDINALITY AS q(s, o)) z WHERE z.s = 1 AND z.h % 2 = 0), 0)::int $$;

CREATE FUNCTION ordered_trees_odd_depth_nodes(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((SELECT count(*) FROM (SELECT s, sum(s) OVER (ORDER BY o) h
    FROM unnest((t).steps) WITH ORDINALITY AS q(s, o)) z WHERE z.s = 1 AND z.h % 2 = 1), 0)::int $$;

-- per-node children counts (helper, not itself a stat): walk the word with a stack of open counters. An open
-- increments the parent's counter (it just gained a child) and pushes a fresh 0 for the new node; a close pops
-- the closing node's final count. What's left on the stack at the end is the root's count. The result multiset
-- covers all n+1 nodes — feeds max_degree and unary_nodes (and any future "nodes with k children" stat).
CREATE FUNCTION ordered_trees_children_counts(t ordered_tree) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE w int[] := (t).steps; n int := coalesce(array_length(w, 1), 0);
          stk int[] := ARRAY[0]; out int[] := ARRAY[]::int[]; i int; top int;
  BEGIN
    FOR i IN 1..n LOOP
      top := array_length(stk, 1);
      IF w[i] = 1 THEN
        stk[top] := stk[top] + 1;                    -- parent gains a child
        stk := stk || 0;                              -- new node's own counter
      ELSE
        out := out || stk[top];                       -- record the closing node's final child count
        stk := stk[1:top-1];                           -- pop
      END IF;
    END LOOP;
    RETURN out || stk;                                 -- stk now holds just the root's counter
  END $$;

-- max degree: the largest number of children any single node has.
CREATE FUNCTION ordered_trees_max_degree(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(max(c), 0)::int FROM unnest(ordered_trees_children_counts(t)) c $$;

-- unary nodes: nodes with exactly one child.
CREATE FUNCTION ordered_trees_unary_nodes(t ordered_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest(ordered_trees_children_counts(t)) c WHERE c = 1 $$;

-- ── maps ────────────────────────────────────────────────────────────────────────────────────────────────
-- to Dyck path: the DFS open/close word is literally a balanced ±1 word — the classic ordered-tree ↔ Dyck-path
-- bijection. Both floors share the open/U-before-close/D lex convention, so this preserves rank within a fiber.
CREATE FUNCTION ordered_trees_to_dyck_path(t ordered_tree) RETURNS dyck_path LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((t).steps)::dyck_path $$;

-- root-subtree sizes: split the word into its maximal arches (each a return-to-0 factor); an arch of length 2m is
-- a child subtree with m edges. The multiset of those sizes is an integer partition of n (parts = root degree).
CREATE FUNCTION ordered_trees_subtree_sizes(t ordered_tree) RETURNS integer_partition LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(ARRAY(
    SELECT (count(*) / 2)::int
    FROM (
      SELECT sum(CASE WHEN h = 0 THEN 1 ELSE 0 END) OVER (ORDER BY o)
             - CASE WHEN h = 0 THEN 1 ELSE 0 END AS arch                 -- arch id = # of returns strictly before o
      FROM (SELECT o, sum(s) OVER (ORDER BY o) h
            FROM unnest((t).steps) WITH ORDINALITY AS q(s, o)) z) a
    GROUP BY arch ORDER BY (count(*) / 2) DESC))::integer_partition $$;

-- ── register in base_stat / base_map ────────────────────────────────────────────────────────────────────
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('ordered_trees','leaves','ordered_trees_leaves','Number of leaves','natural_numbers'),
  ('ordered_trees','height','ordered_trees_height','Height','natural_numbers'),
  ('ordered_trees','root_degree','ordered_trees_root_degree','Root degree','natural_numbers'),
  ('ordered_trees','internal_nodes','ordered_trees_internal_nodes','Number of internal nodes','natural_numbers'),
  ('ordered_trees','leftmost_path','ordered_trees_leftmost_path','Leftmost path length','natural_numbers'),
  ('ordered_trees','rightmost_path','ordered_trees_rightmost_path','Rightmost path length','natural_numbers'),
  ('ordered_trees','even_depth_nodes','ordered_trees_even_depth_nodes','Nodes at even depth','natural_numbers'),
  ('ordered_trees','odd_depth_nodes','ordered_trees_odd_depth_nodes','Nodes at odd depth','natural_numbers'),
  ('ordered_trees','max_degree','ordered_trees_max_degree','Maximum degree','natural_numbers'),
  ('ordered_trees','unary_nodes','ordered_trees_unary_nodes','Number of unary nodes','natural_numbers');

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('ordered_trees','to_dyck_path','ordered_trees_to_dyck_path','dyck_paths','To Dyck path',NULL),
  ('ordered_trees','subtree_sizes','ordered_trees_subtree_sizes','integer_partitions','Root-subtree sizes',NULL);

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- ordered_trees(3) in rank order (open before close): ((())),(()()),(())(),()(()),()()().
-- Distributions below independently derived in sage over OrderedTrees(n+1) (n nodes ⇒ n−1 edges = our n edges).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ordered_trees','leaves: ((()))=1, ()()()=3, (())()=2','eq','1|3|2','childless nodes = "()" factors',$q$
    SELECT ordered_trees_leaves(ROW(ARRAY[1,1,1,-1,-1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_leaves(ROW(ARRAY[1,-1,1,-1,1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_leaves(ROW(ARRAY[1,1,-1,-1,1,-1])::ordered_tree)::text $q$),
  ('ordered_trees','leaves is Narayana over ordered_trees(4): distribution 1,6,6,1','eq','1,6,6,1','#trees with k=1..4 leaves = N(4,k)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_leaves((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','leaves is Narayana over ordered_trees(5): distribution 1,10,20,10,1','eq','1,10,20,10,1','N(5,k)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_leaves((e).value) k, count(*) c FROM elements(ordered_trees(5)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','height over ordered_trees(3) in rank order is 3,2,2,2,1','eq','3,2,2,2,1','max depth per tree',$q$
    SELECT string_agg(ordered_trees_height((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(ordered_trees(3)) e $q$),
  ('ordered_trees','height distribution over ordered_trees(4) is 1,7,5,1','eq','1,7,5,1','#trees of height 1,2,3,4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_height((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','height distribution over ordered_trees(5) is 1,15,18,7,1','eq','1,15,18,7,1','#trees of height 1..5',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_height((e).value) k, count(*) c FROM elements(ordered_trees(5)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','root degree over ordered_trees(3) in rank order is 1,1,2,2,3','eq','1,1,2,2,3','returns to level 0',$q$
    SELECT string_agg(ordered_trees_root_degree((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(ordered_trees(3)) e $q$),
  ('ordered_trees','root degree distribution over ordered_trees(4) is 5,5,3,1','eq','5,5,3,1','#trees with root degree 1..4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_root_degree((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','root degree distribution over ordered_trees(5) is 14,14,9,4,1','eq','14,14,9,4,1','#trees with root degree 1..5',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_root_degree((e).value) k, count(*) c FROM elements(ordered_trees(5)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','internal nodes: ((()))=3, ()()()=1, (())()=2','eq','3|1|2','non-leaf nodes',$q$
    SELECT ordered_trees_internal_nodes(ROW(ARRAY[1,1,1,-1,-1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_internal_nodes(ROW(ARRAY[1,-1,1,-1,1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_internal_nodes(ROW(ARRAY[1,1,-1,-1,1,-1])::ordered_tree)::text $q$),
  ('ordered_trees','internal nodes distribution over ordered_trees(4) is 1,6,6,1','eq','1,6,6,1','complement of leaves ⇒ N(4,k)',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_internal_nodes((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','leaves + internal = n+1 total nodes, everywhere on ordered_trees(4)','eq','true','the two partition the node set',$q$
    SELECT bool_and(ordered_trees_leaves((e).value) + ordered_trees_internal_nodes((e).value) = 5)::text
      FROM elements(ordered_trees(4)) e $q$),
  ('ordered_trees','n=0 single-node tree: leaves=1, height=0, root_degree=0, internal=0','eq','1|0|0|0','the empty word is one leaf',$q$
    SELECT ordered_trees_leaves((unrank(ordered_trees(0),0)).value)::text || '|' ||
           ordered_trees_height((unrank(ordered_trees(0),0)).value)::text || '|' ||
           ordered_trees_root_degree((unrank(ordered_trees(0),0)).value)::text || '|' ||
           ordered_trees_internal_nodes((unrank(ordered_trees(0),0)).value)::text $q$),
  ('ordered_trees','to_dyck_path over ordered_trees(3) = dyck_paths(3) in the same rank order','eq','UUUDDD,UUDUDD,UUDDUD,UDUUDD,UDUDUD','the classic bijection, rank-preserving',$q$
    SELECT string_agg(notation(ordered_trees_to_dyck_path((e).value)), ',' ORDER BY ordinality(e)) FROM elements(ordered_trees(3)) e $q$),
  ('ordered_trees','to_dyck_path image renders in the codomain (dyck_paths) form via render_value','eq','UUDDUD','(())() ↦ UUDDUD',$q$
    SELECT render_value(ordered_trees_to_dyck_path(ROW(ARRAY[1,1,-1,-1,1,-1])::ordered_tree)) $q$),
  ('ordered_trees','subtree_sizes over ordered_trees(3) in rank order','eq','3,3,2+1,2+1,1+1+1','root-subtree edge counts as a partition of n (validated vs sage)',$q$
    SELECT string_agg(notation(ordered_trees_subtree_sizes((e).value)), ',' ORDER BY ordinality(e)) FROM elements(ordered_trees(3)) e $q$),
  ('ordered_trees','subtree_sizes: parts sum to n and # parts = root degree, on all of ordered_trees(4)','eq','true','a partition of n with root_degree parts',$q$
    SELECT bool_and(
        coalesce((SELECT sum(x) FROM unnest((ordered_trees_subtree_sizes((e).value)).parts) x), 0) = 4
        AND coalesce(array_length((ordered_trees_subtree_sizes((e).value)).parts, 1), 0) = ordered_trees_root_degree((e).value)
      )::text FROM elements(ordered_trees(4)) e $q$),
  ('ordered_trees','subtree_sizes of the n=0 tree is the empty partition (prints 0)','eq','0','no children',$q$
    SELECT notation(ordered_trees_subtree_sizes((unrank(ordered_trees(0),0)).value)) $q$);

-- leftmost/rightmost path, even/odd-depth node counts, max degree, unary nodes — hand-verified against an
-- independent (non-SQL) tree-object reimplementation over ordered_trees(3)/(4)/(5), rank order as above.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ordered_trees','leftmost/rightmost path over ordered_trees(3) in rank order','eq','3,2,2,1,1|3,2,1,2,1','always-first-child | always-last-child walk length',$q$
    SELECT string_agg(ordered_trees_leftmost_path((e).value)::text, ',' ORDER BY ordinality(e)) || '|' ||
           string_agg(ordered_trees_rightmost_path((e).value)::text, ',' ORDER BY ordinality(e))
      FROM elements(ordered_trees(3)) e $q$),
  ('ordered_trees','leftmost_path distribution over ordered_trees(4) is 5,5,3,1','eq','5,5,3,1','#trees with leftmost path 1..4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_leftmost_path((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','rightmost_path distribution over ordered_trees(4) is 5,5,3,1 — same as leftmost (mirror symmetry)','eq','5,5,3,1','#trees with rightmost path 1..4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_rightmost_path((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','leftmost_path distribution over ordered_trees(5) is 14,14,9,4,1','eq','14,14,9,4,1','#trees with leftmost path 1..5',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_leftmost_path((e).value) k, count(*) c FROM elements(ordered_trees(5)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','a straight n-chain has leftmost = rightmost = n = height; a root-of-leaves star has both = 1','eq','3|3|1|1','((())) vs ()()()',$q$
    SELECT ordered_trees_leftmost_path(ROW(ARRAY[1,1,1,-1,-1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_rightmost_path(ROW(ARRAY[1,1,1,-1,-1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_leftmost_path(ROW(ARRAY[1,-1,1,-1,1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_rightmost_path(ROW(ARRAY[1,-1,1,-1,1,-1])::ordered_tree)::text $q$),
  ('ordered_trees','even/odd-depth node counts over ordered_trees(3) in rank order','eq','2,3,2,2,1|2,1,2,2,3','depth parity of all n+1 nodes',$q$
    SELECT string_agg(ordered_trees_even_depth_nodes((e).value)::text, ',' ORDER BY ordinality(e)) || '|' ||
           string_agg(ordered_trees_odd_depth_nodes((e).value)::text, ',' ORDER BY ordinality(e))
      FROM elements(ordered_trees(3)) e $q$),
  ('ordered_trees','even_depth_nodes + odd_depth_nodes = n+1 total nodes, everywhere on ordered_trees(4)','eq','true','the two partition the node set',$q$
    SELECT bool_and(ordered_trees_even_depth_nodes((e).value) + ordered_trees_odd_depth_nodes((e).value) = 5)::text
      FROM elements(ordered_trees(4)) e $q$),
  ('ordered_trees','even_depth_nodes distribution over ordered_trees(4) is 1,6,6,1','eq','1,6,6,1','#trees with k=1..4 even-depth nodes',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_even_depth_nodes((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','odd_depth_nodes distribution over ordered_trees(4) is 1,6,6,1','eq','1,6,6,1','#trees with k=1..4 odd-depth nodes',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_odd_depth_nodes((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','max_degree/unary_nodes over ordered_trees(3) in rank order','eq','1,2,2,2,3|3,1,1,1,0','largest # children | # nodes with exactly one child',$q$
    SELECT string_agg(ordered_trees_max_degree((e).value)::text, ',' ORDER BY ordinality(e)) || '|' ||
           string_agg(ordered_trees_unary_nodes((e).value)::text, ',' ORDER BY ordinality(e))
      FROM elements(ordered_trees(3)) e $q$),
  ('ordered_trees','max_degree distribution over ordered_trees(4) is 1,8,4,1','eq','1,8,4,1','#trees with max degree 1..4',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_max_degree((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','max_degree distribution over ordered_trees(5) is 1,20,15,5,1','eq','1,20,15,5,1','#trees with max degree 1..5',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_max_degree((e).value) k, count(*) c FROM elements(ordered_trees(5)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','unary_nodes distribution over ordered_trees(4) is 3,4,6,1 (k=0,1,2,4 — no tree has exactly 3)','eq','3,4,6,1','#trees with k unary nodes',$q$
    SELECT string_agg(c::text, ',' ORDER BY k)
      FROM (SELECT ordered_trees_unary_nodes((e).value) k, count(*) c FROM elements(ordered_trees(4)) e GROUP BY 1) t(k,c) $q$),
  ('ordered_trees','max_degree ≥ 1 and unary_nodes ≤ internal_nodes everywhere on ordered_trees(4) (n≥1)','eq','true','a node with children has ≥1; unary is a subset of internal',$q$
    SELECT bool_and(ordered_trees_max_degree((e).value) >= 1
        AND ordered_trees_unary_nodes((e).value) <= ordered_trees_internal_nodes((e).value))::text
      FROM elements(ordered_trees(4)) e $q$),
  ('ordered_trees','n=0 single-node tree: leftmost=0, rightmost=0, even=1, odd=0, max_degree=0, unary=0','eq','0|0|1|0|0|0','the empty word, no children',$q$
    SELECT ordered_trees_leftmost_path((unrank(ordered_trees(0),0)).value)::text || '|' ||
           ordered_trees_rightmost_path((unrank(ordered_trees(0),0)).value)::text || '|' ||
           ordered_trees_even_depth_nodes((unrank(ordered_trees(0),0)).value)::text || '|' ||
           ordered_trees_odd_depth_nodes((unrank(ordered_trees(0),0)).value)::text || '|' ||
           ordered_trees_max_degree((unrank(ordered_trees(0),0)).value)::text || '|' ||
           ordered_trees_unary_nodes((unrank(ordered_trees(0),0)).value)::text $q$);
