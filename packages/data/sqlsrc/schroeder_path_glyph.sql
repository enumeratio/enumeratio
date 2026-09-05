-- requires: schroeder_paths, glyphs
-- schroeder_path_glyph — schroeder_path's steps double as height deltas (1=U -1=D 0=F; see schroeder_paths.sql),
-- same as dyck/motzkin, EXCEPT the flat step F has x-WIDTH 2 (a Schroeder path draws to (2n,0), not (n,0)).
-- lattice_path_svg (glyphs.sql:20) advances x by exactly 1 per step (x = the step's ordinality), so it can't
-- express F's double-width without either bloating its signature or risking the byte-identical dyck/motzkin
-- output it already serves. A dedicated helper — walking (x,y) directly instead of (ordinality,height) — keeps
-- that helper untouched and gives F its correct width; everything else (fill polygon, polyline styling) mirrors
-- lattice_path_svg's convention so the glyph still reads as the same family.
CREATE FUNCTION schroeder_path_svg(steps int[], unit numeric DEFAULT 18) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH pts AS (                                              -- the walk in page space, incl. the (0,0) origin;
    SELECT 0 AS o, 0 AS x, 0 AS y                             -- x advances 1 per U/D, 2 per F (its x-width)
    UNION ALL
    SELECT o::int,
           (sum(CASE WHEN s = 0 THEN 2 ELSE 1 END) OVER (ORDER BY o))::int,
           (sum(s) OVER (ORDER BY o))::int
    FROM unnest(steps) WITH ORDINALITY AS t(s, o)
  ),
  dim AS (
    SELECT unit AS u,
           greatest(1, (SELECT max(x) FROM pts)) AS len,
           greatest(1, (SELECT max(y) FROM pts)) AS maxh
  ),
  geo AS (
    SELECT len * u AS w, maxh * u AS h,
           (SELECT string_agg(
              format('%s,%s', trim_scale(round(x * u, 2)), trim_scale(round((maxh - y) * u, 2))), ' ' ORDER BY o)
            FROM pts) AS poly
    FROM dim
  )
  -- args: 1=w+2 2=h+2 (viewBox) · 3=w 4=h (extent) · 5=poly (the walk points, F double-wide)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %2$s" role="img" aria-label="Schroeder path">'
    '<line x1="0" y1="%4$s" x2="%3$s" y2="%4$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>'
    '<polygon points="0,%4$s %5$s %3$s,%4$s" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)"/>'
    '<polyline points="%5$s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    '</svg>',
    trim_scale(round(w + 2, 2)), trim_scale(round(h + 2, 2)), trim_scale(round(w, 2)), trim_scale(round(h, 2)), poly)
  FROM geo;
$$;
CREATE FUNCTION glyph_svg(p schroeder_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT schroeder_path_svg((p).steps) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders schroeder_path (own helper — F is double-width)','eq','<svg…</svg>','schroeder_paths(2) rank 0 = UUDD',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(schroeder_paths(2),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for schroeder_path','eq','true','glyph_svg(schroeder_path) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('schroeder_path')::text $q$),
  ('glyphs','glyph_svg(schroeder_path) dispatches straight to schroeder_path_svg','eq','true','carrier→helper wiring, same pattern as composition/ferrers/cells',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,-1])::schroeder_path) = schroeder_path_svg(ARRAY[1,-1]))::text $q$),
  ('glyphs','an F step is TWICE the x-width of a U/D step: FF vs UUDD span the same n=2 but FF is wider','eq','true','both are 2-step-count, 4-step-count encodings of semilength 2 — FF (2 flats) is 2x as wide as UD (2 unit steps)',$q$
    SELECT (substring(glyph_svg(ROW(ARRAY[0,0])::schroeder_path) FROM 'viewBox="-1 -1 ([0-9.]+) ')::numeric
          > substring(glyph_svg(ROW(ARRAY[1,-1])::schroeder_path) FROM 'viewBox="-1 -1 ([0-9.]+) ')::numeric)::text $q$),
  ('glyphs','schroeder_path viewBox for FF (two flat steps, unit 18): width = 4 x-units, height = 1 (flat, floor)','eq','-1 -1 74 20','x = 2+2 = 4 units wide; y stays 0, greatest(1,0)=1 unit tall',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') FROM (SELECT schroeder_path_svg(ARRAY[0,0]) g) s $q$);
