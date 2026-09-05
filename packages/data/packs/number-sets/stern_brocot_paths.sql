-- requires: binary_words, realizer, utilities
-- stern_brocot_paths — paths of length n through the Stern–Brocot tree, one per length-n binary word (0=L, 1=R): all
-- 2ⁿ of them, no filter. BORROWS the binary_words carrier + floor + count verbatim, then adds the to-rational
-- reading. Descent from the mediant of sentinels 0/1 and 1/0: at each step compute the mediant, then L moves the
-- RIGHT boundary to it, R moves the LEFT boundary to it; the encoded rational is the final mediant (lp+rp)/(lq+rq).
-- Every positive rational appears once, in lowest terms, and rank order is Minkowski's ?-function (the bits as a
-- dyadic fraction). Same tree VERTICES as calkin_wilf_paths but a different descent, so ranks differ.

-- ── the to-rational reading (Stern–Brocot mediant descent) ─────────────────────────────────────────────
CREATE FUNCTION stern_brocot_fraction(bits int[]) RETURNS bigint[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE lp bigint := 0; lq bigint := 1;   -- left sentinel 0/1
          rp bigint := 1; rq bigint := 0;   -- right sentinel 1/0
          mp bigint; mq bigint; b int; BEGIN
    FOREACH b IN ARRAY coalesce(bits, '{}'::int[]) LOOP
      mp := lp + rp; mq := lq + rq;                       -- the mediant
      IF b = 0 THEN rp := mp; rq := mq;   -- L: right boundary ← mediant
      ELSE          lp := mp; lq := mq;   -- R: left boundary ← mediant
      END IF;
    END LOOP;
    RETURN ARRAY[lp + rp, lq + rq];                       -- the final mediant
  END $$;
CREATE FUNCTION stern_brocot_numerator(w binary_word)   RETURNS bigint LANGUAGE sql IMMUTABLE AS $$ SELECT (stern_brocot_fraction((w).bits))[1] $$;
CREATE FUNCTION stern_brocot_denominator(w binary_word) RETURNS bigint LANGUAGE sql IMMUTABLE AS $$ SELECT (stern_brocot_fraction((w).bits))[2] $$;
CREATE FUNCTION stern_brocot_rational(w binary_word)    RETURNS text   LANGUAGE sql IMMUTABLE AS $$
  SELECT (SELECT f[1] || '/' || f[2] FROM stern_brocot_fraction((w).bits) f) $$;
CREATE FUNCTION stern_brocot_turns(w binary_word)       RETURNS text   LANGUAGE sql IMMUTABLE AS $$   -- the L/R turn string
  SELECT coalesce(string_agg(CASE WHEN b = 0 THEN 'L' ELSE 'R' END, '' ORDER BY o), 'ε') FROM unnest((w).bits) WITH ORDINALITY t(b, o) $$;

-- ── borrow the binary_words engines verbatim (same 2ⁿ words, same order) ────────────────────────────────
CREATE TYPE stern_brocot_paths_fiber AS (n natural_number);   -- typed fiber; axis: n (borrows binary_words' floor)
CREATE FUNCTION fiber_elements(f stern_brocot_paths_fiber, element_limit int) RETURNS SETOF binary_word LANGUAGE sql STABLE AS $$
  SELECT v FROM fiber_elements(ROW((f).n)::binary_words_fiber, element_limit) v LIMIT element_limit $$;
CREATE FUNCTION fiber_count(f stern_brocot_paths_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT fiber_count(ROW((f).n)::binary_words_fiber) $$;
CREATE FUNCTION contains_in_fiber(f stern_brocot_paths_fiber, v binary_word) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT contains_in_fiber(ROW((f).n)::binary_words_fiber, v) $$;

INSERT INTO base_collection VALUES ('stern_brocot_paths', 'binary_word');
INSERT INTO base_grade VALUES ('stern_brocot_paths', 1, 'n', NULL, NULL);
CREATE FUNCTION fiber_symbol(f stern_brocot_paths_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$ SELECT 'SB(' || (f).n::int || ')' $$;   -- corpus symbol
SELECT base_realize('stern_brocot_paths');

-- bits is the carrier's bit-string codec (carrier-scoped, inherits); turns/rational read the Stern–Brocot descent
-- private to THIS collection, so they are collection-scoped and don't leak onto binary_word siblings.
INSERT INTO base_repr (collection, repr, render_fn, title, canonical, scope) VALUES
  ('stern_brocot_paths','bits','notation','Bit string (0=L, 1=R)',true,'carrier'),
  ('stern_brocot_paths','turns','stern_brocot_turns','L/R turns',false,'collection'),
  ('stern_brocot_paths','rational','stern_brocot_rational','Rational p/q',false,'collection');
INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('stern_brocot_paths','numerator','stern_brocot_numerator','Numerator','natural_numbers'),
  ('stern_brocot_paths','denominator','stern_brocot_denominator','Denominator','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('stern_brocot_paths','count = 2ⁿ for n=0..5','eq','1,2,4,8,16,32','all length-n paths, borrowed from binary_words',$q$
    SELECT string_agg(cardinality(stern_brocot_paths(n))::text, ',' ORDER BY n) FROM generate_series(0,5) n $q$),
  ('stern_brocot_paths','the empty path is the root 1/1','eq','1/1','n=0 ⇒ the single empty word',$q$
    SELECT stern_brocot_rational((unrank(stern_brocot_paths(0), 0)).value) $q$),
  ('stern_brocot_paths','level-1: L↦1/2, R↦2/1','eq','1/2,2/1','the two length-1 paths in rank order',$q$
    SELECT string_agg(stern_brocot_rational((e).value), ',' ORDER BY ordinality(e)) FROM elements(stern_brocot_paths(1)) e $q$),
  ('stern_brocot_paths','level-2 rationals (LL,LR,RL,RR): 1/3,2/3,3/2,3/1','eq','1/3,2/3,3/2,3/1','Stern–Brocot in-order (differs from Calkin–Wilf at ranks 1,2)',$q$
    SELECT string_agg(stern_brocot_rational((e).value), ',' ORDER BY ordinality(e)) FROM elements(stern_brocot_paths(2)) e $q$),
  ('stern_brocot_paths','the rank order is strictly increasing in value (Stern–Brocot sorts ℚ⁺)','eq','true','p/q ascending across level 3',$q$
    SELECT bool_and(stern_brocot_numerator(a) * stern_brocot_denominator(b) < stern_brocot_numerator(b) * stern_brocot_denominator(a))
      FROM (SELECT (e).value a, lead((e).value) OVER (ORDER BY ordinality(e)) b FROM elements(stern_brocot_paths(3)) e) s WHERE b IS NOT NULL $q$),
  ('stern_brocot_paths','every level-4 rational is in lowest terms','eq','true','Stern–Brocot yields reduced fractions',$q$
    SELECT bool_and(gcd(stern_brocot_numerator((e).value), stern_brocot_denominator((e).value)) = 1) FROM elements(stern_brocot_paths(4)) e $q$);
