-- requires: semistandard_tableaux, glyphs
-- glyph_svg(semistandard_tableau) — the SSYT Young diagram (#191, follow-up to #145's standard_tableau_grid_svg):
-- same left-justified grid convention, but cells come from (entries, shape) directly — entries is already row-major,
-- shape is the row lengths (a partition) — rather than the row_word the standard-tableau carrier uses. REPEATED
-- labels are expected (that's the semistandard-vs-standard distinction) so no dedup logic here, just row-major fill.
-- layer: glyph

-- ── grid: one cell per entry, positioned by (row, column-within-row) from shape's row lengths, entry centered ─────
CREATE FUNCTION semistandard_tableau_grid_svg(entries int[], shape int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH rows AS (
    SELECT r - 1 AS ri, len,                                            -- ri = 0-based row index; len = that row's cell count
           coalesce(sum(len) OVER (ORDER BY r ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS off
    FROM unnest(shape) WITH ORDINALITY AS t(len, r)
  ),
  cells AS (
    SELECT ri, c, entries[off + c] AS val                               -- c = 1-based column within the row
    FROM rows, LATERAL generate_series(1, len) AS c
  ),
  dim AS (SELECT greatest(1, coalesce(max(c), 0)) * unit AS w, greatest(1, coalesce(max(ri), -1) + 1) * unit AS h FROM cells)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="semistandard Young tableau">%s</svg>',
    (SELECT w FROM dim) + 2, (SELECT h FROM dim) + 2,
    (SELECT string_agg(format(
      '<rect x="%1$s" y="%2$s" width="%3$s" height="%3$s" rx="1.5" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
      '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
      (c - 1) * unit, ri * unit, unit,
      trim_scale(round((c - 1) * unit + unit / 2, 2)), trim_scale(round(ri * unit + unit / 2, 2)),
      trim_scale(round(unit * 0.5, 2)), val), '' ORDER BY ri, c) FROM cells));
$$;
CREATE FUNCTION glyph_svg(t semistandard_tableau) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT semistandard_tableau_grid_svg((t).entries, (t).shape) $$;

-- ── examples (glyphs.sql style: assert the GEOMETRY, not the styling) ─────────────────────────────────────────────
-- semistandard_tableaux(3,2) rank 0 = shape {2,1}, entries {1,1,2} = the tableau 1,1/2.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('semistandard_tableaux','glyph_svg emits a self-contained svg for a SSYT','eq','<svg…</svg>','1,1/2 (rank 0 of semistandard_tableaux(3,2)), the filled grid',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(semistandard_tableaux(3,2),0)).value) g) s $q$),
  ('semistandard_tableaux','glyph grid viewBox tracks shape (1,1/2: 2 cols × 2 rows, unit 22)','eq','-1 -1 46 46','shape {2,1}: row 0 has 2 cells, row 1 has 1',$q$
    SELECT substring(glyph_svg((unrank(semistandard_tableaux(3,2),0)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('semistandard_tableaux','glyph grid has one cell per entry (n=3)','eq','3','rect count == the tableau size',$q$
    SELECT ((length(g) - length(replace(g, '<rect', '')))/5)::text FROM (SELECT glyph_svg((unrank(semistandard_tableaux(3,2),0)).value) g) s $q$),
  ('semistandard_tableaux','glyph grid labels REPEAT (entries 1,1,2 — the semistandard-vs-standard point)','eq','2|1','entry 1 renders twice, entry 2 once — repeats are the whole point, not deduped',$q$
    SELECT ((length(g) - length(replace(g, '>1</text>', '')))/9)::text || '|' ||
           ((length(g) - length(replace(g, '>2</text>', '')))/9)::text
    FROM (SELECT glyph_svg((unrank(semistandard_tableaux(3,2),0)).value) g) s $q$),
  ('semistandard_tableaux','glyph grid rows land at distinct y-offsets (row 0 and row 1, unit 22)','eq','0,22','2 rows ⇒ 2 distinct rect y-values, 0 and unit',$q$
    SELECT string_agg(DISTINCT (m)[1], ',' ORDER BY (m)[1])
    FROM (SELECT regexp_matches(g, '<rect[^>]*y="([0-9.]+)"', 'g') m
          FROM (SELECT glyph_svg((unrank(semistandard_tableaux(3,2),0)).value) g) s) t $q$),
  ('semistandard_tableaux','glyph_svg dispatches to the SSYT grid renderer','eq','true','glyph_svg(t) == semistandard_tableau_grid_svg((t).entries, (t).shape)',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,1,2], ARRAY[2,1])::semistandard_tableau) = semistandard_tableau_grid_svg(ARRAY[1,1,2], ARRAY[2,1]))::text $q$),
  ('semistandard_tableaux','carrier_renders_svg is now true for semistandard_tableau','eq','true','glyph_svg overload derives the flag automatically',$q$
    SELECT carrier_renders_svg('semistandard_tableau')::text $q$);
