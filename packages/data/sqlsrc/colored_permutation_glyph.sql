-- requires: k_colored_permutations, glyphs
-- colored_permutation_glyph (issue #145 glyph bald spot): the wreath-product carrier ℤ_k ≀ S_n had zero glyph_svg.
-- Same n×n permutation-matrix picture as permutation_glyph.sql (one filled dot per row i at column image[i]), but
-- each dot is TINTED by that position's colour — the SQL twin of pairing permutation_matrix_svg's geometry with
-- word_glyph's colour-ramp idea.
--
-- Color scheme: like word_glyph, a MONOCHROME RAMP on --enumeratio-accent, tinted by each position's colour within
-- the value's own observed range [0, max(colors)] — colour 0 renders faintest, the highest colour present strongest,
-- everything between interpolates linearly. There's no true colour COUNT (k) to read off a bare value (only the
-- fiber carries k — see k_colored_permutations.sql), so — exactly as word_glyph reasons for its letter alphabet —
-- we scale to what's actually IN the value rather than guessing a fixed k-size palette. A monochrome value (every
-- colour equal, e.g. all-0) collapses to one flat tint, the correct degenerate case. Unlike word_glyph's flat cells,
-- each dot ALSO gets a thin border stroke (the grid's own border color) so it stays legible even at the faintest
-- tint, where a borderless circle would nearly vanish against the page background.
CREATE FUNCTION colored_permutation_matrix_svg(image int[], colors int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(image, 1), 0)) AS n),
  pts AS (SELECT o AS row, val AS col, colors[o] AS color FROM unnest(image) WITH ORDINALITY AS t(val, o)),
  mx AS (SELECT greatest(1, coalesce(max(color), 0)) AS maxcolor FROM pts),
  geo AS (SELECT n * unit AS w FROM dim)
  -- args: 1=w+2 (viewBox, square) · 2=grid cells (n² light borders) · 3=dots (one per row, at (row, image[row]), tinted by color)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %1$s" role="img" aria-label="colored permutation matrix">%2$s%3$s</svg>',
    (SELECT w FROM geo) + 2,
    (SELECT string_agg(format(
      '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>',
      (c - 1) * unit, (r - 1) * unit, unit, unit), '' ORDER BY r, c)
     FROM dim, LATERAL generate_series(1, n) r, LATERAL generate_series(1, n) c),
    (SELECT string_agg(format(
      '<circle cx="%1$s" cy="%2$s" r="%3$s" fill="%4$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1"/>',
      trim_scale(round((col - 0.5) * unit, 2)), trim_scale(round((row - 0.5) * unit, 2)), round(unit * 0.32, 2),
      format('color-mix(in srgb, var(--enumeratio-accent,#d97706) %s%%, transparent)',
             trim_scale(round(30 + 60.0 * color / maxcolor, 2)))
    ), '' ORDER BY row) FROM pts, mx));
$$;
CREATE FUNCTION glyph_svg(cp colored_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT colored_permutation_matrix_svg((cp).image, (cp).colors) $$;

-- Assert the GEOMETRY (grid size, dot count/positions, colour-tint distinctness) — mirrors permutation_glyph.sql
-- and word_glyph.sql's own examples, not the styling.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg(colored_permutation) emits a self-contained svg','eq','<svg…</svg>','pg renders the render payload for the wreath-product carrier',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[1,2,3],ARRAY[0,1,2])::colored_permutation) g) s $q$),
  ('glyphs','colored-permutation-matrix viewBox is n×n square (n=3, unit 22)','eq','-1 -1 68 68','3*22+2, square — same grid geometry as the plain permutation glyph',$q$
    SELECT substring(glyph_svg(ROW(ARRAY[1,2,3],ARRAY[0,1,2])::colored_permutation) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','colored permutation matrix has exactly n dots, regardless of colouring','eq','3|3','one filled cell per row',$q$
    SELECT (length(a) - length(replace(a, '<circle', '')))/7 || '|' || (length(b) - length(replace(b, '<circle', '')))/7
    FROM (SELECT glyph_svg(ROW(ARRAY[1,2,3],ARRAY[0,1,2])::colored_permutation) a,
                 glyph_svg(ROW(ARRAY[1,2,3],ARRAY[0,0,0])::colored_permutation) b) s $q$),
  ('glyphs','distinct colours (0,1,2) get distinct tints','eq','3','three dots, three different color-mix percentages',$q$
    SELECT count(DISTINCT m[1])::text FROM (SELECT regexp_matches(g, 'color-mix\(in srgb, var\(--enumeratio-accent,#d97706\) ([0-9.]+)%', 'g') m
      FROM (SELECT glyph_svg(ROW(ARRAY[1,2,3],ARRAY[0,1,2])::colored_permutation) g) s) t $q$),
  ('glyphs','a monochrome value (every colour equal) collapses to one flat tint','eq','1','degenerate case — max colour = the only value present, so every dot gets the same pct',$q$
    SELECT count(DISTINCT m[1])::text FROM (SELECT regexp_matches(g, 'color-mix\(in srgb, var\(--enumeratio-accent,#d97706\) ([0-9.]+)%', 'g') m
      FROM (SELECT glyph_svg(ROW(ARRAY[1,2,3],ARRAY[2,2,2])::colored_permutation) g) s) t $q$),
  ('glyphs','132-shaped image still places dots off-diagonal, independent of colour','eq','11,11 55,33 33,55','same row/col geometry as the plain permutation matrix; colours ride along',$q$
    SELECT string_agg(format('%s,%s', substring(m[1] FROM 'cx="([0-9.]+)"'), substring(m[1] FROM 'cy="([0-9.]+)"')), ' ')
    FROM (SELECT regexp_matches(glyph_svg(ROW(ARRAY[1,3,2],ARRAY[0,1,2])::colored_permutation), '<circle[^/]+/>', 'g') m) s $q$),
  ('glyphs','glyph_svg dispatches to colored_permutation_matrix_svg','eq','true','polymorphism check, same shape as the permutation/word dispatch tests',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,3,1],ARRAY[0,1,0])::colored_permutation) = colored_permutation_matrix_svg(ARRAY[2,3,1],ARRAY[0,1,0]))::text $q$),
  ('glyphs','carrier_renders_svg is now true for the colored_permutation carrier','eq','t','glyph_svg overloaded on colored_permutation — issue #145',$q$
    SELECT left(carrier_renders_svg('colored_permutation')::text, 1) $q$);
