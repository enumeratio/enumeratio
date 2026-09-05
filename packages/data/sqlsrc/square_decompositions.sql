-- requires: integer_factorizations, natural_numbers, number-predicates
-- square_decompositions — every positive integer factors UNIQUELY as n = s²·q with q square-free and s ≥ 1
-- (the square part and its square-free kernel). This collection IS that pair space {(s, q) : s ≥ 1, q square-free},
-- ordered by n = s²·q — an ORDER-ISO collection: the map n ⇄ (s, q) is a bijection ℤ⁺ ↔ pairs, and the sequence
-- borrows ℤ⁺'s order (walk n = 1,2,3,… and read off its decomposition). The decomposition itself reuses the factored
-- carrier's square_part_root / square_free_part (single source of truth); this collection just packages the pair and
-- the order. Ungraded / unbounded, like the number sets it is built from.

-- ── carrier: the pair (s, q), n = s²·q ────────────────────────────────────────────────────────────────────
CREATE TYPE square_decomposition AS (root numeric, square_free numeric);   -- s = √(square part), q = square-free kernel

CREATE FUNCTION decompose(n numeric) RETURNS square_decomposition LANGUAGE sql IMMUTABLE AS $$   -- n ↦ (s, q)
  SELECT ROW(value(square_part_root(factored(n))), value(square_free_part(factored(n))))::square_decomposition
   WHERE n >= 1 AND n = trunc(n) $$;
CREATE FUNCTION value(d square_decomposition) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$   -- (s, q) ↦ s²·q = n
  SELECT trunc((d).root ^ 2 * (d).square_free) $$;

CREATE FUNCTION square_root_component(d square_decomposition) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT (d).root $$;
CREATE FUNCTION square_free_component(d square_decomposition) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT (d).square_free $$;

CREATE FUNCTION notation(d square_decomposition) RETURNS text LANGUAGE sql IMMUTABLE AS $$   -- '6²·10'; 's²' when q=1; 'q' when s=1
  SELECT CASE WHEN (d).root = 1 THEN (d).square_free::text
              WHEN (d).square_free = 1 THEN (d).root::text || '²'
              ELSE (d).root::text || '²·' || (d).square_free::text END $$;

-- ── register: walks ℤ⁺ in order, reading each n's decomposition (borrowed order, order-iso to natural_numbers) ──
CREATE TYPE square_decompositions_fiber AS (unit unit);   -- singleton fiber (ungraded)
CREATE FUNCTION fiber_elements(f square_decompositions_fiber, element_limit int) RETURNS SETOF square_decomposition LANGUAGE sql STABLE AS $$
  SELECT decompose(r + 1) FROM generate_series(0, element_limit - 1) r $$;              -- rank r ↦ decompose(r+1)
CREATE FUNCTION contains_in_fiber(f square_decompositions_fiber, d square_decomposition) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (d).root >= 1 AND (d).root = trunc((d).root) AND is_square_free_number((d).square_free) $$;   -- a valid (s, q)
CREATE FUNCTION fiber_unrank(f square_decompositions_fiber, rank rank_index) RETURNS square_decomposition LANGUAGE sql IMMUTABLE AS $fu$
  SELECT decompose(rank + 1) $fu$;

INSERT INTO base_collection VALUES ('square_decompositions', 'square_decomposition', true);   -- unbounded, ungraded
SELECT base_realize('square_decompositions');

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('square_decompositions','square_root','square_root_component','s — the root of the square part in n = s²·q','natural_numbers'),
  ('square_decompositions','square_free_kernel','square_free_component','q — the square-free kernel in n = s²·q','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES

  ('square_decompositions','decompose(360) = (6, 10), notation 6²·10','eq','6²·10','360 = 2³·3²·5 ⇒ s = 2·3 = 6, q = 2·5 = 10',$q$
    SELECT notation(decompose(360)) $q$),

  ('square_decompositions','first ten decompositions (walking ℤ⁺)','eq','1,2,3,2²,5,6,7,2²·2,3²,10','n = 1..10, each as s²·q',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(square_decompositions(), 10) e $q$),

  ('square_decompositions','order-iso: (s, q) recomposes to n, and the walk is ℤ⁺','ok',NULL,
   's²·q = n over 1..200, and value(unrank r) = r+1 (the sequence borrows ℤ⁺ order).',$q$
    DO $$ DECLARE r int; BEGIN
      FOR r IN 0..199 LOOP
        ASSERT value(decompose(r + 1)) = r + 1, 'recompose @'||(r+1);
        ASSERT value((unrank(square_decompositions(), r)).value) = r + 1, 'iso @'||r;
      END LOOP;
    END $$ $q$),

  ('square_decompositions','the kernel q is always square-free','ok',NULL,'square_free_component lands in square_free_numbers over 1..200',$q$
    DO $$ DECLARE n int; BEGIN
      FOR n IN 1..200 LOOP ASSERT (square_free_component(decompose(n)) <@ square_free_numbers()), 'sf @'||n; END LOOP;
    END $$ $q$),

  ('square_decompositions','cardinality = infinity (order-iso to ℤ⁺)','eq','Infinity','one endless fiber',$q$
    SELECT cardinality(square_decompositions())::text $q$),

  ('square_decompositions','contains via <@: (6,10) ∈, (2,4) ∉ (4 not square-free), (3,5) ∈','eq','true|false|true','membership is "a valid (s, q) pair": s a positive integer, q square-free',$q$
    SELECT (ROW(6,10)::square_decomposition <@ square_decompositions())::text || '|' ||
           (ROW(2,4)::square_decomposition  <@ square_decompositions())::text || '|' ||
           (ROW(3,5)::square_decomposition  <@ square_decompositions())::text $q$),

  ('square_decompositions','square-free n decompose to (1, n): 30 ↦ (1, 30)','eq','1 30','a square-free number is its own kernel, s = 1',$q$
    SELECT square_root_component(decompose(30))::text || ' ' || square_free_component(decompose(30))::text $q$),

  ('square_decompositions','perfect squares decompose to (√n, 1): 144 ↦ (12, 1)','eq','12 1','q = 1 exactly on the perfect squares',$q$
    SELECT square_root_component(decompose(144))::text || ' ' || square_free_component(decompose(144))::text $q$);
