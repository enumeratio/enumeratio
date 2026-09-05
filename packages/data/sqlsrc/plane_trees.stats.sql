-- requires: plane_trees, statistics, realizer, utilities
-- plane_trees statistics — leaves and root_degree read directly off the pre-order child-count (Łukasiewicz) word;
-- height reuses the tree ↦ dyck_paths bijection already registered as the `dyck` map (plane_trees.sql) — the DFS
-- open/close encoding's running height IS the depth of the node currently being visited, so the tree's height
-- equals dyck_height of its image, no separate depth-tracking recursion needed.

-- ── statistics (carrier: plane_tree(degrees int[])) ─────────────────────────────────────────────────────
-- leaves: nodes with no children (degree 0).
CREATE FUNCTION plane_tree_leaves(t plane_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM unnest((t).degrees) d WHERE d = 0 $$;
-- root_degree: the number of children of the root (the first pre-order entry).
CREATE FUNCTION plane_tree_root_degree(t plane_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce((t).degrees[1], 0) $$;
-- height: the depth of the deepest node (a single-node tree has height 0) — via the dyck_paths image.
CREATE FUNCTION plane_tree_height(t plane_tree) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT dyck_height(dyck_from_plane_tree(t)) $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('plane_trees','leaves','plane_tree_leaves','Leaves','natural_numbers'),
  ('plane_trees','height','plane_tree_height','Height','natural_numbers'),
  ('plane_trees','root_degree','plane_tree_root_degree','Root degree','natural_numbers');

-- ── examples ────────────────────────────────────────────────────────────────────────────────────────────
-- plane_trees(4) in rank order (from plane_trees.sql's own example):
--   1,1,1,0 | 1,2,0,0 | 2,1,0,0 | 2,0,1,0 | 3,0,0,0
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('plane_trees','leaves over plane_trees(4) in rank order is 1,2,2,2,3','eq','1,2,2,2,3','the chain has 1 leaf; the star has 3',$q$
    SELECT string_agg(plane_tree_leaves((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(plane_trees(4)) e $q$),
  ('plane_trees','root_degree over plane_trees(4) in rank order is 1,1,2,2,3','eq','1,1,2,2,3','the first pre-order entry',$q$
    SELECT string_agg(plane_tree_root_degree((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(plane_trees(4)) e $q$),
  ('plane_trees','height over plane_trees(4) in rank order is 3,2,2,2,1','eq','3,2,2,2,1','the chain (rank 0) has height 3; the star (rank 4) has height 1',$q$
    SELECT string_agg(plane_tree_height((e).value)::text, ',' ORDER BY ordinality(e)) FROM elements(plane_trees(4)) e $q$),
  ('plane_trees','the single root-leaf tree at n=1 has 1 leaf, height 0, root_degree 0','eq','1|0|0','⟨0⟩, no children',$q$
    SELECT plane_tree_leaves((unrank(plane_trees(1),0)).value)::text || '|' ||
           plane_tree_height((unrank(plane_trees(1),0)).value)::text || '|' ||
           plane_tree_root_degree((unrank(plane_trees(1),0)).value)::text $q$),
  ('plane_trees','the star at n=4 (root_degree 3) has height 1 — every child a leaf','eq','1','root ↦ 3 leaves, no deeper',$q$
    SELECT plane_tree_height(ROW(ARRAY[3,0,0,0])::plane_tree)::text $q$);
