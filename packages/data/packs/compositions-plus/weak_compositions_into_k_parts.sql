-- requires: realizer, subsets, utilities
-- weak_compositions_into_k_parts — ordered sequences of EXACTLY k NON-NEGATIVE parts (zeros allowed) summing to
-- n. Multi-grade chain [n (ground total), k (number of parts)]; k defaults to its full range 0..n, so
-- weak_compositions_into_k_parts(n) unfolds fibers over k and the global order is (n, k, ordinality). A fresh
-- `weak_composition` carrier (distinct from `composition`, whose invariant is strictly positive parts).
--
-- Fiber [n,k] = weak compositions of n into k parts, in LEXICOGRAPHIC order of the parts array
-- (e.g. [3,2] ⇒ 0+3, 1+2, 2+1, 3+0). count of a fiber = C(n+k-1, k-1) for k≥1 (stars-and-bars: k-1 dividers
-- among n+k-1 slots); k=0 is a special case — the single empty tuple when n=0, none otherwise.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE weak_composition AS (parts int[]);                        -- ordered non-negative parts; {0,3} = 0 then 3
CREATE FUNCTION notation(c weak_composition) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT array_to_string((c).parts, '+') $$;

-- ── the FLOOR: build weak compositions part-by-part, each part ≥ 0; emit in lex order ──────────────────
-- State = (parts so far, remaining sum, parts still to place). At each step pick the next part a in [0, rem]
-- (any value fits since later parts may be 0 too); when remaining_parts = 1 force a = rem to land exactly.
-- k=0 needs no special case: the base row (empty parts, rem=n, remaining_parts=0) survives the final filter
-- only when n=0, giving the single empty tuple; for n>0 it's filtered out, giving zero rows.
-- The collection OWNS its fiber type — a named typed-axis struct whose SIGNATURE is the fibration (n, then k), each
-- a natural_number. Its hooks are the generic overloaded fiber_elements / fiber_count / contains_in_fiber, dispatched
-- on weak_compositions_into_k_parts_fiber. base_realize introspects it → a natural_range handle.
CREATE TYPE weak_compositions_into_k_parts_fiber AS (n natural_number, k natural_number);
CREATE FUNCTION fiber_elements(f weak_compositions_into_k_parts_fiber, element_limit int) RETURNS SETOF weak_composition LANGUAGE sql STABLE AS $$
  WITH RECURSIVE build AS (
    SELECT ARRAY[]::int[] AS parts, (f).n::int AS rem, (f).k::int AS remaining_parts
    UNION ALL
    SELECT parts || a, rem - a, remaining_parts - 1
      FROM build,
           LATERAL generate_series(CASE WHEN remaining_parts = 1 THEN rem ELSE 0 END, rem) a
     WHERE remaining_parts > 0
  )
  SELECT ROW(parts)::weak_composition FROM build
   WHERE remaining_parts = 0 AND rem = 0
   ORDER BY parts
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f weak_compositions_into_k_parts_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (f).k::int = 0 THEN ((f).n::int = 0)::int::numeric        -- k=0: 1 iff n=0, else 0
              ELSE binomial((f).n::int + (f).k::int - 1, (f).k::int - 1)::numeric END $$;   -- C(n+k-1, k-1)
CREATE FUNCTION contains_in_fiber(f weak_compositions_into_k_parts_fiber, v weak_composition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).parts,1), 0) = (f).k::int                 -- exactly k parts
     AND coalesce((SELECT sum(p) FROM unnest((v).parts) p), 0) = (f).n::int   -- summing to n
     AND NOT EXISTS (SELECT 1 FROM unnest((v).parts) p WHERE p < 0) $$;       -- all non-negative

-- ── declare as DATA + realize ────────────────────────────────────────────────────────────────────────
INSERT INTO base_collection VALUES ('weak_compositions_into_k_parts', 'weak_composition');
INSERT INTO base_grade VALUES
  ('weak_compositions_into_k_parts', 1, 'n', NULL, NULL),
  ('weak_compositions_into_k_parts', 2, 'k', '0', 'g1');                     -- k ranges 0..n by default
-- direct unrank: lex over parts (first part ascending, 0 allowed). #weak compositions of `rem` into `rp` parts with
-- first part = a is C(rem-a + rp-2, rp-2); walk a up subtracting blocks, then recurse. rp=0 ⇒ the empty tuple (n=0).
CREATE FUNCTION weak_composition_unrank(n int, k int, ord bigint) RETURNS weak_composition LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE parts int[] := '{}'; rem int := n; rp int := k; a int; bs numeric; x numeric := ord; BEGIN
    WHILE rp > 0 LOOP
      IF rp = 1 THEN parts := parts || rem; rem := 0; rp := 0;
      ELSE
        a := 0;
        LOOP bs := binomial(rem - a + rp - 2, rp - 2); EXIT WHEN x < bs; x := x - bs; a := a + 1; END LOOP;
        parts := parts || a; rem := rem - a; rp := rp - 1;
      END IF;
    END LOOP;
    RETURN ROW(parts)::weak_composition;
  END $$;
CREATE FUNCTION fiber_unrank(f weak_compositions_into_k_parts_fiber, rank rank_index) RETURNS weak_composition LANGUAGE sql IMMUTABLE AS $fu$
  SELECT weak_composition_unrank((f).n::int, (f).k::int, rank::bigint) $fu$;
SELECT base_realize('weak_compositions_into_k_parts');

-- ── examples ──────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('weak_compositions_into_k_parts','weak compositions of 3 into 2 parts in lex order','eq','0+3,1+2,2+1,3+0','the realized floor for fiber [3,2] (anchor)',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(weak_compositions_into_k_parts(3,2)) e $q$),
  ('weak_compositions_into_k_parts','anchor |weak comps of 3 into 2 parts| = 4 (accel)','eq','4','C(3+2-1,2-1) = C(4,1)',$q$
    SELECT cardinality(weak_compositions_into_k_parts(3,2))::text $q$),
  ('weak_compositions_into_k_parts','anchor |weak comps of 2 into 3 parts| = 6 (k > n is fine, explicit bind)','eq','6','C(2+3-1,3-1) = C(4,2)',$q$
    SELECT cardinality(weak_compositions_into_k_parts(2,3))::text $q$),
  ('weak_compositions_into_k_parts','weak compositions of 2 into 3 parts in lex order','eq','0+0+2,0+1+1,0+2+0,1+0+1,1+1+0,2+0+0','the realized floor for fiber [2,3]',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(weak_compositions_into_k_parts(2,3)) e $q$),
  ('weak_compositions_into_k_parts','k=0 edge case: only n=0 has a (single, empty) weak composition','eq','1|0','k=0 valid only when n=0',$q$
    SELECT cardinality(weak_compositions_into_k_parts(0,0))::text || '|' || cardinality(weak_compositions_into_k_parts(3,0))::text $q$),
  ('weak_compositions_into_k_parts','fiber counts for n=4 are C(4+k-1,k-1) over k=0..5: 0,1,5,15,35,70','eq','0,1,5,15,35,70','k = 0..5',$q$
    SELECT string_agg(cardinality(weak_compositions_into_k_parts(4,k))::text, ',' ORDER BY k) FROM generate_series(0,5) k $q$),
  ('weak_compositions_into_k_parts','k RANGE: cardinality(weak_compositions_into_k_parts(3)) sums k=0..3','eq','15','0 + 1 + 4 + 10 (k=0,1,2,3)',$q$
    SELECT cardinality(weak_compositions_into_k_parts(3))::text $q$),
  ('weak_compositions_into_k_parts','fibers(weak_compositions_into_k_parts(3)) unfold to k = 0,1,2,3','eq','0,1,2,3','the second grade ranges 0..n',$q$
    SELECT string_agg((f).k::text, ',' ORDER BY (f).k) FROM fibers(weak_compositions_into_k_parts(3)) f $q$),
  ('weak_compositions_into_k_parts','multi-grade chain: fiber = (n,k) named axes','eq','3|2','unrank(...).fiber is (n=3,k=2)',$q$
    SELECT (unrank(weak_compositions_into_k_parts(3,2), 0)).fiber.n::text || '|' || (unrank(weak_compositions_into_k_parts(3,2), 0)).fiber.k::text $q$),
  ('weak_compositions_into_k_parts','every element of fiber [3,2] has 2 non-negative parts summing to 3','eq','true','the defining invariant across the fiber',$q$
    SELECT bool_and(array_length(((e).value).parts,1) = 2
                AND (SELECT coalesce(sum(p),0) FROM unnest(((e).value).parts) p) = 3
                AND NOT EXISTS (SELECT 1 FROM unnest(((e).value).parts) p WHERE p < 0))::text
      FROM elements(weak_compositions_into_k_parts(3,2)) e $q$),
  ('weak_compositions_into_k_parts','contains via <@: {1,2} ∈ (3,2), {1,2} ∉ (3,3), {0,3} ∈ (3,2)','eq','true|false|true','generated from contains_in_fiber',$q$
    SELECT (ROW(ARRAY[1,2])::weak_composition <@ weak_compositions_into_k_parts(3,2))::text || '|' ||
           (ROW(ARRAY[1,2])::weak_composition <@ weak_compositions_into_k_parts(3,3))::text || '|' ||
           (ROW(ARRAY[0,3])::weak_composition <@ weak_compositions_into_k_parts(3,2))::text $q$);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('weak_compositions_into_k_parts','fiber_unrank(weak_compositions_into_k_parts(4,3), 0..) are all members (accel floor)','eq','true','direct stars-and-bars unrank lands inside the C(6,2)=15 fiber',$q$
    SELECT bool_and(fiber_unrank((SELECT f FROM fibers(weak_compositions_into_k_parts(4,3)) f), ord::rank_index) <@ weak_compositions_into_k_parts(4,3))::text
      FROM generate_series(0, cardinality(weak_compositions_into_k_parts(4,3))::int - 1) ord $q$);
