-- requires: element_relations, subsets.relations
-- hasse_svg — the Hasse figure (issue #237, deferred piece; design: docs/design/element-relations.md crux (c)). One
-- SVG per FIBER of a registered cover relation (base_element_relation.forward_fn): nodes placed by rank (y), tidy
-- per-level layout (x), edges drawn from the cover pairs. This is a whole-fiber figure, not a per-element glyph —
-- it doesn't fit glyph_svg(<carrier>)'s one-value-in/one-svg-out shape, so it lives here rather than in glyphs.sql,
-- and deliberately adds no base_glyph row (that registry is carrier-keyed, not collection+relation-keyed).
--
-- RANK, derived (crux d): a saturated-chain length from the poset's minimal elements — the longest path from a
-- source in the cover DAG, via a bounded (hops < node count) recursive walk. For every relation drawn below the
-- cover is GRADED (weak order by inversions, Boolean inclusion by cardinality) so every root-to-node path agrees
-- and this coincides with the known grading stat; the derivation is generic so it also lays out a non-graded DAG
-- (any consistent longest-chain assignment), not just these two.
--
-- crux (c): a cover relation's undirected graph IS a polytope's 1-skeleton where one is registered — permutations'
-- weak_order below is exactly the permutahedron's skeleton (base_polytope on the `permutahedron` collection,
-- polytope-collections.sql; element_relations.sql already asserts the (n−1)-regular / n!·(n−1)/2-edge identity).
-- Two layouts of ONE edge set: this file draws the Hasse (ranked) layout, base_polytope the geometric one — no
-- second edge list is maintained, hasse_svg reads the same forward_fn the polytope's edge count was checked against.

-- ── the layout: plain arrays of node ids + edge pairs in, a self-contained SVG out ─────────────────────────────
-- No dynamic dispatch here (that's hasse_svg's job below) — a pure function of ids/edges/unit, so it's testable in
-- isolation and IMMUTABLE like the other page-space generators (lattice_path_svg, ferrers_svg, cells_svg).
CREATE FUNCTION hasse_layout_svg(node_ids text[], edge_src text[], edge_dst text[], unit numeric DEFAULT 48)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH RECURSIVE
  nodes AS (SELECT DISTINCT id FROM unnest(node_ids) id),
  edges AS (SELECT src, dst FROM unnest(edge_src, edge_dst) AS t(src, dst)),
  -- longest path from a source (no incoming edge) to each node; UNION dedupes, hops bounds the walk on any DAG
  chain(id, rnk, hops) AS (
    SELECT id, 0, 0 FROM nodes WHERE id NOT IN (SELECT dst FROM edges)
    UNION
    SELECT e.dst, c.rnk + 1, c.hops + 1
      FROM chain c JOIN edges e ON e.src = c.id
     WHERE c.hops < (SELECT count(*) FROM nodes)
  ),
  ranks AS (SELECT id, max(rnk) AS rnk FROM chain GROUP BY id),
  -- tidy per-level layout: index nodes within their rank level, centered
  leveled AS (
    SELECT n.id, coalesce(r.rnk, 0) AS rnk,
           row_number() OVER (PARTITION BY coalesce(r.rnk, 0) ORDER BY n.id) AS pos,
           count(*)      OVER (PARTITION BY coalesce(r.rnk, 0))              AS level_n
      FROM nodes n LEFT JOIN ranks r ON r.id = n.id
  ),
  positioned AS (SELECT id, rnk, (pos - (level_n + 1) / 2.0) AS xu FROM leveled),
  dims AS (SELECT coalesce(max(rnk), 0) AS maxrank, coalesce(min(xu), 0) AS minx FROM positioned),
  -- page space: rank 0 (the poset minimum) at the bottom, higher rank up; x centered per level, offset non-negative
  pts AS (
    SELECT p.id,
           ((p.xu - d.minx) * unit + unit) AS x,
           ((d.maxrank - p.rnk) * unit + unit) AS y
      FROM positioned p CROSS JOIN dims d
  ),
  lines AS (
    SELECT e.src, e.dst, a.x AS xa, a.y AS ya, b.x AS xb, b.y AS yb
      FROM edges e JOIN pts a ON a.id = e.src JOIN pts b ON b.id = e.dst
  ),
  geo AS (SELECT coalesce(max(x), 0) AS w, coalesce(max(y), 0) AS h FROM pts)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %2$s" role="img" aria-label="Hasse diagram">%3$s%4$s</svg>',
    trim_scale(round((SELECT w FROM geo) + unit + 1, 2)), trim_scale(round((SELECT h FROM geo) + unit + 1, 2)),
    coalesce((SELECT string_agg(format(
      '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1.5" opacity="0.6"/>',
      trim_scale(round(xa, 2)), trim_scale(round(ya, 2)), trim_scale(round(xb, 2)), trim_scale(round(yb, 2))
    ), '' ORDER BY src, dst) FROM lines), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="5" fill="var(--enumeratio-accent,#d97706)"/>',
      trim_scale(round(x, 2)), trim_scale(round(y, 2))
    ), '' ORDER BY id) FROM pts), '')
  )
$$;

-- ── the dispatcher: (collection, rel_id, n) → the fiber's cover graph → hasse_layout_svg ────────────────────────
-- Reuses find_stat.sql's bounded-sweep idiom (elements(<collection>(n), cap)) and map_compose.sql's dynamic
-- function-name idiom (format('%I(...)', fwd_fn) inside an EXECUTEd string) — the same textual-dispatch pattern
-- already trusted for calling a registry-named function whose type isn't known until runtime. Only forward_fn
-- relations (an explicit successor set) can be drawn this way; a related_fn-only relation (e.g.
-- integer_partitions/dominance) has no cheap cover set to enumerate and is out of scope here.
CREATE FUNCTION hasse_svg(p_collection text, p_rel_id text, n int, element_limit int DEFAULT 60, unit numeric DEFAULT 48)
RETURNS text LANGUAGE plpgsql STABLE AS $$
  DECLARE
    fwd_fn text;
    node_ids text[];
    edge_src text[];
    edge_dst text[];
  BEGIN
    SELECT forward_fn INTO fwd_fn FROM base_element_relation WHERE collection = p_collection AND rel_id = p_rel_id;
    IF fwd_fn IS NULL THEN
      RAISE EXCEPTION 'hasse_svg: %.% has no forward_fn (a related_fn-only relation has no cheap cover set to draw)', p_collection, p_rel_id;
    END IF;

    EXECUTE format($f$
      WITH nodes AS (SELECT (e).value AS v, render_value((e).value) AS id FROM elements(%1$I(%2$s), %3$s) e),
      edges AS (SELECT n.id AS src, render_value(c) AS dst FROM nodes n, LATERAL %4$I(n.v) c)
      SELECT (SELECT array_agg(id ORDER BY id) FROM nodes),
             coalesce((SELECT array_agg(src ORDER BY src, dst) FROM edges), ARRAY[]::text[]),
             coalesce((SELECT array_agg(dst ORDER BY src, dst) FROM edges), ARRAY[]::text[])
    $f$, p_collection, n, element_limit, fwd_fn) INTO node_ids, edge_src, edge_dst;

    RETURN hasse_layout_svg(node_ids, edge_src, edge_dst, unit);
  END
$$;

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('hasse', 'hasse_layout_svg emits a self-contained svg', 'eq', '<svg…</svg>', 'the render payload, not just geometry',$q$
    SELECT left(g,4) || '…' || right(g,6)
      FROM (SELECT hasse_layout_svg(ARRAY['a','b'], ARRAY['a'], ARRAY['b']) g) s $q$),
  ('hasse', 'hasse_layout_svg draws one circle per node and one line per edge (a 2-chain: a covers b)', 'eq', '2|1',
   'nodes/edges are literal counts off the svg',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
      FROM (SELECT hasse_layout_svg(ARRAY['a','b'], ARRAY['a'], ARRAY['b']) g) s $q$),
  ('hasse', 'hasse_layout_svg ranks the cover UP: a (source, rank 0) sits BELOW b (its cover, rank 1) in page space (svg y grows downward)', 'eq', 'true',
   'circles are emitted ORDER BY id, so the first cy is a''s, the second b''s — a''s y must be the larger one',$q$
    SELECT (cys[1] > cys[2])::text FROM (
      SELECT array_agg((m[1])::numeric ORDER BY o) cys
        FROM (SELECT hasse_layout_svg(ARRAY['a','b'], ARRAY['a'], ARRAY['b']) g) s,
             LATERAL regexp_matches(g, 'cy="([0-9.]+)"', 'g') WITH ORDINALITY AS t(m, o)
    ) x $q$),

  -- permutations(3), weak order — the hexagon (crux c: this IS the permutahedron(3) skeleton)
  ('hasse', 'hasse_svg on permutations(3)/weak_order draws the hexagon: 6 nodes, 6 edges', 'eq', '6|6',
   'S_3 weak order — one node per permutation, covers = adjacent-transposition edges (element_relations.sql already proves n!·(n−1)/2 = 6 edges for n=3)',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
      FROM (SELECT hasse_svg('permutations', 'weak_order', 3) g) s $q$),
  ('hasse', 'hasse_svg on permutations(3)/weak_order emits a self-contained svg', 'eq', '<svg…</svg>', 'sanity',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT hasse_svg('permutations', 'weak_order', 3) g) s $q$),

  -- subsets(3), Boolean lattice — the 3-cube: 8 nodes, 12 edges
  ('hasse', 'hasse_svg on subsets(3)/inclusion draws the 3-cube: 8 nodes, 12 edges', 'eq', '8|12',
   '2^[3] — one node per subset, covers = hypercube edges (subsets.relations.sql already proves n·2^(n−1) = 12 edges for n=3)',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
      FROM (SELECT hasse_svg('subsets', 'inclusion', 3) g) s $q$),
  ('hasse', 'hasse_svg on subsets(3)/inclusion emits a self-contained svg', 'eq', '<svg…</svg>', 'sanity',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT hasse_svg('subsets', 'inclusion', 3) g) s $q$),

  ('hasse', 'hasse_svg refuses a related_fn-only relation (no cheap cover set to enumerate): integer_partitions/dominance', 'eq', 'true',
   'dominance registers via related_fn, not forward_fn — hasse_svg raises rather than guessing at an edge set',$q$
    SELECT base_raises($e$ SELECT hasse_svg('integer_partitions', 'dominance', 4) $e$)::text $q$);
