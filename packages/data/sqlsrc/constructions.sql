-- requires: realizer, base_species
-- requires-tag: collection
-- The PARAMETERIZED-COLLECTIONS model as data (issue #22 / wiki "Parameterized-Collections"). A construction is a
-- functor with type-parameter HOLES (finset α, words α, …); each concrete collection INSTANTIATES one and binds its α.
-- Three layers, once conflated in a single `alpha` string, are now separated so each is queryable on its own:
--   1. TYPE-FORMER  (base_type_former)      — a function into a universe: `Fin : ℕ → Type` (arity 1), `ℕ : Type` (0).
--   2. CONSTRUCTION (base_construction)      — a former applied over α: `Finset α`, `α*`, `∀ i, π i`.
--   3. ENUMERATION  (base_type_former_enumeration) — the collection that materializes a former's inhabitants as rows.
-- base_alpha records each collection's binding (which construction, which former fills α, with what param, on which
-- grade axis). base_collection_construction is a VIEW over it that reconstructs the fused `alpha` expression + the
-- downstream enumeration link (its shape is unchanged, so the client + carrier_containment + traits read it as before).

-- base_grade names are unique per collection by convention; make it a real constraint so `alpha_axis` can be a true FK
-- into it. Safe here: requires-tag:collection means every collection file (hence every base_grade insert) ran first.
ALTER TABLE base_grade ADD CONSTRAINT base_grade_collection_name_key UNIQUE (collection, name);

-- ── the α-KIND lattice (issue #22 Q1) ──────────────────────────────────────────────────────────────────────────
-- What may FILL an α-hole is a CONSTRAINT (a typeclass bundle), and real bounds are CONJUNCTIONS: boolean_algebra
-- needs Fintype+DecidableEq ON TOP OF finset's DecidableEq. So kinds form an implies-closed poset (like base_tag), not
-- a flat label — `finite` sits above `decidable_eq`, so any α good for boolean_algebra is automatically good for finset.
-- A flat model is just this with the identity closure, so starting minimal boxes nothing out (Dean 2026-08-30).
CREATE TABLE base_kind (id text PRIMARY KEY, title text NOT NULL, description text NOT NULL);
INSERT INTO base_kind (id, title, description) VALUES
  ('decidable_eq', 'DecidableEq', 'equality on inhabitants is decidable — the floor a set/word construction needs to compare & dedup letters'),
  ('fintype',      'Fintype',     'finitely many inhabitants, enumerable as a finset'),
  ('finite',       'Finite',      'Fintype ∧ DecidableEq — a finite ground with decidable equality (what a lattice/complement needs)'),
  ('countable',    'Countable',   'inhabitants enumerable in an ω-sequence (ℕ): DecidableEq, but NOT Fintype'),
  ('nonempty',     'Nonempty',    'the species G has no empty structure (G[∅] = ∅, G_0 = 0) — what ∘ (composition) requires of its inner species'),
  ('x_guarded',    'X-guarded',   'a fixpoint body is guarded by an X factor (each self-reference costs ≥1 atom) — what makes the recursive equation''s Picard iteration converge');
-- kind ⇒ a capability it entails (a CONJUNCT it contains). `finite` is the meet of fintype & decidable_eq.
CREATE TABLE base_kind_implies (kind text NOT NULL REFERENCES base_kind, implies text NOT NULL REFERENCES base_kind,
                                PRIMARY KEY (kind, implies));
INSERT INTO base_kind_implies (kind, implies) VALUES
  ('finite', 'fintype'), ('finite', 'decidable_eq'),   -- finite = Fintype ∧ DecidableEq
  ('countable', 'decidable_eq');                        -- ℕ has decidable equality, but is not a Fintype
-- reflexive-transitive closure: `kind` SATISFIES `implies` (kind ⊒ implies).
CREATE VIEW base_kind_closure AS
  WITH RECURSIVE c(kind, implies) AS (
    SELECT id, id FROM base_kind
    UNION
    SELECT c.kind, i.implies FROM c JOIN base_kind_implies i ON i.kind = c.implies)
  SELECT DISTINCT kind, implies FROM c;
-- does a type of kind `has` meet a requirement of kind `needs`? (the binding-validity oracle)
CREATE FUNCTION kind_satisfies(has text, needs text) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM base_kind_closure WHERE kind = has AND implies = needs) $$;

-- ── layer 1: type-formers ──────────────────────────────────────────────────────────────────────────────────────
-- The α PRIMITIVE is a type-former, not a bare int and not a size-grade. Its Nat param (Fin's `·`) is what a grade
-- axis binds to (Dean 2026-08-27); arity 0 (ℕ) has none. `produces_kind` is the constraint its output type satisfies.
CREATE TABLE base_type_former (
  id            text PRIMARY KEY,                         -- 'Fin', 'ℕ'
  arity         int  NOT NULL,                            -- Fin: 1 (ℕ→Type); ℕ: 0 (already a Type)
  produces_kind text NOT NULL REFERENCES base_kind,       -- the kind an inhabited output type has
  skeleton      text NOT NULL,                            -- 'Fin ·', 'ℕ'
  mathlib       text,                                     -- the mathlib name (borrow its facts)
  description   text NOT NULL
);
INSERT INTO base_type_former (id, arity, produces_kind, skeleton, mathlib, description) VALUES
  ('Fin', 1, 'finite',    'Fin ·', 'Fin', 'the finite ground [·] = {0,…,·−1}; a Nat-indexed finite type'),
  ('ℕ',   0, 'countable', 'ℕ',     'Nat', 'the countable ground ℕ — no Nat parameter (arity 0)'),
  -- a COLLECTION is a type-former too: its fiber at bound axes is a finite type with decidable equality, so it can fill
  -- a hole — the factors of a product, the base of a Σ. Arity = its grade count; its enumeration is itself.
  ('permutations',  1, 'finite', 'permutations ·',   'Equiv.Perm (Fin ·)', 'the permutations of [·] as a type — Sₙ'),
  ('words',         2, 'finite', 'words · ·',        'Fin · → Fin ·',      'words of length · over · letters — the maps Fin m → Fin n');
-- (motzkin_paths' type_former + enumeration rows moved to packs/paths/constructions.paths.sql, together — its
-- enumeration row REFERENCES base_collection, so it would FK-fail loading core alone; the type_former row travels
-- with it for cohesion even though it has no FK of its own, #283 phase 3)

-- ── layer 3: a former's inhabitants, materialized as one of our collections (the alphabet as a pickable set) ──────
-- A DOWNSTREAM UI link, keyed on the former (Fin's inhabitants are [n], enumerated by finite_set_elements; ℕ's are the
-- naturals) — NOT α's identity (α ITSELF is the type Fin n, not the collection that lists its inhabitants).
CREATE TABLE base_type_former_enumeration (
  type_former text PRIMARY KEY REFERENCES base_type_former,
  enumeration text NOT NULL REFERENCES base_collection
);
INSERT INTO base_type_former_enumeration (type_former, enumeration) VALUES
  ('Fin', 'finite_set_elements'),
  ('ℕ',   'natural_numbers'),
  ('permutations',  'permutations'),   -- a collection-former enumerates itself
  ('words',         'words');

-- ── layer 2: constructions (the functor skeletons) ─────────────────────────────────────────────────────────────
-- `requires_kind` is the constraint a construction imposes on its α. `dependent` distinguishes a UNIFORM hole (one α
-- for every position: List α, Finset α) from a POSITION-INDEXED family (∀ i, π i — mixed radix), whose α is not one
-- type but a family, so its binding's `param` is an expression in the position index (issue #22 Q2, Dean 2026-08-30).
-- `from_name` is the construction's FROM surface in the query view — plural + `_of`, since applying a construction
-- PRODUCES A COLLECTION (its element carrier stays singular and fixed: finset / word / map). `finsets_of(fin(4))`
-- resolves to the realized instance (subsets(4)); the client reads this column, nothing is hardcoded there.
-- `cardinality_expr` is the ALGEBRAIC (ADT) cardinality over the params' cardinalities c1, c2, … — `2 ^ c1` for the
-- powerset, `c2 ^ c1` for α → β. A SPEC/ORACLE above each instance's hand-written fiber_count (construction_cardinality
-- below; the differential example at the end), never its replacement; symbolic where not evaluable (∏ᵢ |πᵢ|).
CREATE TABLE base_construction (
  id text PRIMARY KEY, title text NOT NULL, params text[] NOT NULL DEFAULT '{}',
  skeleton text NOT NULL, mathlib text, description text NOT NULL,
  requires_kind text REFERENCES base_kind,               -- the kind the (first / only) α must satisfy — per-position in base_construction_param
  dependent boolean NOT NULL DEFAULT false,              -- true = the α-hole is a position-indexed family (∀ i, π i)
  from_name text UNIQUE,                                 -- the query view's FROM spelling: plural + _of (NULL = not FROM-able)
  cardinality_expr text,                                 -- |instance| in terms of c1, c2, … = the params' cardinalities
  species text REFERENCES base_species_def(id)           -- #274 B6: the species identity this construction realizes, IF one exists as a
                                                          -- stored expr (base_species_def is keyed by expr text, not by operator name —
                                                          -- product/sum/etc are OPERATORS, not whole exprs, so no base_construction row
                                                          -- currently has a matching id; left NULL rather than inventing a def row)
);
INSERT INTO base_construction (id, title, params, skeleton, mathlib, description, requires_kind, dependent, from_name, cardinality_expr) VALUES
  ('finset',          'Finite set',      '{α}',   'Finset α',            'Finset',         'finite sets of DISTINCT elements drawn from α (repetition-free)', 'decidable_eq', false, 'finsets_of',          '2 ^ c1'),
  ('multiset',        'Multiset',        '{α}',   'Multiset α',          'Multiset',       'finite bags (repetition allowed) of elements from α',            'decidable_eq', false, 'multisets_of',        'binomial(c1 + k - 1, k)'),   -- k-multisets over α: multichoose; k is the instance''s grade axis
  ('words',           'Words',           '{α}',   'α* (List α)',         'List.Vector',    'sequences — ordered, with repetition — over ONE alphabet α (List α; a fixed-length word is the map Fin n → α, see maps)', 'decidable_eq', false, 'words_of', NULL),
  ('dependent_words',       'Dependent words', '{π}',   '∀ i, π i',            'Pi',             'mixed-radix words: place i draws from its OWN finite type π i (a per-position radix) — the factorial-base family; α is a FAMILY, not one type', 'decidable_eq', true, NULL, '∏ᵢ |πᵢ|'),
  ('boolean_algebra', 'Boolean algebra', '{α}',   '𝔹(α) = 2^α lattice',  'BooleanAlgebra', 'the powerset of a FINITE α as an order/lattice (∨ ∧ ¬ ⊤ ⊥)',      'finite',       false, 'boolean_algebras_of', '2 ^ c1'),
  ('maps',            'Maps',            '{α,β}', 'α → β',               'Function',       'all functions from a finite α to β — |β|^|α|; words of length |α| over |β| letters ARE these maps, and the diagonal β = α is the endofunctions', 'fintype', false, 'maps_of', 'c2 ^ c1'),
  -- the remaining rungs of the ADT rig: product, sum, and the dependent sum Σ (the value-indexed sibling of Pi = dependent_words)
  ('product',         'Product',         '{α,β}', 'α × β',               'Prod',           'pairs — a structure of α carrying a structure of β; the wreath product ℤ_k ≀ Sₙ is a permutation × a colouring word; |α|·|β|', 'fintype', false, 'products_of', 'c1 * c2'),
  ('sum',             'Sum',             '{α,β}', 'α ⊕ β',               'Sum',            'a tagged disjoint union — either an α or a β; |α|+|β|. No catalog instance yet: the unions here are grade-range unfolds (fibers), which the query view already reads as GROUP BY', 'fintype', false, 'sums_of', 'c1 + c2'),
  ('sigma',           'Dependent sum',   '{α,β}', 'Σ (a : α), β a',      'Sigma',          'dependent pairs — an a : α together with a structure whose TYPE depends on a (a Motzkin path with a colour on each of ITS level steps); |Σ| = Σₐ |β a|, not a product of the params'' sizes', 'fintype', true, NULL, 'Σₐ |β a|');

-- ── per-position params: a construction is a list of typed holes, each with its own kind requirement ─────────────
-- `params`/`requires_kind`/`dependent` above are the one-hole summary (kept for the readers that grew up on them);
-- this table is the per-position truth the multi-param constructions need (maps: α fintype, β decidable_eq).
CREATE TABLE base_construction_param (
  construction  text NOT NULL REFERENCES base_construction,
  pos           int  NOT NULL,
  name          text NOT NULL,                           -- α, β, π — the conventional letter, rarely typed (bindings are positional)
  requires_kind text NOT NULL REFERENCES base_kind,
  dependent     boolean NOT NULL DEFAULT false,          -- this hole is a position-indexed family (∀ i, π i)
  PRIMARY KEY (construction, pos), UNIQUE (construction, name)
);
INSERT INTO base_construction_param (construction, pos, name, requires_kind, dependent) VALUES
  ('finset',          1, 'α', 'decidable_eq', false),
  ('multiset',        1, 'α', 'decidable_eq', false),
  ('words',           1, 'α', 'decidable_eq', false),
  ('dependent_words',       1, 'π', 'decidable_eq', true),
  ('boolean_algebra', 1, 'α', 'finite',       false),
  ('maps',            1, 'α', 'fintype',      false),    -- the domain must be enumerable for the maps to be
  ('maps',            2, 'β', 'decidable_eq', false),    -- the codomain only needs comparable inhabitants
  ('product',         1, 'α', 'fintype',      false),
  ('product',         2, 'β', 'fintype',      false),
  ('sum',             1, 'α', 'fintype',      false),
  ('sum',             2, 'β', 'fintype',      false),
  ('sigma',           1, 'α', 'fintype',      false),
  ('sigma',           2, 'β', 'fintype',      true);     -- β a: the second hole is a family indexed by the VALUE a

-- ── each collection's α-binding (was base_collection_construction's stored columns) ──────────────────────────────
-- `param` is the former's Nat arg: a constant ('2'), a bound axis name ('n','b'), a per-position expression for a
-- dependent construction ('n - i' — lehmer's declining radix), or NULL (arity-0 ℕ). `alpha_axis` is the grade axis
-- the param binds to (NULL = fixed alphabet or ungraded ℕ); it is now a real FK into base_grade. `generic` = the param
-- is a HOLE left to range (a fixed alphabet, binary_words, pins it).
-- One row per (collection, position): a multi-param construction binds each hole separately. `generic` marks a hole
-- left to RANGE as the alphabet/codomain (words' base) — a domain bound to the length axis is an ordinary grade binding,
-- not a generic hole, so a concrete instance (binary_words, endofunctions) stays NOT generic at every position.
CREATE TABLE base_alpha (
  collection   text NOT NULL REFERENCES base_collection,
  construction text NOT NULL REFERENCES base_construction,
  pos          int  NOT NULL DEFAULT 1,
  type_former  text NOT NULL REFERENCES base_type_former,
  param        text,
  alpha_axis   text,
  generic      boolean NOT NULL DEFAULT false,
  restricted   text,                                             -- NULL = the WHOLE application; else the sub-family it keeps ('surjective', 'injective')
  note         text,
  PRIMARY KEY (collection, pos),
  FOREIGN KEY (construction, pos) REFERENCES base_construction_param (construction, pos),
  FOREIGN KEY (collection, alpha_axis) REFERENCES base_grade (collection, name)   -- MATCH SIMPLE: skipped when alpha_axis NULL
);
-- (lehmer_codes/endofunctions/k_colored_permutations/signed_permutations bindings moved to
-- packs/permutations-plus/constructions.permutations-plus.sql — base_alpha.collection REFERENCES base_collection,
-- so a permutations-plus row here would FK-fail when loading core alone, #283 phase 3)
INSERT INTO base_alpha (collection, construction, pos, type_former, param, alpha_axis, generic, note) VALUES
  ('subsets',         'finset',          1, 'Fin', 'n',     'n',    false, 'α = Fin n (inhabitants enumerated by finite_set_elements); Nat param n = the size axis; 2ⁿ'),
  ('finsets',         'finset',          1, 'ℕ',   NULL,    NULL,   false, 'α = ℕ — the whole countable ground, no Nat param; ≅ ℕ'),
  ('k_subsets',       'finset',          1, 'Fin', 'n',     'n',    false, 'the size-k slice of subsets; α = Fin n, n at axis n; C(n,k)'),
  ('boolean_algebra', 'boolean_algebra', 1, 'Fin', 'n',     'n',    false, 'the 2^[n] lattice; α = Fin n (finite, as the lattice needs), n at axis n'),
  ('multisets',       'multiset',        1, 'Fin', 'n',     'n',    false, 'k-multisets over [n]; α = Fin n, n at the ground axis (size is the k axis); multichoose'),
  -- the maps family α → β: a word of length m over n letters IS a map [m] → [n]
  ('words',           'maps',            1, 'Fin', 'size',  'size', false, 'domain Fin size — the word''s length, an ordinary grade binding'),
  ('words',           'maps',            2, 'Fin', 'b',     'base', true,  'codomain Fin b — the alphabet; its Nat b binds THIS collection''s `base` axis (a HOLE ⇒ generic); bⁿ'),
  ('binary_words',    'maps',            1, 'Fin', 'n',     'n',    false, 'domain Fin n — the length'),
  ('binary_words',    'maps',            2, 'Fin', '2',     NULL,   false, 'codomain Fin 2 (alphabet {0,1}); type-param FIXED, no ranging axis; 2ⁿ'),
  ('signed_subsets',  'maps',            1, 'Fin', 'n',     'n',    false, 'domain Fin n — the axes'),
  ('signed_subsets',  'maps',            2, 'Fin', '3',     NULL,   false, 'codomain Fin 3 = {absent, +, −}: a signed subset IS this function; 3ⁿ (equally Σ over subsets S of maps(S, Fin 2))');
-- (colored_motzkin_paths' dependent-sum row moved to packs/paths/constructions.paths.sql — it also names the
-- 'motzkin_paths' type_former as its first hole, another pack-only row, #283 phase 3)
-- RESTRICTED applications: a sub-family of a construction's output that keeps its own carrier (the type-model page's
-- bespoke-carrier + inclusion-map case). Recorded on the binding so the construction graph is complete — a bare
-- maps_of(fin(n), fin(k)) still resolves to the WHOLE application (words), never to a restricted instance, and the
-- ADT cardinality formula does not apply (the oracle abstains); the containment is proven by the examples below.
-- (surjections_onto_k/arrangements moved to the pack, same FK reason)
-- a binding's kind must satisfy its position's requirement — the lattice as a constraint, checked by the example below

-- base_collection_construction — the queryable join: reconstructs the fused α expression + the downstream enumeration
-- link, so existing readers (client core.ts, carrier_containment, traits) see the columns they always did. Also exposes
-- the normalized `type_former`/`param` for new consumers.
-- a binding's fused type expression at one position: 'Fin n', 'ℕ', 'Fin (n - i)' (a family)
CREATE FUNCTION alpha_type_text(a base_alpha) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE WHEN tf.arity = 0 THEN tf.id
              WHEN e.enumeration = tf.id THEN tf.id || '(' || a.param || ')'      -- a collection-former: permutations(size), words(size, 2)
              WHEN p.dependent  THEN tf.id || ' (' || a.param || ')'
              ELSE tf.id || ' ' || a.param END
    FROM base_type_former tf JOIN base_construction_param p ON p.construction = a.construction AND p.pos = a.pos
    LEFT JOIN base_type_former_enumeration e ON e.type_former = tf.id
   WHERE tf.id = a.type_former $$;
-- the construction's skeleton with every hole filled by its binding: 'Finset (Fin n)', 'Fin size → Fin b', '∀ i, Fin (n - i)'
CREATE FUNCTION construction_signature(coll text) RETURNS text LANGUAGE plpgsql STABLE AS $$
DECLARE sig text; a base_alpha; p base_construction_param; t text;
BEGIN
  SELECT k.skeleton INTO sig FROM base_alpha x JOIN base_construction k ON k.id = x.construction WHERE x.collection = coll LIMIT 1;
  IF sig IS NULL THEN RETURN NULL; END IF;
  FOR a IN SELECT * FROM base_alpha WHERE collection = coll ORDER BY pos DESC LOOP
    SELECT * INTO p FROM base_construction_param WHERE construction = a.construction AND pos = a.pos;
    t := alpha_type_text(a);
    IF p.dependent THEN sig := replace(sig, p.name || ' i', t);
    ELSE
      -- a multi-word type gets parens only as an application ARGUMENT ('Finset α' → 'Finset (Fin n)'), not as an
      -- operand ('α → β' → 'Fin n → Fin 2')
      IF t LIKE '% %' AND sig ~ ('[A-Za-z𝔹(]\s*' || p.name) THEN sig := regexp_replace(sig, '([A-Za-z𝔹(]\s*)' || p.name, '\1(' || t || ')', 'g'); END IF;
      sig := replace(sig, p.name, t);
    END IF;
  END LOOP;
  RETURN sig;
END $$;

-- ONE row per collection (the readers — the client, carrier_containment, traits — rely on that). The single-valued
-- columns (alpha / alpha_axis / generic / param / type_former) describe the LAST position — the construction's
-- α-proper, the alphabet/codomain a concrete instance pins — so a one-hole binding reads exactly as before and words'
-- α is still 'Fin b' at axis base. `generic` is true if ANY position is a hole. `signature` and `arity` are new.
CREATE VIEW base_collection_construction AS
  SELECT a.collection, a.construction,
         alpha_type_text(a)                            AS alpha,
         e.enumeration                                AS alpha_collection,
         a.alpha_axis,
         (SELECT bool_or(g.generic) FROM base_alpha g WHERE g.collection = a.collection) AS generic,
         a.note, a.type_former, a.param, a.restricted,
         construction_signature(a.collection)         AS signature,
         (SELECT count(*)::int FROM base_alpha g WHERE g.collection = a.collection)    AS arity
    FROM base_alpha a
    LEFT JOIN base_type_former_enumeration e ON e.type_former = a.type_former
   WHERE a.pos = (SELECT max(pos) FROM base_alpha m WHERE m.collection = a.collection);

-- ── the ADT cardinality as an oracle ──────────────────────────────────────────────────────────────────────────
-- construction_cardinality(fiber): evaluate the instance's construction cardinality_expr on this fiber — c<pos> = the
-- cardinality of the type bound at that position (Fin p → p, with p read off the fiber's axes; ℕ → ∞). NULL when the
-- expression is symbolic (∏ᵢ |πᵢ|), a param is a dependent family, or the collection has no binding. It is a SPEC the
-- hand-written fiber_count must agree with on PRIMARY instances (grade chain = exactly the bound axes) — the example
-- at the end is that differential; a refined instance (k_subsets: an extra k axis) is not compared.
CREATE FUNCTION construction_cardinality(f anyelement) RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE coll text := substring(pg_typeof(f)::text FROM '^(.*)_fiber$');
        expr text; a record; vals jsonb := to_jsonb(f); names text[]; s text; c numeric; i int; out numeric;
BEGIN
  IF coll IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM base_alpha x WHERE x.collection = coll AND x.restricted IS NOT NULL) THEN RETURN NULL; END IF;   -- a sub-family: the formula is the whole application's
  SELECT k.cardinality_expr INTO expr FROM base_alpha x JOIN base_construction k ON k.id = x.construction WHERE x.collection = coll LIMIT 1;
  IF expr IS NULL THEN RETURN NULL; END IF;
  SELECT array_agg(name ORDER BY pos) INTO names FROM base_grade WHERE collection = coll;
  FOR a IN SELECT x.pos, x.type_former, x.param, x.alpha_axis, p.dependent FROM base_alpha x JOIN base_construction_param p
             ON p.construction = x.construction AND p.pos = x.pos WHERE x.collection = coll ORDER BY x.pos DESC LOOP
    IF a.dependent THEN RETURN NULL; END IF;
    IF a.type_former = 'ℕ' THEN c := 'infinity'::numeric;
    ELSIF EXISTS (SELECT 1 FROM base_type_former_enumeration en WHERE en.type_former = a.type_former AND en.enumeration = a.type_former) THEN
      -- a collection-former: |coll(args)| with the args (expressions in this fiber's axes) evaluated positionally
      s := a.param;
      IF names IS NOT NULL THEN
        FOR i IN 1..array_length(names, 1) LOOP s := regexp_replace(s, '\m' || names[i] || '\M', coalesce(vals ->> names[i], 'NULL'), 'g'); END LOOP;
      END IF;
      BEGIN EXECUTE format('SELECT cardinality(%I(%s))', a.type_former, s) INTO c; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
    ELSIF a.alpha_axis IS NOT NULL THEN c := (vals ->> a.alpha_axis)::numeric;   -- bound to an axis: read the fiber (the param text is the Nat SYMBOL, e.g. words' b)
    ELSE
      s := a.param;                                                  -- a constant, or an expression in axes
      IF names IS NOT NULL THEN
        FOR i IN 1..array_length(names, 1) LOOP s := regexp_replace(s, '\m' || names[i] || '\M', coalesce(vals ->> names[i], 'NULL'), 'g'); END LOOP;
      END IF;
      BEGIN EXECUTE 'SELECT (' || s || ')::numeric' INTO c; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;
    END IF;
    expr := replace(expr, 'c' || a.pos, CASE WHEN c = 'infinity'::numeric THEN '(''infinity''::numeric)' ELSE '(' || trim_scale(c)::text || ')' END);   -- bare number: int functions (binomial) resolve
  END LOOP;
  IF names IS NOT NULL THEN                                            -- the expression may read the fiber's own axes (multiset's k)
    FOR i IN 1..array_length(names, 1) LOOP expr := regexp_replace(expr, '\m' || names[i] || '\M', coalesce(vals ->> names[i], 'NULL'), 'g'); END LOOP;
  END IF;
  BEGIN EXECUTE 'SELECT (' || expr || ')::numeric' INTO out; EXCEPTION WHEN OTHERS THEN RETURN NULL; END;   -- symbolic (∏ᵢ |πᵢ|) ⇒ NULL
  RETURN out;
END $$;
-- a PRIMARY instance: every grade axis is bound by some param (nothing refines the construction's own fibration)
CREATE VIEW base_construction_primary AS
  SELECT DISTINCT a.collection FROM base_alpha a JOIN base_construction k ON k.id = a.construction
   WHERE a.restricted IS NULL
     AND NOT EXISTS (SELECT 1 FROM base_grade g WHERE g.collection = a.collection
                       AND NOT EXISTS (SELECT 1 FROM base_alpha b WHERE b.collection = a.collection AND b.alpha_axis = g.name)
                       AND NOT (coalesce(k.cardinality_expr, '') ~ ('\m' || g.name || '\M')));   -- an axis the expression reads counts as bound

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('constructions','finset α''s concrete instantiations include at least finsets/k_subsets/subsets (one construction, many α; a floor — more may join)','eq','true','the parameterized model as data',$q$
    SELECT (array_agg(collection) @> ARRAY['finsets','k_subsets','subsets'])::text FROM base_collection_construction WHERE construction = 'finset' $q$),
  ('constructions','words is GENERIC (α = Fin b, b a hole); binary_words fills it at 2','eq','false|true','generic ⇔ a type-parameter ranges',$q$
    SELECT (SELECT generic FROM base_collection_construction WHERE collection = 'binary_words')::text || '|' ||
           (SELECT generic FROM base_collection_construction WHERE collection = 'words')::text $q$),
  ('constructions','every construction carries a mathlib alignment (borrow its facts)','eq','true','Finset / Multiset / List.Vector / Pi / BooleanAlgebra / Function / Prod / Sum / Sigma — a floor, more may join',$q$
    SELECT (count(*) >= 9 AND count(*) = count(mathlib))::text FROM base_construction $q$),
  ('constructions','the mold in one row: subsets and finsets share the finset construction at different α','eq','finset:Fin n|finset:ℕ','the finset α unification, as data',$q$
    SELECT (SELECT construction || ':' || alpha FROM base_collection_construction WHERE collection='subsets') || '|' ||
           (SELECT construction || ':' || alpha FROM base_collection_construction WHERE collection='finsets') $q$),
  ('constructions','α''s inhabitants are enumerated by a collection (the alphabet as a pickable set): finite_set_elements','eq','finite_set_elements','the downstream α→enumeration link (α ITSELF is the type Fin n)',$q$
    SELECT DISTINCT alpha_collection FROM base_collection_construction WHERE construction IN ('finset','multiset') AND alpha_collection <> 'natural_numbers' $q$),
  ('constructions','the type-former''s Nat param binds one of THIS collection''s axes: words→base, multisets→n','eq','multisets:n words:base','α = Fin ⟨param⟩; the param is a grade axis of the collection',$q$
    SELECT string_agg(collection || ':' || alpha_axis, ' ' ORDER BY collection) FROM base_collection_construction WHERE collection IN ('words','multisets') $q$),
  ('constructions','a fixed alphabet has NO ranging axis; a generic hole does: binary_words(NULL) vs words(base)','eq','binary_words: words:base','fixed type-param vs a hole left to range',$q$
    SELECT string_agg(collection || ':' || coalesce(alpha_axis,''), ' ' ORDER BY collection) FROM base_collection_construction WHERE collection IN ('binary_words','words') $q$),

  -- layer separation + the type-former registry (issue #22)
  ('constructions','the α PRIMITIVES are type-formers with an arity: Fin (ℕ→Type) 1, ℕ (Type) 0 (collection-formers join them)','eq','Fin:1 ℕ:0','layer 1 — the former, not a bare int',$q$
    SELECT string_agg(id || ':' || arity, ' ' ORDER BY arity DESC) FROM base_type_former WHERE id IN ('Fin', 'ℕ') $q$),
  ('constructions','a primitive former''s inhabitants materialize as a collection: Fin→finite_set_elements, ℕ→natural_numbers','eq','Fin:finite_set_elements ℕ:natural_numbers','layer 3 — the enumeration link, keyed on the former',$q$
    SELECT string_agg(type_former || ':' || enumeration, ' ' ORDER BY type_former) FROM base_type_former_enumeration WHERE type_former IN ('Fin', 'ℕ') $q$),
  ('constructions','alpha_axis is now a real FK: every binding''s axis names a grade of its own collection','eq','0','base_grade UNIQUE(collection,name) enables the FK',$q$
    SELECT count(*)::text FROM base_alpha a WHERE a.alpha_axis IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM base_grade g WHERE g.collection=a.collection AND g.name=a.alpha_axis) $q$),

  -- the α-KIND lattice (Q1)
  ('constructions','kind lattice: finite ⊒ decidable_eq AND finite ⊒ fintype (the conjunction), but countable ⋡ finite','eq','t|t|f','a poset, not a flat label',$q$
    SELECT left(kind_satisfies('finite','decidable_eq')::text,1)||'|'||left(kind_satisfies('finite','fintype')::text,1)||'|'||left(kind_satisfies('countable','finite')::text,1) $q$),
  ('constructions','boolean_algebra''s requirement sits ON TOP OF finset''s: its α (finite) also satisfies finset (decidable_eq), not vice versa','eq','true|false','the "Fintype+DecidableEq on top of DecidableEq" relation, as data',$q$
    SELECT kind_satisfies('finite','decidable_eq')::text || '|' || kind_satisfies('countable','finite')::text $q$),
  ('constructions','every binding is VALID: at every position, the former''s produced kind satisfies that hole''s required kind','eq','0','the lattice as a binding oracle — zero violations',$q$
    SELECT count(*)::text FROM base_alpha a
      JOIN base_type_former tf ON tf.id = a.type_former
      JOIN base_construction_param p ON p.construction = a.construction AND p.pos = a.pos
      WHERE NOT kind_satisfies(tf.produces_kind, p.requires_kind) $q$),
  ('constructions','ℕ (countable) CANNOT fill boolean_algebra (needs finite): no infinite powerset lattice','eq','false','the lattice rejects an unsound binding',$q$
    SELECT kind_satisfies((SELECT produces_kind FROM base_type_former WHERE id='ℕ'),
                          (SELECT requires_kind FROM base_construction WHERE id='boolean_algebra'))::text $q$),

  -- the dependent (mixed-radix) construction (Q2)
  ('constructions','the DEPENDENT constructions: dependent_words (Π — a per-position family ∀ i, π i) and sigma (Σ — a value-indexed second type); every uniform-hole construction is not','eq','true|false','value-indexed vs type-indexed holes, as data',$q$
    SELECT ((SELECT array_agg(id) FROM base_construction WHERE dependent) @> ARRAY['dependent_words','sigma'])::text || '|' ||
           EXISTS (SELECT 1 FROM base_construction WHERE dependent AND id IN ('finset','maps','product','sum'))::text $q$),
  -- (the lehmer_codes-instantiates-dependent_words example moved to the pack, same FK reason)
  ('constructions','the view reconstructs the fused α expression unchanged for uniform bindings (regression guard)','eq','Fin n|ℕ|Fin 2','former+param → the old alpha string',$q$
    SELECT (SELECT alpha FROM base_collection_construction WHERE collection='subsets') || '|' ||
           (SELECT alpha FROM base_collection_construction WHERE collection='finsets') || '|' ||
           (SELECT alpha FROM base_collection_construction WHERE collection='binary_words') $q$),

  -- multi-param constructions (the maps family) + the per-position tables
  ('constructions','the one-hole summary on base_construction agrees with the per-position params table','eq','0','params = array_agg(name ORDER BY pos); requires_kind = position 1''s',$q$
    SELECT count(*)::text FROM base_construction k
     WHERE k.params <> (SELECT array_agg(name ORDER BY pos) FROM base_construction_param p WHERE p.construction = k.id)
        OR k.requires_kind IS DISTINCT FROM (SELECT requires_kind FROM base_construction_param p WHERE p.construction = k.id AND p.pos = 1) $q$),
  ('constructions','maps α → β is a TWO-hole construction; words and binary_words instantiate it (a floor)','eq','true','the maps family, as data (endofunctions'' instance moved to packs/permutations-plus/constructions.permutations-plus.sql)',$q$
    SELECT ((SELECT count(*) FROM base_construction_param WHERE construction='maps') = 2
        AND (SELECT array_agg(DISTINCT collection) FROM base_alpha WHERE construction='maps') @> ARRAY['words','binary_words'])::text $q$),
  ('constructions','the view is still ONE row per collection, with the multi-hole signature spelled out','eq','Fin size → Fin b|Fin n → Fin 2|Finset (Fin n)','signature = skeleton with every hole filled (endofunctions/lehmer_codes rows moved to the pack)',$q$
    SELECT string_agg(signature, '|' ORDER BY o) FROM (VALUES ('words',1),('binary_words',2),('subsets',3)) v(c,o)
      JOIN base_collection_construction b ON b.collection = v.c $q$),
  ('constructions','a construction''s FROM spelling is plural + _of (the query view''s surface); unique where present','eq','true','from_name as data — nothing hardcoded in the client',$q$
    SELECT ((SELECT from_name FROM base_construction WHERE id='finset') = 'finsets_of'
        AND (SELECT from_name FROM base_construction WHERE id='maps') = 'maps_of'
        AND (SELECT count(*) FROM base_construction WHERE from_name IS NOT NULL) = (SELECT count(DISTINCT from_name) FROM base_construction WHERE from_name IS NOT NULL))::text $q$),
  ('constructions','PRIMARY instances (grade chain = the bound axes, or axes the cardinality expression reads) include subsets/finsets/words/binary_words/multisets; k_subsets is a refinement','eq','true|false|true','base_construction_primary (endofunctions'' membership checked in the pack)',$q$
    SELECT ((SELECT array_agg(collection) FROM base_construction_primary) @> ARRAY['subsets','finsets','words','binary_words','boolean_algebra'])::text || '|' ||
           EXISTS (SELECT 1 FROM base_construction_primary WHERE collection='k_subsets')::text || '|' ||
           EXISTS (SELECT 1 FROM base_construction_primary WHERE collection='multisets')::text $q$),

  -- the ADT rig's remaining rungs: product (a collection-former fills each hole), sum (no instance), sigma (dependent)
  -- floor >= 2 (was >= 3, permutations/words/motzkin_paths): motzkin_paths' own type_former + enumeration rows
  -- moved to packs/paths/constructions.paths.sql (#283 phase 3), so core alone sees only permutations + words;
  -- the full profile still registers 3+ once the pack reloads it.
  ('constructions','a collection is a type-former: permutations / words (+ pack collections) enumerate themselves and can fill a hole','eq','true','arity = grade count; enumeration = itself',$q$
    SELECT (bool_and(e.enumeration = tf.id) AND count(*) >= 2)::text FROM base_type_former tf JOIN base_type_former_enumeration e ON e.type_former = tf.id
     WHERE tf.id IN (SELECT id FROM base_collection) $q$),
  -- (the wreath-product/product-oracle examples for k_colored_permutations/signed_permutations moved to
  -- packs/permutations-plus/constructions.permutations-plus.sql, same reason as their base_alpha bindings)
  ('constructions','a signed subset is the map [n] → {absent, +, −}: maps(Fin n, Fin 3), 3ⁿ — the oracle agrees','eq','true','the Σ over subsets of sign words collapses to one exponential',$q$
    SELECT bool_and(construction_cardinality(f) = cardinality(f) AND cardinality(f) = 3 ^ (f).n)::text FROM fibers(signed_subsets(0, 5)) f $q$),
  -- (the colored_motzkin_paths dependent-sum example moved to packs/paths/constructions.paths.sql, same reason
  -- as its base_alpha rows)
  ('constructions','sum (α ⊕ β) is registered with no instance: the catalog''s unions are grade-range unfolds','eq','0','a known gap, as data',$q$
    SELECT count(*)::text FROM base_alpha WHERE construction = 'sum' $q$),
  -- (the surjections_onto_k/arrangements restricted-application examples moved to the pack, same FK reason)
  -- the ADT cardinality oracle: |β|^|α| / 2^|α| evaluated on a fiber == the hand-written fiber_count, on primary instances
  ('constructions','construction_cardinality == cardinality on every primary instance''s small fibers: 2^n (subsets, boolean_algebra, binary_words), base^size (words), C(n+k-1,k) (multisets)','eq','true','the ADT cardinality as a self-cert differential over fiber_count (endofunctions'' n^n check moved to the pack)',$q$
    SELECT ((SELECT bool_and(construction_cardinality(f) = cardinality(f)) FROM fibers(subsets(0, 5)) f)
        AND (SELECT bool_and(construction_cardinality(f) = cardinality(f)) FROM fibers(boolean_algebra(0, 4)) f)
        AND (SELECT bool_and(construction_cardinality(f) = cardinality(f)) FROM fibers(binary_words(0, 6)) f)
        AND (SELECT bool_and(construction_cardinality(f) = cardinality(f)) FROM fibers(words(4)) f)
        AND (SELECT bool_and(construction_cardinality(f) = cardinality(f)) FROM fibers(words(3)) f)
        AND (SELECT bool_and(construction_cardinality(f) = cardinality(f)) FROM fibers(ROW(natural_range(3, 3, '[]'), natural_range(0, 4, '[]'))::multisets) f))::text   -- multisets: C(3+k-1, k) = 1 3 6 10 15
    $q$),   -- multisets: C(3+k-1, k) = 1 3 6 10 15
  ('constructions','the oracle reads ℕ as ∞: finsets'' construction cardinality is 2^ℵ₀ = Infinity, matching its cardinality','eq','Infinity|Infinity','an infinite type stays symbolic-infinite, off the enumeration path',$q$
    SELECT construction_cardinality(ROW(true)::finsets_fiber)::text || '|' || cardinality(finsets())::text $q$),
  ('constructions','the oracle abstains where the expression is symbolic or the instance is refined: k_subsets (C(n,k) ≠ 2^n)','eq','true','NULL, not a wrong number (lehmer_codes'' abstention check moved to the pack)',$q$
    SELECT (construction_cardinality(ROW(4,2)::k_subsets_fiber) = 16 AND cardinality(ROW(4,2)::k_subsets_fiber) = 6
        AND NOT EXISTS (SELECT 1 FROM base_construction_primary WHERE collection = 'k_subsets'))::text $q$);
