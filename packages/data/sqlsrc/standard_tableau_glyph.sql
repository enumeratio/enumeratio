-- requires: standard_tableaux, glyphs
-- glyph_svg(standard_tableau) — the filled Young tableau (#145): the same Young-diagram grid as ferrers_svg, but
-- each cell shows its ENTRY instead of standing empty. row_word[i] = the 0-based row of entry i (see
-- standard_tableaux.sql); the column is i's rank among entries sharing that row — entries are placed in increasing
-- order (row-fill order), so that rank is just row_number() OVER (PARTITION BY row ORDER BY i).

-- ── grid: one cell per entry, positioned by (row, column-within-row), entry number centered in the cell ──────────
CREATE FUNCTION standard_tableau_grid_svg(row_word int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH cells AS (
    SELECT i, r, row_number() OVER (PARTITION BY r ORDER BY i) AS c        -- c = i's position within its row (1-based)
    FROM unnest(row_word) WITH ORDINALITY AS t(r, i)
  ),
  dim AS (SELECT greatest(1, coalesce(max(c), 0)) * unit AS w, greatest(1, coalesce(max(r), -1) + 1) * unit AS h FROM cells)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="standard Young tableau">%s</svg>',
    (SELECT w FROM dim) + 2, (SELECT h FROM dim) + 2,
    (SELECT string_agg(format(
      '<rect x="%1$s" y="%2$s" width="%3$s" height="%3$s" rx="1.5" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
      '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
      (c - 1) * unit, r * unit, unit,
      trim_scale(round((c - 1) * unit + unit / 2, 2)), trim_scale(round(r * unit + unit / 2, 2)),
      trim_scale(round(unit * 0.5, 2)), i), '' ORDER BY r, c) FROM cells));
$$;
CREATE FUNCTION glyph_svg(t standard_tableau) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT standard_tableau_grid_svg((t).row_word) $$;

-- ── examples (glyphs.sql style: assert the GEOMETRY, not the styling) ─────────────────────────────────────────────
-- standard_tableaux(3) rank 2 = row_word {0,1,0} = the tableau 1,3/2 (entries 1,3 in row 0; entry 2 in row 1).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('standard_tableaux','glyph_svg emits a self-contained svg for a SYT','eq','<svg…</svg>','1,3/2 (rank 2 of standard_tableaux(3)), the filled grid',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(standard_tableaux(3),2)).value) g) s $q$),
  ('standard_tableaux','glyph grid viewBox tracks shape (1,3/2: 2 cols × 2 rows, unit 22)','eq','-1 -1 46 46','row_word {0,1,0}: row 0 has 2 cells, row 1 has 1',$q$
    SELECT substring(glyph_svg((unrank(standard_tableaux(3),2)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('standard_tableaux','glyph grid has one cell per entry (n=3)','eq','3','rect count == the tableau size',$q$
    SELECT ((length(g) - length(replace(g, '<rect', '')))/5)::text FROM (SELECT glyph_svg((unrank(standard_tableaux(3),2)).value) g) s $q$),
  ('standard_tableaux','glyph grid labels every cell with its entry (1,2,3 all present)','eq','true','entries render as text content, not just empty boxes',$q$
    SELECT (g LIKE '%>1</text>%' AND g LIKE '%>2</text>%' AND g LIKE '%>3</text>%')::text
    FROM (SELECT glyph_svg((unrank(standard_tableaux(3),2)).value) g) s $q$),
  ('standard_tableaux','glyph grid rows land at distinct y-offsets (row 0 and row 1, unit 22)','eq','0,22','2 rows ⇒ 2 distinct rect y-values, 0 and unit',$q$
    SELECT string_agg(DISTINCT (m)[1], ',' ORDER BY (m)[1])
    FROM (SELECT regexp_matches(g, '<rect[^>]*y="([0-9.]+)"', 'g') m
          FROM (SELECT glyph_svg((unrank(standard_tableaux(3),2)).value) g) s) t $q$),
  ('standard_tableaux','glyph_svg dispatches to the tableau grid renderer','eq','true','glyph_svg(t) == standard_tableau_grid_svg((t).row_word)',$q$
    SELECT (glyph_svg(ROW(ARRAY[0,1,0])::standard_tableau) = standard_tableau_grid_svg(ARRAY[0,1,0]))::text $q$),
  ('standard_tableaux','carrier_renders_svg is now true for standard_tableau','eq','true','glyph_svg overload derives the flag automatically',$q$
    SELECT carrier_renders_svg('standard_tableau')::text $q$);
