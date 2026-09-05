-- requires: surjections, realizer, utilities
-- surjections_onto_k — the surjections [n] ↠ [k]: surjection words of length n using EXACTLY the letters {1..k},
-- graded by (n, k). The (n,k) REFINEMENT of `surjections` (which grades by n alone, summing over k = Fubini) —
-- fiber (n,k) holds the surj(n,k) = k!·S(n,k) words (OEIS A019538, the surjection triangle). It is to surjections
-- what set_partitions_into_k_blocks is to set_partitions: the ordered analogue, and the word-side of Sage's
-- OrderedSetPartitions(n,k). Same `surjection` carrier; reuses set_compositions' per-k surjective-word generator.
CREATE TYPE surjections_onto_k_fiber AS (n natural_number, k natural_number);   -- axes: n, k (image size)
CREATE FUNCTION fiber_elements(f surjections_onto_k_fiber, element_limit int) RETURNS SETOF surjection LANGUAGE sql STABLE AS $$
  SELECT ROW(w)::surjection FROM set_composition_surjections((f).n::int, (f).k::int) AS g(w) ORDER BY w LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f surjections_onto_k_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT factorial((f).k::int) * stirling_second((f).n::int, (f).k::int) $$;   -- surj(n,k) = k!·S(n,k)
CREATE FUNCTION contains_in_fiber(f surjections_onto_k_fiber, v surjection) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$   -- length n, image EXACTLY {1..k}
  SELECT coalesce(array_length((v).values, 1), 0) = (f).n
     AND coalesce((SELECT array_agg(DISTINCT x ORDER BY x) FROM unnest((v).values) x), '{}'::int[]) = ARRAY(SELECT generate_series(1, (f).k::int)) $$;   -- coalesce: the empty surjection (n=k=0) has no values, array_agg over it is NULL not '{}'
CREATE FUNCTION fiber_symbol(f surjections_onto_k_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'Surj(' || (f).n::int || ',' || (f).k::int || ')' $$;

INSERT INTO base_collection VALUES ('surjections_onto_k', 'surjection');
INSERT INTO base_grade VALUES ('surjections_onto_k', 1, 'n', NULL, NULL), ('surjections_onto_k', 2, 'k', '0', 'g1');   -- k = image size, 0..n
-- direct unrank: exactly-k surjective-word unrank (set_compositions.sql's surjection_unrank_word, no block search
-- needed since k is already fixed by the fiber).
CREATE FUNCTION fiber_unrank(f surjections_onto_k_fiber, rank rank_index) RETURNS surjection LANGUAGE sql IMMUTABLE AS $fu$
  SELECT ROW(surjection_unrank_word((f).n::int, (f).k::int, rank::bigint))::surjection $fu$;
SELECT base_realize('surjections_onto_k');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('surjections_onto_k','the surjection triangle surj(n,k)=k!·S(n,k): row n=3 is 0,6,6 (k=0,1,2,3 ⇒ 0,1,6,6)','eq','0,1,6,6','fiber counts across k',$q$
    SELECT string_agg(cardinality(surjections_onto_k(3,k))::text, ',' ORDER BY k) FROM generate_series(0,3) k $q$),
  ('surjections_onto_k','k unfolds to Fubini: |surjections_onto_k(3)| = Σ_k = 13 = |surjections(3)|','eq','13|13','the (n,k) refinement sums to the n-grading',$q$
    SELECT cardinality(surjections_onto_k(3))::text || '|' || cardinality(surjections(3))::text $q$),
  ('surjections_onto_k','surjections_onto_k(3,2) = the 6 words onto {1,2}, in lex order','eq','1,1,2|1,2,1|1,2,2|2,1,1|2,1,2|2,2,1','exactly two letters, both used',$q$
    SELECT string_agg(notation((e).value), '|' ORDER BY ordinality(e)) FROM elements(surjections_onto_k(3,2)) e $q$),
  ('surjections_onto_k','fiber = (n,k) typed axes; unrank(surjections_onto_k(3,2),0).fiber','eq','3|2','the two grades',$q$
    SELECT (unrank(surjections_onto_k(3,2),0)).fiber.n::text || '|' || (unrank(surjections_onto_k(3,2),0)).fiber.k::text $q$),
  ('surjections_onto_k','contains the empty surjection of (0,0) (#295: array_agg over the empty word is NULL, not the empty set)','eq','true',$q$the sole element of surjections_onto_k(0,0)$q$,$q$
    SELECT contains(surjections_onto_k(0,0), (unrank(surjections_onto_k(0,0), 0::rank_index)).value)::text $q$),
  ('surjections_onto_k','contains via <@: {1,2,1} ∈ surjections_onto_k(3,2), ∉ (3,3) (only 2 letters), {1,3,2}∈(3,3)','eq','true|false|true','image exactly [k]',$q$
    SELECT (ROW(ARRAY[1,2,1])::surjection <@ surjections_onto_k(3,2))::text || '|' ||
           (ROW(ARRAY[1,2,1])::surjection <@ surjections_onto_k(3,3))::text || '|' ||
           (ROW(ARRAY[1,3,2])::surjection <@ surjections_onto_k(3,3))::text $q$),
  ('surjections_onto_k','set_notation: first word onto {1,2,3} ↦ 1,2,3 ∈ Surj(3,3)','eq','1,2,3 ∈ Surj(3,3)','matches numbers'' Surj(n,k) symbol',$q$
    SELECT set_notation(unrank(surjections_onto_k(3,3), 0)) $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('surjections_onto_k','fiber_unrank(surjections_onto_k(5,3), 0..) are all members (accel floor)','eq','true','exactly-k surjective-word unrank lands inside surj(5,3)=150 for every rank',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(surjections_onto_k(5,3)) f), ord::rank_index) <@ surjections_onto_k(5,3))::text
      FROM generate_series(0, cardinality(surjections_onto_k(5,3))::int - 1) ord $q$);
