-- requires: endofunctions, glyphs
-- endofunction_glyph — the page-space glyph for the endofunction carrier (issue #222 glyph batch): the classic
-- FUNCTIONAL GRAPH picture — n points evenly spaced on a circle (point i at angle 2π(i−1)/n, starting at 12
-- o'clock, clockwise), a straight chord with an arrowhead from i to images[i] for every non-fixed point, and a
-- small loop tangent to the circle (bulging outward, radially) for a fixed point i=images[i]. Distinct from the
-- parking_function/permutation GRID pictures on purpose: a general function [n]→[n] is neither injective nor
-- surjective, so its defining structure (which points feed into which, where the eventual cycles are) reads far
-- better as a graph than as a preference matrix.
CREATE FUNCTION endofunction_graph_svg(images int[], unit numeric DEFAULT 18, r numeric DEFAULT 3.5, loop_r numeric DEFAULT 7)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(images, 1), 0)) AS n),
  -- pg gotcha: cos/sin/pi/sqrt are double precision, and round(double precision, int) doesn't exist — do the
  -- trig in float8, then cast to numeric once (ux/uy) so every downstream round()/^ sees numeric, not double.
  geo AS (SELECT (greatest(24, unit::float8 * n / (2 * pi())))::numeric AS rad FROM dim),
  pts AS (
    SELECT o AS i, val,
           (rad::float8 * cos(2 * pi() * (o - 1) / n - pi() / 2))::numeric AS ux,   -- unit direction from center, point i
           (rad::float8 * sin(2 * pi() * (o - 1) / n - pi() / 2))::numeric AS uy
    FROM unnest(images) WITH ORDINALITY AS t(val, o), dim, geo
  ),
  arrows AS (
    SELECT p.i, p.ux AS xs, p.uy AS ys, q.ux AS xt, q.uy AS yt,
           sqrt((q.ux - p.ux) * (q.ux - p.ux) + (q.uy - p.uy) * (q.uy - p.uy)) AS len
    FROM pts p JOIN pts q ON q.i = p.val WHERE p.val <> p.i
  ),
  loops AS (SELECT i, ux, uy FROM pts WHERE val = i)
  -- args: 1,2=x0,y0 · 3,4=vw,vh (viewBox, centered on the circle, padded for loops+arrowheads) · 5=chords+
  -- arrowheads (i→images[i], straight lines through the circle interior) · 6=self-loops (fixed points, tangent
  -- outward) · 7=points (one dot per element, on the circle)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%1$s %2$s %3$s %4$s" role="img" aria-label="functional graph">%5$s%6$s%7$s</svg>',
    trim_scale(round(-((SELECT rad FROM geo) + loop_r + r + 1), 2)), trim_scale(round(-((SELECT rad FROM geo) + loop_r + r + 1), 2)),
    trim_scale(round(2 * ((SELECT rad FROM geo) + loop_r + r + 1), 2)), trim_scale(round(2 * ((SELECT rad FROM geo) + loop_r + r + 1), 2)),
    coalesce((SELECT string_agg(
      format('<line x1="%s" y1="%s" x2="%s" y2="%s" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"/>',
        trim_scale(round(xs, 2)), trim_scale(round(ys, 2)),
        trim_scale(round(xt - (xt - xs) / len * r, 2)), trim_scale(round(yt - (yt - ys) / len * r, 2))) ||
      format('<polygon points="%s,%s %s,%s %s,%s" fill="var(--enumeratio-accent,#d97706)"/>',
        trim_scale(round(xt - (xt - xs) / len * r, 2)), trim_scale(round(yt - (yt - ys) / len * r, 2)),
        trim_scale(round(xt - (xt - xs) / len * (r + 7) - (yt - ys) / len * 3, 2)), trim_scale(round(yt - (yt - ys) / len * (r + 7) + (xt - xs) / len * 3, 2)),
        trim_scale(round(xt - (xt - xs) / len * (r + 7) + (yt - ys) / len * 3, 2)), trim_scale(round(yt - (yt - ys) / len * (r + 7) - (xt - xs) / len * 3, 2)))
    , '' ORDER BY i) FROM arrows), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"/>',
      trim_scale(round(ux * (1 + loop_r / (SELECT rad FROM geo)), 2)), trim_scale(round(uy * (1 + loop_r / (SELECT rad FROM geo)), 2)), trim_scale(round(loop_r, 2))
    ), '' ORDER BY i) FROM loops), ''),
    (SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-text,currentColor)"/>',
      trim_scale(round(ux, 2)), trim_scale(round(uy, 2)), trim_scale(round(r, 2))
    ), '' ORDER BY i) FROM pts));
$$;
CREATE FUNCTION glyph_svg(f endofunction) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT endofunction_graph_svg((f).images) $$;

-- Assert the GEOMETRY (point/arrow/loop counts), not the styling.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for an endofunction','eq','<svg…</svg>','{2,3,1}: a 3-cycle, f(1)=2,f(2)=3,f(3)=1',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[2,3,1])::endofunction) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the endofunction carrier','eq','true','glyph_svg(endofunction) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('endofunction')::text $q$),
  ('glyphs','a 3-cycle (2,3,1) draws 3 points, 3 chords, 0 loops','eq','3|3|0','no fixed points; every position feeds the next',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'fill="var\(--enumeratio-text', 'g'))
        || '|' || (length(g) - length(replace(g, '<line', '')))/5
        || '|' || (SELECT count(*) FROM regexp_matches(g, '<circle[^>]*fill="none"', 'g'))
    FROM (SELECT glyph_svg(ROW(ARRAY[2,3,1])::endofunction) g) s $q$),
  ('glyphs','the identity (1,2,3) draws 3 loops, 0 chords','eq','0|3','every point is a fixed point',$q$
    SELECT (length(g) - length(replace(g, '<line', '')))/5
        || '|' || (SELECT count(*) FROM regexp_matches(g, '<circle[^>]*fill="none"', 'g'))
    FROM (SELECT glyph_svg(ROW(ARRAY[1,2,3])::endofunction) g) s $q$),
  ('glyphs','glyph_svg dispatches endofunction to endofunction_graph_svg','eq','true','carrier→helper wiring, same pattern as the other carriers',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,2,2])::endofunction) = endofunction_graph_svg(ARRAY[2,2,2]))::text $q$),
  ('glyphs','glyph_svg renders a real endofunctions() element','eq','<svg…</svg>','endofunctions(3), rank 0 = the constant-1 function',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(endofunctions(3),0)).value) g) s $q$);
