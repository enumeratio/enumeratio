-- requires: realizer, utilities, species_kernel
-- requires-tag: collection
-- (base_species CHECKS every registered collection's cardinality, so it must load after all collections — the tag slurps
--  them so a newly-added collection with a species row needs no edit here)
-- base_species — each collection's COUNTING identity as a combinatorial SPECIES, EVALUATED to its sequence and
-- CHECKED against cardinality (closing the notation↔count loop; the "one identity, many roles" thesis in action).
--
-- A tiny generating-function engine, ported in spirit from numbers/src/series.ts. We stay in the INTEGER count domain
-- (a labelled species is its sequence a_0,a_1,… of |F[n]|), so everything is exact with no rationals: a species is a
-- numeric[] with s[j] = a_{j-1}. Atoms X (singleton), E (set), E+ (nonempty set), C (cycle), L (linear order), 1 (empty
-- set), and the parameterized E_k / E_<m> (sets of a fixed size); operators + (sum), · (product = binomial
-- convolution), ∘ (composition = the set-partition / Faà-di-Bruno DP), and ^k (k-fold product, k a grade param).
-- Collections with a secondary grade are marked `graded` and checked PER k (E_k·E = k_subsets, (E+)^k =
-- surjections_onto_k). The `unlabelled` families (Catalan/Motzkin/Schröder + their tree/path collections) are OGF fixed
-- points Y = F(X,Y) OR infinite products ∏_{k≥1} factor(k) (Euler ∏1/(1−xᵏ), distinct ∏(1+xᵏ)), solved by ogf_solve —
-- see the OGF track below (it also carries scalar/subtraction for the rational recurrences and a / series reciprocal).
-- Still follow-ups: alphabet atoms E_Σ, the derivative, pointing/cycle-index. See https://github.com/enumeratio/enumeratio/wiki/Parameterized-Collections.

CREATE FUNCTION species_atom(name text, upto int, kparam int DEFAULT NULL) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE r numeric[] := array_fill(0::numeric, ARRAY[upto + 1]); i int; sz int; nm text := btrim(name);   -- r[i+1] = a_i
  BEGIN
    CASE nm
      WHEN 'X'  THEN IF upto >= 1 THEN r[2] := 1; END IF;                   -- one structure, at n=1
      WHEN '1'  THEN r[1] := 1;                                            -- the empty species
      WHEN 'E'  THEN FOR i IN 0..upto LOOP r[i + 1] := 1; END LOOP;         -- sets: e^x
      WHEN 'E+' THEN FOR i IN 1..upto LOOP r[i + 1] := 1; END LOOP;         -- nonempty sets: e^x − 1
      WHEN 'C'  THEN FOR i IN 1..upto LOOP r[i + 1] := factorial(i - 1); END LOOP;   -- cycles: (n−1)!
      WHEN 'L'  THEN FOR i IN 0..upto LOOP r[i + 1] := factorial(i); END LOOP;       -- linear orders: n!
      ELSE
        IF left(nm, 2) = 'E_' THEN                                         -- E_k / E_<m>: sets of a FIXED size (x^size/size!)
          sz := CASE WHEN substring(nm FROM 3) = 'k' THEN kparam ELSE substring(nm FROM 3)::int END;
          IF sz IS NULL THEN RAISE EXCEPTION 'species_atom: %  needs a bound k (pass kparam)', nm; END IF;
          IF sz >= 0 AND sz <= upto THEN r[sz + 1] := 1; END IF;
        ELSE RAISE EXCEPTION 'unknown species atom: %', name;
        END IF;
    END CASE;
    RETURN r;
  END $$;

CREATE FUNCTION species_add(f numeric[], g numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := array_length(f, 1) - 1; r numeric[]; m int;
  BEGIN
    r := array_fill(0::numeric, ARRAY[n + 1]);
    FOR m IN 0..n LOOP r[m + 1] := f[m + 1] + g[m + 1]; END LOOP;
    RETURN r;
  END $$;

-- labelled product: (F·G)_n = Σ_k C(n,k) F_k G_{n−k}
CREATE FUNCTION species_mul(f numeric[], g numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := array_length(f, 1) - 1; r numeric[]; m int; k int; s numeric;
  BEGIN
    r := array_fill(0::numeric, ARRAY[n + 1]);
    FOR m IN 0..n LOOP
      s := 0;
      FOR k IN 0..m LOOP s := s + binomial(m, k) * f[k + 1] * g[m - k + 1]; END LOOP;
      r[m + 1] := s;
    END LOOP;
    RETURN r;
  END $$;

-- composition F∘G (G must have no empty structure): (F∘G)_n = Σ_k F_k · S_G(n,k), where S_G(n,k) sums ∏ G_{|B|} over
-- set partitions of [n] into k blocks, via the DP S_G(n,k) = Σ_j C(n−1,j−1) G_j S_G(n−j,k−1) (choose block of elem 1).
CREATE FUNCTION species_compose(f numeric[], g numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := array_length(f, 1) - 1; ss numeric[]; r numeric[]; a int; k int; j int; acc numeric;
  BEGIN
    IF g[1] <> 0 THEN RAISE EXCEPTION 'species_compose: inner species must have G_0 = 0 (no empty structure)'; END IF;
    ss := array_fill(0::numeric, ARRAY[n + 1, n + 1]);   -- ss[a+1][k+1] = S_G(a,k)
    ss[1][1] := 1;
    FOR a IN 1..n LOOP
      FOR k IN 1..a LOOP
        acc := 0;
        FOR j IN 1..(a - k + 1) LOOP acc := acc + binomial(a - 1, j - 1) * g[j + 1] * ss[a - j + 1][k]; END LOOP;
        ss[a + 1][k + 1] := acc;
      END LOOP;
    END LOOP;
    r := array_fill(0::numeric, ARRAY[n + 1]);
    FOR a IN 0..n LOOP
      acc := 0;
      FOR k IN 0..a LOOP acc := acc + f[k + 1] * ss[a + 1][k + 1]; END LOOP;
      r[a + 1] := acc;
    END LOOP;
    RETURN r;
  END $$;

CREATE FUNCTION species_sub(f numeric[], g numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := array_length(f, 1) - 1; r numeric[]; m int;
  BEGIN
    r := array_fill(0::numeric, ARRAY[n + 1]);
    FOR m IN 0..n LOOP r[m + 1] := f[m + 1] - g[m + 1]; END LOOP;
    RETURN r;
  END $$;
-- divide a species by a SCALAR (constant species s = c·1) — the c must be a plain number, s_j = 0 for j > 0. Used for the
-- dissymmetry T − T²/2 (unrooted trees): (T²)_n is always even, so this stays in the integer-count domain.
CREATE FUNCTION species_div_scalar(f numeric[], s numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := array_length(f, 1) - 1; r numeric[]; m int;
  BEGIN
    IF s[1] = 0 THEN RAISE EXCEPTION 'species_div_scalar: divisor has no constant term'; END IF;
    r := array_fill(0::numeric, ARRAY[n + 1]);
    FOR m IN 0..n LOOP r[m + 1] := f[m + 1] / s[1]; END LOOP;
    RETURN r;
  END $$;

-- evaluate a species EXPRESSION (atoms + - · / ∘ ^ and parens) to its count sequence a_0..a_upto. Precedence loosest
-- first: +/- (last top-level, − left-assoc), then ·// (scalar divide), then ∘, then ^. A bare integer c = the scalar
-- species c·1. `yval`, when supplied, binds the unknown atom Y — the hook species_solve closes over for Y = F(X, Y).
CREATE FUNCTION species_eval(expr text, upto int, kparam int DEFAULT NULL, yval numeric[] DEFAULT NULL) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE e text := btrim(expr); i int; depth int; ch text; enclosed boolean; base numeric[]; expo int; res numeric[]; t int;
  BEGIN
    -- strip fully-enclosing parentheses, repeatedly
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
    -- additive: split at the LAST top-level + or - (left-assoc; the + in the E+ atom is not an operator)
    depth := 0; expo := 0;   -- reuse expo as the additive split position; base holds nothing yet
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND i > 1 AND (ch = '+' OR ch = '-')
            AND NOT (ch = '+' AND substring(e FROM i - 1 FOR 1) = 'E') THEN expo := i * (CASE ch WHEN '+' THEN 1 ELSE -1 END);
      END IF;
    END LOOP;
    IF expo <> 0 THEN
      RETURN CASE WHEN expo > 0
        THEN species_add(species_eval(left(e, abs(expo) - 1), upto, kparam, yval), species_eval(substring(e FROM abs(expo) + 1), upto, kparam, yval))
        ELSE species_sub(species_eval(left(e, abs(expo) - 1), upto, kparam, yval), species_eval(substring(e FROM abs(expo) + 1), upto, kparam, yval))
      END;
    END IF;
    -- multiplicative: first top-level · or / (÷ by a scalar)
    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND (ch = '·' OR ch = '/') THEN
        RETURN CASE ch
          WHEN '·' THEN species_mul(species_eval(left(e, i - 1), upto, kparam, yval), species_eval(substring(e FROM i + 1), upto, kparam, yval))
          ELSE          species_div_scalar(species_eval(left(e, i - 1), upto, kparam, yval), species_eval(substring(e FROM i + 1), upto, kparam, yval))
        END;
      END IF;
    END LOOP;
    -- composition: first top-level ∘
    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND ch = '∘' THEN
        RETURN species_compose(species_eval(left(e, i - 1), upto, kparam, yval), species_eval(substring(e FROM i + 1), upto, kparam, yval));
      END IF;
    END LOOP;
    -- top-level power A^k (tightest; RHS is a number or the grade param k) = k-fold labelled product
    depth := 0;
    FOR i IN 1..length(e) LOOP
      IF substring(e FROM i FOR 1) = '(' THEN depth := depth + 1;
      ELSIF substring(e FROM i FOR 1) = ')' THEN depth := depth - 1;
      ELSIF substring(e FROM i FOR 1) = '^' AND depth = 0 THEN
        base := species_eval(left(e, i - 1), upto, kparam, yval);
        expo := CASE WHEN btrim(substring(e FROM i + 1)) = 'k' THEN kparam ELSE btrim(substring(e FROM i + 1))::int END;
        res := species_atom('1', upto);   -- product identity (the empty species)
        FOR t IN 1..expo LOOP res := species_mul(res, base); END LOOP;
        RETURN res;
      END IF;
    END LOOP;
    IF btrim(e) = 'Y' THEN RETURN yval; END IF;   -- the unknown (a labelled fixed point)
    IF btrim(e) ~ '^\d+$' THEN res := array_fill(0::numeric, ARRAY[upto + 1]); res[1] := btrim(e)::numeric; RETURN res; END IF;  -- scalar c = c·1
    RETURN species_atom(e, upto, kparam);         -- an atom
  END $$;

-- solve a LABELLED fixed point Y = F(X, Y) to order `upto` by Picard iteration with the species (EGF) operators — the
-- labelled twin of ogf_solve. Every Y is X-guarded (or ∘-guarded through a G_0 = 0 inner), so upto+1 substitutions from
-- Y = 0 fix coefficients 0..upto. Rooted labelled trees = X·(E∘Y) (nⁿ⁻¹); rooted forests = E∘(X·Y) ((n+1)ⁿ⁻¹).
CREATE FUNCTION species_solve(equation text, upto int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE y numeric[] := array_fill(0::numeric, ARRAY[upto + 1]); i int;
  BEGIN
    FOR i IN 0..upto LOOP y := species_eval(equation, upto, NULL, y); END LOOP;
    RETURN y;
  END $$;

-- ── OGF (unlabelled) track: fixed-point families ────────────────────────────────────────────────────────────────
-- The labelled operators above obey the EGF laws (· = binomial convolution, ∘ = Faà di Bruno). The unlabelled families
-- (Catalan, Motzkin, Schröder, trees, paths) are OGF fixed points Y = F(X, Y) with no closed species expression — every
-- Y is X-guarded, so plain Picard iteration (start Y = 0, substitute upto+1 times) fixes coefficients 0..upto exactly.
-- Same numeric[] representation, but the coefficients are the RAW OGF counts, so · is a plain Cauchy convolution (no
-- binomial) and the only atoms are X, 1, and the unknown Y (bound to the current iterate). Ported from numbers/src/species.ts.
CREATE FUNCTION ogf_mul(f numeric[], g numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := array_length(f, 1) - 1; r numeric[]; m int; k int; s numeric;
  BEGIN
    r := array_fill(0::numeric, ARRAY[n + 1]);
    FOR m IN 0..n LOOP
      s := 0;
      FOR k IN 0..m LOOP s := s + f[k + 1] * g[m - k + 1]; END LOOP;   -- plain Cauchy convolution
      r[m + 1] := s;
    END LOOP;
    RETURN r;
  END $$;
CREATE FUNCTION ogf_sub(f numeric[], g numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := array_length(f, 1) - 1; r numeric[]; m int;
  BEGIN
    r := array_fill(0::numeric, ARRAY[n + 1]);
    FOR m IN 0..n LOOP r[m + 1] := f[m + 1] - g[m + 1]; END LOOP;
    RETURN r;
  END $$;
-- series reciprocal 1/f (needs f_0 ≠ 0): r_0 = 1/f_0, r_m = −(Σ_{j=1..m} f_j r_{m−j})/f_0. Powers the `/` operator.
CREATE FUNCTION ogf_inv(f numeric[]) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE n int := array_length(f, 1) - 1; r numeric[]; m int; j int; s numeric;
  BEGIN
    IF f[1] = 0 THEN RAISE EXCEPTION 'ogf_inv: series has no constant term (not invertible)'; END IF;
    r := array_fill(0::numeric, ARRAY[n + 1]);
    r[1] := 1 / f[1];
    FOR m IN 1..n LOOP
      s := 0;
      FOR j IN 1..m LOOP s := s + f[j + 1] * r[m - j + 1]; END LOOP;
      r[m + 1] := - s / f[1];
    END LOOP;
    RETURN r;
  END $$;

-- evaluate an OGF expression over atoms X, 1, a bare integer scalar c (= c·1), the unknown Y (returns yval), and — inside
-- a ∏ product — the index power X^k (kparam); operators + - · / ^ (no composition). Additive splits at the LAST top-level
-- +/- (- is not associative ⇒ left-assoc), then ·// (÷ = multiply by ogf_inv), then ^. Rational recurrences (Fibonacci =
-- X+X·Y+X²·Y) need scalar + subtraction; product families (Euler = ∏1/(1-X^k)) need / and the X^k index power.
CREATE FUNCTION ogf_eval(expr text, upto int, yval numeric[], kparam int DEFAULT NULL) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE e text := btrim(expr); i int; depth int; ch text; enclosed boolean;
          apos int; aop text; mpos int; mop text; base numeric[]; expo int; res numeric[]; t int;
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
    -- additive: split at the LAST top-level + or - (left-associative)
    depth := 0; apos := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND i > 1 AND (ch = '+' OR ch = '-') THEN apos := i; aop := ch;
      END IF;
    END LOOP;
    IF apos > 0 THEN
      RETURN CASE aop
        WHEN '+' THEN species_add(ogf_eval(left(e, apos - 1), upto, yval, kparam), ogf_eval(substring(e FROM apos + 1), upto, yval, kparam))
        ELSE          ogf_sub(ogf_eval(left(e, apos - 1), upto, yval, kparam), ogf_eval(substring(e FROM apos + 1), upto, yval, kparam))
      END;
    END IF;
    -- multiplicative: split at the LAST top-level · or / (÷ = multiply by the series reciprocal)
    depth := 0; mpos := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND (ch = '·' OR ch = '/') THEN mpos := i; mop := ch;
      END IF;
    END LOOP;
    IF mpos > 0 THEN
      RETURN CASE mop
        WHEN '·' THEN ogf_mul(ogf_eval(left(e, mpos - 1), upto, yval, kparam), ogf_eval(substring(e FROM mpos + 1), upto, yval, kparam))
        ELSE          ogf_mul(ogf_eval(left(e, mpos - 1), upto, yval, kparam), ogf_inv(ogf_eval(substring(e FROM mpos + 1), upto, yval, kparam)))
      END;
    END IF;
    -- power A^k (exponent is an integer, or the literal k = the ∏ index)
    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF ch = '^' AND depth = 0 THEN
        base := ogf_eval(left(e, i - 1), upto, yval, kparam);
        expo := CASE WHEN btrim(substring(e FROM i + 1)) = 'k' THEN kparam ELSE btrim(substring(e FROM i + 1))::int END;
        res := species_atom('1', upto);                       -- product identity
        FOR t IN 1..expo LOOP res := ogf_mul(res, base); END LOOP;
        RETURN res;
      END IF;
    END LOOP;
    e := btrim(e);
    IF e = 'Y' THEN RETURN yval; END IF;                       -- the unknown
    IF e ~ '^\d+$' THEN res := array_fill(0::numeric, ARRAY[upto + 1]); res[1] := e::numeric; RETURN res; END IF;  -- scalar c = c·1
    RETURN species_atom(e, upto);                             -- X or 1
  END $$;

-- ∏_{k=1..upto} factor(k): the infinite-product families (Euler ∏1/(1-x^k), distinct ∏(1+x^k)). Factors with k > upto
-- only touch coefficients > upto, so upto factors suffice. `factor` is an ogf expression in X and the index power X^k.
CREATE FUNCTION ogf_product(factor text, upto int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE y numeric[] := species_atom('1', upto); z numeric[] := array_fill(0::numeric, ARRAY[upto + 1]); k int;
  BEGIN
    FOR k IN 1..upto LOOP y := ogf_mul(y, ogf_eval(factor, upto, z, k)); END LOOP;
    RETURN y;
  END $$;

-- solve an OGF to order `upto`: a leading ∏ is an infinite product (ogf_product); else a fixed point Y = F(X,Y) by
-- Picard iteration (upto+1 substitutions from Y = 0 — every Y is X-guarded, so that fixes coefficients 0..upto).
CREATE FUNCTION ogf_solve(equation text, upto int) RETURNS numeric[] LANGUAGE plpgsql IMMUTABLE AS $$
  DECLARE y numeric[] := array_fill(0::numeric, ARRAY[upto + 1]); i int; eq text := btrim(equation);
  BEGIN
    IF left(eq, 1) = '∏' THEN RETURN ogf_product(btrim(substring(eq FROM 2)), upto); END IF;
    FOR i IN 0..upto LOOP y := ogf_eval(eq, upto, y); END LOOP;
    RETURN y;
  END $$;

-- ── the registry (#274 B5) ──────────────────────────────────────────────────────────────────────────────────────
-- base_species_def: the SPECIES IDENTITY itself, one row per DISTINCT expr — many collections share one (e.g. 'E∘C'
-- is both permutations and lehmer_codes). base_collection_species: a collection's READING of that species — labelled
-- (EGF, species_eval/species_solve) or isotype (OGF-fixpoint via ogf_solve, or plethysm via the Z-kernel), ± a
-- *_count_sequence variant when the collection is the unbounded number-sequence twin of a finite graded family
-- (same species, same reading, different "role" — the one-identity-many-roles thesis). `base_species` below is a
-- COMPAT VIEW reshaping these two tables back into the old collection-keyed shape the client and the existing
-- differential examples already read.
CREATE TABLE base_species_def (
  id    text PRIMARY KEY,      -- = the expr text (a species IS its expr)
  expr  text NOT NULL,
  egf   text,                  -- KaTeX, no delimiters — EGF for a labelled reading, OGF for an isotype fixed point/product
  title text,
  note  text,
  pack  text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack   -- #283 provenance
);

CREATE TABLE base_collection_species (
  collection text PRIMARY KEY REFERENCES base_collection,
  species    text NOT NULL REFERENCES base_species_def(id),
  reading    text NOT NULL CHECK (reading IN ('labelled', 'isotype', 'labelled_count_sequence', 'isotype_count_sequence')),
  bindings   jsonb NOT NULL DEFAULT '{}',   -- {"k":{"kind":"nat"}} graded; {"solve_for":"…"} two-stage implicit fixpoint
  note       text,
  pack       text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack   -- #283 provenance
);
-- #283 pack guard on the REAL tables (base_species is a compat view now, #274 B5 — a view can't carry a row trigger)
CREATE TRIGGER base_collection_species_pack_guard BEFORE UPDATE OR DELETE ON base_collection_species FOR EACH ROW EXECUTE FUNCTION base_guard_pack();
CREATE TRIGGER base_species_def_pack_guard BEFORE UPDATE OR DELETE ON base_species_def FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

-- ungraded: species_eval(expr) IS the cardinality sequence over the single size axis.
CREATE FUNCTION base_species_check(coll text, expr text, upto int) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
  DECLARE want numeric[] := '{}'; i int; c numeric;
  BEGIN
    FOR i IN 0..upto LOOP EXECUTE format('SELECT cardinality(%I(%s))', coll, i) INTO c; want := want || c; END LOOP;
    RETURN want = species_eval(expr, upto);
  END $$;

-- graded: for each k, species_eval(expr, ·, k) over n IS cardinality(coll(n, k)) (e.g. E_k·E = C(n,k) = |k_subsets(n,k)|).
CREATE FUNCTION base_species_check_graded(coll text, expr text, upto int) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
  DECLARE k int; n int; want numeric[]; c numeric;
  BEGIN
    FOR k IN 0..upto LOOP
      want := '{}';
      FOR n IN 0..upto LOOP EXECUTE format('SELECT cardinality(%I(%s,%s))', coll, n, k) INTO c; want := want || c; END LOOP;
      IF want <> species_eval(expr, upto, k) THEN RETURN false; END IF;
    END LOOP;
    RETURN true;
  END $$;

-- unlabelled: ogf_solve(equation) IS the OGF coefficient sequence. For a graded finite collection that sequence is the
-- fiber count cardinality(coll(n)); for an unbounded number-sequence collection (catalan_numbers, …) it's the n-th
-- element VALUE — the same sequence in its "many roles".
CREATE FUNCTION base_species_check_unlabelled(coll text, expr text, upto int) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
  DECLARE want numeric[] := '{}'; i int; c numeric; is_unbounded boolean;
  BEGIN
    SELECT unbounded INTO is_unbounded FROM base_collection WHERE id = coll;
    FOR i IN 0..upto LOOP
      IF is_unbounded THEN EXECUTE format('SELECT (unrank(%I(), %s)).value', coll, i) INTO c;   -- the n-th term
      ELSE                 EXECUTE format('SELECT cardinality(%I(%s))', coll, i) INTO c;         -- the fiber count
      END IF;
      want := want || c;
    END LOOP;
    RETURN want = ogf_solve(expr, upto);
  END $$;

-- isotype via the Z-kernel (plethysm, not an OGF fixpoint — expr carries ∘, which ogf_eval can't parse): the count
-- sequence is z_isotype(species_z_eval(expr)), or z_isotype(species_z_fixpoint(expr)) when expr is self-referential
-- (carries Y). Covers the isotype-TWIN bindings (integer_partitions/partition_numbers = E∘E+, integer_compositions =
-- L∘E+, rooted_unlabeled_trees = X·(E∘Y)) that base_species_check_unlabelled (ogf_solve) cannot evaluate.
CREATE FUNCTION base_species_check_isotype_z(coll text, expr text, upto int) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
  DECLARE want numeric[] := '{}'; i int; c numeric; is_unbounded boolean; got numeric[];
  BEGIN
    SELECT unbounded INTO is_unbounded FROM base_collection WHERE id = coll;
    FOR i IN 0..upto LOOP
      IF is_unbounded THEN EXECUTE format('SELECT (unrank(%I(), %s)).value', coll, i) INTO c;
      ELSE                 EXECUTE format('SELECT cardinality(%I(%s))', coll, i) INTO c;
      END IF;
      want := want || c;
    END LOOP;
    got := CASE WHEN expr LIKE '%Y%' THEN z_isotype(species_z_fixpoint(expr, upto))
                ELSE z_isotype(species_z_eval(expr, upto)) END;
    RETURN want = got;
  END $$;

-- implicit (labelled fixed point): the count sequence is species_solve(expr) when `solve_for` is NULL, else `expr`
-- evaluated with Y bound to species_solve(solve_for) — the two-stage "compose over a fixed point" case (endofunctions).
-- Compared against cardinality (graded finite collection) or n-th element value (unbounded).
CREATE FUNCTION base_species_check_implicit(coll text, expr text, solve_for text, upto int) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
  DECLARE want numeric[] := '{}'; i int; c numeric; is_unbounded boolean; got numeric[];
  BEGIN
    SELECT unbounded INTO is_unbounded FROM base_collection WHERE id = coll;
    FOR i IN 0..upto LOOP
      IF is_unbounded THEN EXECUTE format('SELECT (unrank(%I(), %s)).value', coll, i) INTO c;
      ELSE                 EXECUTE format('SELECT cardinality(%I(%s))', coll, i) INTO c;
      END IF;
      want := want || c;
    END LOOP;
    got := CASE WHEN solve_for IS NULL THEN species_solve(expr, upto)
                ELSE species_eval(expr, upto, NULL, species_solve(solve_for, upto)) END;
    RETURN want = got;
  END $$;

-- ── species identities (base_species_def) — one row per DISTINCT expr; the FK target for BOTH core and pack
-- readings, so it carries every expr used anywhere (a pack collection binds a core-defined identity). ──────────
INSERT INTO base_species_def (id, expr, egf, note) VALUES
  ('E∘C',           'E∘C',           '\frac{1}{1-x}',        'permutation = set of cycles; n!'),
  ('E∘C∘(X+X)',     'E∘C∘(X+X)',     '\frac{1}{1-2x}',       'hyperoctahedral B_n = 2ⁿ·n!'),
  ('E∘E+',          'E∘E+',          'e^{e^x-1}',            'partition = set of nonempty blocks; Bell'),
  ('L∘E+',          'L∘E+',          '\frac{1}{2-e^x}',      'ordered set partition; Fubini'),
  ('E·E',           'E·E',           'e^{2x}',               'in-set · out-set; 2ⁿ'),
  ('E·E·E',         'E·E·E',         'e^{3x}',               'each element −/0/+; 3ⁿ'),
  ('E·L',           'E·L',           '\frac{e^x}{1-x}',      'sequences of distinct elements; A000522'),
  ('C',             'C',             '-\ln(1-x)',            'a single cycle; (n−1)!'),
  ('E_k·E',         'E_k·E',        '\frac{x^k}{k!}\,e^x',  'k-subsets of [n]; C(n,k)'),
  ('(E+)^k',        '(E+)^k',       '(e^x-1)^k',             'surjections [n]→[k]; k!·S(n,k)'),
  ('E_k∘E+',        'E_k∘E+',       '\frac{(e^x-1)^k}{k!}', 'partitions of [n] into k blocks; S(n,k)'),
  ('E^k',           'E^k',          'e^{kx}',                'words of length n over k letters; kⁿ'),
  ('1+X·Y^2',       '1+X·Y^2',       'C=1+xC^2',             'Catalan OGF fixed point'),
  ('1+X·Y+X^2·Y^2', '1+X·Y+X^2·Y^2', 'M=1+xM+x^2M^2',        'Motzkin OGF fixed point'),
  ('1+X·Y+X·Y^2',   '1+X·Y+X·Y^2',   'S=1+xS+xS^2',          'large Schröder OGF fixed point'),
  ('X+Y^2',         'X+Y^2',         'P=x+P^2',              'plane trees by nodes; C_{n-1} (shifted Catalan)'),
  ('E∘(X·Y)',       'E∘(X·Y)',       'F=e^{xF}',             'rooted labelled forests; (n+1)ⁿ⁻¹'),
  ('E∘(C∘Y)',       'E∘(C∘Y)',       'e^{-\ln(1-T)}',        'functions [n]→[n]; nⁿ = set of cycles of rooted trees'),
  ('1+Y-Y·Y/2',     '1+Y-Y·Y/2',     '1+T-\tfrac{T^2}{2}',   'unrooted (Cayley) trees; nⁿ⁻² by dissymmetry T−T²/2'),
  ('X·(E∘Y)',       'X·(E∘Y)',       'T=xe^T',               'rooted labelled tree; nⁿ⁻¹ — also the isotype fixpoint for A000081');
-- NB: perfect_matchings = E∘E_2 as a species over POINTS, but our collection is indexed by PAIRS (n ↦ 2n points),
-- so it isn't a labelled species at our n — omitted until the engine indexes by an arbitrary size map.

-- ── collection readings — CORE-owned collections only. The pack-owned ones (lehmer_codes, k_cycle_permutations,
-- subexcedant_seqs, signed_permutations, surjections, arrangements, cyclic_permutations, surjections_onto_k,
-- parking_functions, endofunctions → permutations-plus; motzkin_paths, schroeder_paths → paths) bind in their
-- pack's base_species.<pack>.sql — a core file can't reference a pack collection (#283 phase 3). ──────────────────
INSERT INTO base_collection_species (collection, species, reading, note) VALUES
  ('permutations',              'E∘C',       'labelled', NULL),
  ('set_partitions',            'E∘E+',      'labelled', NULL),
  -- (restricted_growth_strings moved to packs/words-plus/base_species.words-plus.sql — #283 phase 3;
  --  its species identity E∘E+ stays here in base_species_def, which the pack's reading references)
  ('set_compositions',          'L∘E+',      'labelled', NULL),
  ('subsets',                   'E·E',       'labelled', NULL),
  ('boolean_algebra',           'E·E',       'labelled', 'the 2^[n] lattice'),
  ('binary_words',              'E·E',       'labelled', 'a 2-colouring of [n]'),
  ('signed_subsets',            'E·E·E',     'labelled', NULL);

-- graded (a secondary-grade parameter k): E_k = sets of size exactly k, ^k = k-fold product. Checked per k over n.
INSERT INTO base_collection_species (collection, species, reading, bindings) VALUES
  ('k_subsets',                    'E_k·E',  'labelled', '{"k":{"kind":"nat"}}'),
  ('set_partitions_into_k_blocks', 'E_k∘E+', 'labelled', '{"k":{"kind":"nat"}}'),
  ('words',                        'E^k',    'labelled', '{"k":{"kind":"nat"}}');

-- unlabelled: OGF fixed points Y = F(X, Y), checked against the sequence — fiber count for the finite collections
-- (isotype), element value for the unbounded number-sequence twins (isotype_count_sequence). CORE collections only;
-- the tree collections (ordered_trees, plane_trees, labeled_forests, labeled_trees, rooted_unlabeled_trees) moved to
-- packs/trees-graphs/base_species.trees-graphs.sql (#283 phase 3 — a core file can't reference a pack collection).
INSERT INTO base_collection_species (collection, species, reading) VALUES
  ('dyck_paths',      '1+X·Y^2',       'isotype'),
  ('binary_trees',    '1+X·Y^2',       'isotype');
INSERT INTO base_collection_species (collection, species, reading) VALUES
  ('catalan_numbers',   '1+X·Y^2',       'isotype_count_sequence'),
  ('motzkin_numbers',   '1+X·Y+X^2·Y^2', 'isotype_count_sequence'),
  ('schroeder_numbers', '1+X·Y+X·Y^2',   'isotype_count_sequence');

-- (rational-OGF linear recurrences AND figurate/simplex closed forms — 22 collections total — re-filed to
-- base_generating_function (builder gf_rational) in #274 B3; distinct_partitions re-filed there too in B5 below:
-- none of these 23 are species.)

-- honest re-binding (#274 B5): integer_partitions/partition_numbers are NOT ∏1/(1-x^k) as a species — that's the
-- OGF identity, not a combinatorial construction. The honest species is E∘E+ (a set of nonempty sets, unlabelled =
-- an unordered partition into parts), certified against p(n) via the Z-kernel plethysm in #274 B4. Checked here via
-- base_species_check_isotype_z (species_z_eval/z_isotype), not ogf_solve — expr carries ∘, which ogf_eval can't parse.
-- (The figurate/rational OGF sequences main's #283 kept/moved here are NOT species — #274 B3 re-filed ALL of them to
--  base_generating_function via gf_rational; see packs/number-sets for the pack-scoped ones, handled the same way.)
INSERT INTO base_collection_species (collection, species, reading, note) VALUES
  ('integer_partitions', 'E∘E+', 'isotype',                'the honest species (not the ∏ OGF) — see #274 B4/B5'),
  ('partition_numbers',  'E∘E+', 'isotype_count_sequence',  'the p(n) sequence; same species as integer_partitions');

-- isotype TWINS (#274 B5): collections that had no species row before — binding them to species already proved
-- honest by the #274 B4 kernel differential (species_kernel.sql's marquee examples). Both still core collections
-- (integer_compositions core; rooted_unlabeled_trees physically core until trees-graphs is extracted).
INSERT INTO base_collection_species (collection, species, reading, note) VALUES
  ('integer_compositions',   'L∘E+',    'isotype', 'unlabelled ordered set partitions = compositions; 2^(n-1)');
-- (rooted_unlabeled_trees' isotype twin moved to packs/trees-graphs/base_species.trees-graphs.sql — #283 phase 3)
-- multisets SKIPPED: multisets(n,k) is doubly-graded (n and k both vary) and doesn't bind cleanly to a single-axis
-- E^b isotype reading the way k_subsets/E_k·E does for the labelled case — no row minted, per #274 B5 scope.

-- distinct_partitions is NOT a species (no honest species construction proven) — re-filed like the rationals (#274
-- B3) to base_generating_function (builder gf_distinct_partition_ogf) in generating_functions.sql instead.

-- ── compat view ──────────────────────────────────────────────────────────────────────────────────────────────────
-- `base_species` — the OLD collection-keyed shape, reconstructed from the two tables above. The client (core.ts)
-- selects exactly collection/expr/egf/note/graded/unlabelled/implicit; species_registry.sql needs `expr` too (its
-- load-time species_parse(expr) call and the print∘parse differential both read FROM base_species).
-- `implicit` is scoped to the LABELLED readings only — several isotype OGF-fixpoint exprs (1+X·Y^2, X+Y^2, …) also
-- carry a self-referential Y, but they are NOT implicit-labelled-fixpoints (they're solved by ogf_solve, dispatched
-- via `unlabelled`); the two-stage bindings (bindings ? 'solve_for') and the plain self-referential labelled exprs
-- (labeled_forests/parking_functions, expr LIKE '%Y%') are the only honest 4.
CREATE VIEW base_species AS
  SELECT bcs.collection,
         sd.expr,
         sd.egf,
         coalesce(bcs.note, sd.note) AS note,
         (bcs.bindings ? 'k')                                    AS graded,
         (bcs.reading IN ('isotype', 'isotype_count_sequence'))  AS unlabelled,
         (bcs.reading IN ('labelled', 'labelled_count_sequence')
          AND (bcs.bindings ? 'solve_for' OR sd.expr LIKE '%Y%')) AS implicit,
         bcs.bindings ->> 'solve_for'                             AS solve_for,
         bcs.reading,
         bcs.bindings,
         bcs.pack                                                 -- #283 provenance accounting reads base_species.pack (bootstrap.sql)
    FROM base_collection_species bcs
    JOIN base_species_def sd ON sd.id = bcs.species;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species','E∘C evaluates to the factorials 1,1,2,6,24,120','eq','1,1,2,6,24,120','the permutation species, off the engine',$q$
    SELECT array_to_string(species_eval('E∘C', 5), ',') $q$),
  ('species','E∘E+ evaluates to the Bell numbers 1,1,2,5,15,52','eq','1,1,2,5,15,52','set-partition species',$q$
    SELECT array_to_string(species_eval('E∘E+', 5), ',') $q$),
  ('species','L∘E+ evaluates to the Fubini numbers 1,1,3,13,75,541','eq','1,1,3,13,75,541','ordered set partitions',$q$
    SELECT array_to_string(species_eval('L∘E+', 5), ',') $q$),
  ('species','the Z-kernel path (product/labelled) agrees with species_eval for E·E, E·E·E, L·L','eq','true','cycle-index kernel vs. the binomial-convolution engine, cross-checked',$q$
    SELECT bool_and(v)::text FROM (VALUES
      (z_labelled(species_z_product(species_z_atom('E'),species_z_atom('E'))) IS NOT DISTINCT FROM species_eval('E·E', 8)),
      (z_labelled(species_z_product(species_z_product(species_z_atom('E'),species_z_atom('E')),species_z_atom('E'))) IS NOT DISTINCT FROM species_eval('E·E·E', 8)),
      (z_labelled(species_z_product(species_z_atom('L'),species_z_atom('L'))) IS NOT DISTINCT FROM species_eval('L·L', 8))
    ) t(v) $q$),
  ('species','E·E = 2ⁿ and E·E·E = 3ⁿ','eq','1,2,4,8,16|1,3,9,27,81','labelled product = binomial convolution',$q$
    SELECT array_to_string(species_eval('E·E', 4), ',') || '|' || array_to_string(species_eval('E·E·E', 4), ',') $q$),
  ('species','composition is associative + parenthesised sums parse: E∘C∘(X+X) = 2ⁿ·n!','eq','1,2,8,48,384','signed permutations B_n',$q$
    SELECT array_to_string(species_eval('E∘C∘(X+X)', 4), ',') $q$),
  ('species','E_k·E is the k-subset triangle: C(n,2) for k=2 is 0,0,1,3,6,10','eq','0,0,1,3,6,10','the parameterized atom E_k',$q$
    SELECT array_to_string(species_eval('E_k·E', 5, 2), ',') $q$),
  ('species','(E+)^k is surjections onto [k]: onto [2] = 2ⁿ−2 = 0,0,2,6,14,30','eq','0,0,2,6,14,30','the ^k power operator',$q$
    SELECT array_to_string(species_eval('(E+)^k', 5, 2), ',') $q$),
  ('species','OGF fixed points solve to the right sequences: Catalan, Motzkin, large Schröder','eq','1,1,2,5,14,42,132|1,1,2,4,9,21,51|1,2,6,22,90,394,1806','Picard iteration off the engine',$q$
    SELECT array_to_string(ogf_solve('1+X·Y^2', 6), ',') || '|' ||
           array_to_string(ogf_solve('1+X·Y+X^2·Y^2', 6), ',') || '|' ||
           array_to_string(ogf_solve('1+X·Y+X·Y^2', 6), ',') $q$),
  ('species','rational OGFs need scalar + subtraction: Fibonacci and Lucas (2−x numerator)','eq','0,1,1,2,3,5,8,13|2,1,3,4,7,11,18','linear-recurrence fixed points',$q$
    SELECT array_to_string(ogf_solve('X+X·Y+X^2·Y', 7), ',') || '|' ||
           array_to_string(ogf_solve('2-X+X·Y+X^2·Y', 6), ',') $q$),
  ('species','infinite products: ∏1/(1-X^k) = partitions, ∏(1+X^k) = distinct parts','eq','1,1,2,3,5,7,11,15,22|1,1,1,2,2,3,4,5,6','the ∏ construct + the / operator (series reciprocal)',$q$
    SELECT (SELECT string_agg(x::bigint::text, ',' ORDER BY o) FROM unnest(ogf_solve('∏1/(1-X^k)', 8)) WITH ORDINALITY t(x, o)) || '|' ||
           (SELECT string_agg(x::bigint::text, ',' ORDER BY o) FROM unnest(ogf_solve('∏(1+X^k)', 8))   WITH ORDINALITY t(x, o)) $q$),
  ('species','labelled fixed points: X·(E∘Y) = rooted trees nⁿ⁻¹, E∘(X·Y) = forests (n+1)ⁿ⁻¹','eq','0,1,2,9,64,625,7776|1,1,3,16,125,1296,16807','species_solve (EGF Picard) with the Y unknown',$q$
    SELECT array_to_string(species_solve('X·(E∘Y)', 6), ',') || '|' ||
           array_to_string(species_solve('E∘(X·Y)', 6), ',') $q$),
  ('species','two-stage: E∘(C∘T) over the tree function T = endofunctions nⁿ','eq','1,1,4,27,256,3125,46656','compose over a solved fixed point',$q$
    SELECT array_to_string(species_eval('E∘(C∘Y)', 6, NULL, species_solve('X·(E∘Y)', 6)), ',') $q$),
  ('species','dissymmetry T−T²/2 = unrooted (Cayley) trees nⁿ⁻² (subtraction + scalar divide)','eq','0,1,1,3,16,125,1296','species_sub + species_div_scalar',$q$
    SELECT string_agg(x::bigint::text, ',' ORDER BY o) FROM unnest(species_eval('Y-Y·Y/2', 6, NULL, species_solve('X·(E∘Y)', 6))) WITH ORDINALITY t(x, o) $q$),
  ('species','EVERY collection''s species reading matches its sequence (n=0..6)','eq','','a wrong species/reading can''t register — dispatches on reading, graded per k, isotype-∘ via the Z-kernel, isotype-OGF via ogf_solve, implicit via species_solve',$q$
    SELECT coalesce(string_agg(bcs.collection, ',' ORDER BY bcs.collection), '')
      FROM base_collection_species bcs JOIN base_species_def sd ON sd.id = bcs.species
     WHERE NOT (
       CASE
         WHEN bcs.reading IN ('isotype', 'isotype_count_sequence') AND sd.expr LIKE '%∘%'
           THEN base_species_check_isotype_z(bcs.collection, sd.expr, 6)
         WHEN bcs.reading IN ('isotype', 'isotype_count_sequence')
           THEN base_species_check_unlabelled(bcs.collection, sd.expr, 6)
         WHEN bcs.bindings ? 'solve_for'
           THEN base_species_check_implicit(bcs.collection, sd.expr, bcs.bindings ->> 'solve_for', 6)
         WHEN sd.expr LIKE '%Y%'
           THEN base_species_check_implicit(bcs.collection, sd.expr, NULL, 6)
         WHEN bcs.bindings ? 'k'
           THEN base_species_check_graded(bcs.collection, sd.expr, 6)
         ELSE base_species_check(bcs.collection, sd.expr, 6)
       END) $q$);
-- (the isotype-twin bindings — integer_partitions/E∘E+, integer_compositions/L∘E+, rooted_unlabeled_trees/X·(E∘Y) —
--  are already certified by the dispatch above via base_species_check_isotype_z; no separate deg-8 example needed.)

-- ── plethysm + Z-walker (#274 B4): species_z_compose/species_z_fixpoint/species_z_eval certified against the
-- existing labelled engine (species_eval) over the whole plain labelled corpus, plus targeted isotype checks. ──
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
-- The plethysm kernel is expensive at high degree (per-coefficient partition-ordinality lookups; see the #274
-- follow-up note in species_kernel.sql), so these differentials run to degree 6 — the target sequences (partition
-- numbers, compositions, A000081, n!) are already distinctive there. The full-degree corpus cert is on demand
-- (EXAMPLES=all lifts the marquee's slow twin below).
  ('species','isotype(E∘E+) == integer_partitions: p(n) = 1,1,2,3,5,7,11','eq','true','plethysm E composed with the nonempty-set atom counts unlabelled set partitions = integer partitions',$q$
    SELECT (z_isotype(species_z_compose(species_z_atom('E',6),species_z_atom('E+',6)))
            = ARRAY(SELECT cardinality(integer_partitions(m))::numeric FROM generate_series(0,6) m))::text $q$),
  ('species','isotype(L∘E+) == integer_compositions: 2^(n-1) = 1,1,2,4,8,16,32','eq','true','plethysm L composed with the nonempty-set atom counts unlabelled ordered set partitions = integer compositions',$q$
    SELECT (z_isotype(species_z_compose(species_z_atom('L',6),species_z_atom('E+',6)))
            = ARRAY(SELECT cardinality(integer_compositions(m))::numeric FROM generate_series(0,6) m))::text $q$),
  ('species','isotype(E^3) == multisets of 3: C(n+2,2) = 1,3,6,10,15,21,28,36,45','eq','1,3,6,10,15,21,28,36,45','the ^k power operator on the Z side, isotype-projected',$q$
    SELECT array_to_string(z_isotype(species_z_power(species_z_atom('E'),3)), ',') $q$),
  ('species','labelled(E∘C) == species_eval(E∘C): n!','eq','true','plethysm-composed kernel, labelled-projected, vs the existing labelled engine',$q$
    SELECT (z_labelled(species_z_compose(species_z_atom('E',6),species_z_atom('C',6))) IS NOT DISTINCT FROM species_eval('E∘C', 6))::text $q$),
  ('species','Euler transform of all-ones == isotype(E∘E+): both are the partition numbers','eq','true','a sequence-transform differential vs the species-kernel differential, same target sequence',$q$
    SELECT (sequence_transform_terms('all_ones','euler',7) IS NOT DISTINCT FROM z_isotype(species_z_compose(species_z_atom('E',6),species_z_atom('E+',6))))::text $q$),
  ('species','MARQUEE: the Z-walker + plethysm kernel agrees with species_eval over the plain labelled corpus','eq','true','z_labelled(species_z_eval(expr)) == species_eval(expr) for every ungraded, labelled, non-implicit expr (degree 6)',$q$
    SELECT bool_and(z_labelled(species_z_eval(expr, 6)) IS NOT DISTINCT FROM species_eval(expr, 6))::text
      FROM base_species WHERE NOT graded AND NOT unlabelled AND NOT implicit $q$),
  ('species','MARQUEE (full degree 8): the Z-walker + plethysm kernel agrees with species_eval over the plain labelled corpus','eq','true','the on-demand deep tier (EXAMPLES=all) — same differential at degree 8',$q$
    SELECT bool_and(z_labelled(species_z_eval(expr, 8)) IS NOT DISTINCT FROM species_eval(expr, 8))::text
      FROM base_species WHERE NOT graded AND NOT unlabelled AND NOT implicit $q$);

-- ── relabel_invariant stat trait (#274 B6): a stat is relabel-invariant iff its value survives any relabelling of
-- the underlying species' atoms — cycle/block/fixed-point counts don't care WHICH labels moved, only the shape.
-- Runs LATE (after every base_stat insert in CORE has loaded) so the marked rows already exist. Only core-owned
-- rows are listed, so base_guard_pack's core-may-update-core rule lets this through: binary_words.number_of_ones
-- was here until words-plus took binary_words.stats.sql (#283 phase 3), and a pack's row is the PACK's to mark —
-- packs/words-plus/base_species.words-plus.sql now sets it. A core UPDATE naming it would raise the guard, and at
-- core-load time the row does not exist yet anyway.
UPDATE base_stat SET relabel_invariant = true WHERE (collection, stat_id) IN
  (('permutations','cycles'),('set_partitions','blocks'),('permutations','fixed_points'),
   ('set_partitions','singleton_blocks'));

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species','relabel_invariant marks core''s shape-only stats (cycles/blocks/fixed_points/singleton_blocks)','eq','true','floor/containment, not an exact count — other stats may earn the trait later',$q$
    SELECT bool_and(relabel_invariant)::text FROM base_stat WHERE (collection, stat_id) IN
      (('permutations','cycles'),('set_partitions','blocks'),('permutations','fixed_points'),
       ('set_partitions','singleton_blocks')) $q$),
  ('species','the two #274 B6 species kinds (nonempty, x_guarded) are registered','eq','true','nonempty = G has no empty structure (∘''s requirement); x_guarded = fixpoint body guarded by X (Picard convergence)',$q$
    SELECT (EXISTS (SELECT 1 FROM base_kind WHERE id='nonempty') AND EXISTS (SELECT 1 FROM base_kind WHERE id='x_guarded'))::text $q$);
