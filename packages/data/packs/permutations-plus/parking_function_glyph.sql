-- requires: parking_functions, glyphs
-- parking_function_glyph — the page-space glyph for the parking_function carrier (#145's glyph bald spot): an
-- n×n PREFERENCE GRID, the same picture as permutation_matrix_svg (permutation_glyph.sql) — one dot per row i at
-- column spots[i] — generalized to a non-bijective function [n]→[n]. Chosen over a bar/step strip because the grid
-- makes the defining feature of a parking function directly legible: several rows CAN share a column (multiple
-- cars preferring the same spot — the "contention" the parking condition has to survive) and a column can go
-- empty (a spot nobody prefers outright). A 1-D bar strip indexed by position would show the preference sequence
-- but hide exactly that structure. Note the grid depicts PREFERENCES (spots[i]), not the final parked assignment
-- after displacement — there's no collision in the picture itself since each row (car) is distinct.
-- layer: glyph
CREATE FUNCTION parking_function_matrix_svg(spots int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(spots, 1), 0)) AS n),
  pts AS (SELECT o AS row, val AS col FROM unnest(spots) WITH ORDINALITY AS t(val, o)),
  geo AS (SELECT n * unit AS w FROM dim)
  -- args: 1=w+2 (viewBox, square) · 2=grid cells (n² light borders) · 3=dots (one per row/car, at (row, spots[row]))
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %1$s" role="img" aria-label="parking function preference grid">%2$s%3$s</svg>',
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
CREATE FUNCTION glyph_svg(p parking_function) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT parking_function_matrix_svg((p).spots) $$;

-- Assert the GEOMETRY (grid size, dot count/positions, column contention/emptiness), not the styling — mirrors
-- permutation_glyph.sql's own examples. parking_functions(2) ranks 0,1,2 = {1,1},{1,2},{2,1} (see parking_functions.sql).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a parking_function','eq','<svg…</svg>','parking_functions(2) rank 0 = {1,1}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(parking_functions(2),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the parking_function carrier','eq','true','glyph_svg(parking_function) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('parking_function')::text $q$),
  ('glyphs','preference-grid viewBox is n×n square (n=2, unit 22)','eq','-1 -1 46 46','2*22+2, square — same grid geometry as the permutation glyph',$q$
    SELECT substring(glyph_svg((unrank(parking_functions(2),0)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','grid has exactly n dots, whether preferences collide or not','eq','2|2','one dot per car/row, regardless of shared columns',$q$
    SELECT (length(a) - length(replace(a, '<circle', '')))/7 || '|' || (length(b) - length(replace(b, '<circle', '')))/7
    FROM (SELECT glyph_svg((unrank(parking_functions(2),0)).value) a,   -- {1,1}: both cars prefer spot 1
                 glyph_svg((unrank(parking_functions(2),1)).value) b) s $q$),  -- {1,2}: distinct preferences
  ('glyphs','contention case {1,1}: both dots share column 1 (x=11) at distinct rows (y=11, y=33)','eq','11,11 11,33','two cars, one preferred spot',$q$
    SELECT string_agg(format('%s,%s', substring(m[1] FROM 'cx="([0-9.]+)"'), substring(m[1] FROM 'cy="([0-9.]+)"')), ' ')
    FROM (SELECT regexp_matches(glyph_svg((unrank(parking_functions(2),0)).value), '<circle[^/]+/>', 'g') m) s $q$),
  ('glyphs','empty-column case (n=3, spots {1,1,3}): dots skip column 2 entirely','eq','11,11 11,33 55,55','col1 has 2 dots, col3 has 1, col2 (x=33) has none',$q$
    SELECT string_agg(format('%s,%s', substring(m[1] FROM 'cx="([0-9.]+)"'), substring(m[1] FROM 'cy="([0-9.]+)"')), ' ')
    FROM (SELECT regexp_matches(glyph_svg(ROW(ARRAY[1,1,3])::parking_function), '<circle[^/]+/>', 'g') m) s $q$),
  ('glyphs','parking_function_matrix_svg grid has n² border cells, independent of the dots (n=3)','eq','9','one light rect per cell',$q$
    SELECT (length(g) - length(replace(g, '<rect', '')))/5 FROM (SELECT parking_function_matrix_svg(ARRAY[1,1,3]) g) s $q$),
  ('glyphs','parking_function_matrix_svg on the empty parking function (n=0) collapses to a 1×1 grid, no dots','eq','-1 -1 24 24|1|0','greatest(1,·) keeps the viewBox non-degenerate — same convention as permutation/word glyphs',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || ((length(g) - length(replace(g, '<rect', '')))/5)::text || '|' ||
           ((length(g) - length(replace(g, '<circle', '')))/7)::text
    FROM (SELECT parking_function_matrix_svg(ARRAY[]::int[]) g) s $q$),
  ('glyphs','glyph_svg dispatches parking_function to parking_function_matrix_svg','eq','true','carrier→helper wiring, same pattern as permutation/colored_permutation',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,3,1])::parking_function) = parking_function_matrix_svg(ARRAY[2,3,1]))::text $q$);
