/* ============================================================
   damer-provenance.mjs — authoritative regional provenance for Spanish terms (dev-time).

   The variant lexicon of check-variants.mjs must NOT guess which countries use a term. This
   fetches the **Diccionario de americanismos (ASALE)** — the authoritative reference that marks
   each SENSE (acepción) with its countries — and prints, per term, the country ISO codes for the
   acepción that matches the intended meaning. Use it to build/verify LEXICON provenance, then
   cite ASALE in CREDITS.md.

   DAMER lists only AMERICA-specific senses, so the Spain/general term (coche, patata, móvil,
   ordenador) is NOT here — its provenance is España (es) from the DLE / general Spanish.

     node tools/damer-provenance.mjs carro:autom celular:teléfono palta:fruto
       → for each `term:meaningKeyword`, the countries of the matching acepción.

   Source: https://www.asale.org/damer/<term> (public reference, ASALE). Attribute in CREDITS.md.
   ============================================================ */

// DAMER country abbreviation → ISO-3166 alpha-2 (EU = US Spanish; ES = El Salvador, not Spain).
const ISO = {
  EU: 'us', Mx: 'mx', Gu: 'gt', Ho: 'hn', ES: 'sv', Ni: 'ni', CR: 'cr', Pa: 'pa', Cu: 'cu',
  RD: 'do', PR: 'pr', Co: 'co', Ve: 've', Ec: 'ec', Pe: 'pe', Bo: 'bo', Ch: 'cl', Py: 'py',
  Ar: 'ar', Ur: 'uy',
};

async function acepciones(term) {
  const r = await fetch('https://www.asale.org/damer/' + encodeURIComponent(term),
    { headers: { 'User-Agent': 'Mozilla/5.0 provenance' } });
  if (!r.ok) return { err: r.status };
  const html = await r.text();
  const m = html.match(/<meta name="description" content="([^"]*)"/);
  if (!m) return { err: 'no meta (term not found or format changed)' };
  const out = [];
  // The meta packs the entry as "I. 1. <countries>. <definition> 2. <countries>. <def> …".
  for (const chunk of m[1].split(/(?:\b[IVX]+\.\s*)?\b\d+\.\s*/)) {
    if (!/^[A-Z]/.test(chunk.trim())) continue;
    const sm = chunk.match(/^(.*?)\.\s+([A-ZÁÉÍÓÚ].*)$/);       // countries . definition
    const cseg = sm ? sm[1] : chunk;
    const def = (sm ? sm[2] : '').slice(0, 70);
    // Country tokens: 2-3 char abbrev, optional regional suffix (Mx:N,S).
    const codes = [...new Set([...cseg.matchAll(/([A-Z][A-Za-z]{1,2})(?::[^\s,;]*)?/g)]
      .map(x => ISO[x[1]]).filter(Boolean))];
    if (codes.length) out.push({ codes, def });
  }
  return { aceps: out };
}

const args = process.argv.slice(2);
if (!args.length) { console.log('uso: node tools/damer-provenance.mjs term:meaningKeyword ...'); process.exit(0); }
for (const arg of args) {
  const [term, mean] = arg.split(':');
  const d = await acepciones(term);
  console.log(`\n${term.toUpperCase()}${mean ? ' (busca: ' + mean + ')' : ''}`);
  if (d.err) { console.log('  ✗ ' + d.err); continue; }
  for (const a of d.aceps) {
    const hit = mean && new RegExp(mean, 'i').test(a.def) ? '  <== MATCH' : '';
    console.log(`  [${a.codes.join(',')}] ${a.def}${hit}`);
  }
}
