-- requires: realizer, utilities
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

-- ── the registry ────────────────────────────────────────────────────────────────────────────────────────────────
-- collection → its species expression (labelled) + the EGF (KaTeX). base_species_check confirms the expression's
-- sequence IS the collection's cardinality, so a wrong expression can't sneak in.
CREATE TABLE base_species (
  collection text PRIMARY KEY REFERENCES base_collection,
  expr       text NOT NULL,          -- labelled: the X/E/E+/C/L · ∘ + algebra. unlabelled: an OGF fixed point Y = F(X,Y)
  egf        text,                   -- generating function, KaTeX (no delimiters) — EGF for labelled, OGF for unlabelled
  note       text,
  graded     boolean NOT NULL DEFAULT false,  -- expr carries a secondary-grade parameter (E_k); checked per k over n
  unlabelled boolean NOT NULL DEFAULT false,  -- expr is an OGF fixed point/product (solved by ogf_solve, not species_eval)
  implicit   boolean NOT NULL DEFAULT false,  -- expr is a LABELLED fixed point Y = F(X,Y) (solved by species_solve)
  solve_for  text,                            -- if set (implicit only): Y solves THIS equation, then `expr` (in Y) is
                                              -- evaluated — for families that COMPOSE over a fixed point, e.g. endofunctions
  pack       text NOT NULL DEFAULT coalesce(current_setting('enumeratio.pack', true), 'core') REFERENCES base_pack
);
CREATE TRIGGER base_species_pack_guard BEFORE UPDATE OR DELETE ON base_species FOR EACH ROW EXECUTE FUNCTION base_guard_pack();

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

-- (lehmer_codes/k_cycle_permutations/subexcedant_seqs/signed_permutations/surjections/arrangements/
-- cyclic_permutations moved to packs/permutations-plus/base_species.permutations-plus.sql — #283 phase 3)
INSERT INTO base_species (collection, expr, egf, note) VALUES
  ('permutations',              'E∘C',        'e^{-\ln(1-x)} = \frac{1}{1-x}', 'permutation = set of cycles; n!'),
  ('set_partitions',            'E∘E+',       'e^{e^x-1}',                     'partition = set of nonempty blocks; Bell'),
  ('restricted_growth_strings', 'E∘E+',       'e^{e^x-1}',                     'RGS encode set partitions; Bell'),
  ('set_compositions',          'L∘E+',       '\frac{1}{2-e^x}',               'ordered set partitions; Fubini'),
  ('subsets',                   'E·E',        'e^{2x}',                        'in-set · out-set; 2ⁿ'),
  ('boolean_algebra',           'E·E',        'e^{2x}',                        'the 2^[n] lattice; 2ⁿ'),
  ('binary_words',              'E·E',        'e^{2x}',                        'a 2-colouring of [n]; 2ⁿ'),
  ('signed_subsets',            'E·E·E',      'e^{3x}',                        'each element −/0/+; 3ⁿ');
  -- NB: perfect_matchings = E∘E_2 as a species over POINTS, but our collection is indexed by PAIRS (n ↦ 2n points),
  -- so it isn't a labelled species at our n — omitted until the engine indexes by an arbitrary size map.

-- graded (a secondary-grade parameter k): E_k = sets of size exactly k, ^k = k-fold product. Checked per k over n.
-- (surjections_onto_k moved to the pack, same reason)
INSERT INTO base_species (collection, expr, egf, note, graded) VALUES
  ('k_subsets',                   'E_k·E',  '\frac{x^k}{k!}\,e^x', 'k-subsets of [n]; C(n,k)',       true),
  ('set_partitions_into_k_blocks','E_k∘E+', '\frac{(e^x-1)^k}{k!}','partitions of [n] into k blocks; S(n,k)', true),
  ('words',                       'E^k',    'e^{kx}',              'words of length n over k letters; kⁿ', true);

-- unlabelled: OGF fixed points Y = F(X, Y), solved by Picard iteration and checked against the sequence (fiber count for
-- the graded collections, element value for the unbounded number-sequences). Every Y is X-guarded ⇒ division-free.
-- (motzkin_paths/schroeder_paths rows moved to packs/paths/base_species.paths.sql; plane_trees/ordered_trees rows
-- moved to packs/trees-graphs/base_species.trees-graphs.sql — collection REFERENCES base_collection, so those
-- rows would FK-fail loading core alone, #283 phase 3)
INSERT INTO base_species (collection, expr, egf, note, unlabelled) VALUES
  ('catalan_numbers', '1+X·Y^2',      'C=1+xC^2',         'Catalan OGF; C_n = 1,1,2,5,14,…',              true),
  ('dyck_paths',      '1+X·Y^2',      'C=1+xC^2',         'Dyck paths of semilength n; Catalan',          true),
  ('binary_trees',    '1+X·Y^2',      'C=1+xC^2',         'binary trees by internal nodes; Catalan',      true),
  ('motzkin_numbers', '1+X·Y+X^2·Y^2','M=1+xM+x^2M^2',    'Motzkin OGF; M_n = 1,1,2,4,9,21,…',            true),
  ('schroeder_numbers','1+X·Y+X·Y^2', 'S=1+xS+xS^2',      'large Schröder OGF; S_n = 1,2,6,22,90,…',       true);

-- LABELLED implicit (EGF fixed points Y = F(X,Y), solved by species_solve): rooted forests.
-- (parking_functions moved to packs/permutations-plus/base_species.permutations-plus.sql; labeled_forests row
-- moved to packs/trees-graphs/base_species.trees-graphs.sql, #283 phase 3)
-- two-stage: Y = the rooted-tree function (solve_for). (endofunctions moved to the pack; labeled_trees row moved
-- to packs/trees-graphs/base_species.trees-graphs.sql, #283 phase 3)

-- rational OGFs (linear recurrences) as X-guarded fixed points Y = P(X) + (recurrence)·Y — need the scalar + subtraction.
INSERT INTO base_species (collection, expr, egf, note, unlabelled) VALUES
  ('fibonacci_numbers',  'X+X·Y+X^2·Y',         '\frac{x}{1-x-x^2}',       'F_n = 0,1,1,2,3,5,8,…',          true),
  ('lucas_numbers',      '2-X+X·Y+X^2·Y',       '\frac{2-x}{1-x-x^2}',     'L_n = 2,1,3,4,7,11,…',           true),
  ('pell_numbers',       'X+2·X·Y+X^2·Y',       '\frac{x}{1-2x-x^2}',      'P_n = 0,1,2,5,12,29,…',          true),
  ('jacobsthal_numbers', 'X+X·Y+2·X^2·Y',       '\frac{x}{1-x-2x^2}',      'J_n = 0,1,1,3,5,11,…',           true),
  ('tribonacci_numbers', 'X^2+X·Y+X^2·Y+X^3·Y', '\frac{x^2}{1-x-x^2-x^3}', 'T_n = 0,0,1,1,2,4,7,13,…',       true),
  ('padovan_sequence',   '1+X+X^2·Y+X^3·Y',     '\frac{1+x}{1-x^2-x^3}',   'P_n = 1,1,1,2,2,3,4,5,7,…',      true),
  ('perrin_sequence',    '3-X^2+X^2·Y+X^3·Y',   '\frac{3-x^2}{1-x^2-x^3}', 'a_n = 3,0,2,3,2,5,5,7,10,…',     true);

-- polynomial (figurate) sequences: closed rational OGFs poly/(1-X)^d — written directly with the / operator (no Y). The
-- polygonal family is x((s−3)x+1)/(1-x)^3; the pyramidal/simplex family raises the denominator power. The rest of the
-- figurate family (pentagonal/hexagonal/pronic/tetrahedral/… — number-sets collections) is registered in
-- packs/number-sets/base_species.number-sets.sql; only the three named counting sequences (§4) stay here.
INSERT INTO base_species (collection, expr, egf, note, unlabelled) VALUES
  ('triangular_numbers',      'X/(1-X)^3',            '\frac{x}{(1-x)^3}',        'C(n+1,2); 0,1,3,6,10,…',   true),
  ('square_numbers',          'X·(1+X)/(1-X)^3',      '\frac{x(1+x)}{(1-x)^3}',   'n²; 0,1,4,9,16,…',         true),
  ('cube_numbers',            'X·(1+4·X+X^2)/(1-X)^4','\frac{x(1+4x+x^2)}{(1-x)^4}','n³; 0,1,8,27,64,…',      true);

-- infinite-product families: a leading ∏ means ∏_{k≥1} of the per-k factor (X^k = the index power).
INSERT INTO base_species (collection, expr, egf, note, unlabelled) VALUES
  ('integer_partitions', '∏1/(1-X^k)', '\prod_{k\ge1}\frac{1}{1-x^k}', 'partitions of n; p(n) = 1,1,2,3,5,7,11,…',      true),
  ('partition_numbers',  '∏1/(1-X^k)', '\prod_{k\ge1}\frac{1}{1-x^k}', 'the p(n) sequence (integer_partitions'' counts)', true);
-- distinct_partitions' species row moved to the partitions-plus pack (base_species.partitions-plus.sql, #283) —
-- distinct_partitions itself is a pack-owned collection.

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species','E∘C evaluates to the factorials 1,1,2,6,24,120','eq','1,1,2,6,24,120','the permutation species, off the engine',$q$
    SELECT array_to_string(species_eval('E∘C', 5), ',') $q$),
  ('species','E∘E+ evaluates to the Bell numbers 1,1,2,5,15,52','eq','1,1,2,5,15,52','set-partition species',$q$
    SELECT array_to_string(species_eval('E∘E+', 5), ',') $q$),
  ('species','L∘E+ evaluates to the Fubini numbers 1,1,3,13,75,541','eq','1,1,3,13,75,541','ordered set partitions',$q$
    SELECT array_to_string(species_eval('L∘E+', 5), ',') $q$),
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
  ('species','EVERY base_species expression matches its collection sequence (n=0..6)','eq','','a wrong species/equation can''t register (graded per k; unlabelled via ogf_solve)',$q$
    SELECT coalesce(string_agg(collection, ',' ORDER BY collection), '') FROM base_species
     WHERE NOT (CASE WHEN unlabelled THEN base_species_check_unlabelled(collection, expr, 6)
                     WHEN implicit   THEN base_species_check_implicit(collection, expr, solve_for, 6)
                     WHEN graded     THEN base_species_check_graded(collection, expr, 6)
                     ELSE                 base_species_check(collection, expr, 6) END) $q$);
