-- requires: restricted_growth_strings, glyphs
-- rgs_word_glyph — the page-space glyph for the rgs_word carrier (issue #222 glyph batch): reuses sequence_bar_svg
-- (hoisted into core's glyphs.sql — #283 phase 3) — a bar per letter, height ∝ value, labelled underneath. w_1 is always 0.
CREATE FUNCTION glyph_svg(w rgs_word) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT sequence_bar_svg((w).word) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a rgs_word','eq','<svg…</svg>','{0,1,0}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[0,1,0])::rgs_word) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the rgs_word carrier','eq','true','glyph_svg(rgs_word) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('rgs_word')::text $q$),
  ('glyphs','glyph_svg dispatches rgs_word to the shared sequence_bar_svg','eq','true','carrier→helper wiring, same helper as ascent_sequence',$q$
    SELECT (glyph_svg(ROW(ARRAY[0,1,2])::rgs_word) = sequence_bar_svg(ARRAY[0,1,2]))::text $q$),
  ('glyphs','glyph_svg renders a real restricted_growth_strings() element','eq','<svg…</svg>','restricted_growth_strings(3), rank 0 = {0,0,0}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(restricted_growth_strings(3),0)).value) g) s $q$);
