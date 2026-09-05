-- requires: decorated_permutations, glyphs
-- decorated_permutation_glyph — the page-space glyph for the decorated_permutation carrier (issue #222 glyph
-- batch): a permutation ARC diagram — n points on a baseline, an arc bowing below the line from i to image[i] (the
-- perfect_matching_arc_svg semicircle convention), a small tangent LOOP below a fixed point instead of a
-- degenerate zero-radius arc. `decorated[i]` marks position i as decorated: a fixed point's loop draws HOLLOW +
-- dashed instead of solid, and (for other callers below) a non-fixed arc draws dashed instead of solid — the point
-- marker itself is always hollow when decorated[i], filled otherwise.
--
-- Shared design (decorated_permutation hosts the concept; the actual permutation_arc_svg(image int[], decorated
-- boolean[] DEFAULT NULL, unit numeric DEFAULT 22) helper is hoisted into core's glyphs.sql — #283 phase 3 —
-- because core's glyph_kinds.sql reuses it for the plain `permutation` carrier's 'arc' kind. arrangement_glyph.sql
-- and affine_permutation_glyph.sql (both this pack) also reuse it from there.
--   * image[i] = NULL ⇒ position i has no outgoing arc (arrangement's unused domain rows beyond its word length —
--     the sparse convention rook_placement_grid_svg already established for "no mark here").
--   * image[i] = i ⇒ a fixed point: drawn as a tangent loop, not a zero-radius arc.
--   * decorated[i] (default all false) ⇒ dashed stroke on that position's arc/loop, hollow ring on its point.
-- No base_glyph registry row on purpose (the composition precedent in glyphs.sql): the overload alone is enough.
-- layer: glyph
CREATE FUNCTION glyph_svg(d decorated_permutation) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT permutation_arc_svg(
    ARRAY(SELECT abs(x) FROM unnest((d).word) x),
    ARRAY(SELECT x < 0 FROM unnest((d).word) x)
  ) $$;

-- Assert the GEOMETRY (point/arc/loop counts, dashing on the decorated marks), not the styling.
-- decorated_permutations(3) rank 0 = -1,2,3 (fixed points 1,2,3 all decorated with a loop; position 1 is an
-- anti-loop, positions 2,3 plain loops) — see decorated_permutations.sql's own floor.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a decorated_permutation','eq','<svg…</svg>','-1,2,3 (decorated_permutations(3) rank 0)',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(decorated_permutations(3),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the decorated_permutation carrier','eq','true','glyph_svg(decorated_permutation) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('decorated_permutation')::text $q$),
  ('glyphs','a plain (undecorated) identity permutation draws 6 circles (3 points + 3 loops), 0 arcs, 0 dashed marks','eq','6|0|0','1,2,3 — every position a plain (undecorated) fixed point',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7
        || '|' || (length(g) - length(replace(g, '<path', '')))/5
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'dasharray', 'g'))
    FROM (SELECT glyph_svg(ROW(ARRAY[1,2,3])::decorated_permutation) g) s $q$),
  ('glyphs','one decorated fixed point among plain ones draws exactly one dashed loop and one hollow point','eq','1|1','-1,2,3: position 1 is an anti-loop, 2 and 3 are plain loops',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'stroke-dasharray="2,1.5"', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'fill="none" stroke="var\(--enumeratio-text', 'g'))
    FROM (SELECT glyph_svg(ROW(ARRAY[-1,2,3])::decorated_permutation) g) s $q$),
  ('glyphs','a fixed-point-free permutation (2,3,1) draws arcs and zero loops','eq','0|true','no i with image[i]=i; a 3-cycle draws connecting arcs instead',$q$
    SELECT (length(g) - length(replace(g, '<circle', '')))/7 - 3    -- 3 point dots always present; extra circles = loops
        || '|' || ((length(g) - length(replace(g, '<path', '')))/5 > 0)::text
    FROM (SELECT glyph_svg(ROW(ARRAY[2,3,1])::decorated_permutation) g) s $q$),
  ('glyphs','glyph_svg dispatches decorated_permutation to permutation_arc_svg with the sign split into image/decorated','eq','true','carrier→helper wiring: abs(word) = image, word<0 = decorated',$q$
    SELECT (glyph_svg(ROW(ARRAY[-1,2,3])::decorated_permutation) = permutation_arc_svg(ARRAY[1,2,3], ARRAY[true,false,false]))::text $q$),
  ('glyphs','permutation_arc_svg on the empty permutation (n=0) collapses to a padding-only box, no marks','eq','0|0|0','coalesce keeps the viewBox non-degenerate, same convention as perfect_matching_arc_svg''s n=0 case',$q$
    SELECT (length(g) - length(replace(g, '<path', '')))/5
        || '|' || (length(g) - length(replace(g, '<circle', '')))/7
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'dasharray', 'g'))
    FROM (SELECT permutation_arc_svg(ARRAY[]::int[]) g) s $q$);
