-- requires: alternating_sign_matrices, glyphs
-- alternating_sign_matrix glyph (issue #145's carrier bald-spot): the n×n grid, same light-bordered-cell convention
-- as permutation_matrix_svg, but a cell can carry one of TWO distinct marks instead of one — a FILLED dot for +1, a
-- HOLLOW ring (same radius, no fill, thicker stroke) for −1 — while 0-cells stay blank. matrix is the flattened
-- row-major carrier (see alternating_sign_matrices.sql); n = √length, cell (r,c) 1-based ↦ flat position
-- (r-1)*n+c — the same indexing notation() already uses.
--
-- No base_glyph registry row on purpose (the composition/standard_tableau precedent in glyphs.sql): that table
-- feeds the `glyphs` meta-collection's floor (distinct `kind`s) and its own examples are pinned to a fixed count —
-- the overload alone is enough, carrier_renders_svg('alternating_sign_matrix') derives straight from pg_proc/pg_type.

CREATE FUNCTION alternating_sign_matrix_svg(matrix int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT floor(sqrt(coalesce(array_length(matrix, 1), 0)))::int AS n),
  cells AS (
    SELECT r, c, matrix[(r - 1) * n + c] AS v
    FROM dim, LATERAL generate_series(1, n) r, LATERAL generate_series(1, n) c
  ),
  geo AS (SELECT greatest(1, n) * unit AS w FROM dim)
  -- args: 1=w+2 (viewBox, square) · 2=grid cells (n² light borders) · 3=+1 dots (filled) · 4=−1 dots (hollow ring)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %1$s" role="img" aria-label="alternating sign matrix">%2$s%3$s%4$s</svg>',
    (SELECT w FROM geo) + 2,
    (SELECT string_agg(format(
      '<rect x="%s" y="%s" width="%s" height="%s" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>',
      (c - 1) * unit, (r - 1) * unit, unit, unit), '' ORDER BY r, c)
     FROM cells),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-accent,#10b981)"/>',
      trim_scale(round((c - 0.5) * unit, 2)), trim_scale(round((r - 0.5) * unit, 2)), round(unit * 0.32, 2)), '' ORDER BY r, c)
     FROM cells WHERE v = 1), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="var(--enumeratio-accent,#10b981)" stroke-width="2"/>',
      trim_scale(round((c - 0.5) * unit, 2)), trim_scale(round((r - 0.5) * unit, 2)), round(unit * 0.32, 2)), '' ORDER BY r, c)
     FROM cells WHERE v = -1), ''));
$$;
CREATE FUNCTION glyph_svg(a alternating_sign_matrix) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT alternating_sign_matrix_svg((a).matrix) $$;

-- Assert the GEOMETRY (grid size, dot kind + count), same discipline as permutation_glyph.sql. Two literal ASMs
-- built directly (ROW(...)::alternating_sign_matrix) rather than via unrank — fiber_elements enumerates in flat
-- lexicographic order, which puts neither canonical example at a convenient rank.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg(alternating_sign_matrix) emits a self-contained svg','eq','<svg…</svg>','the identity permutation matrix, read as a 3×3 ASM (no −1s)',$q$
    SELECT left(g,4) || '…' || right(g,6)
    FROM (SELECT glyph_svg(ROW(ARRAY[1,0,0,0,1,0,0,0,1])::alternating_sign_matrix) g) s $q$),
  ('glyphs','ASM grid viewBox is n×n square (n=3, unit 22)','eq','-1 -1 68 68','same grid convention as the permutation matrix glyph',$q$
    SELECT substring(glyph_svg(ROW(ARRAY[1,0,0,0,1,0,0,0,1])::alternating_sign_matrix) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','ASM grid has n² border cells (n=3), independent of the marks','eq','9','one light rect per cell, blank or not',$q$
    SELECT (length(g) - length(replace(g, '<rect', '')))/5
    FROM (SELECT alternating_sign_matrix_svg(ARRAY[1,0,0,0,1,0,0,0,1]) g) s $q$),
  ('glyphs','identity ASM: n filled +1 dots, zero hollow −1 dots','eq','3|0','a permutation matrix has no −1 entries',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-accent', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'stroke-width="2"', 'g'))
    FROM (SELECT glyph_svg(ROW(ARRAY[1,0,0,0,1,0,0,0,1])::alternating_sign_matrix) g) s $q$),
  ('glyphs','the unique 3×3 ASM with a −1: four filled dots (+1) and one hollow dot (−1) at the center','eq','4|1','0,1,0/1,-1,1/0,1,0 — row/col sums still all 1',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-accent', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'stroke-width="2"', 'g'))
    FROM (SELECT glyph_svg(ROW(ARRAY[0,1,0,1,-1,1,0,1,0])::alternating_sign_matrix) g) s $q$),
  ('glyphs','the −1 mark sits at the matrix center (row 2, col 2 of 3, unit 22)','eq','33,33','(c-0.5)*unit, (r-0.5)*unit at r=c=2',$q$
    SELECT substring(m[1] FROM 'cx="([0-9.]+)"') || ',' || substring(m[1] FROM 'cy="([0-9.]+)"')
    FROM (SELECT regexp_matches(glyph_svg(ROW(ARRAY[0,1,0,1,-1,1,0,1,0])::alternating_sign_matrix), '<circle[^/]*stroke-width="2"[^/]*/>', 'g') m) s $q$),
  ('glyphs','glyph_svg dispatches alternating_sign_matrix to alternating_sign_matrix_svg','eq','true','carrier→helper wiring, same pattern as ferrers/cells/permutation',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,0,0,0,1,0,0,0,1])::alternating_sign_matrix)
          = alternating_sign_matrix_svg(ARRAY[1,0,0,0,1,0,0,0,1]))::text $q$),
  ('glyphs','carrier_renders_svg is now true for the alternating_sign_matrix carrier','eq','true','glyph_svg overload alone lights this up — no base_glyph row (composition/standard_tableau precedent)',$q$
    SELECT carrier_renders_svg('alternating_sign_matrix')::text $q$);
