-- requires: permutations, glyphs
-- Permutation matrix glyph (issue #145): the permutation carrier had zero glyph_svg — the highest-value bald spot,
-- ~24 collections inherit it. The classic picture: an n×n grid, one filled dot per row i at column image[i].
-- Follows glyphs.sql's dim/geo CTE shape and cells_svg's grid-of-cells styling (border stroke, accent fill).

CREATE FUNCTION permutation_matrix_svg(image int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(image, 1), 0)) AS n),
  pts AS (SELECT o AS row, val AS col FROM unnest(image) WITH ORDINALITY AS t(val, o)),
  geo AS (SELECT n * unit AS w FROM dim)
  -- args: 1=w+2 (viewBox, square) · 2=grid cells (n² light borders) · 3=dots (one per row, at (row, image[row]))
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %1$s" role="img" aria-label="permutation matrix">%2$s%3$s</svg>',
    (SELECT w FROM geo) + 2,
    (SELECT string_agg(format(
      '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>',
      (c - 1) * unit, (r - 1) * unit, unit, unit), '' ORDER BY r, c)
     FROM dim, LATERAL generate_series(1, n) r, LATERAL generate_series(1, n) c),
    (SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-accent,#d97706)"/>',
      trim_scale(round((col - 0.5) * unit, 2)), trim_scale(round((row - 0.5) * unit, 2)), round(unit * 0.32, 2)), '' ORDER BY row)
     FROM pts));
$$;
CREATE FUNCTION glyph_svg(p permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT permutation_matrix_svg((p).image) $$;

-- Assert the GEOMETRY (grid size, dot count/positions), not the styling — mirrors glyphs.sql's own examples.
-- permutations(3) rank 0 = identity 123 (image {1,2,3}); rank 1 = 132 (image {1,3,2}) as the non-identity case.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg(permutation) emits a self-contained svg','eq','<svg…</svg>','pg renders the render payload for the permutation carrier',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(permutations(3),0)).value) g) s $q$),
  ('glyphs','permutation-matrix viewBox is n×n square (n=3, unit 22)','eq','-1 -1 68 68','3*22+2, square',$q$
    SELECT substring(glyph_svg((unrank(permutations(3),0)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','permutation matrix has exactly n dots (identity 123, non-identity 132)','eq','3|3','one filled cell per row, regardless of arrangement',$q$
    SELECT (length(a) - length(replace(a, '<circle', '')))/7 || '|' || (length(b) - length(replace(b, '<circle', '')))/7
    FROM (SELECT glyph_svg((unrank(permutations(3),0)).value) a, glyph_svg((unrank(permutations(3),1)).value) b) s $q$),
  ('glyphs','identity places every dot on the diagonal (row i ↦ col i)','eq','11,11 33,33 55,55','122 ↦ (0.5,1.5,2.5)*22 on both axes',$q$
    SELECT string_agg(format('%s,%s', substring(m[1] FROM 'cx="([0-9.]+)"'), substring(m[1] FROM 'cy="([0-9.]+)"')), ' ')
    FROM (SELECT regexp_matches(glyph_svg((unrank(permutations(3),0)).value), '<circle[^/]+/>', 'g') m) s $q$),
  ('glyphs','132 (image {1,3,2}) places row 2''s dot at column 3, row 3''s at column 2','eq','11,11 55,33 33,55','off-diagonal rows track image[row]',$q$
    SELECT string_agg(format('%s,%s', substring(m[1] FROM 'cx="([0-9.]+)"'), substring(m[1] FROM 'cy="([0-9.]+)"')), ' ')
    FROM (SELECT regexp_matches(glyph_svg((unrank(permutations(3),1)).value), '<circle[^/]+/>', 'g') m) s $q$),
  ('glyphs','permutation_matrix_svg grid has n² border cells (n=3)','eq','9','one light rect per cell, independent of the dots',$q$
    SELECT (length(g) - length(replace(g, '<rect', '')))/5 FROM (SELECT permutation_matrix_svg(ARRAY[1,3,2]) g) s $q$),
  ('glyphs','glyph_svg dispatches to permutation_matrix_svg','eq','true','polymorphism check, same shape as the ferrers/cells dispatch test',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,3,1])::permutation) = permutation_matrix_svg(ARRAY[2,3,1]))::text $q$),
  ('glyphs','carrier_renders_svg is now true for the permutation carrier','eq','t','glyph_svg overloaded on permutation — issue #145',$q$
    SELECT left(carrier_renders_svg('permutation')::text, 1) $q$);
