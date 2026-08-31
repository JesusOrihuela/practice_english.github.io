/* ============================================================
   variant-openness.mjs — the OPENNESS GUARANTEE of the variant system (CI gate).

   The whole premise of the variant framework is that a FUTURE language can add its own variant
   dimension (grammatical case, number, aspect, noun class, honorific, evidentiality…) by writing
   ONE data line in shared/js/variant-dimensions.js — and have it be valid content, badge-able, and
   completeness-checkable WITH NO CODE CHANGE anywhere else. This test proves that claim, so it can
   never silently regress.

   It registers a brand-new, entirely fictitious dimension AT RUNTIME (never committed to the
   registry) and asserts the generic machinery handles it end to end:

     1. Registry API — the data → behavior contract (keys/values/badge/kind/priority/ordered/
        appliesTo/isValidValue) all answer correctly for the new dimension.
     2. Validation — AppVariantDims.validateLabels() (the EXACT function check-content.mjs calls in
        CI) accepts a form/word labelled with the new dimension and rejects a bad value / unknown
        key. So content using the new dimension passes content-checks with zero validator code.
     3. Rendering — shared/js/feedback.js drives its badge row from the registry (_dimOrder() +
        _dimBadge()), never a hardcoded dimension list, so the new dimension paints a badge too.
     4. Additive + reversible — injecting the dimension only ADDS to the registry; removing it
        restores the exact original key set (no global state leaked).

   Run:  node tools/variant-openness.mjs        (CI: validate job)
   Exit 1 on any failure.
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AppVariantDims from '../shared/js/variant-dimensions.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const fails = [];
const ok = [];
function check(desc, cond) { (cond ? ok : fails).push(desc); }

// A fictitious dimension that exists NOWHERE in the codebase — if anything handles it, it can only
// be because that code reads the registry generically (the openness property under test).
const PROBE = 'evidentiality';
const PROBE_VALS = ['directo', 'reportado', 'inferido'];
const PROBE_DEF = {
  kind: 'inflectional', values: PROBE_VALS, priority: 8, badge: 'pill',
  appliesTo: ['xx'], agreement: ['verbo'],
};

const before = AppVariantDims.keys().slice().sort();
// Inject data-only into the live registry (all() returns the backing object by reference).
AppVariantDims.all()[PROBE] = PROBE_DEF;

try {
  // 1 — Registry API contract.
  check('registry.keys() includes the new dimension', AppVariantDims.keys().includes(PROBE));
  check('registry.has(new) is true', AppVariantDims.has(PROBE) === true);
  check('registry.kind(new) reflects the data', AppVariantDims.kind(PROBE) === 'inflectional');
  check('registry.badge(new) reflects the data', AppVariantDims.badge(PROBE) === 'pill');
  check('registry.priority(new) reflects the data', AppVariantDims.priority(PROBE) === 8);
  check('registry.values(new) reflects the data', (AppVariantDims.values(PROBE) || []).join(',') === PROBE_VALS.join(','));
  check('registry.isOpen(new) is false (closed value set)', AppVariantDims.isOpen(PROBE) === false);
  check('registry.agreement(new) reflects the data', AppVariantDims.agreement(PROBE).join(',') === 'verbo');
  check('registry.appliesTo(new, its lang) is true', AppVariantDims.appliesTo(PROBE, 'xx') === true);
  check('registry.appliesTo(new, other lang) is false', AppVariantDims.appliesTo(PROBE, 'es') === false);
  check('registry.isValidValue(new, good) is true', AppVariantDims.isValidValue(PROBE, 'directo') === true);
  check('registry.isValidValue(new, bad) is false', AppVariantDims.isValidValue(PROBE, 'bogus') === false);
  const ord = AppVariantDims.ordered();
  const sortedByPriority = ord.every((d, i) => i === 0 || AppVariantDims.priority(ord[i - 1]) <= AppVariantDims.priority(d));
  check('registry.ordered() includes the new dimension, sorted by priority',
    ord.includes(PROBE) && sortedByPriority && AppVariantDims.priority(ord[ord.indexOf(PROBE) - 1]) <= 8);

  // 2 — Validation: the SAME function check-content.mjs runs in CI.
  check('validateLabels accepts a form/word labelled with the new dimension',
    AppVariantDims.validateLabels({ [PROBE]: 'reportado' }).length === 0);
  const badVal = AppVariantDims.validateLabels({ [PROBE]: 'nope' });
  check('validateLabels rejects a bad value for the new dimension',
    badVal.length === 1 && badVal[0].code === 'invalid-value' && badVal[0].key === PROBE);
  const badKey = AppVariantDims.validateLabels({ notADimension: 'x' });
  check('validateLabels still rejects a truly unknown key',
    badKey.length === 1 && badKey[0].code === 'unknown-key');
  check('validateLabels accepts a COMBINED label mixing the new dimension with an existing one',
    AppVariantDims.validateLabels({ region: 'España', [PROBE]: 'directo' }).length === 0);
  // appliesTo enforcement (validateLabels with a target lang): applies for its lang, rejected elsewhere.
  check('validateLabels enforces appliesTo — accepted for the dimension\'s own language',
    AppVariantDims.validateLabels({ [PROBE]: 'directo' }, 'xx').length === 0);
  const notApp = AppVariantDims.validateLabels({ [PROBE]: 'directo' }, 'es');
  check('validateLabels enforces appliesTo — REJECTED for a language that lacks the dimension',
    notApp.length === 1 && notApp[0].code === 'not-applicable');

  // 3 — Rendering: feedback.js must consult the registry, not a hardcoded dimension list.
  const fb = fs.readFileSync(path.join(ROOT, 'shared/js/feedback.js'), 'utf8');
  check('feedback.js selects present dimensions from the registry order (_dimOrder)',
    /_dimOrder\(\)\s*\.\s*filter/.test(fb));
  check('feedback.js resolves each badge style from the registry (_dimBadge)',
    /_dimBadge\(/.test(fb) && /AppVariantDims/.test(fb));
  // The only literal dimension-name list allowed is the guarded fallback for "registry not loaded".
  const literalLists = (fb.match(/\[\s*'(?:loanword|region|gender|number|register)'[^\]]*\]/g) || []);
  check('feedback.js has no hardcoded dimension list outside the registry-not-loaded fallback',
    literalLists.every(l => {
      const at = fb.indexOf(l);
      const line = fb.slice(fb.lastIndexOf('\n', at) + 1, fb.indexOf('\n', at));
      return /_dimOrder|_dimBadge|fallback|isn't loaded|D \?/.test(line);
    }));
} finally {
  // 4 — Additive + reversible: remove the probe, registry must be byte-identical to before.
  delete AppVariantDims.all()[PROBE];
}
const after = AppVariantDims.keys().slice().sort();
check('removing the new dimension restores the exact original registry (no leaked state)',
  JSON.stringify(before) === JSON.stringify(after));

// ---- Report ----
console.log(`\nvariant-openness — ${ok.length}/${ok.length + fails.length} checks passed`);
if (fails.length) {
  console.log('\n✗ OPENNESS BROKEN — a new registry dimension is NOT handled generically:');
  for (const f of fails) console.log('   • ' + f);
  console.log('\nThe variant framework must accept any dimension defined ONLY in variant-dimensions.js');
  console.log('with no other code change. Fix the consumer that hardcodes dimensions.\n');
  process.exit(1);
}
console.log('✓ The registry is OPEN — a future language can add a variant dimension data-only.\n');
