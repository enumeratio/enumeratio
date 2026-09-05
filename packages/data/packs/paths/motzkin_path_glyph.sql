-- requires: motzkin_paths, glyphs
-- motzkin_path_glyph — motzkin_path shares dyck_path's lattice-path SVG (both are ±1/0 step walks; lattice_path_svg
-- lives in core's glyphs.sql, reused here). Split out of core's glyphs.sql (#283 phase 3): motzkin_path is this
-- pack's own carrier, so the glyph_svg(motzkin_path) overload can't even CREATE loading core alone.
-- layer: glyph
CREATE FUNCTION glyph_svg(p motzkin_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lattice_path_svg((p).steps) $$;

INSERT INTO base_glyph (carrier, kind, title) VALUES
  ('motzkin_path', 'path', 'lattice path');   -- +1/0/−1 steps (level steps allowed)

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg is polymorphic over path carriers: dyck + motzkin share lattice_path_svg','eq','true','both draw through the same core helper',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,-1])::dyck_path) = glyph_svg(ROW(ARRAY[1,-1])::motzkin_path))::text $q$),
  ('glyphs','carrier_renders_svg(motzkin_path) is derived from the overload','eq','true','no second registry — the overload''s existence is enough',$q$
    SELECT carrier_renders_svg('motzkin_path')::text $q$);
