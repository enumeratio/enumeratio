-- requires: generating_functions
-- requires-tag: collection
-- number-sets figurate/simplex COUNTING SEQUENCES, re-filed as rational OGFs into base_generating_function (builder
-- gf_rational) — the pack half of #274 B3's re-file. These 12 are number-sets-pack collections, so their rows live
-- here rather than core sqlsrc/generating_functions.sql (a core file can't reference a pack collection). They are
-- unbounded number sequences, NOT species — #274 moved the whole figurate family off base_species (now a compat
-- view over base_collection_species). Rows default to pack='number-sets' via enumeratio.pack.
INSERT INTO base_generating_function (collection, stat_id, kind, builder, arity, note, findstat, num, den) VALUES
  ('pentagonal_numbers',          NULL, 'ogf', 'gf_rational', 1, 'x(1+2x)/(1-x)^3; n(3n−1)/2; 0,1,5,12,…',  NULL, ARRAY[0,1,2]::numeric[],  ARRAY[1,-3,3,-1]::numeric[]),
  ('hexagonal_numbers',           NULL, 'ogf', 'gf_rational', 1, 'x(1+3x)/(1-x)^3; n(2n−1); 0,1,6,15,28,…',  NULL, ARRAY[0,1,3]::numeric[],  ARRAY[1,-3,3,-1]::numeric[]),
  ('pronic_numbers',              NULL, 'ogf', 'gf_rational', 1, '2x/(1-x)^3; n(n+1); 0,2,6,12,20,…',        NULL, ARRAY[0,2]::numeric[],    ARRAY[1,-3,3,-1]::numeric[]),
  ('heptagonal_numbers',          NULL, 'ogf', 'gf_rational', 1, 'x(1+4x)/(1-x)^3; n(5n−3)/2; 0,1,7,18,…',   NULL, ARRAY[0,1,4]::numeric[],  ARRAY[1,-3,3,-1]::numeric[]),
  ('octagonal_numbers',           NULL, 'ogf', 'gf_rational', 1, 'x(1+5x)/(1-x)^3; n(3n−2); 0,1,8,21,40,…',  NULL, ARRAY[0,1,5]::numeric[],  ARRAY[1,-3,3,-1]::numeric[]),
  ('centered_triangular_numbers', NULL, 'ogf', 'gf_rational', 1, '(1+x+x^2)/(1-x)^3; 1+3·T_n; 1,4,10,19,…',  NULL, ARRAY[1,1,1]::numeric[],  ARRAY[1,-3,3,-1]::numeric[]),
  ('centered_square_numbers',     NULL, 'ogf', 'gf_rational', 1, '(1+2x+x^2)/(1-x)^3; 1+4·T_n; 1,5,13,25,…', NULL, ARRAY[1,2,1]::numeric[],  ARRAY[1,-3,3,-1]::numeric[]),
  ('centered_hexagonal_numbers',  NULL, 'ogf', 'gf_rational', 1, '(1+4x+x^2)/(1-x)^3; 1+6·T_n; 1,7,19,37,…', NULL, ARRAY[1,4,1]::numeric[],  ARRAY[1,-3,3,-1]::numeric[]),
  ('star_numbers',                NULL, 'ogf', 'gf_rational', 1, '(1+10x+x^2)/(1-x)^3; centered 12-gonal; 1,13,37,…', NULL, ARRAY[1,10,1]::numeric[], ARRAY[1,-3,3,-1]::numeric[]),
  ('tetrahedral_numbers',         NULL, 'ogf', 'gf_rational', 1, 'x/(1-x)^4; C(n+2,3); 0,1,4,10,20,…',       NULL, ARRAY[0,1]::numeric[],    ARRAY[1,-4,6,-4,1]::numeric[]),
  ('square_pyramidal_numbers',    NULL, 'ogf', 'gf_rational', 1, 'x(1+x)/(1-x)^4; Σk²; 0,1,5,14,30,55,…',    NULL, ARRAY[0,1,1]::numeric[],  ARRAY[1,-4,6,-4,1]::numeric[]),
  ('pentatope_numbers',           NULL, 'ogf', 'gf_rational', 1, 'x/(1-x)^5; C(n+3,4); 0,1,5,15,35,…',       NULL, ARRAY[0,1]::numeric[],    ARRAY[1,-5,10,-10,5,-1]::numeric[]);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('generating_functions','the number-sets figurate rational-OGF rows (#274 B3, pack half) reproduce their unrank''d element-value sequences, n=0..8','eq','true','gf_rational vs gf_ogf_target''s unbounded (unrank) branch — the 12 pack-owned figurate/simplex sequences',$q$
    SELECT bool_and(gf_agrees(c, NULL, 8))::text FROM (VALUES
      ('pentagonal_numbers'),('hexagonal_numbers'),('pronic_numbers'),('heptagonal_numbers'),('octagonal_numbers'),
      ('centered_triangular_numbers'),('centered_square_numbers'),('centered_hexagonal_numbers'),('star_numbers'),
      ('tetrahedral_numbers'),('square_pyramidal_numbers'),('pentatope_numbers')) v(c) $q$);
