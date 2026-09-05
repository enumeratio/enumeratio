-- requires: surjections, glyphs
-- surjection_glyph — the page-space glyph for the surjection carrier (issue #222 glyph batch): a TWO-ROW BIPARTITE
-- diagram — n domain points on a top row (1..n = length of the word), k codomain points on a bottom row
-- (1..k = max(values), the block count), one connecting line per domain point i down to values[i]. Every
-- codomain point is guaranteed hit (that's the surjectivity), which reads directly off the picture: no bottom dot
-- is ever left without an incoming line.
CREATE FUNCTION surjection_bipartite_svg(word int[], unit numeric DEFAULT 22, gap numeric DEFAULT 50, r numeric DEFAULT 3.5)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dom AS (SELECT o AS i, (o - 1) * unit AS x, val AS k FROM unnest(word) WITH ORDINALITY AS t(val, o)),
  dim AS (SELECT greatest(1, coalesce(array_length(word, 1), 0)) AS n,
                 greatest(1, coalesce((SELECT max(k) FROM dom), 0)) AS kk),
  cod AS (SELECT j, (j - 1) * unit AS x FROM dim, LATERAL generate_series(1, kk) j)
  -- args: 1,2=x0,y0 · 3,4=vw,vh (viewBox, padded by the point radius) · 5=connecting lines (domain i → values[i])
  -- · 6=domain row (top, y=0) · 7=codomain row (bottom, y=gap)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%1$s %2$s %3$s %4$s" role="img" aria-label="surjection bipartite diagram">%5$s%6$s%7$s</svg>',
    trim_scale(round(-(r + 1), 2)), trim_scale(round(-(r + 1), 2)),
    trim_scale(round(greatest((SELECT n FROM dim), (SELECT kk FROM dim)) * unit - unit + 2 * (r + 1), 2)),
    trim_scale(round(gap + 2 * (r + 1), 2)),
    coalesce((SELECT string_agg(format(
      '<line x1="%s" y1="0" x2="%s" y2="%s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.6"/>',
      trim_scale(round(x, 2)), trim_scale(round((k - 1) * unit, 2)), trim_scale(round(gap, 2))
    ), '' ORDER BY i) FROM dom), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="0" r="%s" fill="var(--enumeratio-accent,#d97706)"/>',
      trim_scale(round(x, 2)), trim_scale(round(r, 2))
    ), '' ORDER BY i) FROM dom), ''),
    (SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-text,currentColor)"/>',
      trim_scale(round(x, 2)), trim_scale(round(gap, 2)), trim_scale(round(r, 2))
    ), '' ORDER BY j) FROM cod));
$$;
CREATE FUNCTION glyph_svg(w surjection) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT surjection_bipartite_svg((w).values) $$;

-- Assert the GEOMETRY (row sizes, line count, every codomain point hit), not the styling.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a surjection','eq','<svg…</svg>','{1,2,1}: a surjection [3]↠[2]',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[1,2,1])::surjection) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the surjection carrier','eq','true','glyph_svg(surjection) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('surjection')::text $q$),
  ('glyphs','{1,2,1} draws 3 domain points, 2 codomain points, 3 connecting lines','eq','3|2|3','n=3 (word length), k=2 (max value)',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-accent', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-text', 'g'))
        || '|' || (length(g) - length(replace(g, '<line', '')))/5
    FROM (SELECT surjection_bipartite_svg(ARRAY[1,2,1]) g) s $q$),
  ('glyphs','every codomain point receives at least one line — surjectivity, read off the diagram','eq','true','k=3, every one of {1,2,3} appears in the word {2,1,3,2}',$q$
    SELECT (SELECT count(DISTINCT k) FROM unnest(ARRAY[2,1,3,2]) k) = 3 $q$),
  ('glyphs','glyph_svg dispatches surjection to surjection_bipartite_svg','eq','true','carrier→helper wiring, same pattern as the other carriers',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,2,1])::surjection) = surjection_bipartite_svg(ARRAY[1,2,1]))::text $q$),
  ('glyphs','glyph_svg renders a real surjections() element','eq','<svg…</svg>','surjections(3), rank 0',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(surjections(3),0)).value) g) s $q$);
