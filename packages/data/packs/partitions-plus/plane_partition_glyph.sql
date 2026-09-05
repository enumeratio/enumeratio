-- requires: plane_partitions, glyphs
-- plane_partition_glyph — the page-space glyph for the plane_partition carrier (issue #222 glyph batch): a
-- PLAN-VIEW grid — the same labelled-cell Young diagram as standard_tableau_grid_svg, one cell per (row, column)
-- with its entry (the stack HEIGHT at that cell) printed inside. A deliberate simplification of the "stacked
-- boxes, isometric 3-view" picture the ticket names: an actual isometric projection is real extra surface area
-- (occlusion, per-face shading) that a top-down height-labelled grid gets for free while staying exactly as
-- legible — every entry is still readable as a number, and row/column weakly-decreasing is still visible as the
-- labels shrinking left-to-right and top-to-bottom. Revisit with a true 3-view if the plain grid reads as
-- ambiguous in practice.
-- layer: glyph
CREATE FUNCTION plane_partition_grid_svg(entries int[], shape int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH rows AS (
    SELECT i, shape[i] AS len,
           coalesce(sum(shape[i]) OVER (ORDER BY i ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS off
    FROM generate_subscripts(shape, 1) i
  ),
  cells AS (SELECT i, c, entries[off + c] AS v FROM rows, LATERAL generate_series(1, len) c),
  dim AS (SELECT greatest(1, coalesce((SELECT max(len) FROM rows), 0)) * unit AS w,
                 greatest(1, coalesce((SELECT max(i) FROM rows), 0)) * unit AS h)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="plane partition grid">%s</svg>',
    trim_scale(round((SELECT w FROM dim) + 2, 2)), trim_scale(round((SELECT h FROM dim) + 2, 2)),
    (SELECT string_agg(format(
      '<rect x="%1$s" y="%2$s" width="%3$s" height="%3$s" rx="1.5" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
      '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
      trim_scale(round((c - 1) * unit, 2)), trim_scale(round((i - 1) * unit, 2)), trim_scale(round(unit, 2)),
      trim_scale(round((c - 1) * unit + unit / 2, 2)), trim_scale(round((i - 1) * unit + unit / 2, 2)),
      trim_scale(round(unit * 0.5, 2)), v
    ), '' ORDER BY i, c) FROM cells));
$$;
CREATE FUNCTION glyph_svg(p plane_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT plane_partition_grid_svg((p).entries, (p).shape) $$;

-- Assert the GEOMETRY (grid extent, cell count, entry labels), not the styling. entries={2,1,1}, shape={2,1}: row 1
-- = 2,1 (2 cells); row 2 = 1 (1 cell) — the plane partition 2,1/1 (rows weakly decrease entrywise: 2≥1, 1≥ nothing).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a plane_partition','eq','<svg…</svg>','2,1/1',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[2,1,1],ARRAY[2,1])::plane_partition) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the plane_partition carrier','eq','true','glyph_svg(plane_partition) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('plane_partition')::text $q$),
  ('glyphs','grid viewBox tracks shape (2,1: 2 cols × 2 rows, unit 22)','eq','-1 -1 46 46','shape={2,1}: row1 has 2 cells, row2 has 1',$q$
    SELECT substring(glyph_svg(ROW(ARRAY[2,1,1],ARRAY[2,1])::plane_partition) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','grid has one cell per entry (3 entries) and labels every one','eq','3|true','rect count == sum(shape); every entry value printed',$q$
    SELECT ((length(g) - length(replace(g, '<rect', '')))/5)::text
        || '|' || (g LIKE '%>2</text>%' AND g LIKE '%>1</text>%')::text
    FROM (SELECT glyph_svg(ROW(ARRAY[2,1,1],ARRAY[2,1])::plane_partition) g) s $q$),
  ('glyphs','glyph_svg dispatches plane_partition to plane_partition_grid_svg','eq','true','carrier→helper wiring',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,1,1],ARRAY[2,1])::plane_partition) = plane_partition_grid_svg(ARRAY[2,1,1],ARRAY[2,1]))::text $q$),
  ('glyphs','glyph_svg renders a real plane_partitions() element','eq','<svg…</svg>','plane_partitions(3), rank 0',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(plane_partitions(3),0)).value) g) s $q$);
