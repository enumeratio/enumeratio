-- requires: ternary_gray_codes, glyphs
-- ternary_gray_code_glyph — the page-space glyph for the ternary_gray_code carrier (issue #222 glyph batch):
-- reuses sequence_bar_svg (hoisted into core's glyphs.sql — #283 phase 3) — a bar per digit, height ∝ the digit (0,1,2), labelled
-- underneath.
CREATE FUNCTION glyph_svg(w ternary_gray_code) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT sequence_bar_svg((w).digits) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a ternary_gray_code','eq','<svg…</svg>','{2,0,1}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[2,0,1])::ternary_gray_code) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the ternary_gray_code carrier','eq','true','glyph_svg(ternary_gray_code) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('ternary_gray_code')::text $q$),
  ('glyphs','glyph_svg dispatches ternary_gray_code to the shared sequence_bar_svg','eq','true','carrier→helper wiring, same helper as ascent_sequence',$q$
    SELECT (glyph_svg(ROW(ARRAY[0,1,2])::ternary_gray_code) = sequence_bar_svg(ARRAY[0,1,2]))::text $q$),
  ('glyphs','glyph_svg renders a real ternary_gray_codes() element','eq','<svg…</svg>','ternary_gray_codes(3), rank 0 = {0,0,0}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(ternary_gray_codes(3),0)).value) g) s $q$);
