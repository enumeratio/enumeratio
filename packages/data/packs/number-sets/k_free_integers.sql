-- requires: number-theory, realizer, family_relations
-- k_free_integers(k) — the FAMILY (#67): naturals with NO prime appearing to the k-th power or higher, i.e.
-- max_prime_exponent(n) < k. A THRESHOLD family (D1): the exponent-max is a recoverable stat, and k selects the
-- sublevel set — a re-ranking restrict of the naturals (the fibers of max-exponent interleave in value order, so
-- the downset earns its own name), PLUS a declared is_cumulative_of relation to that stat. square_free_numbers is
-- the k=2 realized point; cube_free_numbers the k=3 pointer point (no tower). A005117 (k=2) · A004709 (k=3).
CREATE FUNCTION is_k_free_number(v numeric, k natural_number) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v >= 1 AND max_prime_exponent(v) < k::int $$;   -- exclude 0 (matches is_square_free_number: k=2 ≡ square_free_numbers)
SELECT base_restrict('k_free_integers', 'natural_numbers', 'is_k_free_number', scan_factor => 8,
                     params => ARRAY['k'], admissibles => ARRAY['k >= 2']);
CREATE FUNCTION fiber_symbol(f k_free_integers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'F' || to_unicode_subscript((f).k) $$;   -- matches the render corpus (F₂ = squarefree, F₃ = cubefree)
INSERT INTO base_collection_meta VALUES ('k_free_integers', 'k-free integers', 'Naturals with no prime raised to the k-th power or higher (max exponent < k); k selects the family.');
-- the second, downset reading: k-free = { n : max_prime_exponent(n) < k }
INSERT INTO base_cumulative_of (collection, stat, op, param) VALUES ('k_free_integers', 'max_prime_exponent', '<', 'k');
-- cube_free_numbers: a POINTER point (k=3, no tower) — the router/resolveFrom maps it to k_free_integers(k = 3).
SELECT base_alias('cube_free_numbers', 'k_free_integers', '{"k": 3}');
INSERT INTO base_collection_meta VALUES ('cube_free_numbers', 'Cube-free numbers', 'Naturals not divisible by any cube > 1 (A004709) — k_free_integers at k = 3.');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('k_free_integers','k=2 (square-free), first twelve','eq','1,2,3,5,6,7,10,11,13,14,15,17','A005117 via the param-restrict',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(k_free_integers(2), 12) e $q$),
  ('k_free_integers','k=3 (cube-free), first twelve — includes 4=2² but not 8=2³','eq','1,2,3,4,5,6,7,9,10,11,12,13','A004709',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(k_free_integers(3), 12) e $q$),
  ('k_free_integers','contains via <@: 8 ∉ cube-free (2³), 4 ∈ cube-free, 4 ∉ square-free','eq','false|true|false','the threshold moves with k',$q$
    SELECT (8::numeric <@ k_free_integers(3))::text || '|' || (4::numeric <@ k_free_integers(3))::text || '|' || (4::numeric <@ k_free_integers(2))::text $q$),
  ('k_free_integers','k is role=param (k >= 2)','eq','param|k >= 2','a family parameter',$q$
    SELECT role || '|' || admissible FROM base_grade WHERE collection='k_free_integers' AND name='k' $q$),
  ('k_free_integers','is_cumulative_of the max-exponent stat (the downset reading)','eq','max_prime_exponent|<','#67 D1',$q$
    SELECT stat || '|' || op FROM base_cumulative_of WHERE collection='k_free_integers' $q$),
  ('k_free_integers','cube_free_numbers is the k=3 pointer point (alias_of + base_family_point)','eq','k_free_integers|k_free_integers|3','no tower — resolves to the family',$q$
    SELECT (SELECT alias_of FROM base_collection WHERE id='cube_free_numbers') || '|' ||
           (SELECT family FROM base_family_point WHERE collection='cube_free_numbers') || '|' ||
           (SELECT (bindings->>'k') FROM base_family_point WHERE collection='cube_free_numbers') $q$);
