-- requires: realizer, arithmetic, rational_numbers
-- The ALGEBRAIC-STRUCTURE lattice + operation registry. Categories (Sage-style) model the "extra operations" a TYPE
-- carries: a type belongs to structures (magma → … → field; poset → well-order), each structure INTRODUCES operations
-- (a magma a binary op, a monoid an identity, a ring the two-op axioms), inherited down `parents`; a type then binds
-- each operation to its concrete impl function. This is the "one identity, many roles" idea for operations — the impl
-- is one function, referenced through its structural role — and it's what a per-ring expression evaluator reads.

-- ── the operation vocabulary ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE base_operation (id text PRIMARY KEY, symbol text NOT NULL, arity int NOT NULL, title text NOT NULL);
INSERT INTO base_operation VALUES
  ('op','∘',2,'a binary operation'), ('id','e',0,'identity'), ('inverse','⁻¹',1,'inverse'),
  ('add','+',2,'addition'), ('zero','0',0,'additive identity'), ('neg','−',1,'negation'),
  ('mul','·',2,'multiplication'), ('one','1',0,'multiplicative identity'), ('recip','⁻¹',1,'multiplicative inverse'),
  ('le','≤',2,'order'),
  ('join','∪',2,'join (least upper bound)'), ('meet','∩',2,'meet (greatest lower bound)'),
  ('complement','ᶜ',1,'complement'), ('top','⊤',0,'top element'), ('bottom','⊥',0,'bottom element');

-- ── the structure lattice ────────────────────────────────────────────────────────────────────────────────
-- parents = the structures this one refines (implication, closed at read time); operations = the ops it INTRODUCES
-- (beyond its parents'); axioms = the laws it adds. A type in `field` is-a everything up to `set`.
CREATE TABLE base_structure (id text PRIMARY KEY, title text NOT NULL, description text NOT NULL,
                             parents text[] NOT NULL DEFAULT '{}', operations text[] NOT NULL DEFAULT '{}',
                             axioms text[] NOT NULL DEFAULT '{}');
INSERT INTO base_structure (id, title, description, parents, operations, axioms) VALUES
  ('set','Set','A bare set — no operations.','{}','{}','{}'),
  ('magma','Magma','A set with one closed binary operation.','{set}','{op}','{closed}'),
  ('semigroup','Semigroup','An associative magma.','{magma}','{}','{associative}'),
  ('monoid','Monoid','A semigroup with an identity element.','{semigroup}','{id}','{identity}'),
  ('commutative_monoid','Commutative monoid','A monoid whose operation commutes.','{monoid}','{}','{commutative}'),
  ('group','Group','A monoid where every element has an inverse.','{monoid}','{inverse}','{inverses}'),
  ('abelian_group','Abelian group','A commutative group.','{group,commutative_monoid}','{}','{}'),
  ('semiring','Semiring (rig)','Two ops: a commutative-monoid + (0) and a monoid · (1), · distributing over +.',
      '{commutative_monoid}','{add,zero,mul,one}','{distributive,zero_annihilates}'),
  ('commutative_semiring','Commutative semiring','A semiring whose · commutes.','{semiring}','{}','{mul_commutative}'),
  ('ring','Ring','A semiring whose + is a group (additive inverses).','{semiring}','{neg}','{additive_inverses}'),
  ('commutative_ring','Commutative ring','A commutative semiring that is a ring.','{ring,commutative_semiring}','{}','{}'),
  ('field','Field','A commutative ring where every nonzero element has a · inverse.','{commutative_ring}','{recip}','{multiplicative_inverses}'),
  ('poset','Poset','A set with a reflexive, antisymmetric, transitive order.','{set}','{le}','{reflexive,antisymmetric,transitive}'),
  ('total_order','Totally ordered set','A poset in which any two elements compare.','{poset}','{}','{total}'),
  ('well_order','Well-ordered set','A total order with no infinite descending chain (every nonempty subset has a least element).','{total_order}','{}','{well_founded}'),
  ('lattice','Lattice','A poset with all binary joins (∪) and meets (∩).','{poset}','{join,meet}','{absorption}'),
  ('distributive_lattice','Distributive lattice','A lattice where ∪ distributes over ∩ (and conversely).','{lattice}','{}','{distributive}'),
  ('boolean_algebra','Boolean algebra','A bounded distributive lattice with a complement (⊤, ⊥, ᶜ) — De Morgan holds.','{distributive_lattice}','{complement,top,bottom}','{complemented,bounded}');

-- a structure and ALL its ancestors (parents closed transitively)
CREATE VIEW base_structure_closure AS
  WITH RECURSIVE up(id, anc) AS (
    SELECT id, id FROM base_structure
    UNION
    SELECT u.id, p FROM up u JOIN base_structure s ON s.id = u.anc, unnest(s.parents) p)
  SELECT id AS structure, anc AS is_a FROM up;

-- ── a TYPE's structure memberships (multi) + its concrete operation impls ─────────────────────────────────
CREATE TABLE base_type_structure (type text NOT NULL, structure text NOT NULL REFERENCES base_structure,
                                  PRIMARY KEY (type, structure));
INSERT INTO base_type_structure VALUES
  ('natural_number','commutative_semiring'), ('natural_number','well_order'),
  ('integer_number','commutative_ring'),     ('integer_number','total_order'),
  ('cardinal','commutative_semiring'),       ('cardinal','well_order'),         -- ℕ ∪ {ℵ₀}: a rig, well-ordered
  ('omega_ordinal','semiring'),                    ('omega_ordinal','well_order'),          -- non-commutative +/·; well-ordered
  ('rational_number','field'),               ('rational_number','total_order');
-- (modular_residue is a commutative ring per modulus — registered in modular_residues.sql, where its carrier carries m.)

-- op → impl function for a type. impl_fn is a SQL function of the op's arity (NULL ⇒ the op is a pg built-in on the
-- base type, use `symbol`); the operators are also defined so `a symbol b` works directly.
CREATE TABLE base_type_operation (type text NOT NULL, op text NOT NULL REFERENCES base_operation,
                                  symbol text NOT NULL, impl_fn text, PRIMARY KEY (type, op));
INSERT INTO base_type_operation (type, op, symbol, impl_fn) VALUES
  ('natural_number','add','+',NULL), ('natural_number','mul','·',NULL),
  ('integer_number','add','+',NULL), ('integer_number','mul','·',NULL), ('integer_number','neg','−',NULL),
  ('cardinal','add','+','cardinal_add'), ('cardinal','mul','·','cardinal_mul'),
  ('omega_ordinal','add','+','ordinal_add'),   ('omega_ordinal','mul','·','ordinal_mul'),
  ('rational_number','add','+','rational_add'), ('rational_number','mul','·','rational_mul'),
  ('rational_number','neg','−','rational_neg'), ('rational_number','recip','⁻¹','reciprocal'),
  ('natural_number','le','≤',NULL), ('integer_number','le','≤',NULL), ('cardinal','le','≤',NULL),
  ('omega_ordinal','le','≤','ordinal_le'), ('rational_number','le','≤','rational_le');

INSERT INTO base_example (suite, title, kind, expected, description, sql) VALUES
  ('algebra','the structure lattice: field is-a commutative_ring, ring, semiring, … set','eq','commutative_ring,commutative_semiring,magma,monoid,ring,semigroup,semiring,set',NULL,$q$
    SELECT string_agg(is_a, ',' ORDER BY is_a) FROM base_structure_closure WHERE structure = 'field' AND is_a <> 'field' AND is_a <> 'commutative_monoid' $q$),
  ('algebra','rational_number IS a field (so a commutative ring, etc.)','eq','true','type ↦ structure, closed over parents',$q$
    SELECT EXISTS(SELECT 1 FROM base_type_structure ts JOIN base_structure_closure c ON c.structure = ts.structure
                  WHERE ts.type = 'rational_number' AND c.is_a = 'commutative_ring')::text $q$),
  ('algebra','cardinal is a commutative_semiring but NOT a ring (no additive inverses)','eq','true|false',NULL,$q$
    SELECT EXISTS(SELECT 1 FROM base_type_structure WHERE type='cardinal' AND structure='commutative_semiring')::text || '|' ||
           EXISTS(SELECT 1 FROM base_type_structure ts JOIN base_structure_closure c ON c.structure=ts.structure
                  WHERE ts.type='cardinal' AND c.is_a='ring')::text $q$),
  ('algebra','omega_ordinal is a (non-commutative) semiring, NOT a commutative_semiring','eq','false',NULL,$q$
    SELECT EXISTS(SELECT 1 FROM base_type_structure ts JOIN base_structure_closure c ON c.structure=ts.structure
                  WHERE ts.type='omega_ordinal' AND c.is_a='commutative_semiring')::text $q$),
  ('algebra','the registry knows at least rational_number''s + ≤ · − ⁻¹ (a floor — more ops may be added)','eq','true','what a UI evaluator reads',$q$
    SELECT (array_agg(symbol) @> ARRAY['+','≤','·','−','⁻¹'])::text FROM base_type_operation WHERE type = 'rational_number' $q$),
  ('algebra','and evaluates in that ring: 1/2 + 1/3 = 5/6 (field arithmetic via the bound impl)','eq','5/6','the operation is real',$q$
    SELECT notation(rational_number(1,2) + rational_number(1,3)) $q$);
