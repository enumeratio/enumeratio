-- requires: integer_partitions, realizer, utilities, number-theory
-- species_kernel — the CYCLE INDEX kernel, in exact fractions. A species' cycle index Z_F is a symmetric function
-- Σ_λ c_λ · p_λ (power-sum basis); we store it truncated to degree maxdeg as jsonb: {"n": [[num,den], ...]} with one
-- fraction per partition λ⊢n, ordered to match integer_partitions(n)'s own floor order (ordinality 0..p(n)-1).
-- Z_F(labelled) projects to n!·c_{1^n}; Z_F(isotype) projects to Σ_λ c_λ. See wiki Species-As-Data (#274 B1).
-- Plethysm/composition + the Z-walker (#274 B4): species_z_compose, species_z_fixpoint, species_z_eval below.

-- ── exact fractions ──────────────────────────────────────────────────────────────────────────────────
CREATE TYPE fraction AS (num numeric, den numeric);

CREATE FUNCTION frac_reduce(f fraction) RETURNS fraction LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n numeric := f.num; d numeric := f.den; g numeric;
  BEGIN
    IF d = 0 THEN RAISE EXCEPTION 'frac_reduce: zero denominator'; END IF;
    IF n = 0 THEN RETURN (0, 1)::fraction; END IF;
    IF d < 0 THEN n := -n; d := -d; END IF;
    g := gcd(n, d);
    IF g = 0 THEN g := 1; END IF;
    RETURN (n / g, d / g)::fraction;
  END $$;

CREATE FUNCTION frac(n numeric, d numeric DEFAULT 1) RETURNS fraction LANGUAGE sql IMMUTABLE AS $$
  SELECT frac_reduce((n, d)::fraction) $$;

CREATE FUNCTION frac_add(a fraction, b fraction) RETURNS fraction LANGUAGE sql IMMUTABLE AS $$
  SELECT frac_reduce((a.num * b.den + b.num * a.den, a.den * b.den)::fraction) $$;

CREATE FUNCTION frac_mul(a fraction, b fraction) RETURNS fraction LANGUAGE sql IMMUTABLE AS $$
  SELECT frac_reduce((a.num * b.num, a.den * b.den)::fraction) $$;

CREATE FUNCTION frac_div(a fraction, b fraction) RETURNS fraction LANGUAGE sql IMMUTABLE AS $$
  SELECT frac_reduce((a.num * b.den, a.den * b.num)::fraction) $$;

-- ── Z representation: jsonb {"n": [[num,den], ...]}, one fraction per partition of n, floor order ──────
CREATE FUNCTION z_parts(n int) RETURNS TABLE(ord int, parts int[]) LANGUAGE sql STABLE AS $$
  SELECT ordinality(e)::int, ((e).value).parts FROM elements(integer_partitions(n)) e $$;

-- PERF (#274 follow-up): z_parts re-runs elements(integer_partitions(n)) on every call, and z_ord_of scans it per
-- coefficient — so plethysm/fixpoint at high degree is quadratic-ish (deg 8 marquee ~160s). A memoized partition
-- index (a lookup table built once) would collapse this; until then the deg-8 differentials live in the slow tier.
CREATE FUNCTION z_ord_of(n int, p int[]) RETURNS int LANGUAGE sql STABLE AS $$
  SELECT ord FROM z_parts(n) WHERE parts = p $$;

-- z_λ = ∏_i i^{m_i} · m_i!  (m_i = multiplicity of part value i); z_λ(∅) = 1
CREATE FUNCTION z_zlambda(parts int[]) RETURNS numeric LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE result numeric := 1; rec record;
  BEGIN
    FOR rec IN SELECT val, count(*) AS m FROM unnest(parts) AS val GROUP BY val LOOP
      result := result * (rec.val::numeric ^ rec.m::numeric) * factorial(rec.m::int);
    END LOOP;
    RETURN result;
  END $$;

CREATE FUNCTION z_max_degree(z jsonb) RETURNS int LANGUAGE sql IMMUTABLE AS $$
  SELECT max(key::int) FROM jsonb_object_keys(z) key $$;

-- binary Z ops assume matching truncation degrees; a mismatch would silently DROP terms (z_get on a missing
-- key is NULL, and a NULL coeff vanishes), so refuse it up front rather than return a quietly-wrong series.
CREATE FUNCTION z_require_same(a jsonb, b jsonb) RETURNS int LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE da int := z_max_degree(a); db int := z_max_degree(b);
  BEGIN
    IF da IS DISTINCT FROM db THEN RAISE EXCEPTION 'species_z: operand degrees differ (% vs %)', da, db; END IF;
    RETURN da;
  END $$;

CREATE FUNCTION z_zero(maxdeg int) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE result jsonb := '{}'::jsonb; n int; arr jsonb;
  BEGIN
    FOR n IN 0..maxdeg LOOP
      SELECT jsonb_agg(jsonb_build_array(0, 1) ORDER BY ord) INTO arr FROM z_parts(n);
      result := jsonb_set(result, ARRAY[n::text], arr);
    END LOOP;
    RETURN result;
  END $$;

CREATE FUNCTION z_get(z jsonb, n int, ord int) RETURNS fraction LANGUAGE sql IMMUTABLE AS $$
  SELECT ((z -> n::text -> ord ->> 0)::numeric, (z -> n::text -> ord ->> 1)::numeric)::fraction $$;

CREATE FUNCTION z_set(z jsonb, n int, ord int, f fraction) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_set(z, ARRAY[n::text, ord::text], jsonb_build_array(f.num, f.den)) $$;

-- ── atoms ────────────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION species_z_atom(name text, maxdeg int DEFAULT 8) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE z jsonb := z_zero(maxdeg); n int; d int; rec record;
  BEGIN
    CASE name
      WHEN '1' THEN
        z := z_set(z, 0, 0, frac(1, 1));
      WHEN 'X' THEN
        IF maxdeg >= 1 THEN z := z_set(z, 1, 0, frac(1, 1)); END IF;
      WHEN 'E' THEN
        FOR n IN 0..maxdeg LOOP
          FOR rec IN SELECT ord, parts FROM z_parts(n) LOOP
            z := z_set(z, n, rec.ord, frac(1, z_zlambda(rec.parts)));
          END LOOP;
        END LOOP;
      WHEN 'E+' THEN
        FOR n IN 1..maxdeg LOOP
          FOR rec IN SELECT ord, parts FROM z_parts(n) LOOP
            z := z_set(z, n, rec.ord, frac(1, z_zlambda(rec.parts)));
          END LOOP;
        END LOOP;
      WHEN 'C' THEN
        FOR n IN 1..maxdeg LOOP
          FOR d IN 1..n LOOP
            IF n % d = 0 THEN
              FOR rec IN SELECT ord, parts FROM z_parts(n) WHERE parts = array_fill(d, ARRAY[n / d]) LOOP
                z := z_set(z, n, rec.ord, frac(euler_phi(d), n));
              END LOOP;
            END IF;
          END LOOP;
        END LOOP;
      WHEN 'L' THEN
        FOR n IN 0..maxdeg LOOP
          FOR rec IN SELECT ord, parts FROM z_parts(n) WHERE parts = array_fill(1, ARRAY[n]) LOOP
            z := z_set(z, n, rec.ord, frac(1, 1));
          END LOOP;
        END LOOP;
      ELSE RAISE EXCEPTION 'unknown species_z atom: %', name;
    END CASE;
    RETURN z;
  END $$;

-- ── operations ───────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION species_z_sum(a jsonb, b jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_require_same(a, b); z jsonb := z_zero(maxdeg); n int; rec record;
  BEGIN
    FOR n IN 0..maxdeg LOOP
      FOR rec IN SELECT ord FROM z_parts(n) LOOP
        z := z_set(z, n, rec.ord, frac_add(z_get(a, n, rec.ord), z_get(b, n, rec.ord)));
      END LOOP;
    END LOOP;
    RETURN z;
  END $$;

-- Z_{F·G} = Z_F · Z_G in the p-basis: p_λ · p_μ = p_{λ∪μ} (concat + re-sort descending)
CREATE FUNCTION species_z_product(a jsonb, b jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_require_same(a, b); z jsonb := z_zero(maxdeg); n int; i int; j int; ra record; rb record;
          merged int[]; tord int; c fraction;
  BEGIN
    FOR n IN 0..maxdeg LOOP
      FOR i IN 0..n LOOP
        j := n - i;
        FOR ra IN SELECT ord, parts FROM z_parts(i) LOOP
          FOR rb IN SELECT ord, parts FROM z_parts(j) LOOP
            c := frac_mul(z_get(a, i, ra.ord), z_get(b, j, rb.ord));
            IF c.num <> 0 THEN
              SELECT array_agg(x ORDER BY x DESC) INTO merged FROM unnest(ra.parts || rb.parts) x;
              IF merged IS NULL THEN merged := '{}'::int[]; END IF;
              tord := z_ord_of(n, merged);
              z := z_set(z, n, tord, frac_add(z_get(z, n, tord), c));
            END IF;
          END LOOP;
        END LOOP;
      END LOOP;
    END LOOP;
    RETURN z;
  END $$;

-- c_{F×G}(λ) = z_λ · c_F(λ) · c_G(λ)  (fix(F×G) = fixF · fixG, same λ)
CREATE FUNCTION species_z_cartesian(a jsonb, b jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_require_same(a, b); z jsonb := z_zero(maxdeg); n int; rec record;
  BEGIN
    FOR n IN 0..maxdeg LOOP
      FOR rec IN SELECT ord, parts FROM z_parts(n) LOOP
        z := z_set(z, n, rec.ord, frac_mul(frac(z_zlambda(rec.parts), 1), frac_mul(z_get(a, n, rec.ord), z_get(b, n, rec.ord))));
      END LOOP;
    END LOOP;
    RETURN z;
  END $$;

-- ∂/∂p_1: c_{F'}(λ) = (m_1(λ)+1) · c_F(λ ∪ {1})  for λ⊢n, using F's coefficient at degree n+1. Top degree maxdeg is
-- lost to truncation (no data at maxdeg+1) and is left zero.
CREATE FUNCTION species_z_derivative(a jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_max_degree(a); z jsonb := z_zero(maxdeg); n int; rec record; mu int[]; muord int; m1 int;
  BEGIN
    FOR n IN 0..maxdeg - 1 LOOP
      FOR rec IN SELECT ord, parts FROM z_parts(n) LOOP
        SELECT array_agg(x ORDER BY x DESC) INTO mu FROM unnest(rec.parts || ARRAY[1]) x;
        muord := z_ord_of(n + 1, mu);
        SELECT count(*) INTO m1 FROM unnest(rec.parts) x WHERE x = 1;
        z := z_set(z, n, rec.ord, frac_mul(frac(m1 + 1, 1), z_get(a, n + 1, muord)));
      END LOOP;
    END LOOP;
    RETURN z;
  END $$;

-- c_{F•}(λ) = m_1(λ) · c_F(λ)
CREATE FUNCTION species_z_pointing(a jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_max_degree(a); z jsonb := z_zero(maxdeg); n int; rec record; m1 int;
  BEGIN
    FOR n IN 0..maxdeg LOOP
      FOR rec IN SELECT ord, parts FROM z_parts(n) LOOP
        SELECT count(*) INTO m1 FROM unnest(rec.parts) x WHERE x = 1;
        z := z_set(z, n, rec.ord, frac_mul(frac(m1, 1), z_get(a, n, rec.ord)));
      END LOOP;
    END LOOP;
    RETURN z;
  END $$;

CREATE FUNCTION species_z_restrict_exact(a jsonb, k int) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_max_degree(a); z jsonb := z_zero(maxdeg);
  BEGIN
    IF k >= 0 AND k <= maxdeg THEN z := jsonb_set(z, ARRAY[k::text], a -> k::text); END IF;
    RETURN z;
  END $$;

CREATE FUNCTION species_z_restrict_min(a jsonb, k int) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_max_degree(a); z jsonb := z_zero(maxdeg); n int;
  BEGIN
    FOR n IN greatest(k, 0)..maxdeg LOOP z := jsonb_set(z, ARRAY[n::text], a -> n::text); END LOOP;
    RETURN z;
  END $$;

CREATE FUNCTION species_z_power(a jsonb, b int) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_max_degree(a); z jsonb; i int;
  BEGIN
    IF b < 0 THEN RAISE EXCEPTION 'species_z_power: negative exponent %', b; END IF;
    IF b = 0 THEN RETURN species_z_atom('1', maxdeg); END IF;
    z := a;
    FOR i IN 2..b LOOP z := species_z_product(z, a); END LOOP;
    RETURN z;
  END $$;

CREATE FUNCTION z_scalar_mul(fr fraction, z jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_max_degree(z); result jsonb := z_zero(maxdeg); n int; rec record;
  BEGIN
    FOR n IN 0..maxdeg LOOP
      FOR rec IN SELECT ord FROM z_parts(n) LOOP
        result := z_set(result, n, rec.ord, frac_mul(fr, z_get(z, n, rec.ord)));
      END LOOP;
    END LOOP;
    RETURN result;
  END $$;

-- the plethystic p_k substitution: c_μ·p_μ (μ⊢d) becomes c_μ·p_{k·μ} at degree k·d — every part scaled by k, parts
-- stay non-increasing so k·μ is still a valid partition. Terms with k·d > maxdeg are dropped by truncation.
CREATE FUNCTION z_inflate(g jsonb, k int, maxdeg int) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE result jsonb := z_zero(maxdeg); d int; rec record; c fraction; target int[]; tdeg int; tord int;
  BEGIN
    IF k < 1 THEN RAISE EXCEPTION 'z_inflate: k must be >= 1, got %', k; END IF;
    FOR d IN 0..(maxdeg / k) LOOP
      FOR rec IN SELECT ord, parts FROM z_parts(d) LOOP
        c := z_get(g, d, rec.ord);
        IF c.num <> 0 THEN
          SELECT array_agg(x * k ORDER BY x DESC) INTO target FROM unnest(rec.parts) x;
          IF target IS NULL THEN target := '{}'::int[]; END IF;
          tdeg := k * d;
          tord := z_ord_of(tdeg, target);
          result := z_set(result, tdeg, tord, frac_add(z_get(result, tdeg, tord), c));
        END IF;
      END LOOP;
    END LOOP;
    RETURN result;
  END $$;

-- plethysm: Z_{F∘G} = Σ_λ c_λ(F) · ∏_i p_{λ_i}[Z_G] = Σ_λ c_λ · ∏_i z_inflate(Z_G, λ_i). Requires Z_G nonempty
-- (degree-0 coeff 0) — mirrors species_compose's G_0 = 0 rule (a species can't compose over one with an empty
-- structure). m=0 contributes λ=∅ ⇒ the empty product = 1 ⇒ carries F_0 through automatically, no special case.
CREATE FUNCTION species_z_compose(f jsonb, g jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_require_same(f, g); result jsonb; m int; rec record; c fraction; piece jsonb; part int;
  BEGIN
    IF (z_get(g, 0, 0)).num <> 0 THEN
      RAISE EXCEPTION 'species_z_compose: inner species must have Z_G degree-0 coefficient 0 (no empty structure)';
    END IF;
    result := z_zero(maxdeg);
    FOR m IN 0..maxdeg LOOP
      FOR rec IN SELECT ord, parts FROM z_parts(m) LOOP
        c := z_get(f, m, rec.ord);
        IF c.num <> 0 THEN
          piece := species_z_atom('1', maxdeg);
          FOREACH part IN ARRAY rec.parts LOOP
            piece := species_z_product(piece, z_inflate(g, part, maxdeg));
          END LOOP;
          result := species_z_sum(result, z_scalar_mul(c, piece));
        END IF;
      END LOOP;
    END LOOP;
    RETURN result;
  END $$;

-- Picard iteration on the Z side: every Y is X-guarded (or ∘-guarded), so maxdeg+1 substitutions from Y = 0 fix
-- degrees 0..maxdeg exactly — the Z twin of species_solve.
CREATE FUNCTION species_z_fixpoint(body text, maxdeg int DEFAULT 8) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE y jsonb := z_zero(maxdeg); i int;
  BEGIN
    FOR i IN 0..maxdeg LOOP y := species_z_eval(body, maxdeg, y); END LOOP;
    RETURN y;
  END $$;

-- functorial composition (F on the list of all G-structures) — registered on base_species_op for completeness,
-- but no honest cycle-index formula is implemented yet. Deferred — #274 follow-up.
CREATE FUNCTION species_z_functor_compose(a jsonb, b jsonb) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  BEGIN
    RAISE EXCEPTION 'species_z_functor_compose: not implemented (#274 follow-up)';
  END $$;

-- Z-walker: a jsonb twin of species_eval, MIRRORING its precedence exactly (strip parens → additive last →
-- multiplicative first → composition first → power → leaf) so the parse trees for the same expr text align.
CREATE FUNCTION species_z_eval(expr text, maxdeg int DEFAULT 8, yval jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE e text := btrim(expr); i int; depth int; ch text; enclosed boolean; apos int; base jsonb; k int;
  BEGIN
    LOOP
      IF left(e, 1) <> '(' THEN EXIT; END IF;
      depth := 0; enclosed := true;
      FOR i IN 1..length(e) LOOP
        ch := substring(e FROM i FOR 1);
        IF ch = '(' THEN depth := depth + 1;
        ELSIF ch = ')' THEN depth := depth - 1;
          IF depth = 0 AND i < length(e) THEN enclosed := false; EXIT; END IF;
        END IF;
      END LOOP;
      IF enclosed THEN e := btrim(substring(e FROM 2 FOR length(e) - 2)); ELSE EXIT; END IF;
    END LOOP;
    -- additive: last top-level + or - ('+' after 'E' is the E+ atom, not an operator)
    depth := 0; apos := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND i > 1 AND (ch = '+' OR ch = '-')
            AND NOT (ch = '+' AND substring(e FROM i - 1 FOR 1) = 'E') THEN apos := i * (CASE ch WHEN '+' THEN 1 ELSE -1 END);
      END IF;
    END LOOP;
    IF apos <> 0 THEN
      RETURN CASE WHEN apos > 0
        THEN species_z_sum(species_z_eval(left(e, abs(apos) - 1), maxdeg, yval), species_z_eval(substring(e FROM abs(apos) + 1), maxdeg, yval))
        ELSE species_z_sum(species_z_eval(left(e, abs(apos) - 1), maxdeg, yval), z_scalar_mul(frac(-1, 1), species_z_eval(substring(e FROM abs(apos) + 1), maxdeg, yval)))
      END;
    END IF;
    -- multiplicative: first top-level ·
    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND ch = '·' THEN
        RETURN species_z_product(species_z_eval(left(e, i - 1), maxdeg, yval), species_z_eval(substring(e FROM i + 1), maxdeg, yval));
      ELSIF depth = 0 AND ch = '/' THEN   -- species_eval has scalar-divide; no Z analogue — refuse rather than misparse '/' as part of a leaf atom
        RAISE EXCEPTION 'species_z_eval: / (scalar divide) not supported on the cycle index (expr %)', e;
      END IF;
    END LOOP;
    -- composition: first top-level ∘
    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND ch = '∘' THEN
        RETURN species_z_compose(species_z_eval(left(e, i - 1), maxdeg, yval), species_z_eval(substring(e FROM i + 1), maxdeg, yval));
      END IF;
    END LOOP;
    -- power: top-level ^k (exponent an integer literal)
    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF ch = '^' AND depth = 0 THEN
        base := species_z_eval(left(e, i - 1), maxdeg, yval);
        k := btrim(substring(e FROM i + 1))::int;
        RETURN species_z_power(base, k);
      END IF;
    END LOOP;
    e := btrim(e);
    IF e = 'Y' THEN RETURN yval; END IF;
    IF e ~ '^\d+$' THEN RETURN z_scalar_mul(frac(e::numeric, 1), species_z_atom('1', maxdeg)); END IF;
    RETURN species_z_atom(e, maxdeg);
  END $$;

-- ── projections → numeric[] (f[j] = a_{j-1}, matching species_eval's convention) ────────────────────────
-- f_n = n! · c_{1^n}  (coeff at the all-ones partition)
-- fraction arithmetic throughout, ONE division at the very end — dividing per-term (num/den) accumulates
-- non-terminating decimals (e.g. thirds) as rounded numeric approximations, which don't re-sum to an exact
-- integer; staying in exact rationals until the last step avoids that drift, and trim_scale() strips the
-- inflated display scale numeric division leaves behind even on an exact result.
CREATE FUNCTION z_labelled(z jsonb) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_max_degree(z); r numeric[] := array_fill(0::numeric, ARRAY[maxdeg + 1]); n int; ord int; f fraction; val numeric;
  BEGIN
    FOR n IN 0..maxdeg LOOP
      ord := z_ord_of(n, array_fill(1, ARRAY[n]));
      f := frac_mul(frac(factorial(n), 1), z_get(z, n, ord));
      val := trim_scale(f.num / f.den);
      IF val <> trunc(val) THEN RAISE EXCEPTION 'z_labelled: non-integer projection at n=%: %', n, val; END IF;
      r[n + 1] := val;
    END LOOP;
    RETURN r;
  END $$;

-- f̃_n = Σ_{λ⊢n} c_λ
CREATE FUNCTION z_isotype(z jsonb) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE maxdeg int := z_max_degree(z); r numeric[] := array_fill(0::numeric, ARRAY[maxdeg + 1]); n int; rec record; s fraction; val numeric;
  BEGIN
    FOR n IN 0..maxdeg LOOP
      s := frac(0, 1);
      FOR rec IN SELECT ord FROM z_parts(n) LOOP
        s := frac_add(s, z_get(z, n, rec.ord));
      END LOOP;
      val := trim_scale(s.num / s.den);
      IF val <> trunc(val) THEN RAISE EXCEPTION 'z_isotype: non-integer projection at n=%: %', n, val; END IF;
      r[n + 1] := val;
    END LOOP;
    RETURN r;
  END $$;

-- ── examples ─────────────────────────────────────────────────────────────────────────────────────────
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species_kernel','labelled E·E = 2^n','eq','1,2,4,8,16,32,64,128,256','set × set, via the kernel',$q$
    SELECT array_to_string(z_labelled(species_z_product(species_z_atom('E'),species_z_atom('E'))), ',') $q$),
  ('species_kernel','labelled E·E·E = 3^n','eq','1,3,9,27,81,243,729,2187,6561','set × set × set, via the kernel',$q$
    SELECT array_to_string(z_labelled(species_z_product(species_z_product(species_z_atom('E'),species_z_atom('E')),species_z_atom('E'))), ',') $q$),
  ('species_kernel','labelled L·L = (n+1)!','eq','1,2,6,24,120,720,5040,40320,362880','linear order × linear order',$q$
    SELECT array_to_string(z_labelled(species_z_product(species_z_atom('L'),species_z_atom('L'))), ',') $q$),
  ('species_kernel','labelled C = (n-1)!, 0 at n=0','eq','0,1,1,2,6,24,120,720,5040','the cycle atom',$q$
    SELECT array_to_string(z_labelled(species_z_atom('C')), ',') $q$),
  ('species_kernel','derivative(C) == L: n!','eq','1,1,2,6,24,120,720,5040,40320','C'' = L, the classic cycle/linear-order identity',$q$
    SELECT array_to_string((z_labelled(species_z_derivative(species_z_atom('C', 9))))[1:9], ',') $q$),
  ('species_kernel','isotype E = all ones','eq','1,1,1,1,1,1,1,1,1','one unlabelled set-shape per size',$q$
    SELECT array_to_string(z_isotype(species_z_atom('E')), ',') $q$),
  ('species_kernel','isotype C = 0 then ones','eq','0,1,1,1,1,1,1,1,1','one unlabelled cycle-shape per size ≥ 1',$q$
    SELECT array_to_string(z_isotype(species_z_atom('C')), ',') $q$),
  ('species_kernel','isotype L = all ones','eq','1,1,1,1,1,1,1,1,1','one unlabelled linear-order-shape per size',$q$
    SELECT array_to_string(z_isotype(species_z_atom('L')), ',') $q$);
