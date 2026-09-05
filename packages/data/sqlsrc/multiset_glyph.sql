-- requires: multisets, glyphs
-- multiset_glyph — the page-space glyph for the multiset carrier (issue #222 glyph batch): DOT COLUMNS — one
-- column per ground element 1..n, a stack of dots (bottom-up) whose height IS that element's multiplicity in the
-- multiset. A tally-mark picture: reading the column heights left to right reads off the multiset's histogram
-- directly, and an absent element (multiplicity 0) is simply an empty column above the baseline.
CREATE FUNCTION multiset_columns_svg(elements int[], n int, unit numeric DEFAULT 22, dot_r numeric DEFAULT 5, dot_gap numeric DEFAULT 12)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(n, 0)) AS nn),
  counts AS (SELECT k, (SELECT count(*) FROM unnest(elements) e WHERE e = k) AS c FROM dim, LATERAL generate_series(1, nn) k),
  maxc AS (SELECT greatest(1, coalesce((SELECT max(c) FROM counts), 0)) AS m),
  dots AS (SELECT k, idx FROM counts, LATERAL generate_series(1, c) idx)
  -- args: 1=w+2 2=h+2 (viewBox) · 3=baseline · 4=one bordered column per ground element · 5=dots, stacked bottom-up
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="multiset dot columns">%s%s%s</svg>',
    trim_scale(round((SELECT nn FROM dim) * unit + 2, 2)), trim_scale(round((SELECT m FROM maxc) * dot_gap + 2, 2)),
    format('<line x1="0" y1="%1$s" x2="%2$s" y2="%1$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.5"/>',
      trim_scale(round((SELECT m FROM maxc) * dot_gap, 2)), trim_scale(round((SELECT nn FROM dim) * unit, 2))),
    (SELECT string_agg(format(
      '<rect x="%1$s" y="0" width="%2$s" height="%3$s" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.3"/>',
      trim_scale(round((k - 1) * unit, 2)), trim_scale(round(unit, 2)), trim_scale(round((SELECT m FROM maxc) * dot_gap, 2))
    ), '' ORDER BY k) FROM dim, LATERAL generate_series(1, nn) k),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-accent,#d97706)"/>',
      trim_scale(round((k - 0.5) * unit, 2)), trim_scale(round((SELECT m FROM maxc) * dot_gap - (idx - 0.5) * dot_gap, 2)), trim_scale(round(dot_r, 2))
    ), '' ORDER BY k, idx) FROM dots), ''));
$$;
CREATE FUNCTION glyph_svg(m multiset) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT multiset_columns_svg((m).elements, (m).n) $$;

-- Assert the GEOMETRY (column count, per-column dot count == multiplicity), not the styling.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a multiset','eq','<svg…</svg>','{1,1,2} over n=3',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[1,1,2],3)::multiset) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the multiset carrier','eq','true','glyph_svg(multiset) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('multiset')::text $q$),
  ('glyphs','row viewBox tracks n, independent of multiplicities (n=3, unit 22)','eq','-1 -1 68 26','3*22+2; height = maxc(2)*dot_gap(12)+2',$q$
    SELECT substring(glyph_svg(ROW(ARRAY[1,1,2],3)::multiset) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','{1,1,2} over n=3 draws 3 columns, 3 dots total (2 in column 1, 1 in column 2, 0 in column 3)','eq','3|3','one <rect> per ground element',$q$
    SELECT (length(g) - length(replace(g, '<rect', '')))/5
        || '|' || (length(g) - length(replace(g, '<circle', '')))/7
    FROM (SELECT glyph_svg(ROW(ARRAY[1,1,2],3)::multiset) g) s $q$),
  ('glyphs','the empty multiset draws n blank columns, no dots','eq','3|0','{} over n=3',$q$
    SELECT (length(g) - length(replace(g, '<rect', '')))/5
        || '|' || (length(g) - length(replace(g, '<circle', '')))/7
    FROM (SELECT glyph_svg(ROW(ARRAY[]::int[],3)::multiset) g) s $q$),
  ('glyphs','glyph_svg dispatches multiset to multiset_columns_svg','eq','true','carrier→helper wiring, same pattern as the other carriers',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,2,2],3)::multiset) = multiset_columns_svg(ARRAY[2,2,2],3))::text $q$),
  ('glyphs','glyph_svg renders a real multisets() element','eq','<svg…</svg>','multisets(3,2), rank 0',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(multisets(3,2),0)).value) g) s $q$);
