-- requires: weak_compositions_into_k_parts, glyphs
-- weak_composition_glyph — the page-space glyph for the weak_composition carrier (issue #222 glyph batch): the
-- same divided-bar picture as composition_glyph.sql's composition_bar_svg (segment width ∝ part value), but a
-- weak composition can have a ZERO part — invisible at width 0 in the plain composition picture — so a 0-part
-- here instead draws a small fixed-width DASHED, unfilled "gap" segment (still labelled 0), keeping every part
-- visible and countable even when its value is empty. composition_bar_svg itself is untouched; this is its own
-- helper since the zero-width special case doesn't apply there (composition's parts are always ≥ 1).
CREATE FUNCTION weak_composition_bar_svg(parts int[], unit numeric DEFAULT 18, height numeric DEFAULT 22, gap_w numeric DEFAULT 10)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH p AS (
    SELECT o AS i, part, CASE WHEN part > 0 THEN part * unit ELSE gap_w END AS seg_w
    FROM unnest(parts) WITH ORDINALITY AS t(part, o)
  ),
  x AS (
    SELECT i, part, seg_w,
           coalesce(sum(seg_w) OVER (ORDER BY i ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS x
    FROM p
  ),
  dim AS (SELECT greatest(1, coalesce((SELECT sum(seg_w) FROM p), 0)) AS w FROM p)
  -- args: 1=w+2 2=h+2 (viewBox) · 3=segments (a filled rect per positive part, a dashed hollow rect per zero part
  -- — both labelled with their value)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="weak composition bar">%s</svg>',
    trim_scale(round((SELECT max(w) FROM dim) + 2, 2)), trim_scale(round(height + 2, 2)),
    (SELECT string_agg(
      CASE WHEN part > 0 THEN format(
        '<rect x="%1$s" y="0" width="%2$s" height="%3$s" rx="1.5" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>'
        '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
        trim_scale(round(x, 2)), trim_scale(round(seg_w, 2)), trim_scale(round(height, 2)),
        trim_scale(round(x + seg_w / 2, 2)), trim_scale(round(height / 2, 2)), trim_scale(round(height * 0.5, 2)), part)
      ELSE format(
        '<rect x="%1$s" y="0" width="%2$s" height="%3$s" rx="1.5" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" stroke-dasharray="2,2"/>'
        '<text x="%4$s" y="%5$s" text-anchor="middle" dominant-baseline="central" font-size="%6$s" fill="var(--enumeratio-text,currentColor)">%7$s</text>',
        trim_scale(round(x, 2)), trim_scale(round(seg_w, 2)), trim_scale(round(height, 2)),
        trim_scale(round(x + seg_w / 2, 2)), trim_scale(round(height / 2, 2)), trim_scale(round(height * 0.4, 2)), part)
      END
    , '' ORDER BY i) FROM x));
$$;
CREATE FUNCTION glyph_svg(c weak_composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT weak_composition_bar_svg((c).parts) $$;

-- Assert the GEOMETRY (segment widths/count, the dashed-gap treatment for a 0 part), not the styling.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a weak_composition','eq','<svg…</svg>','{0,3}: 0 then 3',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[0,3])::weak_composition) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the weak_composition carrier','eq','true','glyph_svg(weak_composition) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('weak_composition')::text $q$),
  ('glyphs','{0,3} draws one dashed gap segment and one filled segment','eq','1|1','one zero part, one positive part',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'stroke-dasharray="2,2"', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'color-mix', 'g'))
    FROM (SELECT weak_composition_bar_svg(ARRAY[0,3]) g) s $q$),
  ('glyphs','a zero part still takes up a fixed gap width, distinct from a positive part''s proportional width','eq','-1 -1 66 24','{0,3}: gap_w(10) + 3*unit(18)=64, +2',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') FROM (SELECT weak_composition_bar_svg(ARRAY[0,3]) g) s $q$),
  ('glyphs','two consecutive zero parts each get their own gap segment (2 dashed, 0 filled)','eq','2|0','{0,0}: every part is empty',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'stroke-dasharray="2,2"', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'color-mix', 'g'))
    FROM (SELECT weak_composition_bar_svg(ARRAY[0,0]) g) s $q$),
  ('glyphs','glyph_svg dispatches weak_composition to weak_composition_bar_svg','eq','true','carrier→helper wiring, same pattern as composition',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,0,1])::weak_composition) = weak_composition_bar_svg(ARRAY[2,0,1]))::text $q$),
  ('glyphs','glyph_svg renders a real weak_compositions_into_k_parts() element','eq','<svg…</svg>','weak_compositions_into_k_parts(3,2), rank 0',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(weak_compositions_into_k_parts(3,2),0)).value) g) s $q$);
