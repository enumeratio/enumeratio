-- requires: constructions
-- requires-tag: collection
-- permutations-plus half of sqlsrc/constructions.sql (#283 phase 3 extraction) — core keeps the construction/
-- construction_param tables (pure meta, no per-collection FK) plus base_alpha/example rows for core collections;
-- this pack carries its own base_alpha bindings and examples, split out because base_alpha.collection
-- REFERENCES base_collection — a permutations-plus row in the core file would FK-fail loading core alone.
-- requires-tag: collection (scoped to this pack's own files by orderFiles) ensures every collection named below
-- (lehmer_codes, endofunctions, k_colored_permutations, signed_permutations, surjections_onto_k, arrangements)
-- has already loaded.

INSERT INTO base_alpha (collection, construction, pos, type_former, param, alpha_axis, generic, note) VALUES
  ('lehmer_codes',    'dependent_words', 1, 'Fin', 'n - i', 'size', false, 'mixed radix: place i (1-based) draws from Fin (n − i), a DECLINING radix ⇒ ∏(n−i) = n!; the factorial base'),
  ('endofunctions',   'maps',            1, 'Fin', 'n',     'n',    false, 'domain Fin n'),
  ('endofunctions',   'maps',            2, 'Fin', 'n',     'n',    false, 'codomain Fin n = the DOMAIN — the diagonal β = α (parametric, not dependent); nⁿ'),
  -- products: a collection-former fills each hole; the param is the factor's argument list in THIS collection's axes
  ('k_colored_permutations', 'product', 1, 'permutations', 'size',        'size',   false, 'a permutation of [size]'),
  ('k_colored_permutations', 'product', 2, 'words',        'size, colors','colors', true,  'a colour word: maps(Fin size, Fin colors) = words(size, colors); colors is the hole ⇒ generic. ℤ_k ≀ Sₙ, kⁿ·n!'),
  ('signed_permutations',    'product', 1, 'permutations', 'size',        'size',   false, 'a permutation of [size]'),
  ('signed_permutations',    'product', 2, 'words',        'size, 2',     NULL,     false, 'the sign word: words(size, 2) — the colour count PINNED at 2 (Bₙ = ℤ₂ ≀ Sₙ, 2ⁿ·n!)');
-- RESTRICTED applications: a sub-family of a construction's output that keeps its own carrier — see core's
-- constructions.sql for the fuller comment on what `restricted` means.
INSERT INTO base_alpha (collection, construction, pos, type_former, param, alpha_axis, generic, restricted, note) VALUES
  ('surjections_onto_k', 'maps', 1, 'Fin', 'n', 'n', false, 'surjective', 'domain Fin n'),
  ('surjections_onto_k', 'maps', 2, 'Fin', 'k', 'k', false, 'surjective', 'codomain Fin k, every letter used — the surjective maps [n] ↠ [k]; k!·S(n,k) ≤ kⁿ'),
  ('arrangements',       'maps', 1, 'Fin', 'length', 'length', false, 'injective', 'domain Fin length — the word''s length'),
  ('arrangements',       'maps', 2, 'Fin', 'size',   'size',   false, 'injective', 'codomain Fin size, no letter twice — the injective maps [k] ↪ [n]; n!/(n−k)! ≤ nᵏ');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('constructions','lehmer_codes instantiates dependent_words as a DECLINING radix: place i draws from Fin (n − i)','eq','dependent_words|Fin (n - i)','the mixed-radix / factorial base, reconstructed from former+param',$q$
    SELECT construction || '|' || alpha FROM base_collection_construction WHERE collection='lehmer_codes' $q$),
  ('constructions','maps α → β is a TWO-hole construction; endofunctions instantiates it (the diagonal β = α)','eq','true','the maps family, permutations-plus half',$q$
    SELECT (SELECT array_agg(DISTINCT collection) FROM base_alpha WHERE construction='maps') @> ARRAY['endofunctions']::text[] $q$),
  ('constructions','the view is still ONE row per collection, with the multi-hole signature spelled out: endofunctions, lehmer_codes','eq','Fin n → Fin n|∀ i, Fin (n - i)','signature = skeleton with every hole filled',$q$
    SELECT string_agg(signature, '|' ORDER BY o) FROM (VALUES ('endofunctions',1),('lehmer_codes',2)) v(c,o)
      JOIN base_collection_construction b ON b.collection = v.c $q$),
  ('constructions','endofunctions is the DIAGONAL: both holes bound to the same axis (β = α), not a dependent family','eq','n|n|false','diagonalization is parametric',$q$
    SELECT (SELECT param FROM base_alpha WHERE collection='endofunctions' AND pos=1) || '|' ||
           (SELECT param FROM base_alpha WHERE collection='endofunctions' AND pos=2) || '|' ||
           (SELECT dependent FROM base_construction_param WHERE construction='maps' AND pos=2)::text $q$),
  ('constructions','PRIMARY instances include endofunctions (its grade chain n is the bound axis)','eq','true','base_construction_primary',$q$
    SELECT EXISTS (SELECT 1 FROM base_construction_primary WHERE collection='endofunctions')::text $q$),
  ('constructions','the wreath product as data: k_colored_permutations = permutations(size) × words(size, colors); signed_permutations pins colors at 2','eq','permutations(size) × words(size, colors)|permutations(size) × words(size, 2)|true|false','a product whose factors are collections; the alias is the pinned point',$q$
    SELECT (SELECT signature FROM base_collection_construction WHERE collection = 'k_colored_permutations') || '|' ||
           (SELECT signature FROM base_collection_construction WHERE collection = 'signed_permutations') || '|' ||
           (SELECT generic FROM base_collection_construction WHERE collection = 'k_colored_permutations')::text || '|' ||
           (SELECT generic FROM base_collection_construction WHERE collection = 'signed_permutations')::text $q$),
  ('constructions','the product oracle: |permutations(n)| · |words(n, k)| = n!·kⁿ == fiber_count on k_colored and signed permutations','eq','true','c1 * c2 with each factor''s cardinality read off its own collection',$q$
    SELECT ((SELECT bool_and(construction_cardinality(f) = cardinality(f)) FROM fibers(k_colored_permutations(4)) f)
        AND (SELECT bool_and(construction_cardinality(f) = cardinality(f)) FROM fibers(signed_permutations(0, 5)) f))::text $q$),
  -- restricted applications: surjections and arrangements are sub-families of maps, with their own carriers
  ('constructions','surjections_onto_k ⊂ maps(Fin n, Fin k): every surjection''s value array is a word of words(n, k), and k!·S(n,k) ≤ kⁿ','eq','true','containment proven on the arrays (renders differ across carriers)',$q$
    SELECT bool_and(ok)::text FROM (
      SELECT n, k, (SELECT bool_and(((s).value).values IN (SELECT ((w).value).letters FROM elements(words(n, k)) w)) FROM elements(surjections_onto_k(n, k)) s)
                   AND cardinality(surjections_onto_k(n, k)) <= cardinality(words(n, k)) AS ok
        FROM (VALUES (3, 2), (4, 2), (4, 3), (3, 3)) v(n, k)) t $q$),
  ('constructions','arrangements ⊂ maps(Fin k, Fin n): every arrangement''s word is a word of words(k, n), and n!/(n−k)! ≤ nᵏ','eq','true','the injective sub-family',$q$
    SELECT bool_and(ok)::text FROM (
      SELECT n, k, (SELECT bool_and(((a).value).word IN (SELECT ((w).value).letters FROM elements(words(k, n)) w)) FROM elements(arrangements(n, k)) a)
                   AND cardinality(arrangements(n, k)) <= cardinality(words(k, n)) AS ok
        FROM (VALUES (3, 2), (4, 2), (4, 3), (3, 3)) v(n, k)) t $q$),
  ('constructions','a restricted application is outside the product formula and the primary set: the oracle abstains','eq','true|false|false','the ADT cardinality is the WHOLE application''s',$q$
    SELECT (construction_cardinality(ROW(4, 2)::surjections_onto_k_fiber) IS NULL)::text || '|' ||
           EXISTS (SELECT 1 FROM base_construction_primary WHERE collection IN ('surjections_onto_k', 'arrangements'))::text || '|' ||
           (SELECT bool_or(restricted IS NULL) FROM base_alpha WHERE collection = 'arrangements')::text $q$),
  ('constructions','construction_cardinality == cardinality on endofunctions'' small fibers: n^n','eq','true','the ADT cardinality as a self-cert differential over fiber_count',$q$
    SELECT bool_and(construction_cardinality(f) = cardinality(f))::text FROM fibers(endofunctions(0, 4)) f $q$),
  ('constructions','the oracle abstains where the instance is a dependent (mixed-radix) family: lehmer_codes (∏ᵢ|πᵢ|)','eq','true','NULL, not a wrong number',$q$
    SELECT (construction_cardinality(ROW(4)::lehmer_codes_fiber) IS NULL)::text $q$);
