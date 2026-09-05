-- requires: realizer, references, number-theory, all_ones
-- requires-tag: collection
-- Sequence transforms (issue #239, catalog-audit friction 8) — the OEIS's standard way of relating sequences:
-- a sequence collection IN, a sequence collection OUT. A transform is a FUNCTOR on sequence collections, the same
-- shape base_map is on elements — NOT a base_construction (that layer's ADT type-formers carry a finite cardinality
-- expression; a transform's result is always the one endless fiber, ungraded, |·| = ∞). So it gets its own focused
-- registry + a generic "generator hook": one term function reads an argument collection's OWN terms (via its realized
-- unrank — so ANY numeric ungraded sequence collection is a valid argument) and applies the transform.
--
-- INDEXING. Transforms split by how they read the argument a and index the result b:
--   'window'         (0-based) — b_m is a window/prefix over a_0..a_m: partial_sums, first_differences.
--   'triangle'       (0-based) — b_m = Σ_k T(m,k) a_k, a lower-triangular (binomial) kernel.
--   'multiplicative' (1-based) — number-theoretic: a is read as a_1,a_2,… (a_0 ignored), b_0 = 1: euler, inverse_euler, moebius.
-- The classical inverses are paired so a round-trip is provable (first_differences ∘ partial_sums = id).

CREATE TABLE base_sequence_transform (
  id          text PRIMARY KEY,
  title       text NOT NULL,
  family      text NOT NULL CHECK (family IN ('window', 'triangle', 'multiplicative')),
  indexing    int  NOT NULL CHECK (indexing IN (0, 1)),   -- the base index the transform reads/produces from
  inverse     text REFERENCES base_sequence_transform,    -- the inverse transform, when classical (set below)
  description text NOT NULL,
  pack        text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack
);
CREATE TRIGGER base_sequence_transform_pack_guard BEFORE UPDATE OR DELETE ON base_sequence_transform FOR EACH ROW EXECUTE FUNCTION base_guard_pack();
INSERT INTO base_sequence_transform (id, title, family, indexing, description) VALUES
  ('partial_sums',      'Partial sums',       'window',         0, 'b_m = Σ_{i≤m} a_i — the prefix-sum (OEIS PARTIAL-SUMS / the INVERT-less accumulation)'),
  ('first_differences', 'First differences',  'window',         0, 'b_m = a_m − a_{m−1} (b_0 = a_0) — the inverse of partial sums'),
  ('binomial',          'Binomial transform', 'triangle',       0, 'b_m = Σ_k C(m,k) a_k — the binomial (Euler) transform; self-inverse up to sign'),
  ('inverse_binomial',  'Inverse binomial',   'triangle',       0, 'b_m = Σ_k (−1)^{m−k} C(m,k) a_k — undoes the binomial transform'),
  ('euler',             'Euler transform',    'multiplicative', 1, 'Π_k (1−x^k)^{−a_k} = Σ b_n x^n — the multiset/partition transform; euler(1,1,1,…) = the partition numbers'),
  ('inverse_euler',     'Inverse Euler transform (EULERi)', 'multiplicative', 1, 'undoes the Euler transform: c_n = n·b_n − Σ_{k<n} c_k·b_{n−k}, then a_n = (1/n) Σ_{d|n} μ(n/d) c_d'),
  ('moebius',           'Möbius transform',   'multiplicative', 1, 'b_n = Σ_{d|n} μ(n/d) a_d — the Dirichlet inverse of the divisor-sum (undoes Σ_{d|n} a_d)');
UPDATE base_sequence_transform SET inverse = 'first_differences' WHERE id = 'partial_sums';
UPDATE base_sequence_transform SET inverse = 'partial_sums'      WHERE id = 'first_differences';
UPDATE base_sequence_transform SET inverse = 'inverse_binomial'  WHERE id = 'binomial';
UPDATE base_sequence_transform SET inverse = 'binomial'          WHERE id = 'inverse_binomial';
UPDATE base_sequence_transform SET inverse = 'inverse_euler'     WHERE id = 'euler';
UPDATE base_sequence_transform SET inverse = 'euler'             WHERE id = 'inverse_euler';

-- read the r-th term (0-based) of any numeric ungraded sequence collection, straight off its realized unrank.
CREATE FUNCTION sequence_arg_term(arg text, r int) RETURNS numeric LANGUAGE plpgsql STABLE AS $$
  DECLARE v numeric; BEGIN
    EXECUTE format('SELECT (unrank(%I(), $1)).value', arg) INTO v USING r; RETURN v; END $$;

-- exact integer C(n,k) (no float), for the triangle kernels.
CREATE FUNCTION sequence_binomial(n int, k int) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE c numeric := 1; i int; BEGIN
    IF k < 0 OR k > n THEN RETURN 0; END IF;
    FOR i IN 0 .. k - 1 LOOP c := div(c * (n - i), i + 1); END LOOP; RETURN c; END $$;

-- THE GENERATOR HOOK: the first n terms of transform(arg, tid), computed generically from arg's own terms. plpgsql
-- arrays are 1-indexed; a[j] holds arg term (j−1). Multiplicative transforms read a_k = arg term k (a[k+1]) and the
-- argument's term 0 is ignored (they are 1-indexed sequences with b_0 = 1).
CREATE FUNCTION sequence_transform_terms(arg text, tid text, n int) RETURNS numeric[] LANGUAGE plpgsql STABLE AS $$
  DECLARE a numeric[]; b numeric[] := '{}'; c numeric[] := '{}'; i int; k int; s numeric;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM base_sequence_transform WHERE id = tid) THEN
      RAISE EXCEPTION 'unknown sequence transform %', tid; END IF;
    SELECT array_agg(sequence_arg_term(arg, g) ORDER BY g) INTO a FROM generate_series(0, n - 1) g;
    IF tid = 'partial_sums' THEN
      s := 0; FOR i IN 1 .. n LOOP s := s + a[i]; b := b || s; END LOOP;
    ELSIF tid = 'first_differences' THEN
      FOR i IN 1 .. n LOOP b := b || (a[i] - coalesce(a[i - 1], 0)); END LOOP;
    ELSIF tid = 'binomial' THEN
      FOR i IN 1 .. n LOOP s := 0;
        FOR k IN 1 .. i LOOP s := s + sequence_binomial(i - 1, k - 1) * a[k]; END LOOP; b := b || s; END LOOP;
    ELSIF tid = 'inverse_binomial' THEN
      FOR i IN 1 .. n LOOP s := 0;
        FOR k IN 1 .. i LOOP s := s + CASE WHEN (i - k) % 2 = 0 THEN 1 ELSE -1 END * sequence_binomial(i - 1, k - 1) * a[k]; END LOOP;
        b := b || s; END LOOP;
    ELSIF tid = 'euler' THEN                                     -- Sloane: c_m = Σ_{d|m} d·a_d; b_0 = 1;
      FOR i IN 1 .. n - 1 LOOP s := 0;                           --         b_m = (1/m) Σ_{k=1..m} c_k·b_{m−k}
        FOR k IN 1 .. i LOOP IF i % k = 0 THEN s := s + k * a[k + 1]; END IF; END LOOP; c := c || s; END LOOP;
      b := ARRAY[1::numeric];
      FOR i IN 1 .. n - 1 LOOP s := 0;
        FOR k IN 1 .. i LOOP s := s + c[k] * b[i - k + 1]; END LOOP; b := b || trim_scale(s / i); END LOOP;   -- exact integer; trim the numeric scale
    ELSIF tid = 'inverse_euler' THEN                              -- Sloane EULERi, undoes euler: b (the argument) plays
      FOR i IN 1 .. n - 1 LOOP s := i * a[i + 1];                 -- the role euler produces. c_n = n·b_n − Σ_{k<n} c_k·b_{n−k}
        FOR k IN 1 .. i - 1 LOOP s := s - c[k] * a[i - k + 1]; END LOOP; c := c || s; END LOOP;
      b := ARRAY[a[1]];                                           -- pass through arg's term 0 to keep the array shape
      FOR i IN 1 .. n - 1 LOOP s := 0;                            -- a_n = (1/n) Σ_{d|n} μ(n/d)·c_d
        FOR k IN 1 .. i LOOP IF i % k = 0 THEN s := s + mobius_function(i / k) * c[k]; END IF; END LOOP;
        b := b || trim_scale(s / i); END LOOP;
    ELSIF tid = 'moebius' THEN                                   -- b_n = Σ_{d|n} μ(n/d) a_d (1-based; b_0 := a_0)
      b := ARRAY[a[1]];
      FOR i IN 1 .. n - 1 LOOP s := 0;
        FOR k IN 1 .. i LOOP IF i % k = 0 THEN s := s + mobius_function(i / k) * a[k + 1]; END IF; END LOOP; b := b || s; END LOOP;
    END IF;
    RETURN b;
  END $$;

-- the m-th term alone (0-based). Multiplicative transforms still build the whole prefix (their recurrence needs it).
CREATE FUNCTION sequence_transform_term(arg text, tid text, m int) RETURNS numeric LANGUAGE sql STABLE AS $$
  SELECT (sequence_transform_terms(arg, tid, m + 1))[m + 1] $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('sequence_transforms','the transform registry carries the classical set with paired inverses (a floor)','eq','true','partial_sums/first_differences/binomial/inverse_binomial/euler/moebius',$q$
    SELECT ((SELECT array_agg(id) FROM base_sequence_transform) @> ARRAY['partial_sums','first_differences','binomial','euler','moebius']
        AND (SELECT inverse FROM base_sequence_transform WHERE id='partial_sums') = 'first_differences'
        AND (SELECT inverse FROM base_sequence_transform WHERE id='first_differences') = 'partial_sums')::text $q$),
  ('sequence_transforms','every inverse is symmetric (t.inverse.inverse = t) where defined','eq','0','the inverse pairing is an involution on the registry',$q$
    SELECT count(*)::text FROM base_sequence_transform t JOIN base_sequence_transform u ON u.id = t.inverse
     WHERE u.inverse IS DISTINCT FROM t.id $q$),

  -- the generator hook against OEIS: read a real collection's terms, transform, check the first terms by A-number
  ('sequence_transforms','partial_sums(catalan_numbers) = A014137 (1,2,4,9,23,65,197,626)','eq','1,2,4,9,23,65,197,626','the prefix sums of the Catalan numbers',$q$
    SELECT array_to_string(sequence_transform_terms('catalan_numbers','partial_sums',8), ',') $q$),
  ('sequence_transforms','binomial(catalan_numbers) = A007317 (1,2,5,15,51,188,731,2950)','eq','1,2,5,15,51,188,731,2950','the binomial transform of the Catalan numbers',$q$
    SELECT array_to_string(sequence_transform_terms('catalan_numbers','binomial',8), ',') $q$),
  ('sequence_transforms','euler(all_ones) = A000041, the PARTITION NUMBERS (1,1,2,3,5,7,11,15,22,30)','eq','1,1,2,3,5,7,11,15,22,30','the marquee identity: the Euler transform of the constant-1 sequence counts partitions',$q$
    SELECT array_to_string(sequence_transform_terms('all_ones','euler',10), ',') $q$),
  ('sequence_transforms','moebius(all_ones) = the unit 1,1,0,0,… (Σ_{d|n} μ(n/d) = [n=1])','eq','1,1,0,0,0,0,0,0','the Möbius transform inverts the divisor-sum; on the constant-1 sequence it collapses to the unit',$q$
    SELECT array_to_string(sequence_transform_terms('all_ones','moebius',8), ',') $q$),
  -- the inverse pairing, proved live on the terms: differencing the prefix sums recovers the argument (no stale pin)
  ('sequence_transforms','round-trip: first_differences ∘ partial_sums = identity on catalan_numbers (n=0..7)','eq','true','t composed with its registered inverse is the argument, term for term',$q$
    WITH ps AS (SELECT sequence_transform_terms('catalan_numbers','partial_sums',8) v)
    SELECT bool_and(
             (CASE WHEN g = 0 THEN v[1] ELSE v[g + 1] - v[g] END) = sequence_arg_term('catalan_numbers', g)
           )::text
    FROM ps, generate_series(0, 7) g $q$),

  -- more classical named instances, each OEIS-verified against the argument's ACTUAL terms (not a guessed A-number)
  ('sequence_transforms','partial_sums(fibonacci_numbers) = A000071(n+2), Fibonacci−1 (0,1,2,4,7,12,20,33)','eq','0,1,2,4,7,12,20,33','Σ_{k≤n} F(k) = F(n+2)−1; A000071 lists Fibonacci(m)−1 from m=1, so this run is its terms from m=2',$q$
    SELECT array_to_string(sequence_transform_terms('fibonacci_numbers','partial_sums',8), ',') $q$),
  ('sequence_transforms','binomial(fibonacci_numbers) = A001906, F(2n) (0,1,3,8,21,55,144,377)','eq','0,1,3,8,21,55,144,377','the binomial transform of the Fibonacci numbers is the even-indexed bisection F(2n)',$q$
    SELECT array_to_string(sequence_transform_terms('fibonacci_numbers','binomial',8), ',') $q$),
  ('sequence_transforms','binomial(motzkin_numbers) = A000108(n+1), Catalan shifted (1,2,5,14,42,132,429,1430)','eq','1,2,5,14,42,132,429,1430','the binomial transform of the Motzkin numbers is the Catalan numbers from their second term',$q$
    SELECT array_to_string(sequence_transform_terms('motzkin_numbers','binomial',8), ',') $q$),
  ('sequence_transforms','partial_sums(partition_numbers) = A000070 (1,2,4,7,12,19,30,45)','eq','1,2,4,7,12,19,30,45','A000070 is BY DEFINITION the running sum of the partition numbers',$q$
    SELECT array_to_string(sequence_transform_terms('partition_numbers','partial_sums',8), ',') $q$),
  ('sequence_transforms','moebius(natural_numbers) = A000010, Euler''s totient φ (0,1,1,2,2,4,2,6)','eq','0,1,1,2,2,4,2,6','φ(n) = Σ_{d|n} μ(n/d)·d — the classic Möbius-inversion of the identity function; slot 0 is the pass-through, not φ(0)',$q$
    SELECT array_to_string(sequence_transform_terms('natural_numbers','moebius',8), ',') $q$),
  ('sequence_transforms','euler(natural_numbers) = A000219, plane partitions (1,1,3,6,13,24,48,86)','eq','1,1,3,6,13,24,48,86','Π_k (1−x^k)^{−k} — MacMahon''s plane-partition generating function is the Euler transform of a_k=k',$q$
    SELECT array_to_string(sequence_transform_terms('natural_numbers','euler',8), ',') $q$),

  -- inverse round-trips, proved live (no stale array pin) — see the first_differences/partial_sums pair above
  ('sequence_transforms','round-trip: inverse_binomial ∘ binomial = identity on fibonacci_numbers (n=0..7)','eq','true','undoing the binomial transform (Σ (−1)^{n−k} C(n,k) b_k) recovers the argument, term for term',$q$
    WITH bt AS (SELECT sequence_transform_terms('fibonacci_numbers','binomial',8) v)
    SELECT bool_and(
             (SELECT sum(CASE WHEN (g - k) % 2 = 0 THEN 1 ELSE -1 END * sequence_binomial(g, k) * v[k + 1])
              FROM generate_series(0, g) k) = sequence_arg_term('fibonacci_numbers', g)
           )::text
    FROM bt, generate_series(0, 7) g $q$),
  ('sequence_transforms','round-trip: inverse_euler ∘ euler = identity on all_ones (n=0..7)','eq','true','partition_numbers IS euler(all_ones) (proved above); inverting it live recovers all_ones, term for term',$q$
    SELECT bool_and(
             (sequence_transform_terms('partition_numbers','inverse_euler',8))[g + 1] = sequence_arg_term('all_ones', g)
           )::text
    FROM generate_series(0, 7) g $q$);
