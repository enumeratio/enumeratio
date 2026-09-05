-- requires: signed_permutations, glyphs
-- Signed permutation matrix glyph (issue #145's carrier bald-spot): the hyperoctahedral group B_n had zero glyph_svg.
-- Same n×n grid convention as permutation_matrix_svg, one mark per row i at column |image[i]|, but — like the ASM
-- glyph — a mark can carry a SIGN: a FILLED dot for a positive entry, a HOLLOW ring (same radius, no fill, thicker
-- stroke) for a negative one. image[i] already carries both the column (|image[i]|) and the sign (sign(image[i])),
-- so unlike the ASM carrier there's no separate 0-cell case — every row has exactly one mark.
--
-- No base_glyph registry row on purpose (the composition/standard_tableau precedent in glyphs.sql): the overload
-- alone is enough, carrier_renders_svg('signed_permutation') derives straight from pg_proc/pg_type.

CREATE FUNCTION signed_permutation_matrix_svg(image int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(image, 1), 0)) AS n),
  pts AS (SELECT o AS row, abs(val) AS col, sign(val) AS sgn FROM unnest(image) WITH ORDINALITY AS t(val, o)),
  geo AS (SELECT n * unit AS w FROM dim)
  -- args: 1=w+2 (viewBox, square) · 2=grid cells (n² light borders) · 3=+ dots (filled) · 4=− dots (hollow ring)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %1$s" role="img" aria-label="signed permutation matrix">%2$s%3$s%4$s</svg>',
    (SELECT w FROM geo) + 2,
    (SELECT string_agg(format(
      '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>',
      (c - 1) * unit, (r - 1) * unit, unit, unit), '' ORDER BY r, c)
     FROM dim, LATERAL generate_series(1, n) r, LATERAL generate_series(1, n) c),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-accent,#d97706)"/>',
      trim_scale(round((col - 0.5) * unit, 2)), trim_scale(round((row - 0.5) * unit, 2)), round(unit * 0.32, 2)), '' ORDER BY row)
     FROM pts WHERE sgn > 0), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="2"/>',
      trim_scale(round((col - 0.5) * unit, 2)), trim_scale(round((row - 0.5) * unit, 2)), round(unit * 0.32, 2)), '' ORDER BY row)
     FROM pts WHERE sgn < 0), ''));
$$;
CREATE FUNCTION glyph_svg(sp signed_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT signed_permutation_matrix_svg((sp).image) $$;

-- Assert the GEOMETRY (grid size, mark kind/count/position), same discipline as permutation_glyph.sql and
-- alternating_sign_matrix_glyph.sql. signed_permutations(3) rank 0 = 1,2,3 (identity, all positive); n=2 rank 1 =
-- -1,2 (one sign flip) — both pinned by signed_permutations.sql's own order examples.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg(signed_permutation) emits a self-contained svg','eq','<svg…</svg>','pg renders the render payload for the signed_permutation carrier',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(signed_permutations(3),0)).value) g) s $q$),
  ('glyphs','signed-permutation-matrix viewBox is n×n square (n=3, unit 22)','eq','-1 -1 68 68','3*22+2, square, same convention as the permutation matrix glyph',$q$
    SELECT substring(glyph_svg((unrank(signed_permutations(3),0)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','signed permutation matrix grid has n² border cells (n=3), independent of the marks','eq','9','one light rect per cell, blank or not',$q$
    SELECT (length(g) - length(replace(g, '<rect', '')))/5 FROM (SELECT signed_permutation_matrix_svg(ARRAY[1,2,3]) g) s $q$),
  ('glyphs','identity (all positive): n filled dots on the diagonal, zero hollow','eq','3|0','signed_permutations(3) rank 0 = 1,2,3',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-accent', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'stroke-width="2"', 'g'))
    FROM (SELECT glyph_svg((unrank(signed_permutations(3),0)).value) g) s $q$),
  ('glyphs','a single sign flip: one filled dot, one hollow ring','eq','1|1','signed_permutations(2) rank 1 = -1,2 (position 1 negated)',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-accent', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'stroke-width="2"', 'g'))
    FROM (SELECT glyph_svg((unrank(signed_permutations(2),1)).value) g) s $q$),
  ('glyphs','the hollow mark sits at row 1, col 1 (unit 22) for -1,2','eq','11,11','(col-0.5)*unit,(row-0.5)*unit at row=col=1',$q$
    SELECT substring(m[1] FROM 'cx="([0-9.]+)"') || ',' || substring(m[1] FROM 'cy="([0-9.]+)"')
    FROM (SELECT regexp_matches(glyph_svg((unrank(signed_permutations(2),1)).value), '<circle[^/]*stroke-width="2"[^/]*/>', 'g') m) s $q$),
  ('glyphs','glyph_svg dispatches signed_permutation to signed_permutation_matrix_svg','eq','true','carrier→helper wiring, same pattern as permutation/ASM',$q$
    SELECT (glyph_svg(ROW(ARRAY[-2,3,1])::signed_permutation) = signed_permutation_matrix_svg(ARRAY[-2,3,1]))::text $q$),
  ('glyphs','carrier_renders_svg is now true for the signed_permutation carrier','eq','t','glyph_svg overloaded on signed_permutation — issue #145',$q$
    SELECT left(carrier_renders_svg('signed_permutation')::text, 1) $q$);
