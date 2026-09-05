-- requires: rational_numbers, farey_sequences, number-theory, realizer, utilities
-- continued_fractions(q) — the canonical continued-fraction expansion [a₀;a₁,a₂,…] of every reduced proper
-- fraction p/q (1≤p≤q, gcd(p,q)=1), graded by the denominator q. Since every such p/q lies in [0,1], every term
-- a₀=0 (except p=q=1, where the CF is just [1]) — the Euclidean algorithm on (p,q) IS the CF, so |terms|>0 always.
-- Count = φ(q), reusing euler_phi (number-theory.sql) — an exact accel. Fresh carrier: an int-sequence CF has no
-- existing shape to restrict.
CREATE TYPE continued_fraction AS (terms int[]);
CREATE FUNCTION notation(c continued_fraction) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT '[' || (c).terms[1]::text ||
    CASE WHEN coalesce(array_length((c).terms,1),0) > 1
         THEN ';' || (SELECT string_agg(x::text, ',' ORDER BY o) FROM unnest((c).terms[2:array_length((c).terms,1)]) WITH ORDINALITY t(x,o))
         ELSE '' END || ']' $$;

-- forward: the Euclidean algorithm on (p,q) IS the continued-fraction expansion.
CREATE FUNCTION continued_fraction_terms(p int, q int) RETURNS int[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE a int; num int := p; den int := q; terms int[] := '{}'; tmp int; BEGIN
    IF q = 0 THEN RETURN NULL; END IF;
    WHILE den <> 0 LOOP
      a := num / den;   -- integer (floor, for nonnegative operands) division
      terms := terms || a;
      tmp := num - a * den; num := den; den := tmp;
    END LOOP;
    RETURN terms;
  END $$;

-- inverse: evaluate the CF back to a rational, folding from the last term (reuses rational_numbers' arithmetic).
CREATE FUNCTION continued_fraction_value(terms int[]) RETURNS rational_number LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := coalesce(array_length(terms,1),0); val rational_number; i int; BEGIN
    IF n = 0 THEN RETURN NULL; END IF;
    val := ROW(terms[n], 1)::rational_number;
    FOR i IN REVERSE (n-1)..1 LOOP val := rational_add(ROW(terms[i],1)::rational_number, reciprocal(val)); END LOOP;
    RETURN val;
  END $$;

CREATE TYPE continued_fractions_fiber AS (q natural_number);   -- typed fiber; axis: q (the denominator)
CREATE FUNCTION fiber_elements(f continued_fractions_fiber, element_limit int) RETURNS SETOF continued_fraction LANGUAGE sql STABLE AS $$
  SELECT ROW(continued_fraction_terms(p, (f).q::int))::continued_fraction
    FROM generate_series(1, (f).q::int) p
   WHERE gcd_int(p, (f).q::int) = 1
   ORDER BY p
   LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f continued_fractions_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT euler_phi((f).q::int) $$;
CREATE FUNCTION contains_in_fiber(f continued_fractions_fiber, v continued_fraction) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((v).terms,1),0) > 0
     AND (continued_fraction_value((v).terms)).denominator = (f).q::int
     AND continued_fraction_terms((continued_fraction_value((v).terms)).numerator, (f).q::int) = (v).terms $$;

INSERT INTO base_collection VALUES ('continued_fractions', 'continued_fraction');
INSERT INTO base_grade VALUES ('continued_fractions', 1, 'q', '1', NULL);
CREATE FUNCTION fiber_symbol(f continued_fractions_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'CF(' || (f).q::int || ')' $$;
SELECT base_realize('continued_fractions');

-- ── stats: length, largest partial quotient ───────────────────────────────────────────────────────────
CREATE FUNCTION continued_fractions_length(c continued_fraction) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT coalesce(array_length((c).terms,1),0) $$;
CREATE FUNCTION continued_fractions_largest_partial_quotient(c continued_fraction) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT max(x) FROM unnest((c).terms) x) $$;
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('continued_fractions','length','continued_fractions_length','Length (number of partial quotients)','natural_numbers'),
  ('continued_fractions','largest_partial_quotient','continued_fractions_largest_partial_quotient','Largest partial quotient','natural_numbers');

-- ── maps: to the value it expands (rational_numbers), and its penultimate convergent (a shorter, coarser
-- denominator fraction — still in [0,1] since every term here is nonnegative, so it lands in farey_sequences) ──
CREATE FUNCTION continued_fractions_to_rational_number(c continued_fraction) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT continued_fraction_value((c).terms) $$;
CREATE FUNCTION continued_fractions_penultimate_convergent(c continued_fraction) RETURNS rational_number LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN coalesce(array_length((c).terms,1),0) <= 1 THEN NULL
              ELSE continued_fraction_value(((c).terms)[1:array_length((c).terms,1)-1]) END $$;
INSERT INTO base_map (collection, map_id, mapping_fn, codomain, title, findstat) VALUES
  ('continued_fractions','to_rational_number','continued_fractions_to_rational_number','rational_numbers','The rational it expands',NULL),
  ('continued_fractions','penultimate_convergent','continued_fractions_penultimate_convergent','farey_sequences','Penultimate convergent',NULL);

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('continued_fractions','CF(7)''s expansions of 1/7..6/7','eq','[0;7],[0;3,2],[0;2,3],[0;1,1,3],[0;1,2,2],[0;1,6]',NULL,$q$
    SELECT string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(continued_fractions(7)) e $q$),
  ('continued_fractions','1/1''s expansion is the single term [1]','eq','[1]',NULL,$q$
    SELECT notation((unrank(continued_fractions(1), 0)).value) $q$),
  ('continued_fractions','|CF(n)| = φ(n) for n=1..10: 1,1,2,2,4,2,6,4,6,4','eq','1,1,2,2,4,2,6,4,6,4',NULL,$q$
    SELECT string_agg(cardinality(continued_fractions(n))::text, ',' ORDER BY n) FROM generate_series(1,10) n $q$),
  ('continued_fractions','every expansion for q=1..30 evaluates back to its own p/q','eq','true','the defining forward/inverse round-trip',$q$
    SELECT bool_and((e).value <@ continued_fractions(q)) FROM generate_series(1,30) q, LATERAL elements(continued_fractions(q)) e $q$),
  ('continued_fractions','length/largest_partial_quotient of 1/7 = [0;7]','eq','2|7',NULL,$q$
    SELECT continued_fractions_length(ROW(ARRAY[0,7])::continued_fraction)::text || '|'
        || continued_fractions_largest_partial_quotient(ROW(ARRAY[0,7])::continued_fraction)::text $q$),
  ('continued_fractions','to_rational_number of [0;1,1,3] (4/7''s CF) is 4/7','eq','4/7',NULL,$q$
    SELECT notation(continued_fractions_to_rational_number(ROW(ARRAY[0,1,1,3])::continued_fraction)) $q$),
  ('continued_fractions','penultimate_convergent of [0;1,1,3] (4/7) is [0;1,1] = 1/2 — a farey_sequences(7) member','eq','1/2|true',NULL,$q$
    SELECT notation(continued_fractions_penultimate_convergent(ROW(ARRAY[0,1,1,3])::continued_fraction)) || '|'
        || (continued_fractions_penultimate_convergent(ROW(ARRAY[0,1,1,3])::continued_fraction) <@ farey_sequences(7))::text $q$),
  ('continued_fractions','contains: [0;1,1,3] (=4/7) ∈ continued_fractions(7), ∉ continued_fractions(5) (wrong denominator)','eq','true|false',NULL,$q$
    SELECT (ROW(ARRAY[0,1,1,3])::continued_fraction <@ continued_fractions(7))::text || '|'
        || (ROW(ARRAY[0,1,1,3])::continued_fraction <@ continued_fractions(5))::text $q$);
