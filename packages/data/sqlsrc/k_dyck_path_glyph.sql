-- requires: k_dyck_paths, glyphs
-- k_dyck_path_glyph — k_dyck_path's steps are already signed height deltas (+(k−1) up, −1 down; see
-- k_dyck_paths.sql), the same shape lattice_path_svg (glyphs.sql:20) expects: one unit of x-width per step,
-- y = running height. No k-specific geometry needed — the walk just gets taller per up-step at higher k.
CREATE FUNCTION glyph_svg(p k_dyck_path) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT lattice_path_svg((p).steps) $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('glyphs','glyph_svg renders k_dyck_path via the shared lattice-path helper','eq','<svg…</svg>','k_dyck_paths(2,3) rank 2 = UUDDDD',$q$
    SELECT left(g,4) || '…' || right(g,6) FROM (SELECT glyph_svg((unrank(k_dyck_paths(2,3),2)).value) g) s $q$),
  ('glyphs','carrier_renders_svg is now true for k_dyck_path','eq','true','glyph_svg(k_dyck_path) overload alone lights this up — no base_glyph row',$q$
    SELECT carrier_renders_svg('k_dyck_path')::text $q$),
  ('glyphs','glyph_svg(k_dyck_path) dispatches straight to lattice_path_svg','eq','true','same wiring as dyck_path/motzkin_path',$q$
    SELECT (glyph_svg(ROW(ARRAY[2,2,-1,-1,-1,-1])::k_dyck_path) = lattice_path_svg(ARRAY[2,2,-1,-1,-1,-1]))::text $q$),
  ('glyphs','k=3 walk peaks higher than k=2 for the same up-step count (rise (k−1) per up-step)','eq','true','viewBox height tracks (k-1) via the step magnitude, not a fixed ±1',$q$
    SELECT (substring(glyph_svg((unrank(k_dyck_paths(2,3),2)).value) FROM 'viewBox="-1 -1 [0-9.]+ ([0-9.]+)"')::numeric
          > substring(glyph_svg((unrank(k_dyck_paths(2,2),2)).value) FROM 'viewBox="-1 -1 [0-9.]+ ([0-9.]+)"')::numeric)::text $q$);
