-- requires: ordered_trees, binary_tree_glyph
-- ordered_tree_glyph — the page-space glyph for the ordered_tree carrier (issue #192; see binary_tree_glyph.sql for
-- the shared tree_layout_svg design note). Reuses that shared layout, but its OWN decode: ordered_tree's word isn't
-- a per-node child count (unlike binary_tree/plane_tree) — it's a DFS walk where +1 descends into a brand-new child
-- and -1 returns to the parent, and the node count (n+1) differs from the word length (2n). So instead of building a
-- child_count array and feeding tree_preorder_decode, this walks the word directly with a stack of the CURRENT
-- root→here path, minting a new node id (and recording its parent + depth) on every +1.
CREATE FUNCTION ordered_tree_layout_decode(steps int[], OUT parent int[], OUT depth int[]) LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    m int := coalesce(array_length(steps, 1), 0);
    path int[] := ARRAY[1];                              -- root→current node-id path; node 1 = the root
    next_id int := 1;
    i int; s int; cur int;
  BEGIN
    parent := ARRAY[NULL::int];                           -- node 1 (root): no parent, depth 0
    depth := ARRAY[0];
    FOR i IN 1..m LOOP
      s := steps[i];
      IF s = 1 THEN                                       -- descend: mint a new child of the current node
        cur := path[array_length(path, 1)];
        next_id := next_id + 1;
        parent := parent || cur;
        depth := depth || array_length(path, 1);          -- path length before the push = parent's depth + 1
        path := path || next_id;
      ELSE                                                  -- ascend: pop back to the parent
        path := path[1 : array_length(path, 1) - 1];
      END IF;
    END LOOP;
  END $$;

CREATE FUNCTION glyph_svg(t ordered_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT tree_layout_svg(d.parent, d.depth) FROM ordered_tree_layout_decode((t).steps) d $$;

-- Assert the GEOMETRY (as glyphs.sql does for its own carriers), not the styling.
-- ordered_trees(2) rank 0 = "(())" (a chain: root -> child -> grandchild); rank 1 = "()()" (root with 2 leaf
-- children side by side) — the two shapes at n=2, see ordered_trees.sql's own example for the notation.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders the ordered_tree carrier (nodes + edges, tidy layout)','eq','<svg…</svg>','ordered_trees(2) rank 0, steps (())',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(ordered_trees(2),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the ordered_tree carrier','eq','true','glyph_svg(ordered_tree) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('ordered_tree')::text $q$),
  ('glyphs','ordered_tree_layout_decode on "(())" (steps +1,+1,-1,-1) is a 3-node chain, depths 0,1,2','eq','|1|2|0,1,2','root -> child -> grandchild, each node''s only child is the next',$q$
    SELECT coalesce(d.parent[1]::text,'') || '|' || array_to_string(d.parent[2:3], '|') || '|' || array_to_string(d.depth, ',')
    FROM ordered_tree_layout_decode(ARRAY[1,1,-1,-1]) d $q$),
  ('glyphs','ordered_tree_layout_decode on "()()" (steps +1,-1,+1,-1) is a 3-node cherry: root with 2 leaf children','eq','|1|1|0,1,1','both children attach to the root, not to each other',$q$
    SELECT coalesce(d.parent[1]::text,'') || '|' || array_to_string(d.parent[2:3], '|') || '|' || array_to_string(d.depth, ',')
    FROM ordered_tree_layout_decode(ARRAY[1,-1,1,-1]) d $q$),
  ('glyphs','the chain and the cherry have the same node/edge counts but different depths (n=2)','eq','3|2|3|2|true','same |V|,|E|; the chain reaches deeper',$q$
    SELECT (length(a) - length(replace(a, '<circle', '')))/7 || '|' || (length(a) - length(replace(a, '<line', '')))/5
        || '|' || (length(b) - length(replace(b, '<circle', '')))/7 || '|' || (length(b) - length(replace(b, '<line', '')))/5
        || '|' || (substring(a FROM 'viewBox="-1 -1 [0-9.]+ ([0-9.]+)') > substring(b FROM 'viewBox="-1 -1 [0-9.]+ ([0-9.]+)'))::text
    FROM (SELECT glyph_svg((unrank(ordered_trees(2),0)).value) a, glyph_svg((unrank(ordered_trees(2),1)).value) b) s $q$),
  ('glyphs','ordered_trees(0) (the bare root, empty steps) renders one node, no edges','eq','1|0','n=0 edges ⇒ single root, no descent',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
    FROM (SELECT glyph_svg((unrank(ordered_trees(0),0)).value) g) s $q$),
  ('glyphs','glyph_svg dispatches ordered_tree through ordered_tree_layout_decode + the shared tree_layout_svg','eq','true','carrier→helper wiring, same pattern as binary_tree',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,1,-1,-1])::ordered_tree)
         = tree_layout_svg((ordered_tree_layout_decode(ARRAY[1,1,-1,-1])).parent, (ordered_tree_layout_decode(ARRAY[1,1,-1,-1])).depth))::text $q$);
