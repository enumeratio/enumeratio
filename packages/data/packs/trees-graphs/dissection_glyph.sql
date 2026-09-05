-- requires: dissections, glyphs
-- dissection_glyph — the page-space glyph for the dissection carrier (issue #222 glyph batch): the (n+2)-gon
-- itself (light outline), with each diagonal drawn as a chord. Vertex k (0-indexed, 0..m-1) sits at angle
-- 2πk/m − π/2 (12 o'clock, clockwise) on a circle — diagonals.sql's own code c=i·m+j decodes straight to the two
-- vertex indices i=c/m, j=c%m (integer division/modulo, the same decode notation() uses).
-- layer: glyph
CREATE FUNCTION dissection_polygon_svg(diagonals int[], m int, unit numeric DEFAULT 16, r numeric DEFAULT 3)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(3, coalesce(m, 0)) AS mm),
  -- pg gotcha: cos/sin/pi are double precision; compute in float8, cast to numeric once so every round() below
  -- sees numeric (round(double precision, int) doesn't exist).
  geo AS (SELECT (greatest(30, unit::float8 * mm / (2 * pi())))::numeric AS rad FROM dim),
  verts AS (
    SELECT k, (rad::float8 * cos(2 * pi() * k / mm - pi() / 2))::numeric AS x,
              (rad::float8 * sin(2 * pi() * k / mm - pi() / 2))::numeric AS y
    FROM dim, geo, generate_series(0, mm - 1) k
  ),
  diags AS (SELECT c, c / mm AS vi, c % mm AS vj FROM dim, unnest(diagonals) c)
  -- args: 1,2=x0,y0 · 3,4=vw,vh (viewBox, centered, padded by the vertex-dot radius) · 5=polygon outline (m sides)
  -- · 6=diagonal chords · 7=vertex dots
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%1$s %2$s %3$s %4$s" role="img" aria-label="polygon dissection">%5$s%6$s%7$s</svg>',
    trim_scale(round(-((SELECT rad FROM geo) + r + 1), 2)), trim_scale(round(-((SELECT rad FROM geo) + r + 1), 2)),
    trim_scale(round(2 * ((SELECT rad FROM geo) + r + 1), 2)), trim_scale(round(2 * ((SELECT rad FROM geo) + r + 1), 2)),
    (SELECT string_agg(format(
      '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" opacity="0.5"/>',
      trim_scale(round(v1.x, 2)), trim_scale(round(v1.y, 2)), trim_scale(round(v2.x, 2)), trim_scale(round(v2.y, 2))
    ), '' ORDER BY v1.k) FROM verts v1 JOIN verts v2 ON v2.k = (v1.k + 1) % (SELECT mm FROM dim)),
    coalesce((SELECT string_agg(format(
      '<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"/>',
      trim_scale(round(vi.x, 2)), trim_scale(round(vi.y, 2)), trim_scale(round(vj.x, 2)), trim_scale(round(vj.y, 2))
    ), '' ORDER BY diags.c) FROM diags JOIN verts vi ON vi.k = diags.vi JOIN verts vj ON vj.k = diags.vj), ''),
    (SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-text,currentColor)"/>',
      trim_scale(round(x, 2)), trim_scale(round(y, 2)), trim_scale(round(r, 2))
    ), '' ORDER BY k) FROM verts));
$$;
CREATE FUNCTION glyph_svg(d dissection) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT dissection_polygon_svg((d).diagonals, (d).m) $$;

-- Assert the GEOMETRY (vertex/side/diagonal counts), not the styling. The square (m=4, n=2): diagonal codes
-- 0*4+2=2 ⇒ (0,2), 1*4+3=7 ⇒ (1,3) are its only two possible diagonals (little_schroeder(2)=3: empty + either one).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a dissection','eq','<svg…</svg>','the square with diagonal (0,2)',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[2],4)::dissection) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the dissection carrier','eq','true','glyph_svg(dissection) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('dissection')::text $q$),
  ('glyphs','the empty dissection of the square still draws all 4 vertices and 4 sides, zero diagonals','eq','4|4|0','m=4, no diagonals',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7
        || '|' || (length(g) - length(replace(g, '<line', '')))/5
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'stroke="var\(--enumeratio-accent', 'g'))
    FROM (SELECT dissection_polygon_svg(ARRAY[]::int[], 4) g) s $q$),
  ('glyphs','a single diagonal (0,2) draws 4 sides + 1 accent-colored diagonal chord','eq','4|1','code 0*4+2=2 decodes to vertices (0,2)',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'stroke="var\(--enumeratio-border', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'stroke="var\(--enumeratio-accent', 'g'))
    FROM (SELECT dissection_polygon_svg(ARRAY[2], 4) g) s $q$),
  ('glyphs','a triangulation of the square (both diagonals would cross, so a single diagonal is maximal) — the OTHER diagonal (1,3) also renders one chord','eq','1','code 1*4+3=7 decodes to vertices (1,3)',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'stroke="var\(--enumeratio-accent', 'g'))
    FROM (SELECT dissection_polygon_svg(ARRAY[7], 4) g) s $q$),
  ('glyphs','glyph_svg dispatches dissection to dissection_polygon_svg','eq','true','carrier→helper wiring',$q$
    SELECT (glyph_svg(ROW(ARRAY[2],4)::dissection) = dissection_polygon_svg(ARRAY[2],4))::text $q$),
  ('glyphs','glyph_svg renders a real dissections() element','eq','<svg…</svg>','dissections(2), rank 0',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(dissections(2),0)).value) g) s $q$);
