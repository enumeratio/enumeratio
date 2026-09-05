-- requires: signed_subsets, glyphs
-- signed_subset_glyph — the page-space glyph for the signed_subset carrier (issue #222 glyph batch): a SIGNED BAR
-- ROW — n bordered cells (cells_svg's row convention), one per axis 1..n, each marked with a FILLED dot for a
-- present +k, a HOLLOW ring for a present −k (the signed_permutation_glyph.sql filled/hollow idiom), and left
-- blank for an absent axis. Reading the row left-to-right IS reading off the cross-polytope vertex/face
-- coordinates: a signed subset of {1..n} names, per axis, absent / +k / −k (see signed_subsets.sql).
CREATE FUNCTION signed_subset_row_svg(coords int[], n int, unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(n, 0)) AS nn),
  pos AS (SELECT c AS v, abs(c) AS k FROM unnest(coords) c)
  -- args: 1=w+2 2=unit+2 (viewBox) · 3=n bordered cells · 4=filled dots (present +k) · 5=hollow rings (present −k)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="signed subset row">%s%s%s</svg>',
    trim_scale(round((SELECT nn FROM dim) * unit + 2, 2)), trim_scale(round(unit + 2, 2)),
    (SELECT string_agg(format(
      '<rect x="%1$s" y="0" width="%2$s" height="%2$s" rx="2" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1"/>',
      trim_scale(round((k - 1) * unit, 2)), trim_scale(round(unit, 2))
    ), '' ORDER BY k) FROM dim, LATERAL generate_series(1, nn) k),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-accent,#d97706)"/>',
      trim_scale(round((k - 0.5) * unit, 2)), trim_scale(round(unit / 2, 2)), trim_scale(round(unit * 0.32, 2))
    ), '' ORDER BY k) FROM pos WHERE v > 0), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="2"/>',
      trim_scale(round((k - 0.5) * unit, 2)), trim_scale(round(unit / 2, 2)), trim_scale(round(unit * 0.32, 2))
    ), '' ORDER BY k) FROM pos WHERE v < 0), ''));
$$;
CREATE FUNCTION glyph_svg(s signed_subset) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT signed_subset_row_svg((s).coords, (s).n) $$;

-- Assert the GEOMETRY (cell count, filled/hollow mark placement), not the styling.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a signed_subset','eq','<svg…</svg>','{1,-3} over n=3',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[1,-3],3)::signed_subset) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the signed_subset carrier','eq','true','glyph_svg(signed_subset) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('signed_subset')::text $q$),
  ('glyphs','row viewBox tracks n (n=3, unit 22), independent of how many coords are present','eq','-1 -1 68 24','3*22+2, unit+2 — same convention as cells_svg',$q$
    SELECT substring(glyph_svg(ROW(ARRAY[1,-3],3)::signed_subset) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','{1,-3} over n=3 draws 3 empty cells, 1 filled dot (+1), 1 hollow ring (-3)','eq','3|1|1','one <rect> per axis, dots split by sign',$q$
    SELECT (length(g) - length(replace(g, '<rect', '')))/5
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-accent', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'fill="none" stroke="var\(--enumeratio-accent', 'g'))
    FROM (SELECT glyph_svg(ROW(ARRAY[1,-3],3)::signed_subset) g) s $q$),
  ('glyphs','the empty signed subset (the polytope body) draws n blank cells, no marks','eq','3|0|0','{} over n=3: every axis absent',$q$
    SELECT (length(g) - length(replace(g, '<rect', '')))/5
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-accent', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'fill="none" stroke="var\(--enumeratio-accent', 'g'))
    FROM (SELECT glyph_svg(ROW(ARRAY[]::int[],3)::signed_subset) g) s $q$),
  ('glyphs','glyph_svg dispatches signed_subset to signed_subset_row_svg','eq','true','carrier→helper wiring, same pattern as the other carriers',$q$
    SELECT (glyph_svg(ROW(ARRAY[-2],3)::signed_subset) = signed_subset_row_svg(ARRAY[-2],3))::text $q$),
  ('glyphs','glyph_svg renders a real signed_subsets() element','eq','<svg…</svg>','signed_subsets(2), rank 0 = {}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(signed_subsets(2),0)).value) g) s $q$);
