-- requires: integer_compositions, realizer, subsets, utilities
-- compositions_into_k_parts — ordered sequences of EXACTLY k positive parts summing to n. Multi-grade chain
-- [n (ground total), k (number of parts)]; k defaults to its full range 1..n, so compositions_into_k_parts(n)
-- unfolds fibers over k and the global order is (n, k, ordinality). Reuses the `composition` carrier + its
-- notation from integer_compositions, and `binomial` from subsets; base_realize generates the full surface.
--
-- Fiber [n,k] = compositions of n into k positive parts, in LEXICOGRAPHIC order of the parts array
-- (e.g. [4,2] ⇒ 1+3, 2+2, 3+1). count of a fiber = C(n-1, k-1) (stars-and-bars: k-1 cuts among n-1 gaps);
-- summed over k=1..n that telescopes to 2^(n-1), matching integer_compositions(n).

-- ── the FLOOR: build compositions part-by-part, each part ≥ 1, leaving enough for the rest; emit in lex order ──
-- State = (parts so far, remaining sum, parts still to place). At each step pick the next part a in
-- [1, rem-(remaining_parts-1)] so the tail (each ≥1) still fits; when remaining_parts = 1 force a = rem to
-- land exactly. `rem >= remaining_parts` prunes infeasible states (and keeps every emitted part positive).
-- The collection OWNS its fiber type — a named typed-axis struct (n, then k), each a natural_number;
-- base_realize introspects it → a natural_range handle. (Migrated from the legacy int[] address.)
CREATE TYPE compositions_into_k_parts_fiber AS (n natural_number, k natural_number);
CREATE FUNCTION fiber_elements(f compositions_into_k_parts_fiber, element_limit int) RETURNS SETOF composition LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS parts, (f).n::int AS rem, (f).k::int AS remaining_parts
    UNION ALL
    SELECT parts || a, rem - a, remaining_parts - 1
      FROM build,
           LATERAL generate_series(CASE WHEN remaining_parts = 1 THEN rem ELSE 1 END,
                                   rem - (remaining_parts - 1)) a
     WHERE remaining_parts > 0 AND rem >= remaining_parts
  )
  SELECT ROW(parts)::composition FROM build
   WHERE remaining_parts = 0 AND rem = 0
   ORDER BY parts
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f compositions_into_k_parts_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT binomial((f).n::int - 1, (f).k::int - 1)::numeric $$;                 -- C(n-1, k-1); 0 when infeasible
CREATE FUNCTION contains_in_fiber(f compositions_into_k_parts_fiber, v composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).parts, 1), 0) = (f).k                       -- exactly k parts
     AND coalesce((SELECT sum(p) FROM unnest((v).parts) p), 0) = (f).n          -- summing to n
     AND NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p <= 0) $$;        -- all positive

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('compositions_into_k_parts', 'composition');
INSERT INTO base_grade VALUES
  ('compositions_into_k_parts', 1, 'n', NULL, NULL),
  ('compositions_into_k_parts', 2, 'k', '1', 'g1');                            -- k ranges 1..n
SELECT base_realize('compositions_into_k_parts');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('compositions_into_k_parts','compositions of 4 into 2 parts in lex order','eq','1+3,2+2,3+1','the realized floor for fiber [4,2]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(compositions_into_k_parts(4,2)) e $q$),
  ('compositions_into_k_parts','anchor |compositions of 4 into 2 parts| = 3 (accel)','eq','3','C(4-1,2-1) = C(3,1)',$q$
    SELECT cardinality(compositions_into_k_parts(4,2))::text $q$),
  ('compositions_into_k_parts','fiber counts for n=5 are C(4,k-1): 1,4,6,4,1','eq','1,4,6,4,1','k = 1..5',$q$
    SELECT string_agg(cardinality(compositions_into_k_parts(5,k))::text, ',' ORDER BY k) FROM generate_series(1,5) k $q$),
  ('compositions_into_k_parts','k RANGE: cardinality(compositions_into_k_parts(4)) = 8 = 2^(4-1)','eq','8','fibers unfold over k=1..4',$q$
    SELECT cardinality(compositions_into_k_parts(4))::text $q$),
  ('compositions_into_k_parts','multi-grade chain: fiber = (n,k) named axes','eq','4|2','unrank(compositions_into_k_parts(4,2), 0).fiber is (n=4,k=2)',$q$
    SELECT (unrank(compositions_into_k_parts(4,2), 0)).fiber.n::text || '|' || (unrank(compositions_into_k_parts(4,2), 0)).fiber.k::text $q$),
  ('compositions_into_k_parts','fibers(compositions_into_k_parts(4)) unfold to k = 1,2,3,4','eq','1,2,3,4','the second grade ranges 1..n',$q$
    SELECT string_agg((f).k::text, ',' ORDER BY (f).k) FROM fibers(compositions_into_k_parts(4)) f $q$),
  ('compositions_into_k_parts','every element of fiber [4,2] has 2 positive parts summing to 4','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(array_length(((e).value).parts,1) = 2
                AND (SELECT coalesce(sum(p),0) FROM unnest(((e).value).parts) p) = 4)::text
      FROM elements(compositions_into_k_parts(4,2)) e $q$),
  ('compositions_into_k_parts','global order = (n,k,ordinality): all of compositions_into_k_parts(3)','eq','3,1+2,2+1,1+1+1','k ascending, lex within',$q$
    SELECT string_agg(notation(v), ',' ORDER BY rk) FROM (
      SELECT (e).value v, row_number() OVER (ORDER BY e) rk FROM elements(compositions_into_k_parts(3)) e) s $q$),
  ('compositions_into_k_parts','unrank crosses k-fibers (rank 2 of compositions_into_k_parts(3) = 2+1)','eq','2+1','ranks 0..3 are k=1,2,2,3',$q$
    SELECT notation((unrank(compositions_into_k_parts(3), 2)).value) $q$),
  ('compositions_into_k_parts','contains via <@: 1+3 ∈ (4,2), 1+3 ∉ (4,3), 2+2 ∈ (4,2)','eq','true|false|true','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[1,3])::composition <@ compositions_into_k_parts(4,2))::text || '|' ||
           (ROW(ARRAY[1,3])::composition <@ compositions_into_k_parts(4,3))::text || '|' ||
           (ROW(ARRAY[2,2])::composition <@ compositions_into_k_parts(4,2))::text $q$);
