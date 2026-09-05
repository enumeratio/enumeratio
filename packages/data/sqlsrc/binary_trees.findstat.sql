-- requires: binary_trees.stats, binary_trees, references, realizer
-- binary_trees — FindStat sweep wave 2 (issue #263). Confirmed with findstat.org's Statistic Finder: our binary
-- trees (rendered into FindStat's "[.,.]" node notation, . = empty subtree) plus our value_fn values matched these
-- St-numbers pointwise across binary_trees(1..4). Carrier is the preorder Łukasiewicz word (shape int[]): 1 = an
-- internal node (left then right subtree follow), 0 = an empty subtree. So [1,0,0] = [.,.], [1,0,1,0,0] = [.,[.,.]],
-- [1,1,0,0,1,0,0] = [[.,.],[.,.]].
--
-- CONFIRMED:
--   leaves  St000201  "number of leaf nodes in a binary tree" (internal nodes both of whose children are empty)
--   height  St000050  "the depth (height) of a binary tree" (edges on the longest root-to-leaf path)
--
-- DELIBERATELY OMITTED (no exact match at depth 0 — do NOT fabricate):
--   no_left_child, no_right_child, left_spine, right_spine, balance — the finder returned no exact match. Left NULL.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','binary_trees.leaves','findstat','St000201','https://www.findstat.org/St000201',''),
  ('stat','binary_trees.height','findstat','St000050','https://www.findstat.org/St000050','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('binary_trees','leaves (St000201): [.,.]=1, [[.,.],[.,.]]=2, [.,[.,.]]=1, [[[.,.],.],.]=1','eq','1|2|1|1','findstat.org St000201 Values table',$q$
    SELECT binary_trees_leaves(ROW(ARRAY[1,0,0])::binary_tree)::text || '|' ||
           binary_trees_leaves(ROW(ARRAY[1,1,0,0,1,0,0])::binary_tree)::text || '|' ||
           binary_trees_leaves(ROW(ARRAY[1,0,1,0,0])::binary_tree)::text || '|' ||
           binary_trees_leaves(ROW(ARRAY[1,1,1,0,0,0,0])::binary_tree)::text $q$),
  ('binary_trees','height (St000050): [.,.]=1, [.,[.,.]]=2, [.,[.,[.,.]]]=3, [[.,.],[.,.]]=2','eq','1|2|3|2','findstat.org St000050 Values table',$q$
    SELECT binary_trees_height(ROW(ARRAY[1,0,0])::binary_tree)::text || '|' ||
           binary_trees_height(ROW(ARRAY[1,0,1,0,0])::binary_tree)::text || '|' ||
           binary_trees_height(ROW(ARRAY[1,0,1,0,1,0,0])::binary_tree)::text || '|' ||
           binary_trees_height(ROW(ARRAY[1,1,0,0,1,0,0])::binary_tree)::text $q$),
  ('references','the two new binary_trees findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 2 AND array_agg(r.subject) @> ARRAY['binary_trees.leaves','binary_trees.height'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('binary_trees.leaves','binary_trees.height')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='binary_trees' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
