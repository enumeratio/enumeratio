-- requires: algebra
-- HOLD FORM — render an UNEVALUATED SQL expression fragment as mathematical notation (never run it). The reference is
-- Mathematica's HoldForm + TraditionalForm: `hold_form('x <@ subsets(4)')` ⤳ 'x ∈ subsets(4)' without touching the DB.
-- It is a lexical rewrite driven by an operator→symbol TABLE (base_hold_symbol), not per-expression code: tokenize the
-- fragment, swap each operator token for its math symbol, re-space. Membership is the anchor (∈/∉/∋/∌); the arithmetic
-- operators lean on base_operation.symbol so the display matches the algebra registry.

-- ── the token→symbol table ───────────────────────────────────────────────────────────────────────────────
-- pg_token = the SQL lexeme as tokenized; symbol = its math rendering; negated = the rendering under a NOT/! (membership
-- only — ∈↦∉). Arithmetic rows carry no negated form. This is the whole vocabulary; extend it, not hold_form.
CREATE TABLE base_hold_symbol (pg_token text PRIMARY KEY, symbol text NOT NULL, negated text);
INSERT INTO base_hold_symbol (pg_token, symbol, negated) VALUES
  ('<@','∈','∉'), ('@>','∋','∌'),                                   -- membership: element ∈ collection, collection ∋ element
  ('<>','≠',NULL), ('!=','≠',NULL), ('>=','≥',NULL);                -- comparisons with no base_operation entry
-- the arithmetic/order symbols ARE the algebra registry's — pull them so hold form and evaluation agree
INSERT INTO base_hold_symbol (pg_token, symbol)
  SELECT '*', symbol FROM base_operation WHERE id = 'mul'
  UNION ALL SELECT '+', symbol FROM base_operation WHERE id = 'add'
  UNION ALL SELECT '-', symbol FROM base_operation WHERE id = 'neg'   -- the true minus sign − (U+2212), not hyphen
  UNION ALL SELECT '<=', symbol FROM base_operation WHERE id = 'le';

-- ── the renderer ─────────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION hold_form(sql text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  toks text[];
  t text; sym base_hold_symbol%ROWTYPE;
  out text[] := '{}';
  neg boolean := false;
  r text;
BEGIN
  -- tokenize: multi-char operators first, then identifiers / numbers / single-char punctuation. Whitespace is dropped.
  SELECT array_agg(m[1]) INTO toks
    FROM regexp_matches(sql,
      '<@|@>|<=|>=|<>|!=|::|[A-Za-z_][A-Za-z0-9_]*|[0-9]+(?:\.[0-9]+)?|[-+*/%^=<>(),!]', 'g') m;
  IF toks IS NULL THEN RETURN sql; END IF;

  -- a leading NOT / ! negates a membership fragment: drop it, flag the flip, and shed one wrapping paren pair.
  FOREACH t IN ARRAY toks LOOP
    IF lower(t) = 'not' OR t = '!' THEN neg := true; CONTINUE; END IF;
    out := out || t;
  END LOOP;
  IF neg AND array_length(out,1) >= 2 AND out[1] = '(' AND out[array_upper(out,1)] = ')' THEN
    out := out[2:array_upper(out,1)-1];
  END IF;

  -- swap each operator token for its symbol (negated column when a NOT applies); everything else passes through.
  toks := out; out := '{}';
  FOREACH t IN ARRAY toks LOOP
    SELECT * INTO sym FROM base_hold_symbol WHERE pg_token = t;
    IF FOUND THEN
      out := out || COALESCE(CASE WHEN neg THEN sym.negated END, sym.symbol);
    ELSE
      out := out || t;
    END IF;
  END LOOP;

  -- re-space: tokens joined by spaces, then tighten punctuation and function calls.
  r := array_to_string(out, ' ');
  r := regexp_replace(r, '\s+([),])', '\1', 'g');          -- no space before ) or ,
  r := regexp_replace(r, '([(])\s+', '\1', 'g');           -- no space after (
  r := regexp_replace(r, '([A-Za-z0-9_])\s+\(', '\1(', 'g'); -- foo ( ⇒ foo(  (function call)
  RETURN r;
END $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('hold_form','membership: x <@ subsets(4) renders x ∈ subsets(4)','eq','x ∈ subsets(4)','<@ ↦ ∈',$q$
    SELECT hold_form('x <@ subsets(4)') $q$),
  ('hold_form','negated membership: NOT (x <@ subsets(4)) renders x ∉ subsets(4)','eq','x ∉ subsets(4)','NOT ↦ ∉, outer parens shed',$q$
    SELECT hold_form('NOT (x <@ subsets(4))') $q$),
  ('hold_form','! prefix negates too: ! x <@ subsets(4) ↦ x ∉ subsets(4)','eq','x ∉ subsets(4)','! ↦ ∉',$q$
    SELECT hold_form('! x <@ subsets(4)') $q$),
  ('hold_form','containment direction: subsets(4) @> x ↦ subsets(4) ∋ x','eq','subsets(4) ∋ x','@> ↦ ∋',$q$
    SELECT hold_form('subsets(4) @> x') $q$),
  ('hold_form','arithmetic maps to base_operation symbols: 2 * 3 + 1 ↦ 2 · 3 + 1','eq','2 · 3 + 1','* ↦ ·, + ↦ +',$q$
    SELECT hold_form('2 * 3 + 1') $q$),
  ('hold_form','comparisons: n <= 4 <> m ↦ n ≤ 4 ≠ m','eq','n ≤ 4 ≠ m','<= ↦ ≤, <> ↦ ≠',$q$
    SELECT hold_form('n <= 4 <> m') $q$),
  ('hold_form','unmapped tokens and calls pass through: gcd(a, b) = 1 ↦ gcd(a, b) = 1','eq','gcd(a, b) = 1','function call spacing preserved',$q$
    SELECT hold_form('gcd(a, b) = 1') $q$);
