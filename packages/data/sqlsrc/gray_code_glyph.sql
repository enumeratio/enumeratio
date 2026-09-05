-- requires: gray_codes, glyphs
-- gray_code_glyph — the page-space glyph for the gray_code carrier (issue #222 glyph batch): reuses
-- sequence_bar_svg (hoisted into core's glyphs.sql — #283 phase 3) — a bar per bit, height 0 or unit_h, labelled underneath. Grouped
-- with the other "word as bars" carriers (ascent_sequence, subexcedant_seq, rgs_word, ternary_gray_code) rather
-- than cells_svg's flat 0/1 strip so a scan of the gallery reads all five sequence carriers as one family.
CREATE FUNCTION glyph_svg(w gray_code) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT sequence_bar_svg((w).bits) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a gray_code','eq','<svg…</svg>','{1,0,1}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[1,0,1])::gray_code) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the gray_code carrier','eq','true','glyph_svg(gray_code) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('gray_code')::text $q$),
  ('glyphs','glyph_svg dispatches gray_code to the shared sequence_bar_svg','eq','true','carrier→helper wiring, same helper as ascent_sequence',$q$
    SELECT (glyph_svg(ROW(ARRAY[0,1,1])::gray_code) = sequence_bar_svg(ARRAY[0,1,1]))::text $q$),
  ('glyphs','glyph_svg renders a real gray_codes() element','eq','<svg…</svg>','gray_codes(3), rank 0 = {0,0,0}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(gray_codes(3),0)).value) g) s $q$);
