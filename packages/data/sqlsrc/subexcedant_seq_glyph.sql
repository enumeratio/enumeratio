-- requires: subexcedant_seqs, ascent_sequence_glyph
-- subexcedant_seq_glyph — the page-space glyph for the subexcedant_seq carrier (issue #222 glyph batch): reuses
-- sequence_bar_svg (ascent_sequence_glyph.sql) — a bar per term, height ∝ value, labelled underneath. terms here
-- are 1-based (aᵢ ∈ [1,i]), so unlike the ascent_sequence's 0-based terms every bar has some positive height.
CREATE FUNCTION glyph_svg(s subexcedant_seq) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT sequence_bar_svg((s).terms) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg emits a self-contained svg for a subexcedant_seq','eq','<svg…</svg>','{1,1,3}: a1=1<=1, a2=1<=2, a3=3<=3',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg(ROW(ARRAY[1,1,3])::subexcedant_seq) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for the subexcedant_seq carrier','eq','true','glyph_svg(subexcedant_seq) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('subexcedant_seq')::text $q$),
  ('glyphs','glyph_svg dispatches subexcedant_seq to the shared sequence_bar_svg','eq','true','carrier→helper wiring, same helper as ascent_sequence',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,2,1])::subexcedant_seq) = sequence_bar_svg(ARRAY[1,2,1]))::text $q$),
  ('glyphs','glyph_svg renders a real subexcedant_seqs() element','eq','<svg…</svg>','subexcedant_seqs(3), rank 0 = {1,1,1}',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(subexcedant_seqs(3),0)).value) g) s $q$);
