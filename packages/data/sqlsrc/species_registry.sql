-- requires: species_kernel, identities, function_impls
-- species_registry — the op/atom registry (wiki Species-Data-Model.md §3a) + a text↔tree codec for base_species.expr.
-- base_species_op/atom are the DATA description of the kernel functions species_kernel.sql already hand-wrote;
-- base_species_node materialises every distinct expr into a tree (species_parse), and species_print inverts it
-- (print∘parse is the differential below). compose/fixpoint get base_function/impl rows below (#274 B4: the
-- plethysm + Z-walker landed in species_kernel.sql). functor_compose stays impl-less — species_z_functor_compose
-- is a raising stub with no honest formula yet, and function_impls.sql's self-test requires every engine='pg'
-- impl_ref to resolve in pg_proc, not to be a real implementation.

-- ── atoms ────────────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE base_species_atom (id text PRIMARY KEY, symbol text, cycle_index_fn text NOT NULL, egf_katex text, ogf_katex text, description text);

INSERT INTO base_species_atom (id, symbol, cycle_index_fn, egf_katex, ogf_katex, description) VALUES
  ('1',  '1',  'species_z_atom', '1',       '1',       'the empty species — one structure, on the empty label set'),
  ('X',  'X',  'species_z_atom', 'x',       'x',       'the singleton — one structure, on a single label'),
  ('E',  'E',  'species_z_atom', 'e^x',     '1/(1-x)', 'the set — one structure per label set, any size'),
  ('E+', 'E+', 'species_z_atom', 'e^x-1',   'x/(1-x)', 'the nonempty set'),
  ('C',  'C',  'species_z_atom', '-\ln(1-x)', 'x/(1-x)', 'the cycle — (n-1)! structures at size n'),
  ('L',  'L',  'species_z_atom', '1/(1-x)', '1/(1-x)', 'the linear order — n! structures at size n');

-- ── operations ───────────────────────────────────────────────────────────────────────────────────────
CREATE TABLE base_species_op (
  id             text PRIMARY KEY,
  symbol         text,
  arity          int  NOT NULL,
  requires_kind  text,   -- free-text constraint note (compose needs a nonempty inner G₀=0; fixpoint needs an
                          -- X-guarded body) — not FK'd to base_kind, those aren't type-former kinds
  labelled_rule  text,
  isotype_rule   text,
  cycle_index_fn text NOT NULL,
  structure_rule text,
  yorgey         text,
  sage           text,
  note           text
);

-- the ten species ops (wiki §3a).
INSERT INTO base_species_op (id, symbol, arity, requires_kind, labelled_rule, isotype_rule, cycle_index_fn, structure_rule, yorgey, sage) VALUES
  ('sum',             '+',  2, NULL,        'coefficientwise',                  'coefficientwise',          'species_z_sum',             '{"tag":0|1,"of":…}',                          '+',                    'Sum'),
  ('product',         '·',  2, NULL,        'binomial convolution',             'via Z',                    'species_z_product',         'label split A⊔B, F on A, G on B',             '*',                    'Product'),
  ('cartesian',       '×',  2, NULL,        'fix(F×G)=fixF·fixG (via Z)',       'via Z',                    'species_z_cartesian',       'same labels, F-structure and G-structure',    '><',                   NULL),
  ('compose',         '∘',  2, 'nonempty',  'Faà di Bruno DP',                  'via Z (plethysm)',         'species_z_compose',         'set partition of labels; G in blocks, F on blocks', 'o',              'Composition'),
  ('functor_compose', '@@', 2, NULL,        'via Z only',                       'via Z only',                'species_z_functor_compose', 'F-structure on the list of all G-structures', '@@',                   'FunctorialComposition');
UPDATE base_species_op SET note = 'deferred — #274 follow-up' WHERE id = 'functor_compose';
INSERT INTO base_species_op (id, symbol, arity, requires_kind, labelled_rule, isotype_rule, cycle_index_fn, structure_rule, yorgey, sage) VALUES
  ('derivative',      '′',  1, NULL,        '∂/∂p_1',                          'via Z',                     'species_z_derivative',      'F on labels ∪ {*}',                           'differentiate/oneHole', NULL),
  ('pointing',        '•',  1, NULL,        'p_1·∂/∂p_1',                      'via Z',                     'species_z_pointing',        'F on labels with one distinguished',          'pointed',              NULL),
  ('restrict_size',   'E_k', 1, NULL,       'zero outside k',                   'zero outside k',            'species_z_restrict_exact',  'only the size-k structures',                  'ofSize/ofSizeExactly/nonEmpty', 'restricted(min,max)'),
  ('power',           '^',  2, NULL,        'k-fold labelled product',          'via Z',                     'species_z_power',           NULL,                                           NULL,                   NULL),
  ('fixpoint',        'Y=', 1, 'x_guarded', 'Picard iteration',                 'Picard iteration',          'species_z_fixpoint',        'unfold to the label count',                   'rec',                  'define');

-- OGF sequence operators (rational-recurrence / figurate exprs use these) — not species
-- operations; registered so species_parse can build a tree for the rational rows base_species.sql carries
-- today. Re-filed onto real species ops in #274 B3.
INSERT INTO base_species_op (id, symbol, arity, cycle_index_fn, note) VALUES
  ('difference',       '-', 2, 'species_z_sum',   'virtual-species op (union with multiplicity): used in dissymmetry identities');

-- ── base_function / base_function_impl — one row per op with a LIVE kernel function ────────────────────
-- (skips functor_compose: species_z_functor_compose is a raising stub with no honest impl.)
INSERT INTO base_function (id, description) VALUES
  ('species_sum',           'species cycle-index sum Z_F + Z_G (coefficientwise)'),
  ('species_product',       'species cycle-index product Z_F · Z_G (p_λ · p_μ = p_{λ∪μ})'),
  ('species_cartesian',     'species cycle-index Cartesian product Z_{F×G} (fix F[σ]·fix G[σ], scaled by z_λ)'),
  ('species_derivative',    'species cycle-index derivative Z_{F′} (∂/∂p_1)'),
  ('species_pointing',      'species cycle-index pointing Z_{F•} (p_1·∂/∂p_1)'),
  ('species_restrict_size', 'species cycle-index restricted to an exact size k'),
  ('species_power',         'species cycle-index k-fold labelled product Z_F^k'),
  ('species_compose',       'species cycle-index plethysm Z_{F∘G} (Σ_λ c_λ(F)·∏_i p_{λ_i}[Z_G])'),
  ('species_fixpoint',      'species cycle-index Picard fixed point Y = F(X, Y)');

INSERT INTO base_function_impl (function, engine, impl_ref, arg_types, return_type, representation) VALUES
  ('species_sum',           'pg', 'species_z_sum',             '{jsonb,jsonb}', 'jsonb', 'numeric'),
  ('species_product',       'pg', 'species_z_product',         '{jsonb,jsonb}', 'jsonb', 'numeric'),
  ('species_cartesian',     'pg', 'species_z_cartesian',       '{jsonb,jsonb}', 'jsonb', 'numeric'),
  ('species_derivative',    'pg', 'species_z_derivative',      '{jsonb}',       'jsonb', 'numeric'),
  ('species_pointing',      'pg', 'species_z_pointing',        '{jsonb}',       'jsonb', 'numeric'),
  ('species_restrict_size', 'pg', 'species_z_restrict_exact',  '{jsonb,int}',   'jsonb', 'numeric'),
  ('species_power',         'pg', 'species_z_power',           '{jsonb,int}',  'jsonb', 'numeric'),
  ('species_compose',       'pg', 'species_z_compose',         '{jsonb,jsonb}', 'jsonb', 'numeric'),
  ('species_fixpoint',      'pg', 'species_z_fixpoint',        '{text,int}',    'jsonb', 'numeric');

-- ── node model ───────────────────────────────────────────────────────────────────────────────────────
-- `species` = the expr STRING itself (a species IS its expr; many collections share one, e.g. 'E∘C').
CREATE TABLE base_species_node (
  species  text NOT NULL,
  node     int  NOT NULL,
  kind     text NOT NULL CHECK (kind IN ('op','atom','param','lit','self')),
  op       text REFERENCES base_species_op,
  atom     text,
  param    text,
  lit      numeric,
  children int[],
  PRIMARY KEY (species, node)
);

CREATE SEQUENCE species_node_seq;

-- rank for the print-time paren decision: an operand is wrapped iff its own top operator binds LOOSER than
-- its parent's (child_rank < parent_rank) — mirrors the fixed scan order species_eval/ogf_eval use (additive
-- scanned first = loosest, power tightest). A non-op node (leaf) never needs wrapping.
-- #274 F2: × (cartesian) is now REACHABLE — species_parse_node scans it between the multiplicative (·//) and
-- compose (∘) stages, so it shares compose's rank 3 (same tightness, distinct symbol; @@ has no scan branch yet,
-- functor_compose stays unreachable). Postfix ′ (derivative) / • (pointing) are unary ops scanned AFTER power —
-- tightest, above power — and fall into the ELSE bucket (rank 5), one tighter than power's 4.
CREATE FUNCTION species_node_rank(sp text, nid int) RETURNS int LANGUAGE plpgsql STABLE AS $$
  DECLARE k text; o text;
  BEGIN
    SELECT kind, op INTO k, o FROM base_species_node WHERE species = sp AND node = nid;
    IF k IS DISTINCT FROM 'op' THEN RETURN 999; END IF;
    RETURN CASE o
      WHEN 'sum' THEN 1 WHEN 'difference' THEN 1
      WHEN 'product' THEN 2
      WHEN 'compose' THEN 3 WHEN 'functor_compose' THEN 3 WHEN 'cartesian' THEN 3
      WHEN 'power' THEN 4
      WHEN 'derivative' THEN 5 WHEN 'pointing' THEN 5   -- tightest: postfix, binds to the immediately preceding operand
      ELSE 5 END;
  END $$;

-- recursive-descent parser, MIRRORING species_eval/ogf_eval's precedence exactly (extended by #274 F2 with ×
-- and postfix ′/•, which the plain text engines never needed): strip enclosing parens → leading ∏
-- (infinite_product, prefix) → additive (LAST top-level +/-, left-assoc; '+' after 'E' is the E+ atom, not an
-- operator) → multiplicative (FIRST top-level · or /) → cartesian (FIRST top-level ×, between multiplicative and
-- compose — same rank as ∘, see species_node_rank) → composition (FIRST top-level ∘) → power (top-level ^;
-- exponent is 'k' or an integer literal) → postfix ′/• (tightest, above power — the LAST character of what's
-- left, applied to the whole remaining operand) → leaf (Y → self; digits → lit; bare 'k' → param; else → atom,
-- which also covers E_k / E_<m>). Inserts bottom-up (children before parent), returns the new node's id — the
-- LAST id inserted for a species is always its root (single top-level call per parse).
CREATE FUNCTION species_parse_node(species text, e0 text) RETURNS int LANGUAGE plpgsql AS $$
  DECLARE
    e text := btrim(e0); i int; depth int; ch text; enclosed boolean;
    pos int; opch text; leftid int; rightid int; myid int; base text; expo text;
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

    depth := 0; pos := 0; opch := NULL;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND i > 1 AND (ch = '+' OR ch = '-')
            AND NOT (ch = '+' AND substring(e FROM i - 1 FOR 1) = 'E') THEN pos := i; opch := ch;
      END IF;
    END LOOP;
    IF pos > 0 THEN
      leftid := species_parse_node(species, left(e, pos - 1));
      rightid := species_parse_node(species, substring(e FROM pos + 1));
      myid := nextval('species_node_seq');
      INSERT INTO base_species_node (species, node, kind, op, children) VALUES
        (species, myid, 'op', CASE opch WHEN '+' THEN 'sum' ELSE 'difference' END, ARRAY[leftid, rightid]);
      RETURN myid;
    END IF;

    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND ch = '·' THEN
        leftid := species_parse_node(species, left(e, i - 1));
        rightid := species_parse_node(species, substring(e FROM i + 1));
        myid := nextval('species_node_seq');
        INSERT INTO base_species_node (species, node, kind, op, children) VALUES
          (species, myid, 'op', 'product', ARRAY[leftid, rightid]);
        RETURN myid;
      END IF;
    END LOOP;

    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND ch = '×' THEN
        leftid := species_parse_node(species, left(e, i - 1));
        rightid := species_parse_node(species, substring(e FROM i + 1));
        myid := nextval('species_node_seq');
        INSERT INTO base_species_node (species, node, kind, op, children) VALUES (species, myid, 'op', 'cartesian', ARRAY[leftid, rightid]);
        RETURN myid;
      END IF;
    END LOOP;

    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF depth = 0 AND ch = '∘' THEN
        leftid := species_parse_node(species, left(e, i - 1));
        rightid := species_parse_node(species, substring(e FROM i + 1));
        myid := nextval('species_node_seq');
        INSERT INTO base_species_node (species, node, kind, op, children) VALUES (species, myid, 'op', 'compose', ARRAY[leftid, rightid]);
        RETURN myid;
      END IF;
    END LOOP;

    depth := 0;
    FOR i IN 1..length(e) LOOP
      ch := substring(e FROM i FOR 1);
      IF ch = '(' THEN depth := depth + 1;
      ELSIF ch = ')' THEN depth := depth - 1;
      ELSIF ch = '^' AND depth = 0 THEN
        base := left(e, i - 1);
        expo := btrim(substring(e FROM i + 1));
        leftid := species_parse_node(species, base);
        myid := nextval('species_node_seq');
        IF expo = 'k' THEN
          INSERT INTO base_species_node (species, node, kind, param) VALUES (species, myid, 'param', 'k');
        ELSE
          INSERT INTO base_species_node (species, node, kind, lit) VALUES (species, myid, 'lit', expo::numeric);
        END IF;
        rightid := myid;
        myid := nextval('species_node_seq');
        INSERT INTO base_species_node (species, node, kind, op, children) VALUES (species, myid, 'op', 'power', ARRAY[leftid, rightid]);
        RETURN myid;
      END IF;
    END LOOP;

    -- postfix ′ (derivative) / • (pointing): tightest, above power — binds to the whole preceding operand, so it's
    -- just the trailing character once no top-level infix operator matched (the operand can't itself end in an
    -- unclosed paren here, since e's parens are balanced).
    e := btrim(e);
    IF length(e) > 0 AND right(e, 1) IN ('′', '•') THEN
      leftid := species_parse_node(species, left(e, length(e) - 1));
      myid := nextval('species_node_seq');
      INSERT INTO base_species_node (species, node, kind, op, children) VALUES
        (species, myid, 'op', CASE right(e, 1) WHEN '′' THEN 'derivative' ELSE 'pointing' END, ARRAY[leftid]);
      RETURN myid;
    END IF;

    myid := nextval('species_node_seq');
    IF e = 'Y' THEN
      INSERT INTO base_species_node (species, node, kind) VALUES (species, myid, 'self');
    ELSIF e ~ '^\d+$' THEN
      INSERT INTO base_species_node (species, node, kind, lit) VALUES (species, myid, 'lit', e::numeric);
    ELSIF e = 'k' THEN
      INSERT INTO base_species_node (species, node, kind, param) VALUES (species, myid, 'param', 'k');
    ELSE
      INSERT INTO base_species_node (species, node, kind, atom) VALUES (species, myid, 'atom', e);
    END IF;
    RETURN myid;
  END $$;

CREATE FUNCTION species_parse(expr text) RETURNS void LANGUAGE plpgsql AS $$
  BEGIN
    DELETE FROM base_species_node WHERE species = expr;
    PERFORM species_parse_node(expr, expr);
  END $$;

-- ── the Z-walker (#274 F2) ───────────────────────────────────────────────────────────────────────────────────────
-- species_z_walk: the parsed tree IS the form the Z engine evaluates — walk it directly instead of re-scanning
-- text (species_kernel.sql's old species_z_eval carried its own copy of the precedence scanner above). `sp`/`nid`
-- address a node (species text, node id); its own kind/op/children carry everything a text scan had to re-derive
-- on every call. Dispatch mirrors species_z_sum/_product/_cartesian/_compose/_power/_derivative/_pointing/
-- _restrict_exact one-for-one; difference is sum + scalar(-1)·, matching species_eval's species_sub-via-species_add
-- shape. `divide`/`infinite_product`/`functor_compose` are OGF-sequence or unimplemented ops with no cycle-index
-- analogue — refuse rather than silently misparse.
CREATE FUNCTION species_z_walk(sp text, nid int, maxdeg int, yval jsonb DEFAULT NULL, kparam int DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
  DECLARE rec base_species_node%ROWTYPE; a jsonb; expkind text; explit numeric; expparam text; k int; full_z jsonb;
  BEGIN
    SELECT * INTO rec FROM base_species_node WHERE species = sp AND node = nid;
    IF NOT FOUND THEN RAISE EXCEPTION 'species_z_walk: no node % for species %', nid, sp; END IF;
    CASE rec.kind
      WHEN 'atom' THEN
        IF rec.atom = 'E_k' THEN   -- the parameterized atom: 'E_<m>' (fixed literal size) is handled by species_z_atom itself
          IF kparam IS NULL THEN RAISE EXCEPTION 'species_z_walk: E_k needs kparam (pass k)'; END IF;
          RETURN species_z_restrict_exact(species_z_atom('E', maxdeg), kparam);
        END IF;
        RETURN species_z_atom(rec.atom, maxdeg);
      WHEN 'lit' THEN
        RETURN z_scalar_mul(frac(rec.lit, 1), species_z_atom('1', maxdeg));   -- a bare integer c = the scalar species c·1
      WHEN 'param' THEN
        RAISE EXCEPTION 'species_z_walk: bare param % only valid as a power exponent or the E_k size, not as a species itself', rec.param;
      WHEN 'self' THEN
        IF yval IS NULL THEN RAISE EXCEPTION 'species_z_walk: Y (self) with no yval bound'; END IF;
        RETURN yval;
      WHEN 'op' THEN
        CASE rec.op
          WHEN 'sum' THEN
            RETURN species_z_sum(species_z_walk(sp, rec.children[1], maxdeg, yval, kparam),
                                  species_z_walk(sp, rec.children[2], maxdeg, yval, kparam));
          WHEN 'difference' THEN
            RETURN species_z_sum(species_z_walk(sp, rec.children[1], maxdeg, yval, kparam),
                                  z_scalar_mul(frac(-1, 1), species_z_walk(sp, rec.children[2], maxdeg, yval, kparam)));
          WHEN 'product' THEN
            RETURN species_z_product(species_z_walk(sp, rec.children[1], maxdeg, yval, kparam),
                                      species_z_walk(sp, rec.children[2], maxdeg, yval, kparam));
          WHEN 'cartesian' THEN
            RETURN species_z_cartesian(species_z_walk(sp, rec.children[1], maxdeg, yval, kparam),
                                        species_z_walk(sp, rec.children[2], maxdeg, yval, kparam));
          WHEN 'compose' THEN
            RETURN species_z_compose(species_z_walk(sp, rec.children[1], maxdeg, yval, kparam),
                                      species_z_walk(sp, rec.children[2], maxdeg, yval, kparam));
          WHEN 'power' THEN
            a := species_z_walk(sp, rec.children[1], maxdeg, yval, kparam);
            -- the exponent node is a lit or a bare param 'k' — inspect it directly rather than walking it generically
            -- (a generic walk would hit the 'param' case above and raise).
            SELECT kind, lit, param INTO expkind, explit, expparam FROM base_species_node WHERE species = sp AND node = rec.children[2];
            IF expkind = 'lit' THEN
              k := trunc(explit)::int;
            ELSIF expkind = 'param' AND expparam = 'k' THEN
              IF kparam IS NULL THEN RAISE EXCEPTION 'species_z_walk: power exponent k needs kparam (pass k)'; END IF;
              k := kparam;
            ELSE
              RAISE EXCEPTION 'species_z_walk: power exponent must be a literal or k (got node kind %)', expkind;
            END IF;
            RETURN species_z_power(a, k);
          WHEN 'derivative' THEN
            -- species_z_derivative zeroes its own top degree (no data at maxdeg+1) — walk the operand ONE degree
            -- higher so the truncated result is exact through maxdeg (#274 F2 task 4), then drop the extra key.
            full_z := species_z_derivative(species_z_walk(sp, rec.children[1], maxdeg + 1, yval, kparam));
            RETURN full_z - (maxdeg + 1)::text;
          WHEN 'pointing' THEN
            RETURN species_z_pointing(species_z_walk(sp, rec.children[1], maxdeg, yval, kparam));
          WHEN 'restrict_size' THEN
            IF kparam IS NULL THEN RAISE EXCEPTION 'species_z_walk: restrict_size needs kparam (pass k)'; END IF;
            RETURN species_z_restrict_exact(species_z_walk(sp, rec.children[1], maxdeg, yval, kparam), kparam);
          WHEN 'functor_compose' THEN
            RAISE EXCEPTION 'species_z_walk: functor_compose has no honest cycle-index formula yet (#274 follow-up)';
          ELSE
            RAISE EXCEPTION 'species_z_walk: unhandled op %', rec.op;
        END CASE;
    END CASE;
  END $$;

-- Picard iteration on the Z side: every Y is X-guarded (or ∘-guarded), so maxdeg+1 substitutions from Y = 0 fix
-- degrees 0..maxdeg exactly — the Z twin of species_solve. Parses `body` once (if it has no nodes yet) and walks
-- the SAME tree every iteration, rather than re-parsing text on each Picard step.
CREATE FUNCTION species_z_fixpoint(body text, maxdeg int DEFAULT 8) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
  DECLARE y jsonb := z_zero(maxdeg); i int; root int;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM base_species_node WHERE species = body) THEN PERFORM species_parse(body); END IF;
    SELECT node INTO root FROM base_species_node WHERE species = body ORDER BY node DESC LIMIT 1;
    FOR i IN 0..maxdeg LOOP y := species_z_walk(body, root, maxdeg, y, NULL); END LOOP;
    RETURN y;
  END $$;

-- Z-walker entry point (#274 F2): ensure `expr` has parsed nodes (species_parse on first use — an expr already
-- parsed at load time by THIS FILE's own DISTINCT-expr pass below takes the read-only path; an ad-hoc expr, e.g.
-- an example's 'C′', parses here on its first call), find its root, and walk it. Replaces species_kernel.sql's old
-- duplicated text scanner — species_parse_node above already mirrors the same precedence, so re-scanning text
-- there just re-derived the same tree species_parse already builds. VOLATILE, not IMMUTABLE/STABLE: the
-- parse-on-miss branch INSERTs into base_species_node, which an immutable/stable marking would misrepresent.
CREATE FUNCTION species_z_eval(expr text, maxdeg int DEFAULT 8, yval jsonb DEFAULT NULL, kparam int DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
  DECLARE root int;
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM base_species_node WHERE species = expr) THEN PERFORM species_parse(expr); END IF;
    SELECT node INTO root FROM base_species_node WHERE species = expr ORDER BY node DESC LIMIT 1;
    RETURN species_z_walk(expr, root, maxdeg, yval, kparam);
  END $$;

-- inverse of species_parse: walk the tree back to text, adding parens only where species_node_rank says the
-- child binds looser than its parent (the same asymmetry the parser's fixed scan order creates). The LEFT
-- operand only needs parens when it binds strictly looser (child_rank < parent_rank) — the parse is left-
-- associative, so an equal-rank left child reads correctly bare (a+b-c == (a+b)-c already). The RIGHT operand
-- additionally needs parens at EQUAL rank when the parent op is non-associative/non-commutative (difference,
-- divide) — a-b+c and a-(b+c) parse to different trees, so the equal-rank right child must be wrapped to
-- round-trip; product/compose/etc. are associative enough that a bare equal-rank right child is unambiguous
-- (E∘C∘Y, X·E∘Y stay unparenthesised — #274 F1).
CREATE FUNCTION species_print_node(sp text, nid int) RETURNS text LANGUAGE plpgsql STABLE AS $$
  DECLARE rec base_species_node%ROWTYPE; rank int; sym text; l text; r text; rrank int;
  BEGIN
    SELECT * INTO rec FROM base_species_node WHERE species = sp AND node = nid;
    CASE rec.kind
      WHEN 'atom'  THEN RETURN rec.atom;
      WHEN 'param' THEN RETURN rec.param;
      WHEN 'self'  THEN RETURN 'Y';
      WHEN 'lit'   THEN RETURN trunc(rec.lit)::bigint::text;
      WHEN 'op' THEN
        IF rec.op IN ('derivative', 'pointing') THEN   -- postfix, arity 1: no right operand
          rank := species_node_rank(sp, nid);
          sym := (SELECT symbol FROM base_species_op WHERE id = rec.op);
          l := species_print_node(sp, rec.children[1]);
          IF species_node_rank(sp, rec.children[1]) < rank THEN l := '(' || l || ')'; END IF;
          RETURN l || sym;
        END IF;
        rank := species_node_rank(sp, nid);
        sym := (SELECT symbol FROM base_species_op WHERE id = rec.op);
        l := species_print_node(sp, rec.children[1]);
        IF species_node_rank(sp, rec.children[1]) < rank THEN l := '(' || l || ')'; END IF;
        r := species_print_node(sp, rec.children[2]);
        rrank := species_node_rank(sp, rec.children[2]);
        IF rrank < rank OR (rrank = rank AND rec.op IN ('difference')) THEN r := '(' || r || ')'; END IF;
        RETURN l || sym || r;
    END CASE;
  END $$;

CREATE FUNCTION species_print(sp text) RETURNS text LANGUAGE plpgsql STABLE AS $$
  DECLARE root int;
  BEGIN
    SELECT node INTO root FROM base_species_node WHERE species = sp ORDER BY node DESC LIMIT 1;
    IF root IS NULL THEN RETURN NULL; END IF;
    RETURN species_print_node(sp, root);
  END $$;

-- tree-isomorphism check (#274 F1): two parsed species agree iff every node pairs up same kind/op/atom/
-- param/lit with pairwise-equal children — a structural differential, not a name-excluded text compare.
-- na/nb default to each species' root (species_print's own root pick: the last-inserted node).
CREATE FUNCTION species_tree_equal(sp_a text, sp_b text, na int DEFAULT NULL, nb int DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
  DECLARE a base_species_node%ROWTYPE; b base_species_node%ROWTYPE; ida int; idb int; i int;
  BEGIN
    ida := na; idb := nb;
    IF ida IS NULL THEN SELECT node INTO ida FROM base_species_node WHERE species = sp_a ORDER BY node DESC LIMIT 1; END IF;
    IF idb IS NULL THEN SELECT node INTO idb FROM base_species_node WHERE species = sp_b ORDER BY node DESC LIMIT 1; END IF;
    IF ida IS NULL OR idb IS NULL THEN RETURN ida IS NULL AND idb IS NULL; END IF;

    SELECT * INTO a FROM base_species_node WHERE species = sp_a AND node = ida;
    SELECT * INTO b FROM base_species_node WHERE species = sp_b AND node = idb;
    IF a.kind IS DISTINCT FROM b.kind THEN RETURN false; END IF;
    CASE a.kind
      WHEN 'atom'  THEN RETURN a.atom  IS NOT DISTINCT FROM b.atom;
      WHEN 'param' THEN RETURN a.param IS NOT DISTINCT FROM b.param;
      WHEN 'self'  THEN RETURN true;
      WHEN 'lit'   THEN RETURN a.lit   IS NOT DISTINCT FROM b.lit;
      WHEN 'op' THEN
        IF a.op IS DISTINCT FROM b.op THEN RETURN false; END IF;
        IF coalesce(array_length(a.children, 1), 0) IS DISTINCT FROM coalesce(array_length(b.children, 1), 0) THEN RETURN false; END IF;
        FOR i IN 1..coalesce(array_length(a.children, 1), 0) LOOP
          IF NOT species_tree_equal(sp_a, sp_b, a.children[i], b.children[i]) THEN RETURN false; END IF;
        END LOOP;
        RETURN true;
    END CASE;
  END $$;

-- materialise every distinct species identity's expr. Read base_species_def (the identity table, core, complete at
-- this point), NOT the base_species compat view — pack collections' readings load AFTER this file, so their exprs
-- aren't in the view yet; base_species_def already carries every expr any pack binds (#274 × #283).
SELECT species_parse(expr) FROM (SELECT DISTINCT expr FROM base_species_def) s;

-- canonical identity (#274 F1): print∘parse is NOT a byte-identical fixed point for every expr — a few rows carry
-- human-added parens the grammar never required (associativity already fixes the shape without them), so
-- species_print reconstructs the MINIMAL text for the same tree:
--   surjections_onto_k        '(E+)^k'   → 'E+^k'    (paren around a bare atom before ^ is redundant)
--   endofunctions              'E∘(C∘Y)'  → 'E∘C∘Y'   (∘ is already right-nested by the first-match scan)
--   rooted_unlabeled_trees     'X·(E∘Y)'  → 'X·E∘Y'   (∘ binds tighter than · in print rank, so the paren is redundant)
-- `canonical` is that minimal spelling, filled here AFTER the parse above so it's derived from the real tree —
-- id/expr stay the original human-typed text (the stable FK packs/constructions bind to). The UNIQUE constraint
-- means two spellings of one species now collide at load time instead of silently drifting apart; none of the
-- three rows above collide with an existing id (verified by hand — 'E+^k'/'E∘C∘Y'/'X·E∘Y' aren't ids), so no
-- rebinding was needed.
ALTER TABLE base_species_def ADD COLUMN canonical text;
UPDATE base_species_def SET canonical = species_print(expr);
ALTER TABLE base_species_def ADD CONSTRAINT base_species_def_canonical_key UNIQUE (canonical);

-- parse the canonical text into its OWN node set (keyed by the canonical string — for the fixed-point rows this
-- reparses the same key the expr already used, which is idempotent; for the 3 rows above it's a genuinely new
-- scratch key) and compare it to the id's own parse by TREE STRUCTURE, not text — a real differential, no
-- name exclusions. Scratch nodes are left in base_species_node keyed by their canonical text (harmless: nothing
-- else looks them up by that key, and species_parse/species_print stay well-defined for it going forward).
CREATE FUNCTION species_canonical_check(sp_id text) RETURNS boolean LANGUAGE plpgsql AS $$
  DECLARE canon text;
  BEGIN
    SELECT canonical INTO canon FROM base_species_def WHERE id = sp_id;
    PERFORM species_parse(canon);
    RETURN species_print(canon) = canon AND species_tree_equal(sp_id, canon);
  END $$;

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species_registry','op/atom registry floors: >=9 ops, >=6 atoms, every real species op (no stub/virtual note) has a cycle_index_fn','eq','true','the registry isn''t empty; every op without a note (stubs/virtual excluded) carries a live kernel ref',$q$
    SELECT (
      (SELECT count(*) FROM base_species_op WHERE note IS NULL) >= 9 AND
      (SELECT count(*) FROM base_species_atom) >= 6 AND
      (SELECT bool_and(cycle_index_fn IS NOT NULL) FROM base_species_op WHERE note IS NULL)
    )::text $q$),
  ('species_registry','canonical text is a species_print fixed point AND tree-isomorphic to its id''s own parse, for EVERY def','eq','true','species_parse(canonical) + species_tree_equal(id, canonical) — structural round-trip, no name exclusions',$q$
    SELECT bool_and(species_canonical_check(id))::text FROM base_species_def $q$);
