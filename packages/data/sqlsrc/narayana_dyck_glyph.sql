-- requires: narayana_numbers, glyphs
-- narayana_dyck_glyph — narayana_dyck's steps are a ±1 word (see narayana_numbers.sql), byte-for-byte the same
-- encoding as dyck_path's steps; the peak-count grade (k) is a fibering distinction over the same carrier
-- shape, not a different geometry. Reuses lattice_path_svg (glyphs.sql:20) as-is.
CREATE FUNCTION glyph_svg(p narayana_dyck) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lattice_path_svg((p).steps) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders narayana_dyck via the shared lattice-path helper','eq','<svg…</svg>','narayana_numbers(4,1) rank 0 = UUUUDDDD (the single-peak path)',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(narayana_numbers(4,1),0)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for narayana_dyck','eq','true','glyph_svg(narayana_dyck) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('narayana_dyck')::text $q$),
  ('glyphs','narayana_dyck and dyck_path glyph identically for the same step word','eq','true','same ±1 carrier shape; peak-count is a fibering distinction, not a geometry change',$q$
    SELECT (glyph_svg(ROW(ARRAY[1,1,-1,-1])::narayana_dyck) = glyph_svg(ROW(ARRAY[1,1,-1,-1])::dyck_path))::text $q$);
