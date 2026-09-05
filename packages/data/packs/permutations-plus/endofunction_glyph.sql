-- requires: endofunctions, glyphs
-- endofunction_glyph — the page-space glyph for the endofunction carrier (issue #222 glyph batch): the classic
-- FUNCTIONAL GRAPH picture — n points evenly spaced on a circle (point i at angle 2π(i−1)/n, starting at 12
-- o'clock, clockwise), a straight chord with an arrowhead from i to images[i] for every non-fixed point, and a
-- small loop tangent to the circle (bulging outward, radially) for a fixed point i=images[i]. Distinct from the
-- parking_function/permutation GRID pictures on purpose: a general function [n]→[n] is neither injective nor
-- surjective, so its defining structure (which points feed into which, where the eventual cycles are) reads far
-- better as a graph than as a preference matrix.
-- endofunction_graph_svg itself is hoisted into core's glyphs.sql (#283 phase 3) because core's glyph_kinds.sql
-- reuses it for the plain `permutation` carrier's 'cycle_diagram' kind (a permutation IS an endofunction, viewed
-- as its own cycles).
-- layer: glyph
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
