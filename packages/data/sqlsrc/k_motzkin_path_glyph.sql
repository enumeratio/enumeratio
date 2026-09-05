-- requires: k_motzkin_paths, glyphs
-- k_motzkin_path_glyph — k_motzkin_path's steps are +1/0/-1 (U/H/D; see k_motzkin_paths.sql), byte-for-byte the
-- same encoding as motzkin_path's steps. Reuses lattice_path_svg (glyphs.sql:20) as-is — the H-count grade (k)
-- is a fibering distinction, not a different step geometry.
CREATE FUNCTION glyph_svg(p k_motzkin_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lattice_path_svg((p).steps) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders k_motzkin_path via the shared lattice-path helper','eq','<svg…</svg>','k_motzkin_paths(3,1) rank 0 = UHD',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(k_motzkin_paths(3,1),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for k_motzkin_path','eq','true','glyph_svg(k_motzkin_path) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('k_motzkin_path')::text $q$),
  ('glyphs','glyph_svg(k_motzkin_path) dispatches straight to lattice_path_svg','eq','true','same wiring as dyck_path/motzkin_path — H steps are 0-height, same as plain motzkin',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,0,-1])::k_motzkin_path) = lattice_path_svg(ARRAY[1,0,-1]))::text $q$),
  ('glyphs','k_motzkin_path and motzkin_path glyph identically for the same step word','eq','true','the H-count grade is a fibering distinction, not a geometry change',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,0,-1])::k_motzkin_path) = glyph_svg(ROW(ARRAY[1,0,-1])::motzkin_path))::text $q$);
