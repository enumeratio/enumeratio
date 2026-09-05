-- requires: delannoy_paths, glyphs
-- delannoy_path_glyph — delannoy_path walks (x,y) from (0,0) to (n,n) via E=(1,0), N=(0,1), D=(1,1) (see
-- delannoy_paths.sql); it is genuinely 2-D (both coordinates move independently, and a D step moves BOTH at
-- once), not a 1-D "position vs height" walk. lattice_path_svg (glyphs.sql:20) models x as the step's own
-- ordinality and y as a cumulative ±1 SUM of the steps — there's no y in delannoy's step alphabet to sum
-- (E/N/D aren't signed deltas), so bending that helper to fit here would either misdraw the path or force an
-- unrelated argument shape onto its one existing (steps int[]) signature. A dedicated helper draws the actual
-- monotone staircase instead — same visual language (border axes, light fill under the walk, accent polyline)
-- as lattice_path_svg, just built from real (x,y) points so diagonal D steps render as diagonals.
-- layer: glyph
CREATE FUNCTION delannoy_path_svg(steps int[], unit numeric DEFAULT 18) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH pts AS (                                              -- the (x,y) staircase, incl. the (0,0) origin
    SELECT 0 AS o, 0 AS x, 0 AS y                             -- E(0)=(1,0) N(1)=(0,1) D(2)=(1,1) — see delannoy_paths.sql
    UNION ALL
    SELECT o::int,
           (sum(CASE WHEN s IN (0, 2) THEN 1 ELSE 0 END) OVER (ORDER BY o))::int,
           (sum(CASE WHEN s IN (1, 2) THEN 1 ELSE 0 END) OVER (ORDER BY o))::int
    FROM unnest(steps) WITH ORDINALITY AS t(s, o)
  ),
  dim AS (
    SELECT unit AS u, greatest(1, (SELECT max(x) FROM pts), (SELECT max(y) FROM pts)) AS n   -- square n×n grid
  ),
  geo AS (
    SELECT n * u AS w, n * u AS h,
           (SELECT string_agg(
              format('%s,%s', trim_scale(round(x * u, 2)), trim_scale(round((n - y) * u, 2))), ' ' ORDER BY o)
            FROM pts) AS poly
    FROM dim
  )
  -- args: 1=w+2 2=h+2 (viewBox, square) · 3=w 4=h (extent) · 5=poly (the staircase, incl. diagonal D legs)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %1$s %2$s" role="img" aria-label="Delannoy path">'
    '<line x1="0" y1="%4$s" x2="%3$s" y2="%4$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>'
    '<line x1="0" y1="0" x2="0" y2="%4$s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.4"/>'
    '<polygon points="0,%4$s %5$s %3$s,%4$s" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)"/>'
    '<polyline points="%5$s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
    '</svg>',
    trim_scale(round(w + 2, 2)), trim_scale(round(h + 2, 2)), trim_scale(round(w, 2)), trim_scale(round(h, 2)), poly)
  FROM geo;
$$;
CREATE FUNCTION glyph_svg(p delannoy_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT delannoy_path_svg((p).steps) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders delannoy_path (own helper — genuinely 2-D, diagonal D steps)','eq','<svg…</svg>','delannoy_paths(2) rank 12 = DD',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(delannoy_paths(2),12)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for delannoy_path','eq','true','glyph_svg(delannoy_path) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('delannoy_path')::text $q$),
  ('glyphs','glyph_svg(delannoy_path) dispatches straight to delannoy_path_svg','eq','true','carrier→helper wiring, same pattern as composition/ferrers/cells',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,2])::delannoy_path) = delannoy_path_svg(ARRAY[2,2]))::text $q$),
  ('glyphs','DD (two diagonal steps) and EENN (four orthogonal steps) both reach (2,2): same viewBox, different point counts','eq','true|3|5','both end at (n,n)=(2,2) so the grid/viewBox matches, but DD has 3 points on its walk vs EENN''s 5',$q$
    SELECT (substring(a FROM 'viewBox="([^"]+)"') = substring(b FROM 'viewBox="([^"]+)"'))::text
        || '|' || (array_length(regexp_split_to_array(substring(a FROM 'points="([^"]+)" fill="none"'), ' '), 1))::text
        || '|' || (array_length(regexp_split_to_array(substring(b FROM 'points="([^"]+)" fill="none"'), ' '), 1))::text
    FROM (SELECT delannoy_path_svg(ARRAY[2,2]) a, delannoy_path_svg(ARRAY[0,1,0,1]) b) s $q$),
  ('glyphs','delannoy_path viewBox for DD (two diagonal steps, unit 18): a 2x2 grid','eq','-1 -1 38 38','n = max(x,y) = 2; w=h=2*18=36, +2 pad',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') FROM (SELECT delannoy_path_svg(ARRAY[2,2]) g) s $q$);
