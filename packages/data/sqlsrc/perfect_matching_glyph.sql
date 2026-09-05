-- requires: perfect_matchings, glyphs
-- perfect_matching_glyph — the page-space glyph for the perfect_matching carrier (issue #190): a CHORD/ARC diagram.
-- pairs is the flattened array [a1,b1,a2,b2,…] (ai<bi, sorted ascending by ai — see perfect_matchings.sql), so the
-- labels 1..2n themselves ARE the point positions: lay out one dot per label on a horizontal baseline in label
-- order, then draw a semicircular arc — radius = half the label gap — joining each pair. Nesting/crossing structure
-- (which the recursive fiber_elements order visits in a fixed sequence) reads directly off the arcs' radii: a pair
-- that spans other pairs draws a taller arc that visibly contains theirs.
CREATE FUNCTION perfect_matching_arc_svg(pairs int[], unit numeric DEFAULT 22) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH dim AS (SELECT coalesce(array_length(pairs, 1), 0) AS m, unit * 0.16 AS pr),   -- pr = point-dot radius
  pts AS (SELECT o AS i, (o - 1) * unit AS x FROM dim, LATERAL generate_series(1, m) o),
  arcs AS (
    SELECT k, (pairs[2*k-1] - 1) * unit AS xa, (pairs[2*k] - 1) * unit AS xb,
           ((pairs[2*k] - pairs[2*k-1]) * unit) / 2.0 AS r
    FROM dim, LATERAL generate_series(1, m / 2) k
  ),
  geo AS (SELECT pr, greatest(m - 1, 0) * unit AS w, coalesce((SELECT max(r) FROM arcs), 0) AS maxr FROM dim)
  -- args: 1,2=x0,y0 · 3,4=vw,vh (viewBox, padded by the point radius) · 5=arcs (one semicircle per pair, bowing
  -- downward from the baseline) · 6=points (one dot per label 1..m on the baseline, drawn over the arcs)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="%1$s %2$s %3$s %4$s" role="img" aria-label="perfect matching arc diagram">%5$s%6$s</svg>',
    trim_scale(round(-(pr + 1), 2)), trim_scale(round(-(pr + 1), 2)),
    trim_scale(round(w + 2 * (pr + 1), 2)), trim_scale(round(maxr + 2 * (pr + 1), 2)),
    coalesce((SELECT string_agg(format(
      '<path d="M %s,0 A %s,%s 0 0,1 %s,0" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1.5"/>',
      trim_scale(round(xa, 2)), trim_scale(round(r, 2)), trim_scale(round(r, 2)), trim_scale(round(xb, 2))
    ), '' ORDER BY k) FROM arcs), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="0" r="%s" fill="var(--enumeratio-text,currentColor)"/>',
      trim_scale(round(x, 2)), trim_scale(round((SELECT pr FROM geo), 2))
    ), '' ORDER BY i) FROM pts), '')
  ) FROM geo;
$$;
CREATE FUNCTION glyph_svg(m perfect_matching) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT perfect_matching_arc_svg((m).pairs) $$;

-- Assert the GEOMETRY (point count, arc count/radii, nesting via radius), not the styling — mirrors the other
-- glyph files' own examples. perfect_matchings(2) ranks 0,1,2 = (1,2)(3,4), (1,3)(2,4), (1,4)(2,3) (fixed order,
-- see perfect_matchings.sql).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a perfect_matching','eq','<svg…</svg>','perfect_matchings(2) rank 0 = (1,2)(3,4)',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(perfect_matchings(2),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the perfect_matching carrier','eq','true','glyph_svg(perfect_matching) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('perfect_matching')::text $q$),
  ('glyphs','arc-diagram viewBox for (1,2)(3,4): 4 points, both pairs adjacent (r=11)','eq','-4.52 -4.52 75.04 20.04','w=3*22, pr=22*0.16=3.52, maxr=11 → vw=w+2(pr+1), vh=maxr+2(pr+1)',$q$
    SELECT substring(glyph_svg((unrank(perfect_matchings(2),0)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','diagram has exactly n arcs and 2n point-dots (n=2)','eq','2|4','one path per pair, one circle per label',$q$
    SELECT (length(g) - length(replace(g, '<path', '')))/5 || '|' || (length(g) - length(replace(g, '<circle', '')))/7
    FROM (SELECT glyph_svg((unrank(perfect_matchings(2),0)).value) g) s $q$),
  ('glyphs','adjacent pairs (1,2)(3,4) draw two same-radius, non-overlapping arcs','eq','M 0,0 A 11,11 0 0,1 22,0|M 44,0 A 11,11 0 0,1 66,0','pairs=[1,2,3,4]: xa,xb from (label-1)*unit',$q$
    SELECT string_agg(m[1], '|' ORDER BY m[1]) FROM (SELECT regexp_matches(glyph_svg((unrank(perfect_matchings(2),0)).value), 'M [0-9.,-]+ A [0-9.,]+ 0 0,1 [0-9.,]+', 'g') m) s $q$),
  ('glyphs','nested pair (1,4)(2,3) draws an outer big-radius arc containing an inner small one','eq','-4.52 -4.52 75.04 42.04|33|11','(1,4): r=33 spans (2,3): r=11 — taller viewBox than the adjacent case',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || substring(g FROM 'A ([0-9.]+),[0-9.]+ 0 0,1 66,0') || '|' || substring(g FROM 'A ([0-9.]+),[0-9.]+ 0 0,1 44,0')
    FROM (SELECT glyph_svg((unrank(perfect_matchings(2),2)).value) g) s $q$),
  ('glyphs','perfect_matching_arc_svg on the empty matching (n=0) collapses to a padding-only box, no points or arcs','eq','-4.52 -4.52 9.04 9.04|0|0','coalesce keeps the viewBox non-degenerate (just the point-radius padding) — same convention as the grid glyphs'' n=0 case',$q$
    SELECT substring(g FROM 'viewBox="([^"]+)"') || '|' || (length(g) - length(replace(g, '<path', '')))/5 || '|' || (length(g) - length(replace(g, '<circle', '')))/7
    FROM (SELECT perfect_matching_arc_svg(ARRAY[]::int[]) g) s $q$),
  ('glyphs','glyph_svg dispatches perfect_matching to perfect_matching_arc_svg','eq','true','carrier→helper wiring, same pattern as permutation/composition',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,3,2,4])::perfect_matching) = perfect_matching_arc_svg(ARRAY[1,3,2,4]))::text $q$);
