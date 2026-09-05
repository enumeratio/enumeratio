-- requires: labeled_trees, glyphs
-- labeled_tree_glyph — the page-space glyph for the labeled_tree carrier (#145's glyph bald spot): vertices as small
-- labeled circles on a circle, edges as straight lines between them — a deterministic circular layout, legible at
-- small size without any real graph-drawing (no crossing minimization; fine for the small n these glyphs render at).
--
-- The carrier only stores the Prüfer sequence (labeled_trees.sql), length n-2, so n is recovered as length+2 —
-- EXCEPT the empty sequence, which n=1 (lone vertex) and n=2 (single edge) both encode identically (an inherent
-- Prüfer-sequence quirk, already called out in labeled_trees.sql's cardinality convention). A bare labeled_tree
-- value carries no fiber to disambiguate, so the empty case is taken as n=2 — the more informative of the two.
--
-- No base_glyph registry row on purpose (the composition/word precedent above): that table curates a prototype
-- subset feeding the `glyphs` meta-collection's floor, pinned to its current kinds — the overload alone is enough,
-- carrier_renders_svg('labeled_tree') derives straight from pg_proc/pg_type (see glyphs.sql).

-- ── decode: Prüfer sequence → edge list (the standard leaf-picking reconstruction) ──────────────────────────────
CREATE FUNCTION labeled_tree_edges(prufer int[], n int) RETURNS TABLE(u int, v int) LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE
    deg int[] := array_fill(1, ARRAY[n]);
    x int; leaf int; i int; remaining int[];
  BEGIN
    IF n <= 1 THEN RETURN; END IF;
    FOREACH x IN ARRAY prufer LOOP deg[x] := deg[x] + 1; END LOOP;    -- degree = 1 + times each vertex appears
    FOREACH x IN ARRAY prufer LOOP
      leaf := NULL;
      FOR i IN 1..n LOOP IF deg[i] = 1 THEN leaf := i; EXIT; END IF; END LOOP;   -- smallest current leaf
      u := leaf; v := x; RETURN NEXT;
      deg[leaf] := deg[leaf] - 1; deg[x] := deg[x] - 1;
    END LOOP;
    remaining := ARRAY(SELECT gi FROM generate_series(1, n) gi WHERE deg[gi] = 1 ORDER BY gi);   -- final edge
    IF array_length(remaining, 1) >= 2 THEN u := remaining[1]; v := remaining[2]; RETURN NEXT; END IF;
  END $$;

-- ── layout: n vertices evenly spaced on a circle (vertex 1 at the top, clockwise), straight-line edges ──────────
CREATE FUNCTION labeled_tree_svg(prufer int[], unit numeric DEFAULT 9, vr numeric DEFAULT 8) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH geo AS (                                                          -- n from prufer length; r grows with n
    SELECT n, GREATEST(28, unit * n) AS r
    FROM (SELECT coalesce(array_length(prufer, 1), 0) + 2 AS n) t        -- empty prufer ⇒ n=2, see header note
  ),
  verts AS (                                                             -- center the circle at (r+vr, r+vr)
    SELECT i,                                                            -- cos/sin are double precision; cast back
           (r + vr) + r * cos(2 * pi() * (i - 1) / n - pi() / 2)::numeric AS x,
           (r + vr) + r * sin(2 * pi() * (i - 1) / n - pi() / 2)::numeric AS y
    FROM geo, LATERAL generate_series(1, n) i
  ),
  edges AS (SELECT eu.u, eu.v FROM geo, LATERAL labeled_tree_edges(prufer, n) eu),
  extent AS (SELECT 2 * r + 2 * vr AS wh FROM geo)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %2$s" role="img" aria-label="labeled tree">%3$s%4$s</svg>',
    trim_scale(round((SELECT wh FROM extent) + 2, 2)), trim_scale(round((SELECT wh FROM extent) + 2, 2)),
    coalesce((SELECT string_agg(format(
      '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1.5"/>',
      trim_scale(round(a.x, 2)), trim_scale(round(a.y, 2)), trim_scale(round(b.x, 2)), trim_scale(round(b.y, 2))
    ), '' ORDER BY edges.u, edges.v) FROM edges JOIN verts a ON a.i = edges.u JOIN verts b ON b.i = edges.v), ''),
    (SELECT string_agg(format(
      '<circle cx="%1$s" cy="%2$s" r="%3$s" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
      '<text x="%1$s" y="%2$s" text-anchor="middle" dominant-baseline="central" font-size="%4$s" fill="var(--enumeratio-text,currentColor)">%5$s</text>',
      trim_scale(round(x, 2)), trim_scale(round(y, 2)), vr, trim_scale(round(vr * 0.9, 2)), i
    ), '' ORDER BY i) FROM verts));
$$;
CREATE FUNCTION glyph_svg(t labeled_tree) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT labeled_tree_svg((t).prufer) $$;

-- Assert the GEOMETRY (as glyphs.sql does for its own carriers), not the styling.
-- labeled_trees(4) rank 0 = prufer (1,1) → decodes to edges (2,1) (3,1) (1,4) (leaves 2 then 3 attach to 1, then
-- the final pair {1,4} remain). 4 vertices, 3 edges (n-1, always a tree).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders the labeled_tree carrier (vertices + edges on a circle)','eq','<svg…</svg>','labeled_trees(4) rank 0, prufer (1,1)',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(labeled_trees(4),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the labeled_tree carrier','eq','true','glyph_svg(labeled_tree) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('labeled_tree')::text $q$),
  ('glyphs','labeled_tree_edges decodes prufer (1,1) on n=4 to the 3 edges of a tree','eq','1-2,1-3,1-4','vertices 2,3 attach to 1 (repeated in the sequence), then the final pair {1,4}',$q$
    SELECT string_agg(least(u,v) || '-' || greatest(u,v), ',' ORDER BY least(u,v), greatest(u,v)) FROM labeled_tree_edges(ARRAY[1,1], 4) $q$),
  ('glyphs','labeled_tree_edges on the empty sequence (n=2) yields the single edge 1-2','eq','1-2','n=1/n=2 share the empty encoding; the glyph takes n=2 (see header note)',$q$
    SELECT string_agg(least(u,v) || '-' || greatest(u,v), ',') FROM labeled_tree_edges(ARRAY[]::int[], 2) $q$),
  ('glyphs','glyph vertex/edge counts match the tree (n=4 ⇒ 4 circles, n-1=3 lines)','eq','4|3','one <circle> per vertex, one <line> per edge',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
    FROM (SELECT glyph_svg((unrank(labeled_trees(4),0)).value) g) s $q$),
  ('glyphs','glyph labels every vertex 1..n (n=4)','eq','true','vertex labels render as text content',$q$
    SELECT (g LIKE '%>1</text>%' AND g LIKE '%>2</text>%' AND g LIKE '%>3</text>%' AND g LIKE '%>4</text>%')::text
    FROM (SELECT glyph_svg((unrank(labeled_trees(4),0)).value) g) s $q$),
  ('glyphs','glyph_svg dispatches labeled_tree to labeled_tree_svg','eq','true','carrier→helper wiring, same pattern as composition/word',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,1])::labeled_tree) = labeled_tree_svg(ARRAY[1,1]))::text $q$),
  ('glyphs','labeled_tree glyph viewBox scales with n (n=4 vs n=6, unit 9)','eq','true','r = max(28, unit*n) grows the canvas for bigger trees',$q$
    SELECT (substring(a FROM 'viewBox="-1 -1 ([0-9.]+)') <> substring(b FROM 'viewBox="-1 -1 ([0-9.]+)'))::text
    FROM (SELECT glyph_svg((unrank(labeled_trees(4),0)).value) a, glyph_svg((unrank(labeled_trees(6),0)).value) b) s $q$);
