-- requires: realizer, algebra, utilities
-- multicomplex_numbers — the multicomplex ring ℂn(ℤ/Mℤ) = (ℤ/Mℤ)[i₁,…,iₙ] / (i₁²+1, …, iₙ²+1): the commutative
-- ring TOWER (ℂ0 = ℤ/M, ℂ1 ≅ ℂ over ℤ/M, ℂ2 = bicomplex, …), NOT the quaternions. Its 2ⁿ basis units j_m are
-- indexed by bitmasks, so multiplication is XOR on indices with a Thue–Morse overlap sign:
--     j_a · j_b = (−1)^popcount(a∧b) · j_(a⊻b)        j_m² = (−1)^popcount(m)
-- (evil index m → +1, odious → −1). Ported from ~/Playground/ideas/numbers/src/multicomplex.ts.
--
-- ── DESIGN DECISIONS (the #59 deferral was about the carrier/grading/ring calls; here they are) ───────────────
-- CARRIER: (coeffs int[], modulus int) — an element IS its 2ⁿ-coefficient vector over ℤ/M, LSB-first (coeffs[1] = a0
--   the scalar, coeffs[k] = the coefficient of j_(k−1)). The carrier carries M inline (like modular_residue), so a
--   value knows its ring and 2ⁿ = array_length gives the tower order back — ring arithmetic is well-defined on the value.
-- GRADING: two axes (modulus, level) — the base ring ℤ/M and the tower order n. |ℂn(ℤ/M)| = M^(2ⁿ) is a function of
--   BOTH, so both are genuine grades (cf. box_confined_partitions' two structural axes), and both are REQUIRED — there
--   is no natural range to unfold n over (the count explodes), so no default range (cf. affine_permutations). The fiber
--   is finite (huge) → a bounded collection, windowed like k_subsets(40,20): exact numeric cardinality, paged elements.
-- RING: YES — registered in the algebra lattice as a commutative_ring (base_type_structure/base_type_operation),
--   mirroring gaussian_integer and modular_residue, with SQL + − · operators on the carrier. The interactive
--   client-side expression evaluator (core.ts emitterFor) is a FOLLOW-UP: it needs a multi-unit grammar (i₁,i₂,…),
--   a real grammar extension vs. gaussian's single bare `i`. The SQL ring is complete and tested here regardless.
--   NORM + INVERSE: built below (#167 part 1) — the algebra norm (det of multiplication-by-z) via the tower, not a
--   conjugate product, which the mixed signature rules out. Still deferred: the SPECTRAL half of #167 (Hensel-lifted
--   √−1 per CRT channel, primitive idempotents, the î-twisted Walsh–Hadamard transform, the 2ⁿ × ω(M) spectral
--   grid) — it turns on the signature-vector design in #327 and waits for it.

-- ── carrier ──────────────────────────────────────────────────────────────────────────────────────────────
CREATE TYPE multicomplex AS (coeffs int[], modulus int);

CREATE FUNCTION multicomplex_popcount(x int) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT count(*)::int FROM generate_series(0, 30) b WHERE (x >> b) & 1 = 1 $$;

-- balanced coefficient form: a0 + a1·j1 − 2·j3, coefficients folded into (−M/2, M/2], unit names j<idx> (j0 = scalar).
CREATE FUNCTION notation(z multicomplex) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m int := (z).modulus; cs int[] := (z).coeffs; c int; bal int; mag int; unit text; body text;
        out text := ''; first boolean := true; i int;
BEGIN
  IF cs IS NULL OR array_length(cs, 1) IS NULL THEN RETURN '0'; END IF;
  FOR i IN 1 .. array_length(cs, 1) LOOP
    c := ((cs[i] % m) + m) % m;
    CONTINUE WHEN c = 0;
    bal  := CASE WHEN c > m / 2 THEN c - m ELSE c END;          -- balanced representative
    mag  := abs(bal);
    unit := CASE WHEN i = 1 THEN '' ELSE 'j' || (i - 1) END;    -- index = i−1; j0 is the bare scalar
    body := CASE WHEN i = 1 THEN mag::text WHEN mag = 1 THEN unit ELSE mag::text || unit END;
    IF first THEN out := CASE WHEN bal < 0 THEN '-' || body ELSE body END; first := false;
    ELSE           out := out || CASE WHEN bal < 0 THEN ' - ' ELSE ' + ' END || body; END IF;
  END LOOP;
  RETURN CASE WHEN first THEN '0' ELSE out END;
END $$;

-- ── commutative-ring arithmetic (per (M, order); operands must share modulus AND dimension) ──────────────────
CREATE FUNCTION multicomplex_add(a multicomplex, b multicomplex) RETURNS multicomplex LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (a).modulus = (b).modulus AND array_length((a).coeffs, 1) = array_length((b).coeffs, 1) THEN
    ROW((SELECT array_agg((((a).coeffs[i] + (b).coeffs[i]) % (a).modulus + (a).modulus) % (a).modulus ORDER BY i)
           FROM generate_series(1, array_length((a).coeffs, 1)) i), (a).modulus)::multicomplex END $$;
CREATE FUNCTION multicomplex_neg(a multicomplex) RETURNS multicomplex LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((SELECT array_agg(((-(a).coeffs[i]) % (a).modulus + (a).modulus) % (a).modulus ORDER BY i)
                FROM generate_series(1, array_length((a).coeffs, 1)) i), (a).modulus)::multicomplex $$;
CREATE FUNCTION multicomplex_sub(a multicomplex, b multicomplex) RETURNS multicomplex LANGUAGE sql IMMUTABLE AS $$
  SELECT multicomplex_add(a, multicomplex_neg(b)) $$;
-- multiplication = XOR-convolution with Thue–Morse overlap signs: out[a⊻b] += (−1)^popcount(a∧b)·ca·cb  (mod M).
CREATE FUNCTION multicomplex_mul(a multicomplex, b multicomplex) RETURNS multicomplex LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN (a).modulus = (b).modulus AND array_length((a).coeffs, 1) = array_length((b).coeffs, 1) THEN
    ROW((SELECT array_agg(coeff ORDER BY k) FROM (
           SELECT k, ((sum(term) % (a).modulus + (a).modulus) % (a).modulus)::int AS coeff FROM (
             SELECT (i - 1) # (j - 1) AS k,
                    (CASE WHEN multicomplex_popcount((i - 1) & (j - 1)) % 2 = 0 THEN 1 ELSE -1 END)::bigint
                      * ((a).coeffs[i] % (a).modulus) * ((b).coeffs[j] % (a).modulus) AS term
             FROM generate_series(1, array_length((a).coeffs, 1)) i, generate_series(1, array_length((a).coeffs, 1)) j
           ) prod GROUP BY k
         ) g), (a).modulus)::multicomplex END $$;
-- conjugation flipping every unit (i_k ↦ −i_k): a ring automorphism, coeff m negated iff m is odious.
CREATE FUNCTION multicomplex_conj(a multicomplex) RETURNS multicomplex LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((SELECT array_agg(
                CASE WHEN multicomplex_popcount(i - 1) % 2 = 0 THEN (a).coeffs[i]
                     ELSE ((-(a).coeffs[i]) % (a).modulus + (a).modulus) % (a).modulus END ORDER BY i)
              FROM generate_series(1, array_length((a).coeffs, 1)) i), (a).modulus)::multicomplex $$;

CREATE OPERATOR + (LEFTARG = multicomplex, RIGHTARG = multicomplex, FUNCTION = multicomplex_add, COMMUTATOR = +);
CREATE OPERATOR * (LEFTARG = multicomplex, RIGHTARG = multicomplex, FUNCTION = multicomplex_mul, COMMUTATOR = *);
CREATE OPERATOR - (LEFTARG = multicomplex, RIGHTARG = multicomplex, FUNCTION = multicomplex_sub);
CREATE OPERATOR - (RIGHTARG = multicomplex, FUNCTION = multicomplex_neg);

INSERT INTO base_type_structure VALUES ('multicomplex', 'commutative_ring');   -- NOT ordered (a ring of zero divisors)
INSERT INTO base_type_operation (type, op, symbol, impl_fn) VALUES
  ('multicomplex', 'add', '+', 'multicomplex_add'), ('multicomplex', 'mul', '·', 'multicomplex_mul'), ('multicomplex', 'neg', '−', 'multicomplex_neg');

-- ── the collection: ℂn(ℤ/M) as an enumerable, browsable set, graded by (modulus, level=n) ─────────────────────
CREATE TYPE multicomplex_numbers_fiber AS (modulus natural_number, level natural_number);   -- axes: modulus M, tower order n
-- FLOOR: elements addressed by a uniform base-M numeral over 2ⁿ places (LSB = the scalar a0). count = M^(2ⁿ) is
-- finite but astronomically large, so the window never materializes the whole fiber — cap the numeral range at the
-- emit-limit, and skip computing the giant power when the count obviously outruns it.
CREATE FUNCTION fiber_unrank(f multicomplex_numbers_fiber, rank rank_index) RETURNS multicomplex LANGUAGE sql IMMUTABLE AS $$
  SELECT ROW((SELECT array_agg((div(rank::numeric, power((f).modulus::numeric, i)) % (f).modulus)::int ORDER BY i)
                FROM generate_series(0, power(2::numeric, (f).level)::int - 1) i),
             (f).modulus::int)::multicomplex $$;
CREATE FUNCTION fiber_count(f multicomplex_numbers_fiber) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$
  SELECT trunc(power((f).modulus::numeric, power(2::numeric, (f).level))) $$;   -- |ℂn(ℤ/M)| = M^(2ⁿ), exact (scale 0)
CREATE FUNCTION fiber_elements(f multicomplex_numbers_fiber, element_limit int) RETURNS SETOF multicomplex LANGUAGE sql STABLE AS $$
  -- M < 2 is degenerate (ℤ/0 is empty, ℤ/1 the zero ring) and the log-scale test below can't see it: greatest(M, 2)
  -- read both as M=2, so the shortcut claimed a full window for a fiber holding 0 or 1 elements — cardinality said 1
  -- while elements() yielded 5000, and unranking mod 0 divided by zero (#254). Take those two counts directly.
  WITH w AS (SELECT CASE WHEN (f).modulus < 2 THEN least((f).modulus::bigint, element_limit::bigint)
                         WHEN power(2::numeric, (f).level) * log(2.0, (f).modulus::numeric) > 45
                         THEN element_limit::bigint                                          -- count ≫ any window: don't compute it
                         ELSE least(power((f).modulus::numeric, power(2::numeric, (f).level))::bigint, element_limit::bigint)
                    END AS n)
  SELECT fiber_unrank(f, r::rank_index) FROM w, generate_series(0, w.n - 1) r ORDER BY r $$;
CREATE FUNCTION contains_in_fiber(f multicomplex_numbers_fiber, v multicomplex) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT (v).modulus = (f).modulus::int
     AND array_length((v).coeffs, 1) = power(2::numeric, (f).level)::int             -- right dimension for the order
     AND NOT EXISTS (SELECT 1 FROM unnest((v).coeffs) c WHERE c < 0 OR c >= (f).modulus::int) $$;
CREATE FUNCTION fiber_symbol(f multicomplex_numbers_fiber) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'ℂ' || (f).level::int || '(ℤ/' || (f).modulus::int || ')' $$;

INSERT INTO base_collection VALUES ('multicomplex_numbers', 'multicomplex');   -- bounded (finite, huge fibers)
INSERT INTO base_grade VALUES
  ('multicomplex_numbers', 1, 'modulus', NULL, NULL),   -- the base ring ℤ/M (required)
  -- The tower order carries a DEFAULT extent, unlike the modulus: an unbounded inner axis never lets the odometer
  -- carry, so the open handle pinned M at its lower bound and rayed on the level forever — and a 2ⁿ-place numeral
  -- runs past int at level 31 regardless (#254). hi_expr bounds the DEFAULT unfold only; multicomplex_numbers(5, 9)
  -- still constructs and enumerates ℂ9(ℤ/5) exactly as before.
  ('multicomplex_numbers', 2, 'level',   '0',  '4');    -- the tower order n — ℂ4 is 16 places, the marquee example
SELECT base_realize('multicomplex_numbers');

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('multicomplex_numbers','ℂ0(ℤ/5) = ℤ/5: cardinality 5, the modular integers (balanced: 3,4 ↦ −2,−1)','eq','5|0,1,2,-2,-1','the order-0 base case',$q$
    SELECT cardinality(multicomplex_numbers(5,0))::text || '|' ||
           string_agg(notation((e).value), ',' ORDER BY ordinality(e)) FROM elements(multicomplex_numbers(5,0)) e $q$),
  ('multicomplex_numbers','ℂ1(ℤ/5) ≅ ℂ over ℤ/5: cardinality 25 = 5^2','eq','25','one imaginary unit, dim 2',$q$
    SELECT cardinality(multicomplex_numbers(5,1))::text $q$),
  ('multicomplex_numbers','ℂ2(ℤ/5) bicomplex: cardinality 625 = 5^4','eq','625','four basis units 1,j1,j2,j3',$q$
    SELECT cardinality(multicomplex_numbers(5,2))::text $q$),
  ('multicomplex_numbers','ℂ4(ℤ/5): |ℂ4(ℤ/M)| = M^(2^4) = 5^16 (exact numeric, past int)','eq','152587890625','the count outruns int4; fiber_count is closed-form',$q$
    SELECT cardinality(multicomplex_numbers(5,4))::text $q$),
  ('multicomplex_numbers','coefficient address: rank 386 of ℂ2(ℤ/5) is 1 + 2j1 − 2j3','eq','1 + 2j1 - 2j3','base-5 numeral 386 = 1 + 2·5 + 3·125; a3=3 folds to −2',$q$
    SELECT notation((unrank(multicomplex_numbers(5,2), 386)).value) $q$),
  ('multicomplex_numbers','i² = −1: j1·j1 = −1 in ℂ1(ℤ/5) (odious index 1 squares to −1)','eq','-1','the defining relation i₁²+1 = 0',$q$
    SELECT notation(ROW(ARRAY[0,1],5)::multicomplex * ROW(ARRAY[0,1],5)::multicomplex) $q$),
  ('multicomplex_numbers','unit product: j1·j2 = j3 in ℂ2(ℤ/5) (XOR of indices, even overlap → +)','eq','j3','i₁i₂ = j₃, index 1⊻2 = 3',$q$
    SELECT notation(ROW(ARRAY[0,1,0,0],5)::multicomplex * ROW(ARRAY[0,0,1,0],5)::multicomplex) $q$),
  ('multicomplex_numbers','Thue–Morse squares: j3² = +1 (evil index 3), j1² = −1 (odious)','eq','1|-1','j_m² = (−1)^popcount(m)',$q$
    SELECT notation(ROW(ARRAY[0,0,0,1],5)::multicomplex * ROW(ARRAY[0,0,0,1],5)::multicomplex) || '|' ||
           notation(ROW(ARRAY[0,1,0,0],5)::multicomplex * ROW(ARRAY[0,1,0,0],5)::multicomplex) $q$),
  ('multicomplex_numbers','(1 + j1)² = 2j1 in ℂ1(ℤ/5) (binomial: 1 + 2i + i² = 2i)','eq','2j1',NULL,$q$
    SELECT notation(ROW(ARRAY[1,1],5)::multicomplex * ROW(ARRAY[1,1],5)::multicomplex) $q$),
  ('multicomplex_numbers','commutative: j1·j2 = j2·j1 in ℂ2(ℤ/5)','eq','true','a commutative ring, unlike the quaternions',$q$
    SELECT (ROW(ARRAY[0,1,0,0],5)::multicomplex * ROW(ARRAY[0,0,1,0],5)::multicomplex
          = ROW(ARRAY[0,0,1,0],5)::multicomplex * ROW(ARRAY[0,1,0,0],5)::multicomplex)::text $q$),
  ('multicomplex_numbers','add / negate mod 5: (3 + 4j1) + (4 + 2j1) = 2 + j1, and −(1 + j1) = −1 − j1','eq','2 + j1|-1 - j1','coefficient-wise in ℤ/5 (balanced)',$q$
    SELECT notation(ROW(ARRAY[3,4],5)::multicomplex + ROW(ARRAY[4,2],5)::multicomplex) || '|' ||
           notation(- ROW(ARRAY[1,1],5)::multicomplex) $q$),
  ('multicomplex_numbers','conjugation flips every unit: conj(1 + j1 + j2 + j3) = 1 − j1 − j2 + j3','eq','1 - j1 - j2 + j3','odious units negate, evil (1, j3) survive',$q$
    SELECT notation(multicomplex_conj(ROW(ARRAY[1,1,1,1],5)::multicomplex)) $q$),
  ('multicomplex_numbers','registered as a commutative ring (⇒ ring, semiring, …)','eq','true',NULL,$q$
    SELECT EXISTS(SELECT 1 FROM base_type_structure ts JOIN base_structure_closure c ON c.structure = ts.structure
                  WHERE ts.type = 'multicomplex' AND c.is_a = 'ring')::text $q$),
  ('multicomplex_numbers','element carries a TYPED (modulus, level) fiber','eq','5|2','unrank(…).fiber is (modulus=5, level=2)',$q$
    SELECT (unrank(multicomplex_numbers(5,2), 386)).fiber.modulus::text || '|' ||
           (unrank(multicomplex_numbers(5,2), 386)).fiber.level::text $q$),
  ('multicomplex_numbers','contains via <@: (1+2j1−2j3) ∈ ℂ2(ℤ/5); wrong dim / out-of-range coeff ∉','eq','true|false|false','ground-aware membership',$q$
    SELECT (ROW(ARRAY[1,2,0,3],5)::multicomplex <@ multicomplex_numbers(5,2))::text || '|' ||
           (ROW(ARRAY[1,1],5)::multicomplex     <@ multicomplex_numbers(5,2))::text || '|' ||
           (ROW(ARRAY[1,2,0,7],5)::multicomplex <@ multicomplex_numbers(5,2))::text $q$),
  ('multicomplex_numbers','set_notation: rank 0 of ℂ2(ℤ/5) ↦ 0 ∈ ℂ2(ℤ/5)','eq','0 ∈ ℂ2(ℤ/5)','the fiber symbol carries both grades',$q$
    SELECT set_notation(unrank(multicomplex_numbers(5,2), 0)) $q$),
  ('multicomplex_numbers','degenerate moduli count what they enumerate: ℤ/0 is empty, ℤ/1 the zero ring','eq','0|0|1|1','#254 — the log-scale shortcut used to claim a full window for both',$q$
    SELECT cardinality(multicomplex_numbers(0,6))::text || '|' || (SELECT count(*) FROM elements(multicomplex_numbers(0,6)) e)::text || '|' ||
           cardinality(multicomplex_numbers(1,6))::text || '|' || (SELECT count(*) FROM elements(multicomplex_numbers(1,6)) e)::text $q$),
  ('multicomplex_numbers','the open handle fills its window','eq','100','#254 — the level axis''s default extent lets the odometer carry to the next modulus',$q$
    SELECT count(*)::text FROM elements(multicomplex_numbers(), 100) e $q$),
  ('multicomplex_numbers','the default extent bounds the unfold, not the collection','eq','155','ℂ9(ℤ/2) past the level-4 default still constructs and counts: 2^(2^9) = 2^512, a 155-digit integer',$q$
    SELECT length(cardinality(multicomplex_numbers(2,9))::text)::text $q$);

-- ── norm and multiplicative inverse (#167 part 1) ─────────────────────────────────────────────────────────
-- DEFINITION. N(z) = det of the multiplication-by-z map on ℂn(ℤ/M) as a free ℤ/M-module of rank 2ⁿ — the ALGEBRA
-- norm. Not a conjugate product: the signature here is MIXED (j_m² = (−1)^popcount(m), so j1² = j2² = −1 but
-- j3² = +1), and multicomplex_conj — which flips every odious unit — is a ring automorphism whose "norm" is not a
-- scalar above n = 1. At n = 2, for z = a + b·j1 + c·j2 + d·j3,
--     z · conj(z) = (a² + b² + c² + d²) + 2(ad − bc)·j3,
-- with a live j3 part. So the Gaussian shortcut N(z) = z·conj(z) is simply unavailable here; the determinant is.
--
-- COMPUTED BY THE TOWER, not by eliminating a 2ⁿ×2ⁿ matrix. ℂn = ℂ(n−1)[i_n]/(i_n² + 1) with i_n = j_(2^(n−1)),
-- and the coefficient array splits exactly at the halfway mark: the low half is u ∈ ℂ(n−1), the high half is
-- v ∈ ℂ(n−1), and z = u + i_n·v (the overlap 2^(n−1) ∧ m' is empty, so no Thue–Morse sign creeps into the split).
-- The determinant of a ℂ(n−1)-linear map read over the base is the base-norm of its ℂ(n−1)-determinant, and
-- (u + i_n·v)(u − i_n·v) = u² + v², so
--     N(z) = N_{ℂ(n−1)}(u² + v²),        N(a) = a  at n = 0.
-- O(n) squarings, and exact mod M at every step (the norm form has integer coefficients, so reducing as you go is
-- the same as reducing at the end). Checks: n = 1 gives a² + b², the Gaussian norm; a scalar a gives a^(2ⁿ) = det
-- of a·I; and for z = 1 + 2·j1 + 3·j3 over ℤ/97 the multiplication matrix in the basis (1, j1, j2, j3) is
--     [1 −2  0  3; 2  1 −3  0; 0 −3  1 −2; 3  0  2  1],   det = 160,
-- which is what the recursion returns ((1−4+0−9)² + (2·1·2 + 2·0·3)² = 144 + 16), reduced to 160 mod 97 = 63.
CREATE FUNCTION multicomplex_norm(z multicomplex) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n int := array_length((z).coeffs, 1); m int := (z).modulus; h int; u multicomplex; v multicomplex;
BEGIN
  IF n IS NULL OR m IS NULL OR m < 1 OR (n & (n - 1)) <> 0 THEN RETURN NULL; END IF;   -- 2ⁿ places or nothing
  IF n = 1 THEN RETURN ((z).coeffs[1] % m + m) % m; END IF;                            -- ℂ0 = ℤ/M: N(a) = a
  h := n / 2;
  u := ROW((SELECT array_agg((z).coeffs[i]     ORDER BY i) FROM generate_series(1, h) i), m)::multicomplex;
  v := ROW((SELECT array_agg((z).coeffs[h + i] ORDER BY i) FROM generate_series(1, h) i), m)::multicomplex;
  RETURN multicomplex_norm(multicomplex_add(multicomplex_mul(u, u), multicomplex_mul(v, v)));
END $$;

-- extended Euclid, NULL (not an exception) when gcd(a, m) ≠ 1 — multicomplex_inverse needs non-invertibility as a
-- value, since a non-unit is an ordinary inhabitant of ℂn(ℤ/M), not an error. (residue_invmod raises; it also isn't
-- ordered before this file.)
CREATE FUNCTION multicomplex_invmod(a int, m int) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE t bigint := 0; nt bigint := 1; r bigint := m; nr bigint := (a % m + m) % m; q bigint; tmp bigint;
BEGIN
  IF m IS NULL OR m < 1 THEN RETURN NULL; END IF;
  WHILE nr <> 0 LOOP
    q := div(r, nr);
    tmp := t - q * nt; t := nt; nt := tmp;
    tmp := r - q * nr; r := nr; nr := tmp;
  END LOOP;
  IF r <> 1 THEN RETURN NULL; END IF;
  RETURN ((t % m + m) % m)::int;
END $$;

-- z is a UNIT iff N(z) is invertible mod M — NULL for every non-unit. (⇒ N is multiplicative and N(1) = 1, so a
-- unit has an invertible norm; ⇐ is the recursion below: z·(u − i_n·v) = u² + v², so z is a unit exactly when
-- u² + v² is one in ℂ(n−1), and by induction that happens exactly when N(z) = N_{ℂ(n−1)}(u² + v²) is invertible.)
-- Note this is coprimality, NOT non-vanishing: over a composite M a nonzero norm can still fail (N(1 + j1) = 2 over
-- ℤ/6), and over any M ≥ 2 with n ≥ 2 the zero divisor 1 + j3 has N = 0 — indeed (1 + j3)(1 − j3) = 1 − j3² = 0.
CREATE FUNCTION multicomplex_inverse(z multicomplex) RETURNS multicomplex LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE n int := array_length((z).coeffs, 1); m int := (z).modulus; h int;
        u multicomplex; v multicomplex; s multicomplex; s_inv multicomplex; a int;
BEGIN
  IF n IS NULL OR m IS NULL OR m < 1 OR (n & (n - 1)) <> 0 THEN RETURN NULL; END IF;
  IF n = 1 THEN
    a := multicomplex_invmod((z).coeffs[1], m);
    RETURN CASE WHEN a IS NULL THEN NULL ELSE ROW(ARRAY[a], m)::multicomplex END;
  END IF;
  h := n / 2;
  u := ROW((SELECT array_agg((z).coeffs[i]     ORDER BY i) FROM generate_series(1, h) i), m)::multicomplex;
  v := ROW((SELECT array_agg((z).coeffs[h + i] ORDER BY i) FROM generate_series(1, h) i), m)::multicomplex;
  s := multicomplex_add(multicomplex_mul(u, u), multicomplex_mul(v, v));        -- N_{ℂn/ℂ(n−1)}(z) = u² + v²
  s_inv := multicomplex_inverse(s);
  IF s_inv IS NULL OR (s_inv).coeffs IS NULL THEN RETURN NULL; END IF;
  -- z⁻¹ = (u − i_n·v) · s⁻¹, with s⁻¹ lifted back into ℂn by zero-padding the high half
  RETURN multicomplex_mul(
    ROW((u).coeffs || (multicomplex_neg(v)).coeffs, m)::multicomplex,
    ROW((s_inv).coeffs || (SELECT array_agg(0) FROM generate_series(1, h)), m)::multicomplex);
END $$;

INSERT INTO base_stat (collection, stat_id, value_fn, title, codomain) VALUES
  ('multicomplex_numbers','norm','multicomplex_norm','Algebra norm (det of multiplication-by-z)','natural_numbers');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('multicomplex_numbers','norm at n=1 is the Gaussian norm: N(3 + 4j1) = 3²+4² = 25 ≡ 12 mod 13','eq','12|25','the tower recursion bottoms out at a²+b²',$q$
    SELECT multicomplex_norm(ROW(ARRAY[3,4],13)::multicomplex)::text || '|' ||
           multicomplex_norm(ROW(ARRAY[3,4],97)::multicomplex)::text $q$),
  ('multicomplex_numbers','norm at n=0 is the residue itself, and a scalar in ℂ2 has N(a) = a^(2²) = 81','eq','3|81','det of a·I on a rank-2ⁿ module',$q$
    SELECT multicomplex_norm(ROW(ARRAY[3],97)::multicomplex)::text || '|' ||
           multicomplex_norm(ROW(ARRAY[3,0,0,0],97)::multicomplex)::text $q$),
  ('multicomplex_numbers','norm = det of the multiplication matrix: N(1 + 2j1 + 3j3) over ℤ/97 is det[1 −2 0 3; 2 1 −3 0; 0 −3 1 −2; 3 0 2 1] = 160 ≡ 63','eq','63','the 4×4 determinant, expanded by hand in the header',$q$
    SELECT multicomplex_norm(ROW(ARRAY[1,2,0,3],97)::multicomplex)::text $q$),
  ('multicomplex_numbers','norm is multiplicative: N(z)=160, N(w)=32, N(zw) = 160·32 = 5120 ≡ 76 mod 97','eq','76|76','z = 1+2j1+3j3, w = 2+j1+j2 in ℂ2(ℤ/97)',$q$
    SELECT multicomplex_norm(ROW(ARRAY[1,2,0,3],97)::multicomplex * ROW(ARRAY[2,1,1,0],97)::multicomplex)::text || '|' ||
           ((multicomplex_norm(ROW(ARRAY[1,2,0,3],97)::multicomplex)::bigint
           * multicomplex_norm(ROW(ARRAY[2,1,1,0],97)::multicomplex)) % 97)::text $q$),
  ('multicomplex_numbers','the units of ℂ1(ℤ/5) and ℂ1(ℤ/3): 16 = 4·4 (ℤ/5[i] ≅ ℤ/5 × ℤ/5, since −1 ≡ 2² mod 5) and 8 (ℤ/3[i] ≅ 𝔽9, a field)','eq','16|8','closed-form unit counts, independent of the implementation',$q$
    SELECT (SELECT count(*) FROM elements(multicomplex_numbers(5,1)) e WHERE multicomplex_inverse((e).value) IS NOT NULL)::text || '|' ||
           (SELECT count(*) FROM elements(multicomplex_numbers(3,1)) e WHERE multicomplex_inverse((e).value) IS NOT NULL)::text $q$),
  ('multicomplex_numbers','unit ⇔ invertible norm: over all of ℂ1(ℤ/6), inverse exists exactly where gcd(N(z),6) = 1','eq','true','the criterion, checked pointwise on 36 elements',$q$
    SELECT bool_and((multicomplex_inverse((e).value) IS NOT NULL)
                  = (gcd_int(multicomplex_norm((e).value), 6) = 1))::text
      FROM elements(multicomplex_numbers(6,1)) e $q$),
  ('multicomplex_numbers','inverse round-trip: z·z⁻¹ = 1 for the units of ℂ2(ℤ/97) and ℂ1(ℤ/6)','eq','1|1','1 + 2j1 + 3j3 (N=63) and 1 + 2j1 (N=5, coprime to 6)',$q$
    SELECT notation(ROW(ARRAY[1,2,0,3],97)::multicomplex * multicomplex_inverse(ROW(ARRAY[1,2,0,3],97)::multicomplex)) || '|' ||
           notation(ROW(ARRAY[1,2],6)::multicomplex * multicomplex_inverse(ROW(ARRAY[1,2],6)::multicomplex)) $q$),
  ('multicomplex_numbers','(1 + 2j1)⁻¹ = 5 + 2j1 in ℂ1(ℤ/6) — hand-computed: conj/N = (1 − 2j1)·5⁻¹ = (1 + 4j1)·5','eq','-1 + 2j1','balanced notation folds 5 to −1',$q$
    SELECT notation(multicomplex_inverse(ROW(ARRAY[1,2],6)::multicomplex)) $q$),
  ('multicomplex_numbers','non-units return NULL: 1 + j3 is a zero divisor (N = 0, and (1+j3)(1−j3) = 1 − j3² = 0), and 1 + j1 over ℤ/6 has N = 2','eq','0|true|0|2|true','a nonzero norm can still be non-invertible over composite M',$q$
    SELECT multicomplex_norm(ROW(ARRAY[1,0,0,1],97)::multicomplex)::text || '|' ||
           (multicomplex_inverse(ROW(ARRAY[1,0,0,1],97)::multicomplex) IS NULL)::text || '|' ||
           notation(ROW(ARRAY[1,0,0,1],97)::multicomplex * ROW(ARRAY[1,0,0,97-1],97)::multicomplex)::text || '|' ||
           multicomplex_norm(ROW(ARRAY[1,1],6)::multicomplex)::text || '|' ||
           (multicomplex_inverse(ROW(ARRAY[1,1],6)::multicomplex) IS NULL)::text $q$),
  ('multicomplex_numbers','z·conj(z) is NOT a scalar for n ≥ 2: (a+b j1+c j2+d j3)·conj(…) = (a²+b²+c²+d²) + 2(ad−bc)·j3','eq','30 - 4j3','why the norm is a determinant, not a conjugate product: (a,b,c,d) = (1,2,3,4) gives 1+4+9+16 = 30 and 2(1·4 − 2·3) = −4',$q$
    SELECT notation(ROW(ARRAY[1,2,3,4],97)::multicomplex * multicomplex_conj(ROW(ARRAY[1,2,3,4],97)::multicomplex)) $q$),
  ('multicomplex_numbers','norm registered as a stat','eq','true',NULL,$q$
    SELECT EXISTS(SELECT 1 FROM base_stat WHERE collection = 'multicomplex_numbers' AND stat_id = 'norm')::text $q$);
