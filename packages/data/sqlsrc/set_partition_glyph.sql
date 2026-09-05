-- requires: set_partitions, glyphs
-- set_partition glyph — the standard ARC DIAGRAM (#145 glyph bald spot): n points on a horizontal line at
-- positions 1..n, with an arc drawn above the line between each pair of CONSECUTIVE same-block positions. Reuses
-- the exact arc definition set_partitions.stats.sql already built for crossings/nestings (block g = the positions
-- sharing rgs value g; arc (i, next j>i with rgs[j]=rgs[i])) — don't re-derive it, just re-render it. Singleton
-- blocks contribute no arc, just a bare point.

-- args: 1=w+2·pad 2=h+pad (viewBox extent) · 3=pad (viewBox x/y origin, = point-radius + 2) · 4=arc paths · 5=point dots
CREATE FUNCTION set_partition_arcs_svg(rgs int[], unit numeric DEFAULT 24, r numeric DEFAULT 3)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH alen AS (SELECT coalesce(array_length(rgs, 1), 0) AS n),
  arc AS (                                                          -- same construction as setpart_crossings/nestings
    SELECT i, (SELECT min(j) FROM generate_subscripts(rgs, 1) j WHERE j > i AND rgs[j] = rgs[i]) AS j
    FROM generate_subscripts(rgs, 1) i
  ),
  arcs AS (SELECT i, j, (j - i) * unit / 2.0 AS rad FROM arc WHERE j IS NOT NULL),   -- semicircle radius = half the span
  geo AS (
    SELECT (SELECT n FROM alen)                          AS n,
           greatest((SELECT n FROM alen) - 1, 0) * unit   AS w,
           coalesce((SELECT max(rad) FROM arcs), 0) + r + 2 AS y0,    -- baseline: tallest arc's rise + point-radius pad
           r + 2                                          AS pad
  )
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-%3$s -%3$s %1$s %2$s" role="img" aria-label="set partition arc diagram">%4$s%5$s</svg>',
    trim_scale(round(w + 2 * pad, 2)), trim_scale(round(y0 + pad, 2)), trim_scale(round(pad, 2)),
    coalesce((SELECT string_agg(format(                             -- semicircular arc, bowing upward from the baseline
      '<path d="M%s,%s A%s,%s 0 0,1 %s,%s" fill="none" stroke="var(--enumeratio-accent,#d97706)" stroke-width="2"/>',
      trim_scale(round((a.i - 1) * unit, 2)), trim_scale(round(y0, 2)),
      trim_scale(round(a.rad, 2)), trim_scale(round(a.rad, 2)),
      trim_scale(round((a.j - 1) * unit, 2)), trim_scale(round(y0, 2))
    ), '' ORDER BY a.i) FROM arcs a), ''),
    coalesce((SELECT string_agg(format(
      '<circle cx="%s" cy="%s" r="%s" fill="var(--enumeratio-accent,#d97706)"/>',
      trim_scale(round((p.i - 1) * unit, 2)), trim_scale(round(y0, 2)), r
    ), '' ORDER BY p.i) FROM generate_series(1, n) p(i)), '')
  )
  FROM geo;
$$;
CREATE FUNCTION glyph_svg(sp set_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT set_partition_arcs_svg((sp).rgs) $$;

-- register the page-space cast — the client maps kind 'arcs' to an <arc-diagram-glyph> renderer, same as the others.
INSERT INTO base_glyph (carrier, kind, title) VALUES ('set_partition', 'arcs', 'arc diagram');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
-- Assert the GEOMETRY (the math the generator computes), same discipline as glyphs.sql: dyck_paths(2) rank 0 style.
-- set_partitions(3) ranks: 0=000, 2=010, 4=012 (see set_partitions.sql's lex-order example).
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','carrier_renders_svg is now true for set_partition','eq','set_partition:t','glyph_svg(set_partition) overload registers the carrier, no second registry to edit',$q$
    SELECT 'set_partition:' || left(carrier_renders_svg('set_partition')::text, 1) $q$),
  ('glyphs','glyph_svg dispatches set_partition to the arc-diagram generator','eq','true','glyph_svg((sp).value) = set_partition_arcs_svg((sp).rgs)',$q$
    SELECT (glyph_svg(ROW(ARRAY[0,1,0])::set_partition) = set_partition_arcs_svg(ARRAY[0,1,0]))::text $q$),
  ('glyphs','arc diagram: all-in-one-block partition of [3] (RGS 000, rank 0) has 2 arcs','eq','2','consecutive-block arcs (1,2) and (2,3) — {1,2,3} in one block',$q$
    SELECT ((length(g) - length(replace(g, '<path', '')))/5)::text
    FROM (SELECT glyph_svg((unrank(set_partitions(3), 0)).value) g) s $q$),
  ('glyphs','arc diagram: all-singletons partition of [3] (RGS 012, rank 4) has 0 arcs, 3 bare points','eq','0|3','no consecutive same-block pair exists among three distinct blocks',$q$
    SELECT ((length(g) - length(replace(g, '<path', '')))/5)::text || '|' ||
           ((length(g) - length(replace(g, '<circle', '')))/7)::text
    FROM (SELECT glyph_svg((unrank(set_partitions(3), 4)).value) g) s $q$),
  ('glyphs','arc diagram: {1,3}/{2} of [3] (RGS 010, rank 2) has 1 arc spanning positions 1..3','eq','1|3','the lone arc skips over position 2 (its own singleton block)',$q$
    SELECT ((length(g) - length(replace(g, '<path', '')))/5)::text || '|' ||
           ((length(g) - length(replace(g, '<circle', '')))/7)::text
    FROM (SELECT glyph_svg((unrank(set_partitions(3), 2)).value) g) s $q$),
  ('glyphs','arc diagram viewBox tracks span (all-in-one-block [3], unit 24, r 3)','eq','-5 -5 58 22','w=(3-1)·24=48, tallest arc rad=12 (span 24), pad=r+2=5',$q$
    SELECT substring(glyph_svg((unrank(set_partitions(3), 0)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','arc diagram viewBox shrinks with no arcs (all-singletons [3])','eq','-5 -5 58 10','same width (3 points), height collapses to just the point-radius pad',$q$
    SELECT substring(glyph_svg((unrank(set_partitions(3), 4)).value) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','arc path geometry: {1,3}/{2} of [3] draws one semicircle over the skipped singleton','eq','M0,29 A24,24 0 0,1 48,29','x1=0 (pos 1), x2=48 (pos 3), radius=half the span=24, baseline y0=24+5',$q$
    SELECT substring(glyph_svg((unrank(set_partitions(3), 2)).value) FROM 'd="([^"]+)"') $q$),
  ('glyphs','set_partition_arcs_svg on the empty partition (n=0) renders no points, no arcs','eq','0|0','set_partitions(0) has one element: the empty RGS',$q$
    SELECT ((length(g) - length(replace(g, '<path', '')))/5)::text || '|' ||
           ((length(g) - length(replace(g, '<circle', '')))/7)::text
    FROM (SELECT set_partition_arcs_svg(ARRAY[]::int[]) g) s $q$);
