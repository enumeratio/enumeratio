-- requires: natural_numbers, number-predicates, k_free_integers
-- square_free_numbers — the naturals with no repeated prime factor (every exponent = 1 ⇔ Ω=ω), A005117:
-- 1,2,3,5,6,7,10,… A base_restrict SPECIALIZATION of natural_numbers: same numeric carrier, the floor filters the
-- naturals ascending by is_square_free_number (which delegates to the factored carrier — single source of truth).
-- Ungraded / unbounded, so the over-scan window carries the ~6/π² ≈ 0.61 density.
SELECT base_restrict('square_free_numbers', 'natural_numbers', 'is_square_free_number');
-- (#67) square_free_numbers is the k=2 point of k_free_integers (realized point).
INSERT INTO base_family_point (collection, family, bindings) VALUES ('square_free_numbers', 'k_free_integers', '{"k": 2}');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('square_free_numbers','first ten square-free via the realized floor','eq','1,2,3,5,6,7,10,11,13,14','a restriction of the naturals',$q$
    SELECT string_agg((e).value::text, ',' ORDER BY ordinality(e)) FROM elements(square_free_numbers(), 10) e $q$),
  ('square_free_numbers','unrank(4) = 6 (rank 4, 0-based)','eq','6','off the floor: 1,2,3,5,6,…',$q$
    SELECT (unrank(square_free_numbers(), 4)).value::text $q$),
  ('square_free_numbers','cardinality = infinity (unbounded)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(square_free_numbers())::text $q$),
  ('square_free_numbers','contains via <@: 10 ∈, 12 ∉, 1 ∈','eq','true|false|true','delegates to is_square_free(factored); 12=2²·3 is not square-free',$q$
    SELECT (10::numeric <@ square_free_numbers())::text || '|' || (12::numeric <@ square_free_numbers())::text || '|' || (1::numeric <@ square_free_numbers())::text $q$),
  ('square_free_numbers','count of square-free ≤ 30 is 19','eq','19','via the realized membership operator (density ≈ 6/π²)',$q$
    SELECT count(*)::text FROM generate_series(1,30) n WHERE n::numeric <@ square_free_numbers() $q$),
  ('square_free_numbers','the family-tree edge: parent is natural_numbers','eq','natural_numbers|is_square_free_number','base_collection_parent records the specialization',$q$
    SELECT parent || '|' || predicate FROM base_collection_parent WHERE collection = 'square_free_numbers' $q$),
  ('square_free_numbers','(#67) square_free_numbers ≡ k_free_integers(k => 2), element-for-element (first 20)','eq','true','the point differential',$q$
    SELECT (
      (SELECT array_agg((e).value ORDER BY ordinality(e)) FROM elements(square_free_numbers(), 20) e)
      = (SELECT array_agg((e).value ORDER BY ordinality(e)) FROM elements(k_free_integers(2), 20) e))::text $q$);
