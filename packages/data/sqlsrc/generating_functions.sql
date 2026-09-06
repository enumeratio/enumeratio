-- requires: realizer, statistics, utilities, restrictions
-- requires-tag: collection
-- Generating functions as data (issue #234, catalog-audit friction 5) — the classical statement of a fiber-level
-- DISTRIBUTION. A generating function takes a collection (+ optionally a statistic) and yields a coefficient
-- sequence; the differential asserts that sequence IS the live distribution of the stat over the collection's fiber.
--
-- SCOPE. This registry holds the q-POLYNOMIAL (a stat's distribution as Σ_x q^{stat(x)}) and OGF (a collection's own
-- counting sequence) rows. The EXPONENTIAL (species) generating functions live in base_species.sql, which is already
-- a full labelled/EGF engine — a transform's result there is an EGF in x, a different object; #234's egf rows are
-- registry additions THERE, not here.
--
-- The expander is a small polynomial-arithmetic kit over numeric[] coefficient arrays, LOW-TO-HIGH in q:
-- r[j+1] = coefficient of q^j. Everything is exact integer arithmetic (no division), so no trim_scale is needed.

-- ── polynomial kit ───────────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION gf_padd(a numeric[], b numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := greatest(coalesce(array_length(a, 1), 0), coalesce(array_length(b, 1), 0)); r numeric[]; i int;
  BEGIN IF n = 0 THEN RETURN ARRAY[]::numeric[]; END IF; r := array_fill(0::numeric, ARRAY[n]);
    FOR i IN 1 .. n LOOP r[i] := coalesce(a[i], 0) + coalesce(b[i], 0); END LOOP; RETURN r; END $$;
CREATE FUNCTION gf_pmul(a numeric[], b numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- full poly product
  DECLARE da int := coalesce(array_length(a, 1), 0); db int := coalesce(array_length(b, 1), 0); r numeric[]; i int; j int;
  BEGIN IF da = 0 OR db = 0 THEN RETURN ARRAY[]::numeric[]; END IF;
    r := array_fill(0::numeric, ARRAY[da + db - 1]);
    FOR i IN 1 .. da LOOP FOR j IN 1 .. db LOOP r[i + j - 1] := r[i + j - 1] + a[i] * b[j]; END LOOP; END LOOP; RETURN r; END $$;
CREATE FUNCTION gf_shift(p numeric[], s int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- multiply by q^s
  SELECT CASE WHEN s <= 0 THEN p ELSE array_fill(0::numeric, ARRAY[s]) || p END $$;
CREATE FUNCTION gf_qint(k int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- [k]_q = 1+q+…+q^{k-1}
  SELECT CASE WHEN k <= 0 THEN ARRAY[]::numeric[] ELSE array_fill(1::numeric, ARRAY[k]) END $$;
CREATE FUNCTION gf_pow(base numeric[], e int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r numeric[] := ARRAY[1::numeric]; i int; BEGIN
    FOR i IN 1 .. e LOOP r := gf_pmul(r, base); END LOOP; RETURN r; END $$;

-- ── builders — one per registered generating function; each RETURNS numeric[] coefficients low-to-high in q ─────
CREATE FUNCTION gf_qfactorial(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- [n]_q! (Mahonian: inv, maj)
  DECLARE r numeric[] := ARRAY[1::numeric]; i int; BEGIN
    FOR i IN 1 .. n LOOP r := gf_pmul(r, gf_qint(i)); END LOOP; RETURN r; END $$;
CREATE FUNCTION gf_eulerian_row(n int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- A_n(q), via the existing eulerian_number DP
  SELECT CASE WHEN n = 0 THEN ARRAY[1::numeric]
              ELSE ARRAY(SELECT eulerian_number(n, k) FROM generate_series(0, n - 1) k) END $$;
CREATE FUNCTION gf_qcatalan_area(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- Carlitz: C_0=1, C_{m+1}=Σ_k q^k C_k C_{m-k}
  DECLARE store jsonb := jsonb_build_object('0', to_jsonb(ARRAY[1::numeric])); m int; k int; acc numeric[];
  BEGIN FOR m IN 0 .. n - 1 LOOP acc := ARRAY[]::numeric[];
      FOR k IN 0 .. m LOOP acc := gf_padd(acc, gf_shift(gf_pmul(
        ARRAY(SELECT jsonb_array_elements_text(store -> k::text)::numeric),
        ARRAY(SELECT jsonb_array_elements_text(store -> (m - k)::text)::numeric)), k)); END LOOP;
      store := store || jsonb_build_object((m + 1)::text, to_jsonb(acc)); END LOOP;
    RETURN ARRAY(SELECT jsonb_array_elements_text(store -> n::text)::numeric); END $$;
CREATE FUNCTION gf_partition_ogf(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- ∏_{k≥1} 1/(1-q^k) to degree n
  DECLARE r numeric[] := ARRAY[1::numeric]; k int; geom numeric[]; j int; BEGIN
    FOR k IN 1 .. n LOOP geom := array_fill(0::numeric, ARRAY[n + 1]);
      j := 0; WHILE j * k <= n LOOP geom[j * k + 1] := 1; j := j + 1; END LOOP;
      r := (gf_pmul(r, geom))[1:n + 1]; END LOOP;
    RETURN r[1:n + 1]; END $$;
CREATE FUNCTION gf_distinct_partition_ogf(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- ∏_{k≥1} (1+q^k) to degree n — distinct_partitions is NOT a species (#274 B5), re-filed here like the rationals
  DECLARE r numeric[] := ARRAY[1::numeric]; k int; factor numeric[]; BEGIN
    FOR k IN 1 .. n LOOP factor := array_fill(0::numeric, ARRAY[n + 1]);
      factor[1] := 1; IF k <= n THEN factor[k + 1] := 1; END IF;   -- (1+q^k): 1 at exponent 0, 1 at exponent k
      r := (gf_pmul(r, factor))[1:n + 1]; END LOOP;
    RETURN r[1:n + 1]; END $$;
CREATE FUNCTION gf_stirling2_row(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- [S(n,0),…,S(n,n)] (Touchard)
  DECLARE prev numeric[] := ARRAY[1::numeric]; cur numeric[]; i int; k int; BEGIN
    IF n = 0 THEN RETURN ARRAY[1::numeric]; END IF;
    FOR i IN 1 .. n LOOP cur := array_fill(0::numeric, ARRAY[i + 1]);
      FOR k IN 1 .. i LOOP cur[k + 1] := k * coalesce(prev[k + 1], 0) + coalesce(prev[k], 0); END LOOP; prev := cur; END LOOP;
    RETURN prev; END $$;
CREATE FUNCTION gf_pascal_row(n int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- (1+q)^n (binary-word Hamming weight)
  SELECT gf_pow(ARRAY[1::numeric, 1::numeric], n) $$;
CREATE FUNCTION gf_composition_parts(n int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- q·(1+q)^{n-1}; n=0 → [1]
  SELECT CASE WHEN n = 0 THEN ARRAY[1::numeric] ELSE gf_shift(gf_pow(ARRAY[1::numeric, 1::numeric], n - 1), 1) END $$;
CREATE FUNCTION gf_qbinomial(n int, k int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- Gaussian binomial [n,k]_q, Pascal recurrence [n,k]=[n-1,k-1]+q^k[n-1,k]
  BEGIN IF k < 0 OR k > n THEN RETURN ARRAY[0::numeric]; END IF;
    IF k = 0 OR k = n THEN RETURN ARRAY[1::numeric]; END IF;
    RETURN gf_padd(gf_qbinomial(n - 1, k - 1), gf_shift(gf_qbinomial(n - 1, k), k)); END $$;
CREATE FUNCTION gf_subset_sum(n int, k int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- q^{k(k+1)/2}[n,k]_q — element-sum over k-subsets of the 1-INDEXED ground [n]
  SELECT gf_shift(gf_qbinomial(n, k), k * (k + 1) / 2) $$;
CREATE FUNCTION gf_stirling1_row(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- ∏_{i<n}(i+x) — unsigned Stirling-1 (cycles)
  DECLARE r numeric[] := ARRAY[1::numeric]; i int; BEGIN
    FOR i IN 0 .. n - 1 LOOP r := gf_pmul(r, ARRAY[i::numeric, 1::numeric]); END LOOP; RETURN r; END $$;
CREATE FUNCTION gf_weak_exceedance_row(n int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- q·A_n(q): weak excedances range 1..n (n=0 → [1])
  SELECT CASE WHEN n = 0 THEN ARRAY[1::numeric] ELSE gf_shift(gf_eulerian_row(n), 1) END $$;
CREATE FUNCTION gf_rencontres_row(n int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- C(n,k)·D_{n-k} — fixed-point (rencontres) distribution
  SELECT ARRAY(SELECT binomial(n, k) * subfactorial(n - k) FROM generate_series(0, n) k) $$;
CREATE FUNCTION gf_narayana_row(n int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- Narayana numbers N(n,k) (Dyck peaks); n=0 → [1]
  SELECT CASE WHEN n = 0 THEN ARRAY[1::numeric] ELSE gf_shift(ARRAY(SELECT narayana_number(n, k) FROM generate_series(1, n) k), 1) END $$;
CREATE FUNCTION gf_binary_word_descents_row(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- C(n+1,2k+1) — odd coeffs of (1+q)^{n+1}
  DECLARE p numeric[]; BEGIN p := gf_pow(ARRAY[1::numeric, 1::numeric], n + 1);
    RETURN ARRAY(SELECT p[2 * k + 2] FROM generate_series(0, n / 2) k); END $$;
CREATE FUNCTION gf_binary_word_runs(n int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- 2·q·(1+q)^{n-1} — number of runs; n=0 → [1]
  SELECT CASE WHEN n = 0 THEN ARRAY[1::numeric] ELSE gf_shift(gf_pmul(ARRAY[2::numeric], gf_pow(ARRAY[1::numeric, 1::numeric], n - 1)), 1) END $$;
CREATE FUNCTION gf_partition_length_row(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- # partitions of n into exactly k parts (= largest part = k, by conjugation)
  DECLARE store jsonb := '{}'; i int; j int; BEGIN   -- p(i,j) = p(i-1,j-1) + p(i-j,j)
    FOR i IN 0 .. n LOOP FOR j IN 0 .. i LOOP
      IF i = 0 AND j = 0 THEN store := store || jsonb_build_object('0,0', 1);
      ELSIF j = 0 THEN store := store || jsonb_build_object(i || ',0', 0);
      ELSE store := store || jsonb_build_object(i || ',' || j,
        coalesce((store ->> ((i - 1) || ',' || (j - 1)))::numeric, 0) + coalesce((store ->> ((i - j) || ',' || j))::numeric, 0));
      END IF;
    END LOOP; END LOOP;
    RETURN ARRAY(SELECT coalesce((store ->> (n || ',' || g))::numeric, 0) FROM generate_series(0, n) g); END $$;
-- ── heavier DP builders (bivariate / triangular recurrences; same jsonb-store idiom as gf_qcatalan_area) ────────
CREATE FUNCTION gf_dyck_height_row(n int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- Dyck paths of semilength n by max height (reuses the fiber DP)
  SELECT ARRAY(SELECT dyck_height_exactly_count(n, h) FROM generate_series(0, n) h) $$;
CREATE FUNCTION gf_setpart_no_singletons(m int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$   -- A000296: set partitions of [m] with NO singleton block
  SELECT sum((-1)^j * binomial(m, j) * (unrank(bell_numbers(), m - j)).value) FROM generate_series(0, m) j $$;
CREATE FUNCTION gf_setpart_singleton_row(n int) RETURNS numeric[] LANGUAGE sql IMMUTABLE AS $$   -- T(n,k)=C(n,k)·(no-singleton partitions of n−k)
  SELECT ARRAY(SELECT binomial(n, k) * gf_setpart_no_singletons(n - k) FROM generate_series(0, n) k) $$;
CREATE FUNCTION gf_restricted_partition_ogf(maxk int, deg int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- ∏_{k=1}^{maxk} 1/(1-x^k) to degree deg (bound + truncation decoupled)
  DECLARE r numeric[] := ARRAY[1::numeric]; k int; geom numeric[]; j int; BEGIN
    FOR k IN 1 .. maxk LOOP geom := array_fill(0::numeric, ARRAY[deg + 1]);
      j := 0; WHILE j * k <= deg LOOP geom[j * k + 1] := 1; j := j + 1; END LOOP;
      r := (gf_pmul(r, geom))[1:deg + 1]; END LOOP;
    RETURN (r || array_fill(0::numeric, ARRAY[greatest(0, deg + 1 - coalesce(array_length(r, 1), 0))]))[1:deg + 1]; END $$;
CREATE FUNCTION gf_durfee_row(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- Durfee square size: p_d(n)=[x^{n-d²}](1/(x;x)_d)²
  DECLARE dmax int := floor(sqrt(n)); d int; deg int; p numeric[]; sq numeric[]; r numeric[] := '{}'; BEGIN
    FOR d IN 0 .. dmax LOOP deg := n - d * d; p := gf_restricted_partition_ogf(d, deg); sq := gf_pmul(p, p);
      r := r || coalesce(sq[deg + 1], 0); END LOOP;
    RETURN r; END $$;
CREATE FUNCTION gf_dyck_returns_row(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- first-return: R_n = q·Σ_{m=1..n} C_{m-1}·R_{n-m}
  DECLARE store jsonb := jsonb_build_object('0', to_jsonb(ARRAY[1::numeric])); m int; i int; acc numeric[]; BEGIN
    FOR m IN 1 .. n LOOP acc := ARRAY[]::numeric[];
      FOR i IN 1 .. m LOOP acc := gf_padd(acc, gf_pmul(ARRAY[catalan_number(i - 1)],
        ARRAY(SELECT jsonb_array_elements_text(store -> (m - i)::text)::numeric))); END LOOP;
      store := store || jsonb_build_object(m::text, to_jsonb(gf_shift(acc, 1))); END LOOP;
    RETURN ARRAY(SELECT jsonb_array_elements_text(store -> n::text)::numeric); END $$;
CREATE FUNCTION gf_partition_distinct_parts(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- x^n slice of ∏(1+q·x^i/(1-x^i))
  DECLARE t jsonb := jsonb_build_object('0', to_jsonb(ARRAY[1::numeric])); t2 jsonb; i int; s int; mm int; base numeric[]; use_i numeric[]; BEGIN
    FOR i IN 1 .. n LOOP t2 := '{}';
      FOR s IN 0 .. n LOOP
        base := coalesce(ARRAY(SELECT jsonb_array_elements_text(t -> s::text)::numeric), ARRAY[]::numeric[]);
        use_i := ARRAY[]::numeric[]; mm := 1;
        WHILE mm * i <= s LOOP
          use_i := gf_padd(use_i, gf_shift(coalesce(ARRAY(SELECT jsonb_array_elements_text(t -> (s - mm * i)::text)::numeric), '{}'), 1));
          mm := mm + 1; END LOOP;
        t2 := t2 || jsonb_build_object(s::text, to_jsonb(gf_padd(base, use_i)));
      END LOOP; t := t2; END LOOP;
    RETURN ARRAY(SELECT jsonb_array_elements_text(t -> n::text)::numeric); END $$;
CREATE FUNCTION gf_partition_odd_parts(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- coin-change DP, q marks odd part sizes
  DECLARE joint jsonb := jsonb_build_object('0', to_jsonb(ARRAY[1::numeric])); k int; m int; contrib numeric[]; BEGIN
    FOR k IN 1 .. n LOOP
      FOR m IN k .. n LOOP
        contrib := coalesce(ARRAY(SELECT jsonb_array_elements_text(joint -> (m - k)::text)::numeric), ARRAY[]::numeric[]);
        IF array_length(contrib, 1) IS NULL THEN CONTINUE; END IF;
        IF k % 2 = 1 THEN contrib := gf_shift(contrib, 1); END IF;
        joint := joint || jsonb_build_object(m::text, to_jsonb(gf_padd(
          coalesce(ARRAY(SELECT jsonb_array_elements_text(joint -> m::text)::numeric), ARRAY[]::numeric[]), contrib)));
      END LOOP; END LOOP;
    RETURN ARRAY(SELECT jsonb_array_elements_text(joint -> n::text)::numeric); END $$;
CREATE FUNCTION gf_composition_largest_row(n int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$   -- k-bonacci: T[m][k]=Σ_{i≤min(m,k)} T[m-i][k]; row_k = T[n][k]−T[n][k-1]
  DECLARE t jsonb := '{}'; m int; k int; i int; s numeric; r numeric[]; BEGIN
    IF n = 0 THEN RETURN ARRAY[1::numeric]; END IF;
    FOR k IN 0 .. n LOOP t := t || jsonb_build_object('0,' || k, 1); END LOOP;
    FOR k IN 1 .. n LOOP FOR m IN 1 .. n LOOP s := 0;
      FOR i IN 1 .. least(m, k) LOOP s := s + coalesce((t ->> ((m - i) || ',' || k))::numeric, 0); END LOOP;
      t := t || jsonb_build_object(m || ',' || k, s); END LOOP; END LOOP;
    r := array_fill(0::numeric, ARRAY[n + 1]);
    FOR k IN 1 .. n LOOP r[k + 1] := coalesce((t ->> (n || ',' || k))::numeric, 0) - coalesce((t ->> (n || ',' || (k - 1)))::numeric, 0); END LOOP;
    RETURN r; END $$;

-- rational OGF: coefficients of num(x)/den(x) to degree `deg`, low-to-high, exact integer. den[1] (constant term) ≠ 0.
-- Series-reciprocal den to `deg`, multiply by num, then slice/pad to length deg+1 (num can be shorter than den).
CREATE FUNCTION gf_rational(num numeric[], den numeric[], deg int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r numeric[]; m int; j int; s numeric; p numeric[]; n int;
  BEGIN
    -- unit constant term: keeps the reciprocal exact-integer (a non-1 den[1] introduces scale-dependent fractions)
    IF den[1] IS DISTINCT FROM 1 THEN RAISE EXCEPTION 'gf_rational: den constant term must be 1 (got %)', den[1]; END IF;
    r := array_fill(0::numeric, ARRAY[deg + 1]);
    r[1] := 1 / den[1];
    FOR m IN 1 .. deg LOOP
      s := 0;
      FOR j IN 1 .. m LOOP s := s + coalesce(den[j + 1], 0) * r[m - j + 1]; END LOOP;
      r[m + 1] := -s / den[1];
    END LOOP;
    p := gf_pmul(num, r);
    n := coalesce(array_length(p, 1), 0);
    IF n > deg + 1 THEN p := p[1:deg + 1]; n := deg + 1; END IF;
    RETURN p || array_fill(0::numeric, ARRAY[deg + 1 - n]);
  END $$;

-- ── registry ─────────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE base_generating_function (
  collection text NOT NULL REFERENCES base_collection,
  stat_id    text,                 -- NULL = the collection's own counting sequence (an ogf); else the stat this grades
  kind       text NOT NULL CHECK (kind IN ('q_polynomial', 'ogf')),
  builder    text NOT NULL,        -- the gf_* function producing numeric[] coefficients from the grade(s)
  arity      int  NOT NULL DEFAULT 1,  -- how many grade axes the builder takes (1: n; 2: n,k — a doubly-graded family)
  note       text,
  findstat   text,                 -- the FindStat St-id of the statistic, where one exists (else NULL, never fabricated)
  num        numeric[],            -- gf_rational only: numerator coefficients, low-to-high
  den        numeric[],            -- gf_rational only: denominator coefficients, low-to-high
  pack       text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack
);
CREATE UNIQUE INDEX base_generating_function_pk ON base_generating_function (collection, coalesce(stat_id, ''));
CREATE TRIGGER base_generating_function_pack_guard BEFORE UPDATE OR DELETE ON base_generating_function FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

INSERT INTO base_generating_function (collection, stat_id, kind, builder, arity, note, findstat) VALUES
  ('permutations',         'inversions',   'q_polynomial', 'gf_qfactorial',       1, '[n]_q! — the Mahonian distribution', 'St000018'),
  ('permutations',         'major_index',  'q_polynomial', 'gf_qfactorial',       1, '[n]_q! — MacMahon: maj is equidistributed with inv', 'St000004'),
  ('permutations',         'descents',     'q_polynomial', 'gf_eulerian_row',     1, 'the Eulerian polynomial A_n(q)', 'St000021'),
  ('dyck_paths',           'area',         'q_polynomial', 'gf_qcatalan_area',    1, 'the Carlitz–Riordan q-Catalan (by area)', 'St000012'),
  ('set_partitions',       'blocks',       'q_polynomial', 'gf_stirling2_row',    1, 'Touchard/Bell polynomial B_n(q) — Stirling numbers of the 2nd kind', 'St000105'),
  ('binary_words',         'number_of_ones', 'q_polynomial', 'gf_pascal_row',     1, '(1+q)^n — the binomial distribution of Hamming weight', 'St000288'),
  ('integer_compositions', 'parts_count',  'q_polynomial', 'gf_composition_parts', 1, 'q·(1+q)^{n-1} — parts distribution', NULL),
  ('integer_partitions',   NULL,           'ogf',          'gf_partition_ogf',    1, '∏_{k≥1} 1/(1-q^k) — the partition-counting ogf', NULL),
  ('k_subsets',            'sum',          'q_polynomial', 'gf_subset_sum',       2, 'q^{k(k+1)/2}·[n choose k]_q — the Gaussian binomial (element-sum over k-subsets of [n])', NULL);
-- (distinct_partitions' ogf row moved to packs/partitions-plus/generating_functions.partitions-plus.sql — #283
--  phase 3 made distinct_partitions a pack-owned collection; the gf_distinct_partition_ogf builder stays core.)

-- more (collection, statistic) distributions with a known closed form (each differential-gated below). Some REUSE a
-- builder from an equidistribution (excedances/bounce), the rest add a one-builder recipe over the same kit.
INSERT INTO base_generating_function (collection, stat_id, kind, builder, arity, note, findstat) VALUES
  ('permutations',       'cycles',           'q_polynomial', 'gf_stirling1_row',           1, 'x(x+1)…(x+n−1) — unsigned Stirling numbers of the 1st kind (cycles)', 'St000031'),
  ('permutations',       'excedances',       'q_polynomial', 'gf_eulerian_row',            1, 'the Eulerian polynomial — excedances are equidistributed with descents (MacMahon)', 'St000155'),
  ('permutations',       'weak_exceedances', 'q_polynomial', 'gf_weak_exceedance_row',     1, 'q·A_n(q) — weak excedances range 1..n', 'St000213'),
  ('permutations',       'fixed_points',     'q_polynomial', 'gf_rencontres_row',          1, 'the rencontres distribution C(n,k)·D_{n−k} (D = subfactorial)', 'St000022'),
  ('dyck_paths',         'bounce',           'q_polynomial', 'gf_qcatalan_area',           1, 'the Carlitz q-Catalan — bounce is equidistributed with area', 'St000005'),
  ('dyck_paths',         'peaks',            'q_polynomial', 'gf_narayana_row',            1, 'the Narayana numbers N(n,k)', 'St000015'),
  ('binary_words',       'descents',         'q_polynomial', 'gf_binary_word_descents_row', 1, 'C(n+1, 2k+1) — the odd binomial coefficients', NULL),
  ('binary_words',       'number_of_runs',   'q_polynomial', 'gf_binary_word_runs',        1, '2·q·(1+q)^{n−1} — the run-count distribution', NULL),
  ('integer_partitions', 'length',           'q_polynomial', 'gf_partition_length_row',    1, 'partitions of n into exactly k parts', NULL),
  ('integer_partitions', 'largest_part',     'q_polynomial', 'gf_partition_length_row',    1, 'largest part = length by conjugation (same distribution)', 'St000147');

-- the heavier bivariate/triangular-recurrence rows (all differential-gated below).
INSERT INTO base_generating_function (collection, stat_id, kind, builder, arity, note, findstat) VALUES
  ('dyck_paths',           'height',           'q_polynomial', 'gf_dyck_height_row',          1, 'Dyck paths of semilength n by maximum height', NULL),
  ('dyck_paths',           'returns',          'q_polynomial', 'gf_dyck_returns_row',         1, 'returns to the x-axis — the first-return (arch-count) recurrence', NULL),
  ('set_partitions',       'singleton_blocks', 'q_polynomial', 'gf_setpart_singleton_row',    1, 'C(n,k)·(no-singleton set partitions of n−k, A000296)', NULL),
  ('integer_partitions',   'distinct_parts',   'q_polynomial', 'gf_partition_distinct_parts', 1, '∏(1+q·x^i/(1-x^i)) — number of distinct part sizes', 'St000159'),
  ('integer_partitions',   'odd_parts',        'q_polynomial', 'gf_partition_odd_parts',      1, 'coin-change DP with q on odd part sizes', 'St000257'),
  ('integer_partitions',   'durfee_square',    'q_polynomial', 'gf_durfee_row',               1, 'Durfee square size: p_d(n) = [x^{n−d²}] (1/(x;x)_d)²', NULL),
  ('integer_compositions', 'largest_part',     'q_polynomial', 'gf_composition_largest_row',  1, 'largest part — the k-bonacci T(n,k) recurrence (A092921)', NULL);

-- rational-OGF rows (#274 B3, re-filed out of base_species — unbounded number sequences, NOT species). CORE-owned
-- collections only: the 7 linear recurrences + triangular/square/cube. The 12 number-sets-pack figurates
-- (pentagonal/hexagonal/… — pack-owned collections) are re-filed the same way in
-- packs/number-sets/generating_functions.number-sets.sql, since a core file can't reference a pack collection (#283).
INSERT INTO base_generating_function (collection, stat_id, kind, builder, arity, note, findstat, num, den) VALUES
  ('fibonacci_numbers',  NULL, 'ogf', 'gf_rational', 1, 'x/(1-x-x^2); F_n = 0,1,1,2,3,5,8,…', NULL, ARRAY[0,1]::numeric[],   ARRAY[1,-1,-1]::numeric[]),
  ('lucas_numbers',      NULL, 'ogf', 'gf_rational', 1, '(2-x)/(1-x-x^2); L_n = 2,1,3,4,7,11,…', NULL, ARRAY[2,-1]::numeric[], ARRAY[1,-1,-1]::numeric[]),
  ('pell_numbers',       NULL, 'ogf', 'gf_rational', 1, 'x/(1-2x-x^2); P_n = 0,1,2,5,12,29,…', NULL, ARRAY[0,1]::numeric[],   ARRAY[1,-2,-1]::numeric[]),
  ('jacobsthal_numbers', NULL, 'ogf', 'gf_rational', 1, 'x/(1-x-2x^2); J_n = 0,1,1,3,5,11,…', NULL, ARRAY[0,1]::numeric[],   ARRAY[1,-1,-2]::numeric[]),
  ('tribonacci_numbers', NULL, 'ogf', 'gf_rational', 1, 'x^2/(1-x-x^2-x^3); T_n = 0,0,1,1,2,4,7,13,…', NULL, ARRAY[0,0,1]::numeric[], ARRAY[1,-1,-1,-1]::numeric[]),
  ('padovan_sequence',   NULL, 'ogf', 'gf_rational', 1, '(1+x)/(1-x^2-x^3); P_n = 1,1,1,2,2,3,4,5,7,…', NULL, ARRAY[1,1]::numeric[], ARRAY[1,0,-1,-1]::numeric[]),
  ('perrin_sequence',    NULL, 'ogf', 'gf_rational', 1, '(3-x^2)/(1-x^2-x^3); a_n = 3,0,2,3,2,5,5,7,10,…', NULL, ARRAY[3,0,-1]::numeric[], ARRAY[1,0,-1,-1]::numeric[]),
  ('triangular_numbers', NULL, 'ogf', 'gf_rational', 1, 'x/(1-x)^3; C(n+1,2); 0,1,3,6,10,…', NULL, ARRAY[0,1]::numeric[],       ARRAY[1,-3,3,-1]::numeric[]),
  ('square_numbers',     NULL, 'ogf', 'gf_rational', 1, 'x(1+x)/(1-x)^3; n²; 0,1,4,9,16,…', NULL, ARRAY[0,1,1]::numeric[],     ARRAY[1,-3,3,-1]::numeric[]),
  ('cube_numbers',       NULL, 'ogf', 'gf_rational', 1, 'x(1+4x+x^2)/(1-x)^4; n³; 0,1,8,27,64,…', NULL, ARRAY[0,1,4,1]::numeric[], ARRAY[1,-4,6,-4,1]::numeric[]);

-- the coefficients of a registered generating function on its grade(s): dispatch to the row's builder (arity 1 or 2).
CREATE FUNCTION gf_coefficients(p_collection text, p_stat text, VARIADIC grade int[]) RETURNS numeric[] LANGUAGE plpgsql STABLE AS $$
  DECLARE g base_generating_function; r numeric[]; BEGIN
    SELECT * INTO g FROM base_generating_function
     WHERE collection = p_collection AND coalesce(stat_id, '') = coalesce(p_stat, '');
    IF g.builder IS NULL THEN RAISE EXCEPTION 'no generating function %/%', p_collection, coalesce(p_stat, '(counting)'); END IF;
    IF g.builder = 'gf_rational' THEN RETURN gf_rational(g.num, g.den, grade[1]); END IF;
    EXECUTE format('SELECT %I(%s)', g.builder, array_to_string(grade, ', ')) INTO r; RETURN r; END $$;

-- ── the differential: the expander's coefficients ARE the live distribution ────────────────────────────────────
-- q_polynomial: gf_coefficients(c,s,n) == the histogram of s over c(n) (index = stat value). ogf: gf_coefficients(c,
-- NULL,n) == the counting sequence [|c(0)|, …, |c(n)|]. Checked for every row, n = 0..nmax.
CREATE FUNCTION gf_distribution(coll text, statfn text, VARIADIC grade int[]) RETURNS numeric[] LANGUAGE plpgsql STABLE AS $$
  DECLARE mx int; r numeric[]; rec record; g text := array_to_string(grade, ', '); BEGIN
    EXECUTE format('SELECT max(%1$I((e).value)) FROM elements(%2$I(%3$s)) e', statfn, coll, g) INTO mx;
    IF mx IS NULL THEN RETURN ARRAY[]::numeric[]; END IF;
    r := array_fill(0::numeric, ARRAY[mx + 1]);
    FOR rec IN EXECUTE format('SELECT %1$I((e).value)::int v, count(*)::numeric c FROM elements(%2$I(%3$s)) e GROUP BY 1', statfn, coll, g)
    LOOP r[rec.v + 1] := rec.c; END LOOP;
    RETURN r; END $$;
CREATE FUNCTION gf_counting_sequence(coll text, nmax int) RETURNS numeric[] LANGUAGE plpgsql STABLE AS $$
  DECLARE r numeric[]; m int; c numeric; BEGIN r := ARRAY[]::numeric[];
    FOR m IN 0 .. nmax LOOP EXECUTE format('SELECT cardinality(%I(%s))', coll, m) INTO c; r := r || c; END LOOP;
    RETURN r; END $$;
-- the ogf target sequence: for an UNBOUNDED number-sequence collection, the n-th ELEMENT VALUE (unrank); else the
-- fiber cardinality — mirrors base_species_check_unlabelled's branch exactly (same "many roles" sequence).
CREATE FUNCTION gf_ogf_target(coll text, nmax int) RETURNS numeric[] LANGUAGE plpgsql STABLE AS $$
  DECLARE r numeric[] := ARRAY[]::numeric[]; m int; c numeric; is_unbounded boolean; BEGIN
    SELECT unbounded INTO is_unbounded FROM base_collection WHERE id = coll;
    IF is_unbounded IS NULL THEN RAISE EXCEPTION 'gf_ogf_target: unknown collection %', coll; END IF;  -- else a typo'd id silently reads as bounded
    FOR m IN 0 .. nmax LOOP
      IF is_unbounded THEN EXECUTE format('SELECT (unrank(%I(), %s)).value', coll, m) INTO c;
      ELSE                 EXECUTE format('SELECT cardinality(%I(%s))', coll, m) INTO c;
      END IF;
      r := r || c;
    END LOOP;
    RETURN r; END $$;
-- true iff the registered generating function reproduces the live distribution for every n = 0..nmax.
CREATE FUNCTION gf_agrees(p_collection text, p_stat text, nmax int) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
  DECLARE g record; vfn text; n int; BEGIN
    SELECT * INTO g FROM base_generating_function
     WHERE collection = p_collection AND coalesce(stat_id, '') = coalesce(p_stat, '');
    IF g.kind = 'ogf' THEN
      RETURN gf_coefficients(p_collection, p_stat, nmax) IS NOT DISTINCT FROM gf_ogf_target(p_collection, nmax);
    END IF;
    SELECT value_fn INTO vfn FROM base_stat WHERE collection = p_collection AND stat_id = p_stat;
    FOR n IN 0 .. nmax LOOP
      IF gf_coefficients(p_collection, p_stat, n) IS DISTINCT FROM gf_distribution(p_collection, vfn, n) THEN RETURN false; END IF;
    END LOOP;
    RETURN true; END $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('generating_functions','the registry carries the Mahonian/Eulerian/Carlitz/Touchard/Pascal set + the partition ogf (a floor)','eq','true','base_generating_function, q_polynomial + ogf rows',$q$
    SELECT (count(*) >= 8 AND bool_and(kind IN ('q_polynomial','ogf')))::text FROM base_generating_function $q$),
  ('generating_functions','[n]_q! IS the inversion distribution on permutations(n), n=0..6 (the differential)','eq','true','the Mahonian q-factorial expander == live GROUP BY inversions',$q$
    SELECT gf_agrees('permutations','inversions',6)::text $q$),
  ('generating_functions','[n]_q! IS ALSO the major_index distribution — MacMahon equidistribution, live (n=0..6)','eq','true','same expander, different stat: the differential proves maj ≡ inv',$q$
    SELECT gf_agrees('permutations','major_index',6)::text $q$),
  ('generating_functions','the Eulerian polynomial A_n(q) IS the descent distribution on permutations(n), n=0..6','eq','true','gf_eulerian_row == live GROUP BY descents',$q$
    SELECT gf_agrees('permutations','descents',6)::text $q$),
  ('generating_functions','the Carlitz q-Catalan IS the area distribution on dyck_paths(n), n=0..6','eq','true','gf_qcatalan_area == live GROUP BY area',$q$
    SELECT gf_agrees('dyck_paths','area',6)::text $q$),
  ('generating_functions','the Touchard/Stirling-2 row IS the block distribution on set_partitions(n), n=0..6','eq','true','gf_stirling2_row == live GROUP BY blocks; row sums are the Bell numbers',$q$
    SELECT gf_agrees('set_partitions','blocks',6)::text $q$),
  -- (the binary_words/number_of_ones example moved to packs/words-plus/generating-functions.words-plus.sql — the
  -- registry ROW stays here (collection='binary_words' is core, FK-safe), but its base_stat row is words-plus's
  -- own (binary_words.stats.sql), so gf_agrees can't resolve value_fn loading core alone, #283 phase 3)
  ('generating_functions','q·(1+q)^{n-1} IS the parts distribution on integer_compositions(n), n=0..6','eq','true','gf_composition_parts == live GROUP BY parts_count (n=0 special-cased to [1])',$q$
    SELECT gf_agrees('integer_compositions','parts_count',6)::text $q$),
  ('generating_functions','∏1/(1-q^k) IS the partition-counting ogf: coefficients == |integer_partitions(m)| for m=0..6','eq','true','the ogf differential against cardinality (not a stat distribution)',$q$
    SELECT gf_agrees('integer_partitions',NULL,6)::text $q$),
  ('generating_functions','q^{k(k+1)/2}[n,k]_q IS the element-sum distribution over k_subsets(n,k) — the Gaussian binomial, live (a doubly-graded family)','eq','true','the one arity-2 row: gf_coefficients(k_subsets,sum,n,k) == live GROUP BY subset_sum over k_subsets(n,k)',$q$
    SELECT bool_and(gf_coefficients('k_subsets','sum',n,k) IS NOT DISTINCT FROM gf_distribution('k_subsets','subset_sum',n,k))::text
    FROM (VALUES (3,1),(4,2),(5,2),(5,3),(6,3),(6,2)) v(n,k) $q$),
  -- (binary_words' descents/number_of_runs pairs moved to packs/words-plus/generating-functions.words-plus.sql —
  -- same reason as number_of_ones above, #283 phase 3)
  ('generating_functions','every additional single-graded generating function reproduces its live distribution, n=0..6 (Stirling-1, Eulerian excedances/weak-exc, rencontres, Narayana, partition length/largest-part)','eq','true','the differential over the expansion batch — one closed form per (collection, stat)',$q$
    SELECT bool_and(gf_agrees(c, s, 6))::text FROM (VALUES
      ('permutations','cycles'),('permutations','excedances'),('permutations','weak_exceedances'),('permutations','fixed_points'),
      ('dyck_paths','bounce'),('dyck_paths','peaks'),
      ('integer_partitions','length'),('integer_partitions','largest_part')) v(c, s) $q$),
  ('generating_functions','the bivariate/triangular-recurrence generating functions reproduce their live distributions, n=0..6 (Dyck height/returns, set-partition singletons, partition distinct/odd parts + Durfee, composition largest part)','eq','true','the heavier DP builders — each differential-gated against the GROUP BY histogram',$q$
    SELECT bool_and(gf_agrees(c, s, 6))::text FROM (VALUES
      ('dyck_paths','height'),('dyck_paths','returns'),('set_partitions','singleton_blocks'),
      ('integer_partitions','distinct_parts'),('integer_partitions','odd_parts'),('integer_partitions','durfee_square'),
      ('integer_compositions','largest_part')) v(c, s) $q$),
  ('generating_functions','the core re-filed rational-OGF number sequences (#274 B3) reproduce their unrank''d element-value sequences, n=0..8 (7 recurrences + triangular/square/cube)','eq','true','gf_rational vs gf_ogf_target''s unbounded (unrank) branch — these are number sequences, not species; the 12 number-sets-pack figurates are checked in the pack (generating_functions.number-sets.sql)',$q$
    SELECT bool_and(gf_agrees(c, NULL, 8))::text FROM (VALUES
      ('fibonacci_numbers'),('lucas_numbers'),('pell_numbers'),('jacobsthal_numbers'),('tribonacci_numbers'),
      ('padovan_sequence'),('perrin_sequence'),
      ('triangular_numbers'),('square_numbers'),('cube_numbers')) v(c) $q$),
  ('generating_functions','base_generating_function carries at least the 10 core re-filed rational-OGF rows (a floor)','eq','true','builder = gf_rational count (core; the pack adds its own)',$q$
    SELECT (count(*) >= 10)::text FROM base_generating_function WHERE builder = 'gf_rational' $q$);
