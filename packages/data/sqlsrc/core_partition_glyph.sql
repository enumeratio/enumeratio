-- requires: core_partitions, glyphs
-- core_partition_glyph — the page-space glyph for the core_partition carrier (issue #222 glyph batch): a
-- core_partition is exactly a non-increasing `parts` array — the SAME shape as integer_partition, so this reuses
-- ferrers_svg (glyphs.sql) directly rather than redefining a second Ferrers-diagram helper. No new geometry to
-- test here beyond the dispatch: ferrers_svg's own examples (glyphs.sql) already cover the grid math.
CREATE FUNCTION glyph_svg(c core_partition) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT ferrers_svg((c).parts) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a core_partition','eq','<svg…</svg>','{3,1}: the same shape as a Ferrers diagram',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[3,1])::core_partition) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the core_partition carrier','eq','true','glyph_svg(core_partition) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('core_partition')::text $q$),
  ('glyphs','glyph_svg dispatches core_partition straight to the shared ferrers_svg','eq','true','no new geometry — same picture as integer_partition',$q$
    SELECT (glyph_svg(ROW(ARRAY[3,1])::core_partition) = ferrers_svg(ARRAY[3,1]))::text $q$),
  ('glyphs','glyph_svg renders a real core_partitions() element','eq','<svg…</svg>','core_partitions(3,2), rank 0',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(core_partitions(3,2),0)).value) g) s $q$);
