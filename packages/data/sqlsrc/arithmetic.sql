-- requires: realizer
-- Proper arithmetic for the two number types the realizer defines. Neither gets it from its numeric base:
--   • cardinal — commutative (finite | ℵ₀), but ℵ₀·0 = 0 where numeric '*' gives NaN, and ℵ₀ absorbs under +/·.
--   • omega_ordinal  — < ω^ω, a flat CNF coefficient array [a₁,…,aₘ] = Σ aᵢ·ω^(m−i); addition and multiplication are the
--                real (NON-commutative) omega_ordinal operations, nothing to do with array/element arithmetic.
-- Operators are provided where they dispatch cleanly (omega_ordinal's base numeric[] has no +/·). The functions are the
-- canonical interface (an operation registry / UI evaluator binds to them).

-- ── cardinal arithmetic (ℵ₀ = 'infinity', unknown = NULL) ─────────────────────────────────────────────────
CREATE FUNCTION cardinal_add(a cardinal, b cardinal) RETURNS cardinal LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL
              WHEN a = 'infinity'::numeric OR b = 'infinity'::numeric THEN 'infinity'::numeric
              ELSE a::numeric + b::numeric END::cardinal $$;   -- ::numeric forces numeric +, not the cardinal + (⇒ recursion)
CREATE FUNCTION cardinal_mul(a cardinal, b cardinal) RETURNS cardinal LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN a IS NULL OR b IS NULL THEN NULL
              WHEN a = 0 OR b = 0 THEN 0                            -- the annihilator wins over ℵ₀ (numeric ⇒ NaN)
              WHEN a = 'infinity'::numeric OR b = 'infinity'::numeric THEN 'infinity'::numeric
              ELSE a::numeric * b::numeric END::cardinal $$;   -- ::numeric forces numeric *, not the cardinal * (⇒ recursion)

-- ── omega_ordinal arithmetic (CNF over the coefficient array; a[i] is the coefficient of ω^(len−i)) ──────────────
-- canonical form has no leading zeros (a₁ > 0); the empty array is 0.
CREATE FUNCTION ordinal_normalize(o omega_ordinal) RETURNS omega_ordinal LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE m int := coalesce(array_length(o, 1), 0); i int := 1;
  BEGIN
    IF o IS NULL THEN RETURN NULL; END IF;
    WHILE i <= m AND o[i] = 0 LOOP i := i + 1; END LOOP;
    IF i > m THEN RETURN ARRAY[]::numeric[]::omega_ordinal; END IF;   -- all zero ⇒ 0
    RETURN o[i:m]::omega_ordinal;
  END $$;

-- α + β: β's leading power q absorbs every term of α below q; the term at q sums; β's tail follows.
CREATE FUNCTION ordinal_add(a omega_ordinal, b omega_ordinal) RETURNS omega_ordinal LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE aa numeric[]; bb numeric[]; la int; lb int; bdeg int; keep int;
  BEGIN
    IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
    aa := ordinal_normalize(a); bb := ordinal_normalize(b);
    la := coalesce(array_length(aa, 1), 0); lb := coalesce(array_length(bb, 1), 0);
    IF lb = 0 THEN RETURN aa::omega_ordinal; END IF;                  -- α + 0 = α
    IF la = 0 THEN RETURN bb::omega_ordinal; END IF;                  -- 0 + β = β
    bdeg := lb - 1;                                             -- β's leading power
    IF bdeg > la - 1 THEN RETURN bb::omega_ordinal; END IF;          -- every term of α is below q ⇒ absorbed
    keep := la - bdeg - 1;                                      -- α's terms with power > q (kept verbatim)
    RETURN ((CASE WHEN keep > 0 THEN aa[1:keep] ELSE ARRAY[]::numeric[] END)
            || (aa[la - bdeg] + bb[1])                          -- α's coeff at power q, plus β's leading
            || (CASE WHEN lb > 1 THEN bb[2:lb] ELSE ARRAY[]::numeric[] END))::omega_ordinal;
  END $$;

-- α · β = Σ_j α·(term_j of β), left-distributed over β's CNF terms (descending), summed by ordinal_add.
-- α·(ω^q·c): for q>0 it is ω^(deg α + q)·c — α·ω^q = ω^(deg α + q) with coefficient 1 (α's leading coefficient AND
-- tail both vanish: n·ω = ω, ω·2·ω = ω²); only β's coefficient c survives. For q=0 it is α with its LEADING
-- coefficient scaled by c (the tail rides along). That left-vs-right asymmetry is exactly omega_ordinal multiplication.
CREATE FUNCTION ordinal_mul(a omega_ordinal, b omega_ordinal) RETURNS omega_ordinal LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE aa numeric[]; bb numeric[]; la int; lb int; da int; lead numeric; i int; q int; c numeric;
          term numeric[]; res numeric[] := ARRAY[]::numeric[];
  BEGIN
    IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
    aa := ordinal_normalize(a); bb := ordinal_normalize(b);
    la := coalesce(array_length(aa, 1), 0); lb := coalesce(array_length(bb, 1), 0);
    IF la = 0 OR lb = 0 THEN RETURN ARRAY[]::numeric[]::omega_ordinal; END IF;   -- α·0 = 0·β = 0
    da := la - 1; lead := aa[1];                                -- α's leading power + coefficient
    FOR i IN 1..lb LOOP
      c := bb[i]; q := lb - i;
      CONTINUE WHEN c = 0;
      IF q > 0 THEN
        term := array_prepend(c, (SELECT array_agg(0::numeric) FROM generate_series(1, da + q)));  -- ω^(da+q)·c  (α·ω^q = ω^(da+q), coeff 1)
      ELSE
        term := array_prepend(lead * c, CASE WHEN la > 1 THEN aa[2:la] ELSE ARRAY[]::numeric[] END);      -- ω^da·(lead·c) + tail
      END IF;
      res := ordinal_normalize((ordinal_add(res::omega_ordinal, term::omega_ordinal)));
    END LOOP;
    RETURN res::omega_ordinal;
  END $$;

-- operators — omega_ordinal's base type (numeric[]) has no +/·, so these dispatch cleanly; cardinal's do too (guarded funcs).
CREATE OPERATOR + (LEFTARG = omega_ordinal,  RIGHTARG = omega_ordinal,  FUNCTION = ordinal_add);
CREATE OPERATOR * (LEFTARG = omega_ordinal,  RIGHTARG = omega_ordinal,  FUNCTION = ordinal_mul);
CREATE OPERATOR + (LEFTARG = cardinal, RIGHTARG = cardinal, FUNCTION = cardinal_add, COMMUTATOR = +);
CREATE OPERATOR * (LEFTARG = cardinal, RIGHTARG = cardinal, FUNCTION = cardinal_mul, COMMUTATOR = *);

-- ── the order (both types are well-ordered) ──────────────────────────────────────────────────────────────
-- cardinal comparison is numeric's (finite < ℵ₀). omega_ordinal: higher CNF degree wins, else lexicographic on coeffs.
CREATE FUNCTION ordinal_lt(a omega_ordinal, b omega_ordinal) RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE aa numeric[] := ordinal_normalize(a); bb numeric[] := ordinal_normalize(b); la int; lb int;
  BEGIN
    IF a IS NULL OR b IS NULL THEN RETURN NULL; END IF;
    la := coalesce(array_length(aa, 1), 0); lb := coalesce(array_length(bb, 1), 0);
    IF la <> lb THEN RETURN la < lb; END IF;     -- more ω-powers ⇒ larger
    RETURN aa < bb;                              -- same degree ⇒ lexicographic (leading power first)
  END $$;
CREATE FUNCTION ordinal_le(a omega_ordinal, b omega_ordinal) RETURNS boolean LANGUAGE sql IMMUTABLE AS $$ SELECT NOT ordinal_lt(b, a) $$;
-- (no < operator on the omega_ordinal DOMAIN: it would make bare numeric[] < numeric[] ambiguous. Use the functions.)

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('arithmetic','omega_ordinal order (well-ordered): 2 < ω < ω+1 < ω·2','eq','true','higher CNF degree wins, else lexicographic',$q$
    SELECT (ordinal_lt(ARRAY[2]::omega_ordinal, ARRAY[1,0]::omega_ordinal) AND ordinal_lt(ARRAY[1,0]::omega_ordinal, ARRAY[1,1]::omega_ordinal) AND ordinal_lt(ARRAY[1,1]::omega_ordinal, ARRAY[2,0]::omega_ordinal))::text $q$),
  ('arithmetic','cardinal: ℵ₀ + 5 = ℵ₀','eq','Infinity','ℵ₀ absorbs finite addition',$q$
    SELECT ('infinity'::cardinal + 5::cardinal)::text $q$),
  ('arithmetic','cardinal: ℵ₀ · 0 = 0 (numeric would give NaN)','eq','0','the 0 annihilator wins over ℵ₀',$q$
    SELECT ('infinity'::cardinal * 0::cardinal)::text $q$),
  ('arithmetic','cardinal: ℵ₀ · 3 = ℵ₀','eq','Infinity','ℵ₀ absorbs positive-finite product',$q$
    SELECT (cardinal_mul('infinity', 3))::text $q$),
  ('arithmetic','cardinal: finite 2 + 3·4 = 14 (no ℵ₀ — exercises the finite branch)','eq','14','the recursion-safe finite path',$q$
    SELECT (2::cardinal + 3::cardinal * 4::cardinal)::text $q$),
  ('arithmetic','omega_ordinal: 2 + ω = ω (left finite absorbed)','eq','ω','omega_ordinal addition is not commutative',$q$
    SELECT notation(ARRAY[2]::omega_ordinal + ARRAY[1,0]::omega_ordinal) $q$),
  ('arithmetic','omega_ordinal: ω + 2 = ω + 2 (the other order survives)','eq','ω + 2','',$q$
    SELECT notation(ARRAY[1,0]::omega_ordinal + ARRAY[2]::omega_ordinal) $q$),
  ('arithmetic','omega_ordinal: (ω+1) + (ω+1) = ω·2 + 1','eq','ω·2 + 1','1 + ω = ω inside the sum',$q$
    SELECT notation(ARRAY[1,1]::omega_ordinal + ARRAY[1,1]::omega_ordinal) $q$),
  ('arithmetic','omega_ordinal: ω · ω = ω²','eq','ω^2','multiplication climbs the tower',$q$
    SELECT notation(ARRAY[1,0]::omega_ordinal * ARRAY[1,0]::omega_ordinal) $q$),
  ('arithmetic','omega_ordinal: (ω+1)² = ω² + ω + 1','eq','ω^2 + ω + 1','left-distribution over β''s terms',$q$
    SELECT notation(ARRAY[1,1]::omega_ordinal * ARRAY[1,1]::omega_ordinal) $q$),
  ('arithmetic','omega_ordinal: (ω+1) · 2 = ω·2 + 1 (finite right factor scales the lead, tail rides)','eq','ω·2 + 1','',$q$
    SELECT notation(ARRAY[1,1]::omega_ordinal * ARRAY[2]::omega_ordinal) $q$);
