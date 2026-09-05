-- requires: integer_compositions, glyphs
-- composition_glyph — the page-space glyph for the composition carrier (issue #145's carrier bald-spot): a bar
-- strip, one segment per part, each segment's WIDTH proportional to the part's value — a composition of n reads as
-- a divided bar of total width ∝ n, the same bar however the n parts are cut. Thin bordered segments (rx to match
-- ferrers_svg's box convention) double as the dividers between parts; no separate divider primitive needed.
--
-- No base_glyph registry row on purpose (the numeric/natural_number precedent in glyphs.sql): that table is a
-- curated prototype subset feeding the `glyphs` meta-collection's floor (distinct `kind`s), and its cardinality/
-- element examples are pinned to the current 3 kinds — adding a row here would silently grow that count. The
-- overload alone is enough: carrier_renders_svg('composition') derives straight from pg_proc/pg_type (see glyphs.sql).
CREATE FUNCTION composition_bar_svg(parts int[], unit numeric DEFAULT 18, height numeric DEFAULT 22)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH p AS (                                                 -- one row per part; x = cumulative offset (exclusive)
    SELECT o AS i, part,
           part * unit AS seg_w,
           coalesce(sum(part) OVER (ORDER BY o ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) * unit AS x
    FROM unnest(parts) WITH ORDINALITY AS t(part, o)
  ),
  dim AS (SELECT greatest(1, coalesce((SELECT sum(part) FROM p), 0)) * unit AS w)   -- total width ∝ n (sum of parts)
  -- args: 1=w+2 2=h+2 (viewBox) · 3=segments (rect+label per part, width ∝ part, x = running offset)
  -- round + trim_scale so whole-number coords print as "36", not "36.00000000000000000000" (number_line_svg convention)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="composition bar">%s</svg>',
    trim_scale(round((SELECT w FROM dim) + 2, 2)), trim_scale(round(height + 2, 2)),
    (SELECT string_agg(format(
      '<rect x="%1$s" y="0" width="%2$s" height="%3$s" rx="1.5" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
      '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
      trim_scale(round(x, 2)), trim_scale(round(seg_w, 2)), trim_scale(round(height, 2)),
      trim_scale(round(x + seg_w / 2, 2)), trim_scale(round(height / 2, 2)), trim_scale(round(height * 0.5, 2)), part
    ), '' ORDER BY i) FROM p));
$$;
CREATE FUNCTION glyph_svg(c composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT composition_bar_svg((c).parts) $$;

-- Assert the GEOMETRY (as glyphs.sql does for its own carriers), not the styling.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders the composition carrier (bar strip)','eq','<svg…</svg>','integer_compositions(3) rank 1 = 1+2',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(integer_compositions(3),1)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the composition carrier','eq','true','glyph_svg(composition) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('composition')::text $q$),
  ('glyphs','composition bar viewBox + segment count for 2+1 (unit 18, height 22)','eq','-1 -1 56 24|2','w = (2+1)*18, h = 22+2; one <rect> per part',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || (length(g) - length(replace(g, '<rect', '')))/5
    FROM (SELECT composition_bar_svg(ARRAY[2,1]) g) s $q$),
  ('glyphs','composition bar total width tracks n, not the number of parts','eq','true|1|3','3 (one part) and 1+1+1 (three parts) both sum to 3 → same viewBox, different segment counts',$q$
    SELECT (substring(a FROM 'viewBox="([^"]+)"') = substring(b FROM 'viewBox="([^"]+)"'))::text
        || '|' || (length(a) - length(replace(a, '<rect', '')))/5
        || '|' || (length(b) - length(replace(b, '<rect', '')))/5
    FROM (SELECT glyph_svg((unrank(integer_compositions(3),0)).value) a,
                 glyph_svg((unrank(integer_compositions(3),3)).value) b) s $q$),
  ('glyphs','glyph_svg dispatches composition to composition_bar_svg','eq','true','carrier→helper wiring, same pattern as ferrers/cells',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,1])::composition) = composition_bar_svg(ARRAY[2,1]))::text $q$);
