-- requires: fib_strings, fibonacci, natural_numbers, realizer
-- zeckendorf_representations (#231) — Zeckendorf's theorem: every n ≥ 0 is a UNIQUE sum of non-consecutive
-- Fibonacci numbers F₂,F₃,F₄,… (F₂=1,F₃=2,F₄=3,…, skipping the duplicate F₁=1). That uniqueness is exactly the
-- "no two adjacent 1s" invariant fib_strings already enforces — so this is a MAP, not a new collection: a
-- bijection natural_numbers ↔ fib_strings, forward = greedy Zeckendorf decomposition, inverse = evaluation. A
-- length-L fib_string's bit i (1-indexed from the left, MSB-first) carries F_{L-i+2}; n=0 ↦ the empty word.

-- forward: greedy — repeatedly take the largest Fibonacci ≤ the remainder.
CREATE FUNCTION zeckendorf_representation(n numeric) RETURNS binary_word LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE k int := 2; rem numeric := n; bits int[] := '{}'; idx int; BEGIN
    IF n = 0 THEN RETURN ROW('{}'::int[])::binary_word; END IF;
    WHILE fibonacci_term(k + 1) <= rem LOOP k := k + 1; END LOOP;   -- largest Fibonacci index ≤ n
    FOR idx IN REVERSE k..2 LOOP
      IF fibonacci_term(idx) <= rem THEN bits := bits || 1; rem := rem - fibonacci_term(idx);
      ELSE bits := bits || 0; END IF;
    END LOOP;
    RETURN ROW(bits)::binary_word;
  END $$;

-- inverse: evaluation — Σ bit_i · F_{L-i+2}.
CREATE FUNCTION zeckendorf_value(w binary_word) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(b * fibonacci_term((l - i + 2)::int)), 0)
    FROM (SELECT coalesce(array_length((w).bits,1), 0) AS l) x,
         LATERAL unnest((w).bits) WITH ORDINALITY t(b, i) $$;

INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, scope, inverse, is_bijection, findstat) VALUES
  ('natural_numbers','zeckendorf_representation','zeckendorf_representation','fib_strings','Zeckendorf representation','carrier','zeckendorf_value',true,NULL),
  ('fib_strings','zeckendorf_value','zeckendorf_value','natural_numbers','Zeckendorf evaluation','carrier','zeckendorf_representation',true,NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('fib_strings','Zeckendorf representation of 0..12','eq',',1,10,100,101,1000,1001,1010,10000,10001,10010,10100,10101','greedy Fibonacci decomposition (F₂=1,F₃=2,F₄=3,F₅=5,F₆=8,F₇=13)',$q$
    SELECT string_agg(notation(zeckendorf_representation(n)), ',' ORDER BY n) FROM generate_series(0,12) n $q$),
  ('fib_strings','every Zeckendorf representation is a valid fib_string (no adjacent 1s)','eq','true','uniqueness ⇔ the fib_strings invariant',$q$
    SELECT bool_and(is_fib_string(zeckendorf_representation(n))) FROM generate_series(0,200) n $q$),
  ('fib_strings','zeckendorf_value inverts zeckendorf_representation for n=0..200','eq','true','round-trips n → word → n',$q$
    SELECT bool_and(zeckendorf_value(zeckendorf_representation(n)) = n) FROM generate_series(0,200) n $q$),
  ('fib_strings','zeckendorf_representation inverts zeckendorf_value on the LEADING-1 (Zeckendorf-minimal) fib_strings — a bits[1]=0 member of fib_strings(k) is a shorter number padded with a leading zero, not what the forward map produces','eq','true','round-trips word → n → word for exactly the words the forward map produces',$q$
    SELECT bool_and(zeckendorf_representation(zeckendorf_value((e).value)) = (e).value)
    FROM generate_series(1,10) k, LATERAL elements(fib_strings(k)) e
   WHERE ((e).value).bits[1] = 1 $q$),
  ('fib_strings','the two maps declare each other as inverse (mutual bijection)','eq','true|true',NULL,$q$
    SELECT (SELECT is_bijection AND inverse = 'zeckendorf_value' FROM base_map WHERE collection='natural_numbers' AND map_id='zeckendorf_representation')::text
        || '|' || (SELECT is_bijection AND inverse = 'zeckendorf_representation' FROM base_map WHERE collection='fib_strings' AND map_id='zeckendorf_value')::text $q$);
