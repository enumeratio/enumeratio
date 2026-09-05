-- requires: binary_trees, glyphs
-- binary_tree_glyph — the page-space glyph for the binary_tree carrier (issue #192, follow-up to #145/#189/#190/#191:
-- the tree family was the marquee remaining visual gap). Draws the actual rooted tree: small circles for nodes,
-- straight lines for parent→child edges, y = depth, x = a tidy layout (sequential order for leaves, subtree-midpoint
-- for internal nodes) — the same shape you'd sketch by hand, not the raw preorder word.
--
-- Shared design (binary_tree hosts it since it's the most fundamental of the three carriers — ordered_tree_glyph.sql
-- and plane_tree_glyph.sql both `-- requires: binary_tree_glyph` and reuse it):
--   1. tree_preorder_decode(child_count int[]) — given, for each PREORDER position i, how many children node i has,
--      reconstructs (parent[i], depth[i]) via a stack of "open" ancestors still owed children. Preorder guarantees
--      a node's children always have a LARGER index than the node itself (a child is visited immediately after its
--      parent, before any sibling's subtree), so a single left-to-right pass with a shrinking stack suffices — no
--      recursive CTE needed.
--   2. tree_layout_svg(parent int[], depth int[]) — the actual x/y layout + SVG emission, carrier-agnostic (it only
--      wants parent/depth arrays, not any particular word encoding): leaves get sequential x in preorder order (which
--      IS left-to-right order, since preorder visits a node's left subtree before its right), then internal nodes are
--      visited from n DOWN TO 1 (a node's children, having larger indices, are already laid out) and take the mean x
--      of their children — the standard "subtree-midpoint" tidy-tree rule, done in one backward pass instead of a
--      recursive post-order walk.
--
-- binary_tree's own decode: shape[i]=1 (internal) always owes exactly 2 children, shape[i]=0 (leaf) owes 0 — so its
-- child_count array is a one-line CASE over the shape word, then straight into tree_preorder_decode.
CREATE FUNCTION tree_preorder_decode(child_count int[], OUT parent int[], OUT depth int[]) LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    n int := coalesce(array_length(child_count, 1), 0);
    stack_id int[] := '{}'; stack_remaining int[] := '{}'; top int;
    i int;
  BEGIN
    parent := array_fill(NULL::int, ARRAY[n]);          -- root(s) keep the NULL default (nothing owes them)
    depth := array_fill(0, ARRAY[n]);
    FOR i IN 1..n LOOP
      top := array_length(stack_id, 1);
      IF top IS NOT NULL AND top > 0 THEN                -- i is owed by the ancestor on top of the stack
        parent[i] := stack_id[top];
        depth[i] := depth[stack_id[top]] + 1;
        stack_remaining[top] := stack_remaining[top] - 1;
        IF stack_remaining[top] = 0 THEN                 -- that ancestor's last child — it's done, pop it
          stack_id := stack_id[1:top - 1];
          stack_remaining := stack_remaining[1:top - 1];
        END IF;
      END IF;
      IF child_count[i] > 0 THEN                          -- i itself now owes child_count[i] children
        stack_id := stack_id || i;
        stack_remaining := stack_remaining || child_count[i];
      END IF;
    END LOOP;
  END $$;

-- ── layout: tidy rooted-tree drawing from (parent[i], depth[i]) alone, 1-indexed by preorder node id ─────────────
CREATE FUNCTION tree_layout_svg(parent int[], depth int[], unit numeric DEFAULT 24, vr numeric DEFAULT 6)
RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    n int := coalesce(array_length(parent, 1), 0);
    x numeric[] := array_fill(0::numeric, ARRAY[n]);
    has_child boolean[] := array_fill(false, ARRAY[n]);
    leaf_rank int := 0; maxdepth int := 0;
    kidsum numeric; kidcount int;
    i int; j int;
    edges text := ''; nodes text := '';
  BEGIN
    IF n = 0 THEN RETURN '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 2 2" role="img" aria-label="tree"></svg>'; END IF;
    FOR i IN 1..n LOOP
      IF parent[i] IS NOT NULL THEN has_child[parent[i]] := true; END IF;
      IF depth[i] > maxdepth THEN maxdepth := depth[i]; END IF;
    END LOOP;
    FOR i IN 1..n LOOP                                    -- leaves: sequential x, preorder order = left-to-right
      IF NOT has_child[i] THEN x[i] := leaf_rank; leaf_rank := leaf_rank + 1; END IF;
    END LOOP;
    FOR i IN REVERSE n..1 LOOP                             -- internal nodes: children (larger index) already laid out
      IF has_child[i] THEN
        kidsum := 0; kidcount := 0;
        FOR j IN 1..n LOOP
          IF parent[j] = i THEN kidsum := kidsum + x[j]; kidcount := kidcount + 1; END IF;
        END LOOP;
        x[i] := kidsum / kidcount;                        -- subtree-midpoint
      END IF;
    END LOOP;
    FOR i IN 1..n LOOP
      IF parent[i] IS NOT NULL THEN
        edges := edges || format(
          '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1.5"/>',
          trim_scale(round((x[parent[i]] + 0.5) * unit, 2)), trim_scale(round(depth[parent[i]] * unit + vr, 2)),
          trim_scale(round((x[i] + 0.5) * unit, 2)), trim_scale(round(depth[i] * unit + vr, 2)));
      END IF;
    END LOOP;
    FOR i IN 1..n LOOP
      nodes := nodes || format(
        '<circle cx="%s" cy="%s" r="%s" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>',
        trim_scale(round((x[i] + 0.5) * unit, 2)), trim_scale(round(depth[i] * unit + vr, 2)), vr);
    END LOOP;
    RETURN format(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="tree">%s%s</svg>',
      trim_scale(round(leaf_rank * unit + 2, 2)), trim_scale(round(maxdepth * unit + 2 * vr + 2, 2)),
      edges, nodes);
  END $$;

CREATE FUNCTION glyph_svg(t binary_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT tree_layout_svg(d.parent, d.depth)
  FROM tree_preorder_decode((
    SELECT array_agg(CASE WHEN s = 1 THEN 2 ELSE 0 END ORDER BY o) FROM unnest((t).shape) WITH ORDINALITY AS x(s, o)
  )) d $$;

-- Assert the GEOMETRY (as glyphs.sql does for its own carriers), not the styling.
-- binary_trees(1) rank 0 = shape 100 (root + 2 leaf children): 3 nodes, 2 edges, root x is the midpoint of its
-- two children (12 and 36 with unit=24 ⇒ root cx = 24).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders the binary_tree carrier (nodes + edges, tidy layout)','eq','<svg…</svg>','binary_trees(1) rank 0, shape 100',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(binary_trees(1),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the binary_tree carrier','eq','true','glyph_svg(binary_tree) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('binary_tree')::text $q$),
  ('glyphs','tree_preorder_decode reconstructs shape 100 (n=1) as root(1) with two leaf children (2,3) at depth 1','eq','|1|1','parent[1] NULL, parent[2]=parent[3]=1',$q$
    SELECT coalesce(d.parent[1]::text,'') || '|' || d.parent[2]::text || '|' || d.parent[3]::text
    FROM tree_preorder_decode(ARRAY[2,0,0]) d $q$),
  ('glyphs','tree_preorder_decode on shape 1100100 (n=3, two 2-leaf cherries under the root) matches the hand traversal','eq','|1|2|2|1|5|5','7 nodes, parent chain from the stack walk',$q$
    SELECT coalesce(d.parent[1]::text,'') || '|' || array_to_string(d.parent[2:7], '|')
    FROM tree_preorder_decode(ARRAY[2,2,0,0,2,0,0]) d $q$),  -- childcount for shape 1,1,0,0,1,0,0 ("1100100")
  ('glyphs','glyph vertex/edge counts match the tree (binary_trees(1) ⇒ 3 nodes, 2 edges)','eq','3|2','one <circle> per node, one <line> per edge',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
    FROM (SELECT glyph_svg((unrank(binary_trees(1),0)).value) g) s $q$),
  ('glyphs','a leaf-only tree (binary_trees(0)) renders one node, no edges','eq','1|0','the bare leaf word, n=0',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
    FROM (SELECT glyph_svg((unrank(binary_trees(0),0)).value) g) s $q$),
  ('glyphs','root is centered over its two children (binary_trees(1), unit 24 default, nodes emitted in preorder)','eq','24|12|36','root cx = midpoint of the two leaf cx',$q$
    SELECT string_agg(substring(m[1] FROM 'cx="([0-9.]+)"'), '|')
    FROM (SELECT regexp_matches(glyph_svg((unrank(binary_trees(1),0)).value), '<circle[^/]+/>', 'g') m) s $q$),
  ('glyphs','glyph_svg dispatches binary_tree through tree_preorder_decode + tree_layout_svg','eq','true','carrier→helper wiring, same pattern as other glyphs',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,0,0])::binary_tree) = tree_layout_svg((tree_preorder_decode(ARRAY[2,0,0])).parent, (tree_preorder_decode(ARRAY[2,0,0])).depth))::text $q$),
  ('glyphs','binary_tree glyph viewBox height grows with depth (binary_trees(1) vs a deeper shape)','eq','true','a taller tree gets a taller viewBox',$q$
    SELECT (substring(b FROM 'viewBox="-1 -1 [0-9.]+ ([0-9.]+)') > substring(a FROM 'viewBox="-1 -1 [0-9.]+ ([0-9.]+)'))::text
    FROM (SELECT glyph_svg((unrank(binary_trees(1),0)).value) a, glyph_svg(ROW(ARRAY[1,1,0,0,0])::binary_tree) b) s $q$);
