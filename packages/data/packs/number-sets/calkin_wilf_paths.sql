-- requires: binary_words, stern_brocot_paths, realizer, utilities
-- calkin_wilf_paths — paths of length n through the Calkin–Wilf tree, one per length-n binary word (0=L, 1=R): all
-- 2ⁿ of them, no filter. BORROWS the binary_words carrier + floor + count verbatim (a length-n bit word IS the
-- path), then adds the to-rational reading. The Calkin–Wilf tree: root 1/1; at each step L takes p/q → p/(p+q)
-- (denominator grows), R takes p/q → (p+q)/q (numerator grows). Every positive rational appears exactly once, in
-- lowest terms; rank = the word's binary value. Sibling of stern_brocot_paths (same tree vertices, different descent).

-- ── the to-rational reading (the mediant descent from 1/1) ─────────────────────────────────────────────
CREATE FUNCTION calkin_wilf_fraction(bits int[]) RETURNS bigint[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE p bigint := 1; q bigint := 1; b int; BEGIN
    FOREACH b IN ARRAY coalesce(bits, '{}'::int[]) LOOP
      IF b = 0 THEN q := q + p;   -- L: denominator grows
      ELSE          p := p + q;   -- R: numerator grows
      END IF;
    END LOOP;
    RETURN ARRAY[p, q];
  END $$;
CREATE FUNCTION calkin_wilf_numerator(w binary_word)   RETURNS bigint LANGUAGE sql IMMUTABLE AS $$ SELECT (calkin_wilf_fraction((w).bits))[1] $$;
CREATE FUNCTION calkin_wilf_denominator(w binary_word) RETURNS bigint LANGUAGE sql IMMUTABLE AS $$ SELECT (calkin_wilf_fraction((w).bits))[2] $$;
CREATE FUNCTION calkin_wilf_rational(w binary_word)    RETURNS text   LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT f[1] || '/' || f[2] FROM calkin_wilf_fraction((w).bits) f) $$;
CREATE FUNCTION calkin_wilf_turns(w binary_word)       RETURNS text   LANGUAGE sql IMMUTABLE AS $$   -- the L/R turn string
  SELECT coalesce(string_agg(CASE WHEN b = 0 THEN 'L' ELSE 'R' END, '' ORDER BY o), 'ε') FROM unnest((w).bits) WITH ORDINALITY t(b, o) $$;

-- ── borrow the binary_words engines verbatim (same 2ⁿ words, same order) ────────────────────────────────
CREATE TYPE calkin_wilf_paths_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows binary_words' floor)
CREATE FUNCTION fiber_elements(f calkin_wilf_paths_fiber, element_limit int) RETURNS SETOF binary_word LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::binary_words_fiber, element_limit) v LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f calkin_wilf_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fiber_count(ROW((f).n)::binary_words_fiber) $$;
CREATE FUNCTION contains_in_fiber(f calkin_wilf_paths_fiber, v binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::binary_words_fiber, v) $$;

INSERT INTO base_collection VALUES ('calkin_wilf_paths', 'binary_word');
INSERT INTO base_grade VALUES ('calkin_wilf_paths', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f calkin_wilf_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'CW(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('calkin_wilf_paths');

-- bits is the carrier's bit-string codec (carrier-scoped, inherits); turns/rational read the Calkin–Wilf descent
-- private to THIS collection, so they are collection-scoped and don't leak onto binary_word siblings.
INSERT INTO base_repr (collection, repr, render_fn, title, canonical, scope) VALUES
  ('calkin_wilf_paths','bits','notation','Bit string (0=L, 1=R)',true,'carrier'),
  ('calkin_wilf_paths','turns','calkin_wilf_turns','L/R turns',false,'collection'),
  ('calkin_wilf_paths','rational','calkin_wilf_rational','Rational p/q',false,'collection');
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('calkin_wilf_paths','numerator','calkin_wilf_numerator','Numerator','natural_numbers'),
  ('calkin_wilf_paths','denominator','calkin_wilf_denominator','Denominator','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('calkin_wilf_paths','count = 2ⁿ for n=0..5','eq','1,2,4,8,16,32','all length-n paths, borrowed from binary_words',$q$
    SELECT string_agg(cardinality(calkin_wilf_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('calkin_wilf_paths','the empty path is the root 1/1','eq','1/1','n=0 ⇒ the single empty word',$q$
    SELECT calkin_wilf_rational((unrank(calkin_wilf_paths(0), 0)).value) $q$),
  ('calkin_wilf_paths','level-1 children of 1/1: L↦1/2, R↦2/1','eq','1/2,2/1','the two length-1 paths in rank order',$q$
    SELECT string_agg(calkin_wilf_rational((e).value), ',' ORDER BY ordinality(e)) FROM elements(calkin_wilf_paths(1)) e $q$),
  ('calkin_wilf_paths','level-2 rationals (LL,LR,RL,RR): 1/3,3/2,2/3,3/1','eq','1/3,3/2,2/3,3/1','the Calkin–Wilf breadth-first row (A007305/A047679)',$q$
    SELECT string_agg(calkin_wilf_rational((e).value), ',' ORDER BY ordinality(e)) FROM elements(calkin_wilf_paths(2)) e $q$),
  ('calkin_wilf_paths','every rational at level 3 is already in lowest terms','eq','true','Calkin–Wilf yields reduced fractions',$q$
    SELECT bool_and(gcd(calkin_wilf_numerator((e).value), calkin_wilf_denominator((e).value)) = 1) FROM elements(calkin_wilf_paths(3)) e $q$),
  ('calkin_wilf_paths','contrast with stern_brocot_paths: same rationals, ranks 1,2 swap','eq','true','both cover {1/3,3/2,2/3,3/1} at n=2',$q$
    SELECT (
      (SELECT array_agg(calkin_wilf_rational((e).value) ORDER BY calkin_wilf_rational((e).value)) FROM elements(calkin_wilf_paths(2)) e)
      = (SELECT array_agg(stern_brocot_rational((e).value) ORDER BY stern_brocot_rational((e).value)) FROM elements(stern_brocot_paths(2)) e)
    )::text $q$);
