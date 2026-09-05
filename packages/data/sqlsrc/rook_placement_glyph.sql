-- requires: rook_placements, glyphs
-- rook_placement_glyph — the page-space glyph for the rook_placement carrier (issue #190): the same n×n grid
-- picture as permutation_matrix_svg (permutation_glyph.sql), generalized two ways for the partial-injection carrier
-- cols[i]=column of row i's rook, 0=empty (rook_placements.sql): (1) a row with cols[i]=0 draws NO dot — the board
-- can be sparser than a full permutation — and (2) columns are not required to be distinct, so (unlike the
-- permutation matrix) two dots CAN legitimately share a column at different rows, same non-bijective spirit as
-- parking_function_matrix_svg's contention picture. n = the board side = array_length(cols,1).
CREATE FUNCTION rook_placement_grid_svg(cols int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(cols, 1), 0)) AS n),
  pts AS (SELECT o AS row, val AS col FROM unnest(cols) WITH ORDINALITY AS t(val, o) WHERE val <> 0),  -- skip empty rows
  geo AS (SELECT n * unit AS w FROM dim)
  -- args: 1=w+2 (viewBox, square) · 2=grid cells (n² light borders) · 3=dots (one per OCCUPIED row, at (row, cols[row]))
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %1$s" role="img" aria-label="rook placement board">%2$s%3$s</svg>',
    trim_scale(round((SELECT w FROM geo) + 2, 2)),
    (SELECT string_agg(format(
      '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>',
      trim_scale(round((c - 1) * unit, 2)), trim_scale(round((r - 1) * unit, 2)), trim_scale(round(unit, 2)), trim_scale(round(unit, 2))
    ), '' ORDER BY r, c)
     FROM dim, LATERAL generate_series(1, n) r, LATERAL generate_series(1, n) c),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-accent,#d97706)"/>',
      trim_scale(round((col - 0.5) * unit, 2)), trim_scale(round((row - 0.5) * unit, 2)), trim_scale(round(unit * 0.32, 2))
    ), '' ORDER BY row) FROM pts), '')
  );
$$;
CREATE FUNCTION glyph_svg(p rook_placement) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT rook_placement_grid_svg((p).cols) $$;

-- Assert the GEOMETRY (grid size, dot count/positions, empty-row/shared-column handling), not the styling —
-- mirrors permutation_glyph.sql / parking_function_glyph.sql's own examples.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a rook_placement','eq','<svg…</svg>','rook_placements(3) rank 3 = 0,0,3',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(rook_placements(3),3)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the rook_placement carrier','eq','true','glyph_svg(rook_placement) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('rook_placement')::text $q$),
  ('glyphs','board viewBox is n×n square (n=3, unit 22)','eq','-1 -1 68 68','3*22+2, square — same grid geometry as the permutation glyph',$q$
    SELECT substring(glyph_svg((unrank(rook_placements(3),3)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','all-empty placement (0,0,0) draws the grid but zero dots','eq','9|0','rank 0 of R(3): every row empty',$q$
    SELECT (length(g) - length(replace(g, '<rect', '')))/5 || '|' || (length(g) - length(replace(g, '<circle', '')))/7
    FROM (SELECT glyph_svg((unrank(rook_placements(3),0)).value) g) s $q$),
  ('glyphs','one rook, two empty rows (0,0,3): a single dot at row 3, column 3','eq','1|55,55','rank 3 of R(3), anchors the DP stride',$q$
    SELECT (SELECT (length(g) - length(replace(g, '<circle', '')))/7 FROM (SELECT glyph_svg((unrank(rook_placements(3),3)).value) g) t)::text || '|' ||
           (SELECT string_agg(format('%s,%s', substring(m[1] FROM 'cx="([0-9.]+)"'), substring(m[1] FROM 'cy="([0-9.]+)"')), ' ')
              FROM (SELECT regexp_matches(glyph_svg((unrank(rook_placements(3),3)).value), '<circle[^/]+/>', 'g') m) s) $q$),
  ('glyphs','full placement (3,2,1) draws n dots, one per row, off the diagonal','eq','55,11 33,33 11,55','rank 33 (last) of R(3), the reverse full permutation',$q$
    SELECT string_agg(format('%s,%s', substring(m[1] FROM 'cx="([0-9.]+)"'), substring(m[1] FROM 'cy="([0-9.]+)"')), ' ')
    FROM (SELECT regexp_matches(glyph_svg((unrank(rook_placements(3),33)).value), '<circle[^/]+/>', 'g') m) s $q$),
  ('glyphs','shared column (2,2,0): two dots stack in column 2 at distinct rows, row 3 empty','eq','33,11 33,33','non-bijective — unlike the permutation matrix, columns need not be distinct',$q$
    SELECT string_agg(format('%s,%s', substring(m[1] FROM 'cx="([0-9.]+)"'), substring(m[1] FROM 'cy="([0-9.]+)"')), ' ')
    FROM (SELECT regexp_matches(glyph_svg(ROW(ARRAY[2,2,0])::rook_placement), '<circle[^/]+/>', 'g') m) s $q$),
  ('glyphs','rook_placement_grid_svg on the empty board (n=0) collapses to a 1×1 grid, no dots','eq','-1 -1 24 24|1|0','greatest(1,·) keeps the viewBox non-degenerate — same convention as permutation/parking_function glyphs',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || ((length(g) - length(replace(g, '<rect', '')))/5)::text || '|' ||
           ((length(g) - length(replace(g, '<circle', '')))/7)::text
    FROM (SELECT rook_placement_grid_svg(ARRAY[]::int[]) g) s $q$),
  ('glyphs','glyph_svg dispatches rook_placement to rook_placement_grid_svg','eq','true','carrier→helper wiring, same pattern as permutation/parking_function',$q$
    SELECT (glyph_svg(ROW(ARRAY[0,3,1])::rook_placement) = rook_placement_grid_svg(ARRAY[0,3,1]))::text $q$);
