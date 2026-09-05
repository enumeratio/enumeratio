-- requires: decorated_permutations, glyphs
-- decorated_permutation_glyph — the page-space glyph for the decorated_permutation carrier (issue #222 glyph
-- batch): a permutation ARC diagram — n points on a baseline, an arc bowing below the line from i to image[i] (the
-- perfect_matching_arc_svg semicircle convention), a small tangent LOOP below a fixed point instead of a
-- degenerate zero-radius arc. `decorated[i]` marks position i as decorated: a fixed point's loop draws HOLLOW +
-- dashed instead of solid, and (for other callers below) a non-fixed arc draws dashed instead of solid — the point
-- marker itself is always hollow when decorated[i], filled otherwise.
--
-- Shared design (decorated_permutation hosts it since it's the carrier that MOTIVATES the decoration flag —
-- arrangement_glyph.sql and affine_permutation_glyph.sql both `-- requires: decorated_permutation_glyph` and reuse
-- it): permutation_arc_svg(image int[], decorated boolean[] DEFAULT NULL, unit numeric DEFAULT 22).
--   * image[i] = NULL ⇒ position i has no outgoing arc (arrangement's unused domain rows beyond its word length —
--     the sparse convention rook_placement_grid_svg already established for "no mark here").
--   * image[i] = i ⇒ a fixed point: drawn as a tangent loop, not a zero-radius arc.
--   * decorated[i] (default all false) ⇒ dashed stroke on that position's arc/loop, hollow ring on its point.
-- No base_glyph registry row on purpose (the composition precedent in glyphs.sql): the overload alone is enough.
CREATE FUNCTION permutation_arc_svg(image int[], decorated boolean[] DEFAULT NULL, unit numeric DEFAULT 22)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT greatest(1, coalesce(array_length(image, 1), 0)) AS n, unit * 0.16 AS pr, unit * 0.16 * 1.8 AS lr),
  pts AS (SELECT o AS i, (o - 1) * unit AS x, coalesce(decorated[o], false) AS dec
          FROM unnest(image) WITH ORDINALITY AS t(val, o)),
  arcs AS (SELECT (o - 1) * unit AS xa, (val - 1) * unit AS xb, coalesce(decorated[o], false) AS dec
           FROM unnest(image) WITH ORDINALITY AS t(val, o) WHERE val IS NOT NULL AND val <> o),
  loops AS (SELECT (o - 1) * unit AS x, coalesce(decorated[o], false) AS dec
            FROM unnest(image) WITH ORDINALITY AS t(val, o) WHERE val = o),
  geo AS (SELECT pr, greatest(n - 1, 0) * unit AS w,
          greatest(coalesce((SELECT max(abs(xb - xa)) / 2.0 FROM arcs), 0),
                   CASE WHEN EXISTS (SELECT 1 FROM loops) THEN 2 * lr ELSE 0 END) AS maxr
          FROM dim)
  -- args: 1,2=x0,y0 · 3,4=vw,vh (viewBox, padded by the point radius) · 5=arcs (semicircle, i→image[i], bowing
  -- below the baseline — dashed when decorated) · 6=loops (fixed points, tangent below the point — hollow+dashed
  -- when decorated) · 7=points (one dot per position, hollow when decorated[i])
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%1$s %2$s %3$s %4$s" role="img" aria-label="permutation arc diagram">%5$s%6$s%7$s</svg>',
    trim_scale(round(-(pr + 1), 2)), trim_scale(round(-(pr + 1), 2)),
    trim_scale(round(w + 2 * (pr + 1), 2)), trim_scale(round(maxr + 2 * (pr + 1), 2)),
    coalesce((SELECT string_agg(format(
      '<path d="M %s,0 A %s,%s 0 0,1 %s,0" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"%s/>',
      trim_scale(round(least(xa, xb), 2)), trim_scale(round(abs(xb - xa) / 2.0, 2)), trim_scale(round(abs(xb - xa) / 2.0, 2)),
      trim_scale(round(greatest(xa, xb), 2)), CASE WHEN dec THEN ' stroke-dasharray="3,2"' ELSE '' END
    ), '' ORDER BY least(xa, xb)) FROM arcs), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"%s/>',
      trim_scale(round(x, 2)), trim_scale(round((SELECT lr FROM dim), 2)), trim_scale(round((SELECT lr FROM dim), 2)),
      CASE WHEN dec THEN ' stroke-dasharray="2,1.5"' ELSE '' END
    ), '' ORDER BY x) FROM loops), ''),
    coalesce((SELECT string_agg(
      CASE WHEN dec THEN format('<circle cx="%s" cy="0" r="%s" fill="none" stroke="var(--enumeratio-text,currentColor)" stroke-width="2"/>',
                                 trim_scale(round(x, 2)), trim_scale(round((SELECT pr FROM dim), 2)))
           ELSE format('<circle cx="%s" cy="0" r="%s" fill="var(--enumeratio-text,currentColor)"/>',
                        trim_scale(round(x, 2)), trim_scale(round((SELECT pr FROM dim), 2))) END
    , '' ORDER BY i) FROM pts), '')
  ) FROM geo;
$$;
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
