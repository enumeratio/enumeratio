-- requires: labeled_graphs, glyphs
-- labeled_graph_glyph — the page-space glyph for the labeled_graph carrier (issue #228): the classic ADJACENCY
-- figure — n vertices placed evenly on a circle (vertex i at angle 2π(i-1)/n, so labels read clockwise from the
-- top), edges drawn as straight chords between their endpoints. (A second "kind" for the adjacency MATRIX itself
-- is deferred to whenever multi-kind figures land — base_glyph's `kind` column, catalog-audit.md §3 friction 6.)
CREATE FUNCTION labeled_graph_circle_svg(n int, edges int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(n, 1) AS nn, unit * (greatest(n, 3)::numeric / 2) AS r, unit * 0.16 AS pr),
  pts AS (
    SELECT v AS i, (dim.r * cos(2 * pi() * (v - 1) / dim.nn))::numeric AS x, (dim.r * sin(2 * pi() * (v - 1) / dim.nn))::numeric AS y
    FROM dim, LATERAL generate_series(1, n) v
  ),
  chords AS (
    SELECT e, a.x AS xa, a.y AS ya, b.x AS xb, b.y AS yb
    FROM unnest(edges) e,
         LATERAL (SELECT graph_edge_pair(n, e) AS pr) p,
         LATERAL (SELECT x, y FROM pts WHERE i = p.pr[1]) a,
         LATERAL (SELECT x, y FROM pts WHERE i = p.pr[2]) b
  ),
  geo AS (SELECT r, pr FROM dim)
  -- args: 1,2=x0,y0 (viewBox origin, padded by the point radius) · 3=viewBox extent (square) · 4=chords · 5=vertex dots
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%1$s %2$s %3$s %3$s" role="img" aria-label="labeled graph adjacency figure">%4$s%5$s</svg>',
    trim_scale(round(-(geo.r + geo.pr + 1), 2)), trim_scale(round(-(geo.r + geo.pr + 1), 2)),
    trim_scale(round(2 * (geo.r + geo.pr + 1), 2)),
    coalesce((SELECT string_agg(format(
      '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"/>',
      trim_scale(round(xa, 2)), trim_scale(round(ya, 2)), trim_scale(round(xb, 2)), trim_scale(round(yb, 2))
    ), '' ORDER BY e) FROM chords), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-text,currentColor)"/>',
      trim_scale(round(x, 2)), trim_scale(round(y, 2)), trim_scale(round((SELECT pr FROM geo), 2))
    ), '' ORDER BY i) FROM pts), '')
  ) FROM geo;
$$;
CREATE FUNCTION glyph_svg(g labeled_graph) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT labeled_graph_circle_svg((g).n, (g).edges) $$;

-- Assert the GEOMETRY (point count, chord count, viewBox extent), not the styling — mirrors perfect_matching_glyph.
-- labeled_graphs(4) rank of the path 1-2-3-4 (edges at indices {1,3,6} — see labeled_graphs.sql).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a labeled_graph','eq','<svg…</svg>','the path graph on [4]',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(4, ARRAY[1,3,6])::labeled_graph) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the labeled_graph carrier','eq','true','glyph_svg(labeled_graph) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('labeled_graph')::text $q$),
  ('glyphs','the path graph on [4] draws exactly 4 vertex dots and 3 edge chords','eq','4|3','one circle per vertex, one line per edge',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
    FROM (SELECT glyph_svg(ROW(4, ARRAY[1,3,6])::labeled_graph) g) s $q$),
  ('glyphs','the empty graph on [3] draws 3 vertex dots and no chords','eq','3|0','no edges present',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
    FROM (SELECT glyph_svg(ROW(3, ARRAY[]::int[])::labeled_graph) g) s $q$),
  ('glyphs','labeled_graph_circle_svg on n=0 collapses to a padding-only box, no points or chords','eq','0|0','coalesce keeps the viewBox non-degenerate — same convention as perfect_matching_arc_svg''s n=0 case',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 || '|' || (length(g) - length(replace(g, '<line', '')))/5
    FROM (SELECT labeled_graph_circle_svg(0, ARRAY[]::int[]) g) s $q$),
  ('glyphs','glyph_svg dispatches labeled_graph to labeled_graph_circle_svg','eq','true','carrier→helper wiring, same pattern as perfect_matching',$q$
    SELECT (glyph_svg(ROW(4, ARRAY[1,3,6])::labeled_graph) = labeled_graph_circle_svg(4, ARRAY[1,3,6]))::text $q$);
