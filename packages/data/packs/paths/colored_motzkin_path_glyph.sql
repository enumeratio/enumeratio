-- requires: colored_motzkin_paths, glyphs
-- colored_motzkin_path_glyph — colored_motzkin_path's steps are +1/0/-1 (U/H/D) exactly like motzkin_path, but
-- each H step also carries a color 0..r-1 (colors[i] = -1 on U/D; see colored_motzkin_paths.sql). A SINGLE
-- polyline (lattice_path_svg's approach) can't show per-step color, so this draws the walk as one <line> per
-- step instead: U/D keep the shared accent, H steps get a distinct hue per color index (golden-angle rotation,
-- so it stays legible for any r without needing r as an input). Kept as its own helper rather than an optional
-- mode on lattice_path_svg — segment-per-step is a different enough drawing strategy (and colored_motzkin_path
-- carries a second array lattice_path_svg's (steps int[]) signature has no room for) that bolting it on would
-- only compromise the single-carrier callers it already serves.
-- layer: glyph
CREATE FUNCTION colored_motzkin_svg(steps int[], colors int[], unit numeric DEFAULT 18)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH pts AS (                                              -- the walk in page space, incl. the (0,0) origin
    SELECT 0 AS o, 0 AS x, 0 AS y
    UNION ALL
    SELECT o::int, o::int, (sum(step) OVER (ORDER BY o))::int
    FROM unnest(steps) WITH ORDINALITY AS t(step, o)
  ),
  dim AS (
    SELECT unit AS u,
           greatest(1, coalesce(array_length(steps, 1), 0)) AS len,
           greatest(1, (SELECT max(y) FROM pts)) AS maxh
  ),
  geo AS (
    SELECT len * u AS w, maxh * u AS h,
           (SELECT string_agg(
              format('%s,%s', trim_scale(round(x * u, 2)), trim_scale(round((maxh - y) * u, 2))), ' ' ORDER BY o)
            FROM pts) AS poly
    FROM dim
  ),
  segs AS (                                                  -- one <line> per step: H gets a color-indexed hue
    SELECT t.o,
           format('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="%s" stroke-width="2.5" stroke-linecap="round"/>',
             trim_scale(round(p0.x * d.u, 2)), trim_scale(round((d.maxh - p0.y) * d.u, 2)),
             trim_scale(round(p1.x * d.u, 2)), trim_scale(round((d.maxh - p1.y) * d.u, 2)),
             CASE WHEN t.c >= 0 THEN format('hsl(%s 65%% 50%%)', (t.c * 137) % 360)   -- golden-angle hue per color
                  ELSE 'var(--enumeratio-accent,#d97706)' END) AS svg
    FROM unnest(steps, colors) WITH ORDINALITY AS t(step, c, o)
    JOIN pts p0 ON p0.o = t.o - 1
    JOIN pts p1 ON p1.o = t.o
    CROSS JOIN dim d
  )
  -- args: 1=w+2 2=h+2 (viewBox) · 3=w 4=h (extent) · 5=fill poly (accent, same as lattice_path_svg) · 6=colored segments
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %2$s" role="img" aria-label="colored Motzkin path">'
    '<line x1="0" y1="%4$s" x2="%3$s" y2="%4$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>'
    '<polygon points="0,%4$s %5$s %3$s,%4$s" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 12%%, transparent)"/>'
    '%6$s'
    '</svg>',
    trim_scale(round(w + 2, 2)), trim_scale(round(h + 2, 2)), trim_scale(round(w, 2)), trim_scale(round(h, 2)), poly,
    coalesce((SELECT string_agg(svg, '' ORDER BY o) FROM segs), ''))
  FROM geo;
$$;
CREATE FUNCTION glyph_svg(p colored_motzkin_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT colored_motzkin_svg((p).steps, (p).colors) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders colored_motzkin_path (own helper — per-step colored segments)','eq','<svg…</svg>','colored_motzkin_paths(3,1) rank 0 = UH0D',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(colored_motzkin_paths(3,1),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for colored_motzkin_path','eq','true','glyph_svg(colored_motzkin_path) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('colored_motzkin_path')::text $q$),
  ('glyphs','glyph_svg(colored_motzkin_path) dispatches straight to colored_motzkin_svg','eq','true','carrier→helper wiring, same pattern as composition/ferrers/cells',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,0,-1], ARRAY[-1,0,-1])::colored_motzkin_path)
          = colored_motzkin_svg(ARRAY[1,0,-1], ARRAY[-1,0,-1]))::text $q$),
  ('glyphs','differently-colored H steps get different stroke hues (r=2: H0 vs H1)','eq','true','two distinct H colors ⇒ two distinct hsl(...) strokes emitted',$q$
    SELECT (substring(glyph_svg(ROW(ARRAY[0,0], ARRAY[0,1])::colored_motzkin_path) FROM 'hsl\(([0-9]+)')
         <> substring(glyph_svg(ROW(ARRAY[0,0], ARRAY[0,1])::colored_motzkin_path) FROM '.*hsl\(([0-9]+)'))::text $q$),
  ('glyphs','U/D steps keep the shared accent stroke regardless of color array (uncolored, c=-1)','eq','false','no hsl(...) leaks in for an all-U/D path',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,-1], ARRAY[-1,-1])::colored_motzkin_path) LIKE '%hsl(%')::text $q$);
