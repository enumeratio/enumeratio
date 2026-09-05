-- requires: base_species
-- requires-tag: collection
-- (same reason as core's base_species.sql: this INSERTs species rows for number-sets collections, so it must
-- load after every one of this pack's OWN collection files — the tag slurps them, scoped to this pack per
-- orderFiles.)
-- number-sets half of sqlsrc/base_species.sql's figurate-sequence block (#283 phase 3 extraction) — the
-- polygonal/pyramidal number-sets collections, split out because base_species is a core-owned TABLE and this
-- pack may only INSERT rows into it (§3.3 pack contract), never edit core's own INSERT statement.

INSERT INTO base_species (collection, expr, egf, note, unlabelled) VALUES
  ('pentagonal_numbers',      'X·(1+2·X)/(1-X)^3',    '\frac{x(1+2x)}{(1-x)^3}',  'n(3n−1)/2; 0,1,5,12,…',    true),
  ('hexagonal_numbers',       'X·(1+3·X)/(1-X)^3',    '\frac{x(1+3x)}{(1-x)^3}',  'n(2n−1); 0,1,6,15,28,…',   true),
  ('pronic_numbers',          '2·X/(1-X)^3',          '\frac{2x}{(1-x)^3}',       'n(n+1); 0,2,6,12,20,…',    true),
  ('tetrahedral_numbers',     'X/(1-X)^4',            '\frac{x}{(1-x)^4}',        'C(n+2,3); 0,1,4,10,20,…',  true),
  ('square_pyramidal_numbers','X·(1+X)/(1-X)^4',      '\frac{x(1+x)}{(1-x)^4}',   'Σk²; 0,1,5,14,30,55,…',    true),
  ('pentatope_numbers',       'X/(1-X)^5',            '\frac{x}{(1-x)^5}',        'C(n+3,4); 0,1,5,15,35,…',  true),
  ('heptagonal_numbers',      'X·(1+4·X)/(1-X)^3',    '\frac{x(1+4x)}{(1-x)^3}',  'n(5n−3)/2; 0,1,7,18,…',    true),
  ('octagonal_numbers',       'X·(1+5·X)/(1-X)^3',    '\frac{x(1+5x)}{(1-x)^3}',  'n(3n−2); 0,1,8,21,40,…',   true),
  ('centered_triangular_numbers','(1+X+X^2)/(1-X)^3', '\frac{1+x+x^2}{(1-x)^3}',  '1+3·T_n; 1,4,10,19,…',     true),
  ('centered_square_numbers', '(1+2·X+X^2)/(1-X)^3',  '\frac{1+2x+x^2}{(1-x)^3}', '1+4·T_n; 1,5,13,25,…',     true),
  ('centered_hexagonal_numbers','(1+4·X+X^2)/(1-X)^3','\frac{1+4x+x^2}{(1-x)^3}', '1+6·T_n; 1,7,19,37,61,…',  true),
  ('star_numbers',            '(1+10·X+X^2)/(1-X)^3', '\frac{1+10x+x^2}{(1-x)^3}','centered 12-gonal; 1,13,37,…', true);
