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

-- OGF sequence operators (rational-recurrence / figurate / infinite-product exprs use these) — not species
-- operations; registered so species_parse can build a tree for the 22 rational rows base_species.sql carries
-- today. Re-filed onto real species ops in #274 B3.
INSERT INTO base_species_op (id, symbol, arity, cycle_index_fn, note) VALUES
  ('difference',       '-', 2, 'species_z_sum',   'OGF sequence operator, not a species op (re-filed in #274 B3)'),
  ('divide',           '/', 2, 'ogf_inv',         'OGF sequence operator, not a species op (re-filed in #274 B3)'),
  ('infinite_product', '∏', 1, 'ogf_product',     'OGF sequence operator, not a species op (re-filed in #274 B3)');

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
CREATE FUNCTION species_node_rank(sp text, nid int) RETURNS int LANGUAGE plpgsql STABLE AS $$
  DECLARE k text; o text;
  BEGIN
    SELECT kind, op INTO k, o FROM base_species_node WHERE species = sp AND node = nid;
    IF k IS DISTINCT FROM 'op' THEN RETURN 999; END IF;
    RETURN CASE o
      WHEN 'sum' THEN 1 WHEN 'difference' THEN 1
      WHEN 'product' THEN 2 WHEN 'divide' THEN 2
      WHEN 'compose' THEN 3 WHEN 'functor_compose' THEN 3 WHEN 'cartesian' THEN 3   -- ×/@@ ranks unreachable today (no scan branch emits them); if B4 adds a scan stage, revisit its tightness vs ∘
      WHEN 'power' THEN 4
      ELSE 5 END;
  END $$;

-- recursive-descent parser, MIRRORING species_eval/ogf_eval's precedence exactly: strip enclosing parens →
-- leading ∏ (infinite_product, prefix) → additive (LAST top-level +/-, left-assoc; '+' after 'E' is the E+
-- atom, not an operator) → multiplicative (FIRST top-level · or /) → composition (FIRST top-level ∘) →
-- power (top-level ^; exponent is 'k' or an integer literal) → leaf (Y → self; digits → lit; bare 'k' →
-- param; else → atom, which also covers E_k / E_<m>). Inserts bottom-up (children before parent), returns
-- the new node's id — the LAST id inserted for a species is always its root (single top-level call per parse).
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

    IF left(e, 1) = '∏' THEN
      leftid := species_parse_node(species, substring(e FROM 2));
      myid := nextval('species_node_seq');
      INSERT INTO base_species_node (species, node, kind, op, children) VALUES (species, myid, 'op', 'infinite_product', ARRAY[leftid]);
      RETURN myid;
    END IF;

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
      ELSIF depth = 0 AND (ch = '·' OR ch = '/') THEN
        leftid := species_parse_node(species, left(e, i - 1));
        rightid := species_parse_node(species, substring(e FROM i + 1));
        myid := nextval('species_node_seq');
        INSERT INTO base_species_node (species, node, kind, op, children) VALUES
          (species, myid, 'op', CASE ch WHEN '·' THEN 'product' ELSE 'divide' END, ARRAY[leftid, rightid]);
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

    e := btrim(e);
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

-- inverse of species_parse: walk the tree back to text, adding parens only where species_node_rank says the
-- child binds looser than its parent (the same asymmetry the parser's fixed scan order creates).
CREATE FUNCTION species_print_node(sp text, nid int) RETURNS text LANGUAGE plpgsql STABLE AS $$
  DECLARE rec base_species_node%ROWTYPE; rank int; sym text; l text; r text;
  BEGIN
    SELECT * INTO rec FROM base_species_node WHERE species = sp AND node = nid;
    CASE rec.kind
      WHEN 'atom'  THEN RETURN rec.atom;
      WHEN 'param' THEN RETURN rec.param;
      WHEN 'self'  THEN RETURN 'Y';
      WHEN 'lit'   THEN RETURN trunc(rec.lit)::bigint::text;
      WHEN 'op' THEN
        IF rec.op = 'infinite_product' THEN RETURN '∏' || species_print_node(sp, rec.children[1]); END IF;
        rank := species_node_rank(sp, nid);
        sym := (SELECT symbol FROM base_species_op WHERE id = rec.op);
        l := species_print_node(sp, rec.children[1]);
        IF species_node_rank(sp, rec.children[1]) < rank THEN l := '(' || l || ')'; END IF;
        r := species_print_node(sp, rec.children[2]);
        IF species_node_rank(sp, rec.children[2]) < rank THEN r := '(' || r || ')'; END IF;
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

-- materialise every distinct species identity's expr. Read base_species_def (the identity table, core, complete at
-- this point), NOT the base_species compat view — pack collections' readings load AFTER this file, so their exprs
-- aren't in the view yet; base_species_def already carries every expr any pack binds (#274 × #283).
SELECT species_parse(expr) FROM (SELECT DISTINCT expr FROM base_species_def) s;

-- print∘parse is NOT a fixed point for every expr: a few rows carry human-added parens the grammar never required
-- (associativity already fixes the shape without them) — species_print reconstructs the MINIMAL text for the same
-- tree, which is semantically identical but not byte-identical. Confirmed cases (#274 B5: distinct_partitions'
-- '∏(1+X^k)' left this registry — it's re-filed to base_generating_function, no longer a species expr — but
-- rooted_unlabeled_trees' isotype binding brought 'X·(E∘Y)' into the expr set for the first time):
--   surjections_onto_k        '(E+)^k'   → prints 'E+^k'    (paren around a bare atom before ^ is redundant)
--   endofunctions              'E∘(C∘Y)'  → prints 'E∘C∘Y'   (∘ is already right-nested by the first-match scan)
--   rooted_unlabeled_trees     'X·(E∘Y)'  → prints 'X·E∘Y'   (∘ binds tighter than · in print rank, so the paren is redundant)
-- These three are excluded from the differential below by name, not papered over.
INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('species_registry','op/atom registry floors: >=10 ops, >=6 atoms, every real species op has a cycle_index_fn','eq','true','the registry isn''t empty and every non-OGF-note op carries a live kernel ref',$q$
    SELECT (
      (SELECT count(*) FROM base_species_op) >= 10 AND
      (SELECT count(*) FROM base_species_atom) >= 6 AND
      (SELECT bool_and(cycle_index_fn IS NOT NULL) FROM base_species_op WHERE note IS NULL)
    )::text $q$),
  ('species_registry','print∘parse is a fixed point for every expr except the 3 with redundant human parens','eq','true','species_parse/species_print round-trip differential, scoped past the confirmed non-issues',$q$
    SELECT bool_and(species_print(expr) IS NOT DISTINCT FROM expr)::text   -- IS NOT DISTINCT: a NULL print must FAIL, not vanish from bool_and
      FROM (SELECT DISTINCT expr FROM base_species_def
             WHERE expr NOT IN ('(E+)^k', 'E∘(C∘Y)', 'X·(E∘Y)')) s $q$);
