-- requires: plane_trees, binary_tree_glyph
-- plane_tree_glyph — the page-space glyph for the plane_tree carrier (issue #192; see binary_tree_glyph.sql for the
-- shared tree_layout_svg design note). plane_tree's word (degrees[i] = pre-order child count of the i-th node) IS
-- already exactly the child_count array tree_preorder_decode wants — no conversion, no own decode function needed;
-- glyph_svg dispatches straight into the shared binary_tree_glyph.sql helpers.
CREATE FUNCTION glyph_svg(t plane_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT tree_layout_svg(d.parent, d.depth) FROM tree_preorder_decode((t).degrees) d $$;

-- Assert the GEOMETRY (as glyphs.sql does for its own carriers), not the styling.
-- plane_trees(4) rank 0 = degrees {1,1,1,0} (a chain, per plane_trees.sql's own example); rank 4 = {3,0,0,0} (a star:
-- root with 3 leaf children).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders the plane_tree carrier (nodes + edges, tidy layout)','eq','<svg…</svg>','plane_trees(4) rank 0, degrees {1,1,1,0}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(plane_trees(4),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the plane_tree carrier','eq','true','glyph_svg(plane_tree) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('plane_tree')::text $q$),
  ('glyphs','tree_preorder_decode on the chain {1,1,1,0} is a straight parent chain 1-2-3-4, depths 0..3','eq','|1|2|3|0,1,2,3','plane_tree''s degree word IS the child_count array, no conversion',$q$
    SELECT coalesce(d.parent[1]::text,'') || '|' || array_to_string(d.parent[2:4], '|') || '|' || array_to_string(d.depth, ',')
    FROM tree_preorder_decode(ARRAY[1,1,1,0]) d $q$),
  ('glyphs','tree_preorder_decode on the star {3,0,0,0} puts all 3 leaves directly under the root, depth 1','eq','|1|1|1|0,1,1,1','one internal node owing 3 children',$q$
    SELECT coalesce(d.parent[1]::text,'') || '|' || array_to_string(d.parent[2:4], '|') || '|' || array_to_string(d.depth, ',')
    FROM tree_preorder_decode(ARRAY[3,0,0,0]) d $q$),
  ('glyphs','the chain and the star have the same node/edge counts but the chain is deeper (n=4)','eq','4|3|4|3|true','same |V|,|E|; only the shape differs',$q$
    SELECT (length(a) - length(replace(a, '<circle', '')))/7 || '|' || (length(a) - length(replace(a, '<line', '')))/5
        || '|' || (length(b) - length(replace(b, '<circle', '')))/7 || '|' || (length(b) - length(replace(b, '<line', '')))/5
        || '|' || (substring(a FROM 'viewBox="-1 -1 [0-9.]+ ([0-9.]+)') > substring(b FROM 'viewBox="-1 -1 [0-9.]+ ([0-9.]+)'))::text
    FROM (SELECT glyph_svg((unrank(plane_trees(4),0)).value) a, glyph_svg((unrank(plane_trees(4),4)).value) b) s $q$),
  ('glyphs','plane_trees(1) (the bare single-node tree, degrees {0}) renders one node, no edges','eq','1|0','n=1, Catalan(0)=1',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
    FROM (SELECT glyph_svg((unrank(plane_trees(1),0)).value) g) s $q$),
  ('glyphs','glyph_svg dispatches plane_tree through the shared tree_preorder_decode + tree_layout_svg','eq','true','carrier→helper wiring, no plane_tree-specific decode',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,0,0])::plane_tree)
         = tree_layout_svg((tree_preorder_decode(ARRAY[2,0,0])).parent, (tree_preorder_decode(ARRAY[2,0,0])).depth))::text $q$);
