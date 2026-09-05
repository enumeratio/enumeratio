-- requires: skew_partitions, glyphs
-- skew_partition_glyph — the page-space glyph for the skew_partition carrier (issue #222 glyph batch): the
-- Young diagram of the OUTER shape λ, with the INNER shape μ's cells drawn faded/hollow instead of solid — "outer
-- minus inner" read directly off the picture, rather than ferrers_svg's plain filled grid. Row i (1-based) spans
-- columns 1..λ_i; columns 1..μ_i (μ padded with 0 past its own length — a shorter row) are the removed inner
-- cells, columns μ_i+1..λ_i are the skew diagram itself.
CREATE FUNCTION skew_ferrers_svg(lam int[], mu int[], unit numeric DEFAULT 18) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  WITH rows AS (SELECT i, lam[i] AS l, coalesce(mu[i], 0) AS m FROM generate_subscripts(lam, 1) i),
  inner_cells AS (SELECT i, c FROM rows, LATERAL generate_series(1, m) c WHERE m > 0),
  skew_cells AS (SELECT i, c FROM rows, LATERAL generate_series(m + 1, l) c WHERE l > m),
  dim AS (SELECT greatest(1, coalesce((SELECT max(l) FROM rows), 0)) * unit AS w, greatest(1, coalesce((SELECT max(i) FROM rows), 0)) * unit AS h)
  -- args: 1=w+2 2=h+2 (viewBox) · 3=inner μ cells (faded/hollow — the removed part) · 4=skew λ∖μ cells (filled)
  SELECT format(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 %s %s" role="img" aria-label="skew Young diagram">%s%s</svg>',
    trim_scale(round((SELECT w FROM dim) + 2, 2)), trim_scale(round((SELECT h FROM dim) + 2, 2)),
    coalesce((SELECT string_agg(format(
      '<rect x="%1$s" y="%2$s" width="%3$s" height="%3$s" rx="1.5" fill="none" stroke="var(--enumeratio-border,currentColor)" stroke-width="1" stroke-dasharray="2,2" opacity="0.5"/>',
      trim_scale(round((c - 1) * unit, 2)), trim_scale(round((i - 1) * unit, 2)), trim_scale(round(unit, 2))
    ), '' ORDER BY i, c) FROM inner_cells), ''),
    coalesce((SELECT string_agg(format(
      '<rect x="%1$s" y="%2$s" width="%3$s" height="%3$s" rx="1.5" fill="color-mix(in srgb, var(--enumeratio-accent,#d97706) 16%%, transparent)" stroke="var(--enumeratio-accent,#d97706)" stroke-width="1"/>',
      trim_scale(round((c - 1) * unit, 2)), trim_scale(round((i - 1) * unit, 2)), trim_scale(round(unit, 2))
    ), '' ORDER BY i, c) FROM skew_cells), ''));
$$;
CREATE FUNCTION glyph_svg(s skew_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT skew_ferrers_svg((s).lam, (s).mu) $$;

-- Assert the GEOMETRY (outer grid extent, inner-vs-skew cell counts), not the styling. 2,1/1: λ=(2,1), μ=(1) —
-- row 1 spans cols 1..2 (col 1 removed, col 2 skew), row 2 spans col 1..1 (fully removed, since μ_2 defaults to 0
-- but λ_2=1=μ padded... wait μ has only 1 entry, so row 2's μ_2 pads to 0, giving a full skew cell at row 2 col 1.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a skew_partition','eq','<svg…</svg>','2,1/1',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[2,1],ARRAY[1])::skew_partition) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the skew_partition carrier','eq','true','glyph_svg(skew_partition) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('skew_partition')::text $q$),
  ('glyphs','outer viewBox tracks λ, independent of μ (λ=2,1: 2 cols × 2 rows, unit 18)','eq','-1 -1 38 38','max(λ)=2, len(λ)=2 rows',$q$
    SELECT substring(glyph_svg(ROW(ARRAY[2,1],ARRAY[1])::skew_partition) FROM 'viewBox="([^"]+)"') $q$),
  ('glyphs','2,1/1 draws 1 hollow inner cell (row1 col1) and 2 skew cells (row1 col2, row2 col1)','eq','1|2','μ=(1) removes only row 1''s first column; row 2 has no μ entry so it''s all skew',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'stroke-dasharray="2,2"', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'color-mix', 'g'))
    FROM (SELECT skew_ferrers_svg(ARRAY[2,1], ARRAY[1]) g) s $q$),
  ('glyphs','an empty inner shape (μ=λ has zero rows) draws zero hollow cells — every cell is skew','eq','0|3','2,1/ (μ empty): the outer shape itself, no cells removed',$q$
    SELECT (SELECT count(*) FROM regexp_matches(g, 'stroke-dasharray="2,2"', 'g'))
        || '|' || (SELECT count(*) FROM regexp_matches(g, 'color-mix', 'g'))
    FROM (SELECT skew_ferrers_svg(ARRAY[2,1], ARRAY[]::int[]) g) s $q$),
  ('glyphs','glyph_svg dispatches skew_partition to skew_ferrers_svg','eq','true','carrier→helper wiring',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,1],ARRAY[1])::skew_partition) = skew_ferrers_svg(ARRAY[2,1],ARRAY[1]))::text $q$),
  ('glyphs','glyph_svg renders a real skew_partitions() element','eq','<svg…</svg>','skew_partitions(3), rank 0',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(skew_partitions(3),0)).value) g) s $q$);
