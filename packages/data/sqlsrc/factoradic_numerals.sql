-- requires: realizer, utilities, base_radix_schedule
-- factoradic_numerals (#300, §2c/§2d) — the factorial-base numeral system as a ranked collection: the mixed-radix
-- rep of a natural under the `factorial` schedule (place p has radix p+1, weight p!). BIJECTIVE (alphabet = weights):
-- every natural has exactly one factoradic, so RANK = VALUE and the collection is Denumerable (value-addressing is
-- free). Digits are MSB-first and KEEP the degenerate trailing place 0 (radix 1, always digit 0) — because the
-- schedule continues past it into the rational factoradics (D2); dropping it is the Lehmer-specific move (#293), a
-- property of the embedding map, not of the factoradic. Ungraded / unbounded, exactly like natural_numbers.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE factoradic_numeral AS (digits int[]);                    -- MSB-first, incl. the trailing place-0 zero
CREATE FUNCTION notation(v factoradic_numeral) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN EXISTS (SELECT 1 FROM unnest((v).digits) x WHERE x >= 10)
              THEN coalesce(array_to_string((v).digits, '-'), '')     -- digits >= 10 need a separator
              ELSE coalesce(array_to_string((v).digits, ''), '') END $$;

-- ── the factorial-base codec ─────────────────────────────────────────────────────────────────────────
-- factoradic_of(r): the canonical MSB-first factoradic of r >= 0 (minimal width, trailing place-0 zero included).
CREATE FUNCTION factoradic_of(r numeric) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE lsb int[] := '{}'; x numeric := r; i int := 1;                -- i = radix of the current LSB place (place p has radix p+1)
BEGIN
  IF r < 0 OR r <> trunc(r) THEN RAISE EXCEPTION 'factoradic_of needs a non-negative integer, got %', r; END IF;
  LOOP
    lsb := lsb || (x % i)::int;                                       -- place (i-1) digit ∈ [0, i-1]
    x := div(x, i);
    i := i + 1;
    EXIT WHEN x = 0;
  END LOOP;
  RETURN ARRAY(SELECT lsb[j] FROM generate_subscripts(lsb, 1) g(j) ORDER BY j DESC);   -- reverse LSB → MSB-first
END $$;
-- factoradic_value(digits): Σ d_p · p!  (d_p is the LSB place-p digit = digits[len - p]).
CREATE FUNCTION factoradic_value(digits int[]) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(sum(digits[cardinality(digits) - p] * factorial(p)), 0)
    FROM generate_series(0, cardinality(digits) - 1) p $$;
CREATE FUNCTION value(v factoradic_numeral) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT factoradic_value((v).digits) $$;   -- wire "<notation> = <value>"

-- ── engines: rank = value ────────────────────────────────────────────────────────────────────────────
CREATE TYPE factoradic_numerals_fiber AS (unit unit);                -- singleton fiber (ungraded), like natural_numbers
CREATE FUNCTION fiber_elements(f factoradic_numerals_fiber, element_limit int) RETURNS SETOF factoradic_numeral LANGUAGE sql STABLE AS $$
  SELECT ROW(factoradic_of(r))::factoradic_numeral FROM generate_series(0, element_limit - 1) r $$;
CREATE FUNCTION fiber_unrank(f factoradic_numerals_fiber, rank rank_index) RETURNS factoradic_numeral LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW(factoradic_of(rank::numeric))::factoradic_numeral $$;   -- rank = value: unrank(r) is the factoradic of r
CREATE FUNCTION contains_in_fiber(f factoradic_numerals_fiber, v factoradic_numeral) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT factoradic_of(factoradic_value((v).digits)) = (v).digits $$;  -- canonical iff it round-trips (captures digit ranges + minimal width)

INSERT INTO base_collection VALUES ('factoradic_numerals', 'factoradic_numeral', true);   -- unbounded, ungraded
CREATE FUNCTION fiber_symbol(f factoradic_numerals_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT '!' $$;   -- corpus symbol: the factorial base
SELECT base_realize('factoradic_numerals');
INSERT INTO base_collection_meta VALUES ('factoradic_numerals', 'Factoradic numerals', 'The factorial-base (mixed-radix) numerals; bijective with ℕ, rank = value.');
-- (#300 §2b) a numeral system as data: factoradic is the factorial schedule with alphabet = weights ⇒ bijective.
INSERT INTO base_numeral_system (collection, weight_schedule, alphabet_schedule, note) VALUES
  ('factoradic_numerals', 'factorial', 'factorial', 'bijective: rank = value');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('factoradic_numerals','first six factoradics (rank = value): 0,10,100,110,200,210','eq','0,10,100,110,200,210','MSB-first, trailing place-0 zero kept',$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(factoradic_numerals(), 6) e $q$),
  ('factoradic_numerals','rank = value: factoradic_value(unrank(r)) = r for r = 0..50','ok',NULL,'the bijection with ℕ',$q$
    SELECT bool_and(factoradic_value(((unrank(factoradic_numerals(), r)).value).digits) = r) FROM generate_series(0,50) r $q$),
  ('factoradic_numerals','unrank(5) = 210, value 2·2!+1·1! = 5','eq','210|5','MSB-first factoradic of 5',$q$
    SELECT notation((unrank(factoradic_numerals(), 5)).value) || '|' || value((unrank(factoradic_numerals(), 5)).value)::text $q$),
  ('factoradic_numerals','contains via <@: 210 ∈ (canonical), 010 ∉ (non-canonical leading zero)','eq','true|false','canonical round-trip',$q$
    SELECT (ROW(ARRAY[2,1,0])::factoradic_numeral <@ factoradic_numerals())::text || '|' ||
           (ROW(ARRAY[0,1,0])::factoradic_numeral <@ factoradic_numerals())::text $q$),
  ('factoradic_numerals','cardinality = infinity (denumerable)','eq','Infinity','one endless fiber, rank = value',$q$
    SELECT cardinality(factoradic_numerals())::text $q$),
  ('factoradic_numerals','the trailing place is real: factoradic keeps place 0 (radix 1), unlike Lehmer','eq','true','every factoradic ends in a 0 digit (place 0)',$q$
    SELECT bool_and(((e).value).digits[cardinality(((e).value).digits)] = 0) FROM elements(factoradic_numerals(), 12) e $q$);
