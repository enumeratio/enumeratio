-- requires: weak_compositions_into_k_parts, realizer
-- weak3_compositions — ordered triples (a,b,c) of NON-NEGATIVE integers with a+b+c = n: the k=3 slice of
-- weak_compositions_into_k_parts, given its own single-grade [n] home. |weak3_compositions(n)| = C(n+2,2) =
-- (n+1)(n+2)/2 — the triangular numbers [[OEIS:A000217]] (shifted: 1,3,6,10,15,… for n=0,1,2,…). These are the
-- degree-n monomials x^a y^b z^c of a 3-variable polynomial ring. Reuses the `weak_composition` carrier + its
-- '+'-joined notation from weak_compositions_into_k_parts; only the fibration differs (k is fixed at 3, not graded).
--
-- Fiber [n] = weak compositions of n into 3 parts, in LEXICOGRAPHIC order of the parts array (a ascending, then b,
-- with c = n−a−b) — the same lex order weak_compositions_into_k_parts(n,3) uses, re-homed under a single grade.

-- ── the FLOOR: pick a,b ≥ 0 with a+b ≤ n; the third part c = n−a−b closes the triple; emit in lex (a,b) order ──
CREATE TYPE weak3_compositions_fiber AS (n natural_number);   -- typed fiber; axis: n (the ground total)
CREATE FUNCTION fiber_elements(f weak3_compositions_fiber, element_limit int) RETURNS SETOF weak_composition LANGUAGE sql STABLE AS $$
  SELECT ROW(ARRAY[a, b, (f).n::int - a - b])::weak_composition
    FROM generate_series(0, (f).n::int) a,
         generate_series(0, (f).n::int) b
   WHERE a + b <= (f).n::int
   ORDER BY a, b                                                       -- lex on (a,b,c); c is determined
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f weak3_compositions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT div(((f).n::numeric + 1) * ((f).n::numeric + 2), 2) $$;       -- C(n+2,2) = T(n+1), the triangular numbers
CREATE FUNCTION contains_in_fiber(f weak3_compositions_fiber, v weak_composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).parts, 1), 0) = 3                   -- exactly three parts
     AND coalesce((SELECT sum(p) FROM unnest((v).parts) p), 0) = (f).n::int   -- summing to n
     AND NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p < 0) $$;       -- all non-negative

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('weak3_compositions', 'weak_composition');
INSERT INTO base_grade VALUES ('weak3_compositions', 1, 'n', NULL, NULL);
-- direct unrank: the exactly-3-parts case of the weak-composition stars-and-bars unrank (lex on (a,b,c), c = n-a-b).
CREATE FUNCTION fiber_unrank(f weak3_compositions_fiber, rank rank_index) RETURNS weak_composition LANGUAGE sql IMMUTABLE AS $fu$
  SELECT weak_composition_unrank((f).n::int, 3, rank::bigint) $fu$;
SELECT base_realize('weak3_compositions');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('weak3_compositions','weak 3-part compositions of 3 in lex order','eq','0+0+3,0+1+2,0+2+1,0+3+0,1+0+2,1+1+1,1+2+0,2+0+1,2+1+0,3+0+0','the realized floor for fiber [3] (anchor)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(weak3_compositions(3)) e $q$),
  ('weak3_compositions','cardinality anchor is the triangular numbers C(n+2,2), n=0..6','eq','1,3,6,10,15,21,28','A000217 shifted — (n+1)(n+2)/2 (accel)',$q$
    SELECT string_agg(cardinality(weak3_compositions(n))::text, ',' ORDER BY n) FROM generate_series(0,6) n $q$),
  ('weak3_compositions','|weak3_compositions(4)| = 15 = C(6,2)','eq','15','the fifth triangular number',$q$
    SELECT cardinality(weak3_compositions(4))::text $q$),
  ('weak3_compositions','every element of fiber [3] has 3 non-negative parts summing to 3','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(array_length(((e).value).parts,1) = 3
                AND (SELECT coalesce(sum(p),0) FROM unnest(((e).value).parts) p) = 3
                AND NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE p < 0))::text
      FROM elements(weak3_compositions(3)) e $q$),
  ('weak3_compositions','unrank first/last of fiber [3]','eq','0+0+3|3+0+0','ranks 0 and 9 (C(5,2)-1)',$q$
    SELECT notation((unrank(weak3_compositions(3), 0)).value) || '|' ||
           notation((unrank(weak3_compositions(3), 9)).value) $q$),
  ('weak3_compositions','element carries a TYPED point fiber + ordinality','eq','4|5','unrank(weak3_compositions(4),5) sits in fiber n=4',$q$
    SELECT (unrank(weak3_compositions(4), 5)).fiber.n::text || '|' || ordinality(unrank(weak3_compositions(4), 5))::text $q$),
  ('weak3_compositions','n RANGE: cardinality(weak3_compositions(0,3)) sums T(1..4)','eq','20','1 + 3 + 6 + 10',$q$
    SELECT cardinality(weak3_compositions(0,3))::text $q$),
  ('weak3_compositions','fibers(weak3_compositions(0,3)) unfold to n = 0,1,2,3','eq','0,1,2,3','the single grade ranges',$q$
    SELECT string_agg((f).n::text, ',' ORDER BY (f).n) FROM fibers(weak3_compositions(0,3)) f $q$),
  ('weak3_compositions','contains via <@: 1+2+1 ∈ (4), 1+2+1 ∉ (3), 2+2+0 ∈ (4), 1+3 ∉ (4) (only 2 parts)','eq','true|false|true|false','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[1,2,1])::weak_composition <@ weak3_compositions(4))::text || '|' ||
           (ROW(ARRAY[1,2,1])::weak_composition <@ weak3_compositions(3))::text || '|' ||
           (ROW(ARRAY[2,2,0])::weak_composition <@ weak3_compositions(4))::text || '|' ||
           (ROW(ARRAY[1,3])::weak_composition   <@ weak3_compositions(4))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('weak3_compositions','fiber_unrank(weak3_compositions(5), 0..) are all members (accel floor)','eq','true','direct unrank lands inside the C(7,2)=21 fiber',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(weak3_compositions(5)) f), ord::rank_index) <@ weak3_compositions(5))::text
      FROM generate_series(0, cardinality(weak3_compositions(5))::int - 1) ord $q$);
