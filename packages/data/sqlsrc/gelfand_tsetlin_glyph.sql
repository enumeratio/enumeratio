-- requires: gelfand_tsetlin, glyphs
-- glyph_svg(gelfand_tsetlin_pattern) — the staggered triangle (#191): row 0 (n entries, the widest) sits flush left,
-- each next row has one fewer entry and is indented by HALF a cell relative to the row above — the usual
-- Gelfand-Tsetlin/Pascal-triangle picture, centered under the row above rather than left-justified like a Young
-- diagram. n is recovered from the flat length (len = n(n+1)/2), same arithmetic as notation()'s row-length walk.

-- ── triangle: row r (0-based) has n-r cells, x-shifted by r*unit/2, entry centered in each cell ───────────────────
CREATE FUNCTION gelfand_tsetlin_triangle_svg(flat int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH n AS (SELECT floor((-1 + sqrt(1 + 8 * coalesce(array_length(flat,1),0))) / 2)::int AS v),   -- len = n(n+1)/2 ⇒ n rows
  lens AS (SELECT ARRAY(SELECT (SELECT v FROM n) - r FROM generate_series(0, (SELECT v FROM n) - 1) r) AS a),  -- row lengths n, n-1, …, 1
  rows_ AS (
    SELECT o - 1 AS ri, len,                                             -- ri = 0-based row index; len = that row's cell count
           coalesce(sum(len) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS off
    FROM lens, LATERAL unnest(a) WITH ORDINALITY AS t(len, o)
  ),
  cells AS (
    SELECT ri, c, ri * (unit / 2) + (c - 1) * unit AS x, ri * unit AS y, flat[off + c] AS val   -- half-cell stagger per row
    FROM rows_, LATERAL generate_series(1, len) AS c
  )
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="Gelfand-Tsetlin pattern">%s</svg>',
    trim_scale(round((SELECT v FROM n) * unit + 2, 2)), trim_scale(round((SELECT v FROM n) * unit + 2, 2)),
    (SELECT string_agg(format(
      '<rect x="%1$s" y="%2$s" width="%3$s" height="%3$s" rx="1.5" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
      '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
      trim_scale(round(x, 2)), trim_scale(round(y, 2)), unit,
      trim_scale(round(x + unit / 2, 2)), trim_scale(round(y + unit / 2, 2)),
      trim_scale(round(unit * 0.5, 2)), val), '' ORDER BY ri, c) FROM cells));
$$;
CREATE FUNCTION glyph_svg(g gelfand_tsetlin_pattern) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT gelfand_tsetlin_triangle_svg((g).rows) $$;

-- ── examples (glyphs.sql style: assert the GEOMETRY, not the styling) ─────────────────────────────────────────────
-- gelfand_tsetlin(2,1) rank 0 = flat {0,0,0} = the pattern 0,0/0 (top row 0,0; bottom row 0).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('gelfand_tsetlin','glyph_svg emits a self-contained svg for a GT pattern','eq','<svg…</svg>','0,0/0 (rank 0 of gelfand_tsetlin(2,1)), the staggered triangle',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(gelfand_tsetlin(2,1),0)).value) g) s $q$),
  ('gelfand_tsetlin','glyph triangle viewBox is n×n cells (n=2, unit 22)','eq','-1 -1 46 46','2 rows ⇒ n*unit + 2 on both axes',$q$
    SELECT substring(glyph_svg((unrank(gelfand_tsetlin(2,1),0)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('gelfand_tsetlin','glyph triangle has one cell per pattern entry (n(n+1)/2 = 3)','eq','3','rect count == the flat pattern length',$q$
    SELECT ((length(g) - length(replace(g, '<rect', '')))/5)::text FROM (SELECT glyph_svg((unrank(gelfand_tsetlin(2,1),0)).value) g) s $q$),
  ('gelfand_tsetlin','glyph triangle rows are staggered by half a cell (x-offsets 0,11,22)','eq','0,11,22','row 0 unshifted (x=0,22); row 1 shifted by unit/2 = 11, landing between them',$q$
    SELECT string_agg(x, ',' ORDER BY x::numeric) FROM (
      SELECT DISTINCT (m)[1] AS x
      FROM (SELECT regexp_matches(g, '<rect x="([0-9.]+)"', 'g') m       -- x is the first attr; a bare `[^>]*x="` would also match `rx="`
            FROM (SELECT glyph_svg((unrank(gelfand_tsetlin(2,1),0)).value) g) s) t
    ) d $q$),
  ('gelfand_tsetlin','glyph triangle rows land at distinct y-offsets (row 0 and row 1, unit 22)','eq','0,22','2 rows ⇒ 2 distinct rect y-values, 0 and unit',$q$
    SELECT string_agg(DISTINCT (m)[1], ',' ORDER BY (m)[1])
    FROM (SELECT regexp_matches(g, '<rect[^>]*y="([0-9.]+)"', 'g') m
          FROM (SELECT glyph_svg((unrank(gelfand_tsetlin(2,1),0)).value) g) s) t $q$),
  ('gelfand_tsetlin','glyph_svg dispatches to the GT triangle renderer','eq','true','glyph_svg(g) == gelfand_tsetlin_triangle_svg((g).rows)',$q$
    SELECT (glyph_svg(ROW(ARRAY[0,0,0])::gelfand_tsetlin_pattern) = gelfand_tsetlin_triangle_svg(ARRAY[0,0,0]))::text $q$),
  ('gelfand_tsetlin','carrier_renders_svg is now true for gelfand_tsetlin_pattern','eq','true','glyph_svg overload derives the flag automatically',$q$
    SELECT carrier_renders_svg('gelfand_tsetlin_pattern')::text $q$);
