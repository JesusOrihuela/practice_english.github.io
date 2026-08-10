/* ============================================================
   grammar-topics.mjs — derive each grammar rule's `topics` field from
   ACTUAL phrase evidence, so the premise holds: a rule is tagged with a
   topic only if that topic has phrases exercising the structure.

   For each rule a detector matches the target-language structure in the
   phrases; the rule's topics become the topics with the most matches
   (≥ MIN_HITS, top MAX_TOPICS). Rules whose structure appears in no phrase
   get an empty list (correctly → n/a in the Exercise Summary).

   Usage:
     node tools/grammar-topics.mjs --check         # report drift, exit 1 if any
     node tools/grammar-topics.mjs --write          # rewrite grammar-rules.json
     node tools/grammar-topics.mjs --pair en-es ... # limit to one pair
   ============================================================ */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const WRITE = args.includes('--write');
const ONLY_PAIR = args.includes('--pair') ? args[args.indexOf('--pair') + 1] : null;
const MIN_HITS = 2;      // a topic needs ≥ this many matching phrases to be tagged
const MAX_TOPICS = Infinity; // no cap: tag EVERY topic whose phrases exercise it (the premise)

// ── Detectors keyed by rule id. Each tests one phrase's target text. Patterns
//    use unambiguous lexical markers to avoid false positives. Rules without a
//    detector keep their curated tags (listed in CURATED). ────────────────────
// Unicode-aware word boundaries (JS \b is ASCII-only, so it breaks on accented
// endings like "será"/"estará"). Use lookarounds over the Spanish letter set.
const BL = '(?<![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])';
const BR = '(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])';
const wl = (...forms) => new RegExp(BL + '(?:' + forms.join('|') + ')' + BR, 'i');
const ub = (body) => new RegExp(BL + '(?:' + body + ')' + BR, 'i');

const DETECT = {
  'en-es': {
    ser_identity: /\b(soy|eres|es|somos|son) (mi |un |una |el |la )?(estudiante|profesor|profesora|m[eé]dico|periodista|cient[ií]fic|experto|socio|escritor|pintor|poeta|detective|m[uú]sico|gu[ií]a|vecino|due[ñn]o|de [A-ZÁÉÍÓÚ])/i,
    ser_time_events: /\b(son las|es la una|es mediod[ií]a|es medianoche|es (lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)|el evento es)\b/i,
    estar_location_states: /\b(estoy|est[aá]s|est[aá]|estamos|est[aá]n)\b/i,
    present_ar_verbs: wl('hablo','hablas','habla','trabajo','trabaja','estudio','estudia','compro','compra','llego','llega','llevo','lleva','tomo','toma','cocino','descanso','descansa','camino','amo','ama','necesito','necesita','pago','paga','desayuno','cena','cenamos','uso','usa'),
    present_er_ir_verbs: wl('como','comes','come','bebo','bebe','leo','lee','corro','corre','vivo','vive','escribo','escribe','abre','duermo','duerme','prefiero','prefiere','entiendo','entiende','aprendo','aprende','veo','hago','hace','salgo','sale'),
    gender_nouns_articles: null,
    gender_adjective_agreement: null,
    preterite_regular: ub('\\w+(aste|aron|ieron)|\\w{2,}[bcdfghjklmnpqrstvz]ó'),
    preterite_irregular: wl('fui','fue','fueron','tuve','tuvo','hice','hizo','dije','dijo','vino','vine','estuve','estuvo','pude','pudo','puso','quiso','supe','dio','di','trajo','vio'),
    imperfect_habits_descriptions: /\b\w+(aba|abas|[aá]bamos|aban)\b/i,
    imperfect_vs_preterite: /\b\w+(aba|aban)\b/i,
    subjunctive_present_wishes: /\b(quiero que|espero que|ojal[aá]|deseo que|necesito que|prefiero que|dile que|pide que)\b/i,
    reflexive_verbs_daily_routine: /\b(me|te|se|nos) (levanto|levanta|levantas|ducho|ducha|acuesto|acuesta|despierto|despierta|visto|viste|lavo|lava|ba[ñn]o|peino|prepara)\b|\b(levantar|acostar|duchar|vestir|lavar|despertar)se\b/i,
    reflexive_verbs_emotions: /\b(me|te|se) (siento|siente|alegro|alegra|preocupo|preocupa|enoja|enojo|aburro|asusta|molesta|pone|puse)\b/i,
    por_cause_means_duration: /\bpor (la ma[ñn]ana|la tarde|la noche|internet|aqu[ií]|favor|eso|ciento|[a-z]+ (a[ñn]os|d[ií]as|horas|meses)|correo|tel[eé]fono|whatsapp)\b/i,
    para_purpose_destination: /\bpara (que|el|la|los|las|mi|ti|comprar|hacer|ir|el (tren|vuelo|autob[uú]s)|dos personas|llevar)\b/i,
    direct_object_pronouns: /\b\w+(arlo|arla|erlo|erla|irlo|irla|[aá]ndolo|[aá]ndola|[eé]ndolo)\b|\b(lo|la|los|las) (quiero|quieres|compro|compra|veo|necesito|tengo|puedo|voy a|debo|hago)\b/i,
    indirect_object_pronouns: /\b(le|les|te|me|nos) (doy|da|das|digo|dice|dices|env[ií]o|env[ií]a|prometo|traigo|explico|mando|paso|presto|regalo|cuento|pregunto|dije|dijo)\b/i,
    question_words: /¿(qu[eé]|c[oó]mo|d[oó]nde|cu[aá]ndo|cu[aá]l|cu[aá]les|cu[aá]nto|cu[aá]nta|qui[eé]n|por qu[eé])/i,
    question_cual_vs_que: /¿(cu[aá]l|cu[aá]les)\b/i,
    ser_estar_adjectives: /\b(es|son|est[aá]|est[aá]n|estoy|soy|eres|est[aá]s) (muy |un |una |tan |demasiado )?(bonit[oa]|feliz|triste|cansad[oa]|alt[oa]|baj[oa]|car[oa]|barat[oa]|f[aá]cil|dif[ií]cil|grande|peque[ñn][oa]|list[oa]|content[oa]|nuev[oa]|viej[oa]|limpi[oa]|abiert[oa]|cerrad[oa]|llen[oa]|vac[ií]|guap[oa]|amable|fuerte|ric[oa]|pobre|enferm[oa]|ocupad[oa]|segur[oa]|important|interesante|delicios[oa]|calient|fr[ií]|tranquil[oa])/i,
    stem_changing_eie: wl('quiero','quieres','quiere','quieren','prefiero','prefieres','prefiere','pienso','piensa','piensas','entiendo','entiende','empieza','empiezo','empiezan','cierra','cierro','cierran','siento','siente','sientes'),
    condicional_simple: wl('gustar[ií]a','podr[ií]a','podr[ií]as','ser[ií]a','tendr[ií]a','har[ií]a','querr[ií]a','deber[ií]a','encantar[ií]a','preferir[ií]a','dir[ií]a','vendr[ií]a','habr[ií]a'),
    imperfecto_subjuntivo: /\bsi \w+(ara|aras|[aá]ramos|aran|iera|ieras|i[eé]ramos|ieran)\b|\b(fuera|tuviera|hiciera|pudiera|viniera|quisiera|hubiera|estuviera|dijera)\b/i,
    voz_pasiva: /\b(fue|fueron|ser[aá]|ha sido|han sido|hab[ií]a sido) \w+(ad[oa]s?|id[oa]s?)\b|\bse (revis|entreg|realiz|program|cierr|firm|paga|vend|aprob|reconoc|debit|acredit|calcul|document)\w*\b/i,
    clausulas_relativo: /\b(cuyo|cuya|cuyos|cuyas|donde|quien|quienes|el cual|la cual|los cuales|lo que|en el que|en la que|con quien)\b/i,
    futuro_simple: ub('ser[aá]|estar[aá]|habr[aá]|tendr[aá]|podr[aá]|har[aá]|vendr[aá]|ir[aá]|dir[aá]|saldr[aá]|pondr[aá]|\\w{2,}ar[aá]|\\w{2,}er[aá]|\\w{2,}ir[aá]|\\w+aremos|\\w+eremos|\\w+iremos|\\w+ar[aá]n|\\w+er[aá]n|\\w+ir[aá]n'),
    preterito_perfecto: /\b(he|has|ha|hemos|han) \w+(ad[oa]|id[oa]|to|cho|sto|bierto|scrito)\b/i,
    pluscuamperfecto: /\b(hab[ií]a|hab[ií]as|hab[ií]amos|hab[ií]an) \w+(ad[oa]|id[oa]|to|cho|sto)\b/i,
    futuro_perfecto: /\b(habr[eé]|habr[aá]s|habr[aá]|habremos|habr[aá]n) \w+(ad[oa]|id[oa]|to|cho)\b/i,
    subjuntivo_avanzado: /\b(aunque \w+(e|es|a|as|amos|an)\b|para que|antes de que|a menos que|con tal de que|sin que|en caso de que|cuando \w+(es|as|amos)\b)\b/i,
    marcadores_discursivos: /\b(sin embargo|por lo tanto|no obstante|adem[aá]s|en cambio|por consiguiente|en resumen|es decir|as[ií] pues|por otra parte|de hecho|en definitiva)\b/i,
    estilo_indirecto: /\b(dijo que|dice que|coment[oó] que|pregunt[oó] si|explic[oó] que|afirm[oó] que|me dijo que|nos dijo que|asegur[oó] que|respondi[oó] que)\b/i,
    gustar_structure: /\b(me|te|le|nos|les) (gusta|gustan|encanta|encantan|interesa|interesan|molesta|molestan|importa|importan|fascina|apetece)\b/i,
    hay_existence: /\bhay\b/i,
  },

  'es-en': {
    present_simple_habits: /\b(always|usually|every day|every morning|often|sometimes|never|on (weekends|mondays|sundays)|each day)\b/i,
    present_continuous_now: /\b(am|is|are|'m|'re|'s) \w+ing\b/i,
    simple_past: /\b(went|saw|had|was|were|did|didn't|made|took|came|got|said|bought|found|gave|lost|broke|died|ran|felt|left)\b|\b\w{3,}ed\b/i,
    past_continuous: /\b(was|were) \w+ing\b/i,
    present_perfect_experience: /\b(have|has|'ve|'ve|'s) (been|gone|seen|done|had|made|eaten|written|taken|already|just|ever|never|increased|reviewed|risen|arrived|finished|started|delivered|come|closed)\b|\b(have|has) \w+ed\b/i,
    future_will_going_to: /\b(will|'ll|won't|going to|gonna)\b/i,
    past_perfect: /\bhad (been|gone|seen|done|made|had|left|finished|started|already)\b|\bhad \w+ed\b/i,
    article_a_an: null,
    article_the: null,
    article_zero: null,
    modal_can_ability: /\b(can|can't|cannot|could|couldn't)\b/i,
    modal_should_advice: /\bshould(n't)?\b/i,
    modal_must_obligation: /\b(must|mustn't|have to|has to|had to)\b/i,
    conditional_zero: /\bif \w+.*(,|then)/i,
    conditional_first: /\bif [^,]*,? .*(will|won't|'ll)\b/i,
    conditional_second: /\bif [^,]*,? .*(would|wouldn't|'d)\b|\bif I were\b/i,
    conditional_third: /\bif [^,]*had .*(would have|wouldn't have)\b/i,
    passive_present_simple: /\b(is|are|isn't|aren't) (\w+ed|made|done|taken|written|sold|paid|shown|built|included|based)\b/i,
    questions_wh: /\b(what|where|when|why|who|which|how|whose|whom)\b[^.?!]*\?/i,
    comparatives_short: /\b\w+er than\b|\bmore \w+ than\b|\b(better|worse|bigger|smaller|older|younger|cheaper|faster|slower|higher|lower) than\b/i,
    verb_gerund: /\b(enjoy|enjoys|like|likes|love|loves|hate|hates|prefer|stop|finish|keep|avoid|mind|start|consider|recommend) \w+ing\b|\b(of|for|before|after|without|by|about) \w+ing\b/i,
    verb_infinitive: /\b(want|wants|need|needs|would like|'d like|decide|hope|hopes|try|plan|going|have|has|like|love|forget|remember|learn) to \w+\b/i,
    prepositions_time: /\b(at|on|in) (the )?(morning|afternoon|evening|night|noon|midnight|monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|march|summer|winter|\d)\b/i,
    prepositions_place: /\b(next to|in front of|across from|behind|between|under|near|on the corner|on the (shelf|table|patio|stove)|in the (cabinet|drawer|room|kitchen))\b/i,
    prepositions_after_verbs: /\b(depend on|listen to|wait for|look for|think about|belong to|apply for|pay for|talk about|worry about|deal with)\b/i,
    phrasal_common: /\b(get up|turn on|turn off|pick up|put on|take off|find out|give up|come back|wake up|go out|sit down|stand up|check in|check out)\b/i,
    phrasal_separable: /\b(turn (it |the )?(on|off|up|down)|pick (it |them )?up|put (it |them )?(on|away)|take (it |them )?off|fill (it |the )?out|throw (it )?away)\b/i,
    phrasal_idiomatic: /\b(look up|work out|come across|run into|figure out|carry out|look forward to|get along|put up with|come up with|catch up)\b/i,
    inversion_negative_adverbials: /\b(not only|never before|rarely (do|does|did|have|has)|seldom|hardly (had|did)|no sooner|not until)\b/i,
    mixed_conditionals: /\bif [^,]*had .*(would|'d) (be|have|feel)\b/i,
    subjunctive_formal: /\b(recommend|suggest|insist|demand|request|essential|important|advise) that \w+ \w+\b|\bif (I|he|she|it) were\b/i,
    nominalization: /\b(the (development|recognition|elimination|impairment|restatement|reconciliation|implementation|contribution) of|\w+tion of the)\b/i,
    cleft_sentences: /\bit (is|was|'s) \w+ (that|who|which)\b|\bwhat \w+ (is|was|needs|makes|matters)\b/i,
    ellipsis_substitution: /\b(so (do|did|am|is|are|have|will) (I|we|they|he|she)|neither (do|did|am|is|are) (I|we|they)|me too|me neither|i do too)\b/i,
    discourse_markers_advanced: /\b(however|therefore|nevertheless|furthermore|moreover|consequently|in addition|on the other hand|as a result|in contrast|thus)\b/i,
  },
};

const CURATED = new Set(['gender_nouns_articles', 'gender_adjective_agreement']);

function verifyPair(pair) {
  const det = DETECT[pair];
  if (!det) return { pair, changes: [], skipped: true };
  const topicsMeta = JSON.parse(fs.readFileSync(`${ROOT}/shared/json/pairs/${pair}/topics.json`, 'utf8')).topics.filter(t => t.phrase);
  const phrasesByTopic = {};
  for (const t of topicsMeta) {
    const d = JSON.parse(fs.readFileSync(`${ROOT}/shared/json/pairs/${pair}/${t.id}.json`, 'utf8'));
    phrasesByTopic[t.id] = (d.phrases || []).map(p => p.target.map(f => f.text).join(' '));
  }
  const rulesFile = `${ROOT}/shared/json/pairs/${pair}/grammar-rules.json`;
  const data = JSON.parse(fs.readFileSync(rulesFile, 'utf8'));
  const changes = [];
  for (const r of data.rules) {
    if (CURATED.has(r.id)) continue;                    // keep hand-curated
    const d = det[r.id];
    if (!d) { changes.push({ id: r.id, note: 'NO DETECTOR (kept)', keep: true }); continue; }
    const hits = [];
    for (const [tid, phrases] of Object.entries(phrasesByTopic)) {
      const n = phrases.filter(p => d.test(p)).length;
      if (n >= MIN_HITS) hits.push([tid, n]);
    }
    hits.sort((a, b) => b[1] - a[1]);
    const newTopics = hits.slice(0, MAX_TOPICS).map(([t]) => t);
    const old = Array.isArray(r.topics) ? r.topics : [];
    const same = old.length === newTopics.length && old.every(t => newTopics.includes(t));
    if (!same) changes.push({ id: r.id, old, now: newTopics, evidence: hits.slice(0, MAX_TOPICS) });
    r.topics = newTopics;
  }
  if (WRITE) fs.writeFileSync(rulesFile, JSON.stringify(data, null, 2) + '\n');
  return { pair, changes };
}

const pairs = ONLY_PAIR ? [ONLY_PAIR] : Object.keys(DETECT);
let drift = 0;
for (const pair of pairs) {
  const res = verifyPair(pair);
  if (res.skipped) { console.log(`(${pair}: sin detectores — omitido)`); continue; }
  console.log(`\n=== ${pair} ===`);
  for (const c of res.changes) {
    if (c.keep) continue;
    drift++;
    console.log(`  ${c.id.padEnd(30)} ${JSON.stringify(c.old)} → ${JSON.stringify(c.now)}` +
                (c.evidence ? `  (evidencia: ${c.evidence.map(e => e[0] + ':' + e[1]).join(', ')})` : ''));
  }
  if (!res.changes.some(c => !c.keep)) console.log('  (sin cambios — tags coinciden con la evidencia)');
}
if (!WRITE && drift > 0) {
  console.log(`\n✗ ${drift} regla(s) con tags que no coinciden con la evidencia. Corre con --write.`);
  process.exit(1);
} else if (WRITE) {
  console.log(`\n✓ escrito. ${drift} regla(s) actualizada(s).`);
} else {
  console.log('\n✓ todos los tags coinciden con la evidencia de las frases.');
}
