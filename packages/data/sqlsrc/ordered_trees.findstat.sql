-- requires: ordered_trees.stats, ordered_trees, references, realizer
-- ordered_trees — FindStat sweep wave 2 (issue #263). Confirmed with findstat.org's Statistic Finder: our tree
-- objects (rendered into FindStat's nested-list notation) plus our value_fn values were submitted, and each
-- St-number is the pointwise + definition match. Carrier is the DFS ±1 word (steps int[]); the word is the forest
-- of the root's children, so [1,-1] = a root with one leaf child = [[]], [1,-1,1,-1] = [[],[]], [1,1,-1,-1] = [[[]]].
--
-- CONFIRMED:
--   leaves  St000167  "number of leaves of an ordered tree" (nodes with no children)
--   height  St000166  "the depth minus 1 of an ordered tree" (edges on the longest root-to-leaf path) = ours
--
-- DELIBERATELY OMITTED (no exact match at depth 0 — do NOT fabricate):
--   internal_nodes — the finder's nearest (St000168) matches only up to a +1 offset, not equal. Left NULL.
--   root_degree, max_degree, leftmost_path, rightmost_path, unary_nodes, even/odd_depth_nodes — no St-number
--     confirmed here; left NULL.
INSERT INTO base_reference (subject_kind, subject, system, identity, url, delta) VALUES
  ('stat','ordered_trees.leaves','findstat','St000167','https://www.findstat.org/St000167',''),
  ('stat','ordered_trees.height','findstat','St000166','https://www.findstat.org/St000166','');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('ordered_trees','leaves (St000167): [[]]=1, [[],[]]=2, [[[]]]=1, [[],[],[]]=3','eq','1|2|1|3','findstat.org St000167 Values table',$q$
    SELECT ordered_trees_leaves(ROW(ARRAY[1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_leaves(ROW(ARRAY[1,-1,1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_leaves(ROW(ARRAY[1,1,-1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_leaves(ROW(ARRAY[1,-1,1,-1,1,-1])::ordered_tree)::text $q$),
  ('ordered_trees','height (St000166): [[]]=1, [[[]]]=2, [[[[]]]]=3, [[],[]]=1','eq','1|2|3|1','findstat.org St000166 (depth minus 1)',$q$
    SELECT ordered_trees_height(ROW(ARRAY[1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_height(ROW(ARRAY[1,1,-1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_height(ROW(ARRAY[1,1,1,-1,-1,-1])::ordered_tree)::text || '|' ||
           ordered_trees_height(ROW(ARRAY[1,-1,1,-1])::ordered_tree)::text $q$),
  ('references','the two new ordered_trees findstat stat refs resolve and back real base_stat rows (floor)','eq','true','containment, not an exact count',$q$
    SELECT (count(*) >= 2 AND array_agg(r.subject) @> ARRAY['ordered_trees.leaves','ordered_trees.height'])::text
    FROM base_reference r WHERE r.system='findstat' AND r.subject_kind='stat' AND r.subject IN
      ('ordered_trees.leaves','ordered_trees.height')
      AND EXISTS (SELECT 1 FROM base_stat s WHERE s.collection='ordered_trees' AND s.stat_id = split_part(r.subject,'.',2)) $q$);
