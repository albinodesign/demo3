#!/usr/bin/env node
/**
 * cms-check.mjs — Maschineller Kompatibilitäts-Check Website ↔ Agency CMS
 *
 * Prüft die Website gegen den verbindlichen Contract in CMS-REFERENCE.md
 * (Abschnitte 3, 4, 5, 7, 8, 10, 11) und die Security-Regeln aus vercel.json.
 *
 * Aufruf:  node scripts/cms-check.mjs [--dist dist] [--cms-origin https://…]
 * Exit:    0 = keine Fehler (Warnungen erlaubt), 1 = Fehler gefunden.
 *
 * Es werden nur Standardbibliotheken benutzt (Node >= 18).
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const argOf = (name, fallback) => {
  const i = argv.indexOf(name);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const DIST = join(ROOT, argOf('--dist', 'dist'));
/** Erwartete CMS-Herkunft. Default = Produktions-CMS der Agentur. */
const CMS_ORIGIN = argOf('--cms-origin', process.env.CMS_ORIGIN || 'https://agency-cms-teal.vercel.app');
const LOCALHOST_ORIGIN = 'http://localhost:3000';

const TYPES = new Set(['text', 'textarea', 'image', 'number', 'email', 'phone', 'url', 'date', 'boolean']);
const BANNER_VARIANTS = new Set(['vacation', 'emergency', 'info']);
const ID_RE = /^[A-Za-z0-9._-]+$/;
const PAGE_FILE_RE = /^src\/content\/pages\/[A-Za-z0-9][A-Za-z0-9._-]*\.json$/;
const SITE_FILE = 'src/content/site.json';
const BLOG_FILE_RE = /^src\/content\/blog\/[a-z0-9-]+\.md$/;

const errors = [];
const warnings = [];
const err = (code, msg) => errors.push([code, msg]);
const warn = (code, msg) => warnings.push([code, msg]);

/** Sammelt Meldungen pro Code und gibt sie gebündelt aus. */
function report(list, title) {
  if (!list.length) return;
  const byCode = new Map();
  for (const [code, msg] of list) {
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(msg);
  }
  console.log(`\n${title} (${list.length})\n`);
  for (const [code, msgs] of byCode) {
    // Sehr häufige, gleichartige Befunde werden zusammengefasst.
    const showAll = !code.endsWith('-AGG') && msgs.length <= 12;
    console.log(`  ── ${code} (${msgs.length})`);
    if (msgs.length <= 4) {
      for (const m of msgs) console.log(`     • ${m}`);
    } else if (showAll) {
      for (const m of msgs) console.log(`     • ${m}`);
    } else {
      for (const m of msgs.slice(0, 4)) console.log(`     • ${m}`);
      console.log(`     • … ${msgs.length - 4} weitere, gleiche Ursache`);
    }
  }
}

// ---------------------------------------------------------------- Helpers ---
const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

function getPath(obj, dotPath) {
  const segments = dotPath
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s !== '');
  let cur = obj;
  for (const seg of segments) {
    if (cur === null || typeof cur !== 'object') return { found: false };
    if (!Object.prototype.hasOwnProperty.call(cur, seg)) return { found: false };
    cur = cur[seg];
  }
  return { found: true, value: cur };
}

/** HTML ohne <script>/<style>/Kommentare — nur sichtbarer Inhalt. */
function visibleHtml(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
}

function collectHtmlFiles(dir, acc = []) {
  return collectFiles(dir, ['.html'], acc);
}

/** Alle Dateien unter dir mit einer der angegebenen Endungen. */
function collectFiles(dir, exts, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) collectFiles(full, exts, acc);
    else if (exts.some((e) => entry.endsWith(e))) acc.push(full);
  }
  return acc;
}

// ------------------------------------------------------------ 1. Manifest ---
const MANIFEST_PATH = 'src/content/cms.manifest.json';
if (!existsSync(join(ROOT, MANIFEST_PATH))) {
  console.error(`FEHLER: ${MANIFEST_PATH} nicht gefunden.`);
  process.exit(1);
}
const manifest = readJson(MANIFEST_PATH);
const sections = Array.isArray(manifest.sections) ? manifest.sections : [];
const fields = sections.flatMap((s) => (Array.isArray(s.fields) ? s.fields : []));

if (sections.length === 0) err('MANIFEST', 'Keine Sektionen im Manifest.');
if (fields.length === 0) err('MANIFEST', 'Manifest ergibt keine Sektion mit Feldern (ungültig).');
if (manifest.features && typeof manifest.features.blog === 'boolean') {
  /* ok */
}

const seenIds = new Map();
const fieldById = new Map();
const idsWithUppercase = [];

for (const section of sections) {
  if (!section.id) err('MANIFEST', `Sektion ohne id: ${JSON.stringify(section.title ?? '')}`);
  if (!section.title) warn('MANIFEST', `Sektion "${section.id}" ohne Titel (Fallback im Editor).`);
  if (!section.page) warn('MANIFEST', `Sektion "${section.id}" ohne page (Editor rät per Heuristik).`);
  if (Array.isArray(section.fields) && section.fields.length === 0) {
    warn('MANIFEST', `Sektion "${section.id}" hat keine Felder (wird ausgeblendet).`);
  }

  for (const f of section.fields ?? []) {
    const where = `Sektion "${section.id}"`;

    if (!f.id) {
      err('FELD-ID', `${where}: Feld ohne id → ${JSON.stringify(f.label)}`);
      continue;
    }
    // CMS-REFERENCE §3: verworfen (stillschweigend) werden IDs mit Leerzeichen,
    // Quotes oder <>"'. Großbuchstaben sind nicht als Verwerfungsgrund genannt.
    if (/[\s<>"'`]/.test(f.id)) {
      err(
        'FELD-ID',
        `${where}: id "${f.id}" enthält Leerzeichen/Quotes/<>"' — das CMS verwirft die ID ` +
          'stillschweigend, der Vorschau-Klick landet im Leeren.'
      );
    } else if (!ID_RE.test(f.id)) {
      err('FELD-ID', `${where}: id "${f.id}" enthält unzulässige Zeichen (erlaubt: [a-zA-Z0-9._-]).`);
    }
    if (/[A-Z]/.test(f.id)) idsWithUppercase.push(f.id);
    if (seenIds.has(f.id)) {
      err('FELD-ID', `id "${f.id}" ist nicht global eindeutig (auch in "${seenIds.get(f.id)}") — bricht den gesamten Publish ab.`);
    } else {
      seenIds.set(f.id, where);
      fieldById.set(f.id, f);
    }

    if (!f.label) warn('FELD', `${f.id}: kein label (Fallback title → id).`);

    if (!TYPES.has(f.type)) err('TYP', `${f.id}: type "${f.type}" ist unbekannt → fällt still auf "text" zurück.`);

    if (f.maxLength !== undefined) {
      if (typeof f.maxLength !== 'number' || !Number.isInteger(f.maxLength) || f.maxLength < 1 || f.maxLength > 10000) {
        err('MAXLENGTH', `${f.id}: maxLength muss ganze Zahl 1–10000 sein (ist ${JSON.stringify(f.maxLength)}).`);
      }
    }
    if (f.aspectRatio !== undefined && f.aspectRatio !== '16:9') {
      err('ASPECTRATIO', `${f.id}: aspectRatio "${f.aspectRatio}" wird vom CMS ignoriert (nur "16:9").`);
    }

    // Alt-Texte: das CMS hat bewusst kein Alt-Konzept (CMS-REFERENCE §9/§13).
    const altHint = `${f.id} ${f.label ?? ''} ${f.path ?? ''}`.toLowerCase();
    if (/\balt\b|alt-?text|bildbeschreibung/.test(altHint)) {
      err('ALT-TEXT', `${f.id}: Manifest-Feld für einen Alt-Text existiert, obwohl das CMS kein Alt-Konzept hat — im Editor sichtbar, ohne Wirkung.`);
    }
    // Keine Felder für Linkziele (tel:, mailto:, Button-URLs) — die sind abgeleitet.
    if (f.type === 'url' || /tel:|mailto:|link-?url|ziel-?url|button-?url/.test(altHint)) {
      err('LINKZIEL', `${f.id}: Manifest-Feld für ein Linkziel (url/tel:/mailto:) — Linkziele sind abgeleitet und dürfen nicht editierbar sein.`);
    }

    if (!f.file) {
      err('DATEI', `${f.id}: file fehlt.`);
      continue;
    }
    if (f.file !== SITE_FILE && !PAGE_FILE_RE.test(f.file)) {
      err('DATEI', `${f.id}: file "${f.file}" ist nicht erlaubt (nur ${SITE_FILE} oder src/content/pages/*.json).`);
      continue;
    }
    if (!f.path || typeof f.path !== 'string') {
      err('PFAD', `${f.id}: path fehlt.`);
      continue;
    }
    if (/__proto__|constructor|prototype/.test(f.path)) {
      err('PFAD', `${f.id}: path "${f.path}" enthält einen verbotenen Schlüssel.`);
    }
    if (f.path.includes('[]') || f.path.includes('..') || f.path.startsWith('.') || f.path.endsWith('.')) {
      err('PFAD', `${f.id}: path "${f.path}" hat leere/nicht-numerische Segmente.`);
    }

    if (!existsSync(join(ROOT, f.file))) {
      err('PFAD', `${f.id}: Zieldatei ${f.file} existiert nicht.`);
      continue;
    }
    const data = readJson(f.file);
    const res = getPath(data, f.path);
    if (!res.found) {
      err('PFAD', `${f.id}: Pfad "${f.path}" existiert in ${f.file} nicht.`);
      continue;
    }

    // Typen: Zahlen und Booleans müssen echte JSON-Typen sein.
    const v = res.value;
    if (f.type === 'number' && (typeof v !== 'number' || !Number.isFinite(v))) {
      err('JSON-TYP', `${f.id}: Pfad ${f.file}#${f.path} muss eine echte Zahl sein (ist ${JSON.stringify(v)}) — Publish blockiert die Datei.`);
    }
    if (f.type === 'boolean' && typeof v !== 'boolean') {
      err('JSON-TYP', `${f.id}: Pfad ${f.file}#${f.path} muss ein echter Boolean sein (ist ${JSON.stringify(v)}) — Publish blockiert die Datei.`);
    }
    if (['text', 'textarea', 'image', 'email', 'phone', 'url', 'date'].includes(f.type) && typeof v !== 'string') {
      err('JSON-TYP', `${f.id}: Pfad ${f.file}#${f.path} muss ein String sein (ist ${JSON.stringify(v)}).`);
    }
    if (typeof f.maxLength === 'number' && typeof v === 'string' && v.length > f.maxLength) {
      err('MAXLENGTH', `${f.id}: Wert in ${f.file}#${f.path} ist ${v.length} Zeichen, maxLength ist ${f.maxLength} — Publish blockiert die Datei.`);
    }
    if (f.type === 'image' && typeof v === 'string' && v.length > 0 && !/^(https:\/\/|\/|[A-Za-z0-9._-]+\/)/.test(v)) {
      err('BILD-URL', `${f.id}: "${v}" ist kein erlaubter Bildpfad (http(s) oder sicherer relativer Pfad).`);
    }
    if (f.type === 'email' && typeof v === 'string' && v.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
      err('EMAIL', `${f.id}: "${v}" ist keine gültige E-Mail.`);
    }
    if (f.type === 'phone' && typeof v === 'string' && v.length > 0) {
      if (!/^[+(]?[0-9]/.test(v) || v.length < 5) err('PHONE', `${f.id}: "${v}" entspricht nicht dem Telefonformat.`);
    }
    if (f.type === 'date' && typeof v === 'string' && v.length > 0 && !/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      err('DATUM', `${f.id}: "${v}" ist nicht JJJJ-MM-TT.`);
    }
  }
}

if (idsWithUppercase.length) {
  warn(
    'FELD-ID-GROSS-AGG',
    `${idsWithUppercase.length} Feld-IDs enthalten Großbuchstaben (${idsWithUppercase.slice(0, 6).join(', ')} …). ` +
      'CMS-REFERENCE §3 empfiehlt "[a-z0-9._-]"; als verworfen sind dort nur IDs mit Leerzeichen/Quotes/' +
      '<>"\'' + ' genannt — das Verhalten bei Großbuchstaben im echten CMS ist nicht verifiziert.'
  );
}

// Listenfelder: alle Indizes abgedeckt? (Listen wachsen nicht per Entwurf)
for (const section of sections) {
  const grouped = new Map();
  for (const f of section.fields ?? []) {
    const m = /^(.*)\.(\d+)\./.exec(f.id);
    if (!m) continue;
    const listPath = m[1];
    if (!grouped.has(listPath)) grouped.set(listPath, []);
    grouped.get(listPath).push(Number(m[2]));
  }
  for (const [listPath, idxs] of grouped) {
    const max = Math.max(...idxs);
    for (let i = 0; i <= max; i++) {
      if (!idxs.includes(i)) err('LISTE', `Sektion "${section.id}": Liste "${listPath}" hat kein Feld für Index ${i}.`);
    }
  }
}

// ----------------------------------------------------- 2. Content-Dateien ---
const site = existsSync(join(ROOT, SITE_FILE)) ? readJson(SITE_FILE) : null;
if (site) {
  const b = site.banner;
  if (!b || typeof b !== 'object') {
    err('BANNER', 'site.banner fehlt — Pflichtobjekt { enabled, variant, text }.');
  } else {
    if (typeof b.enabled !== 'boolean') err('BANNER', 'site.banner.enabled muss ein echter Boolean sein.');
    if (!BANNER_VARIANTS.has(b.variant)) {
      err('BANNER', `site.banner.variant "${b.variant}" ist unbekannt — erlaubt: vacation|emergency|info (Publish blockiert site.json).`);
    }
    if (typeof b.text !== 'string' || b.text.length > 160) err('BANNER', 'site.banner.text muss ein String ≤ 160 Zeichen sein.');
    if (b.enabled === true && (!b.text || !String(b.text).trim())) {
      err('BANNER', 'site.banner.enabled ist true, aber text ist leer — enabled braucht Stil UND Text.');
    }
    for (const key of Object.keys(b)) {
      if (!['enabled', 'variant', 'text'].includes(key)) err('BANNER', `site.banner hat unbekannten Schlüssel "${key}".`);
    }
  }
}

const blogDir = join(ROOT, 'src/content/blog');
if (existsSync(blogDir)) {
  for (const name of readdirSync(blogDir)) {
    if (!name.endsWith('.md')) continue;
    const rel = `src/content/blog/${name}`;
    if (!BLOG_FILE_RE.test(rel)) err('BLOG', `${rel}: Dateiname muss [a-z0-9-]+.md sein.`);
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!m) {
      err('BLOG', `${rel}: kein Frontmatter.`);
      continue;
    }
    const fm = {};
    for (const line of m[1].split(/\r?\n/)) {
      const kv = /^([A-Za-z][A-Za-z0-9]*):\s*(.*)$/.exec(line);
      if (kv) fm[kv[1]] = kv[2].trim().replace(/^["'](.*)["']$/, '$1');
    }
    for (const key of ['title', 'slug', 'coverImage', 'excerpt']) {
      if (fm[key] === undefined) err('BLOG', `${rel}: Frontmatter-Schlüssel "${key}" fehlt.`);
    }
    if (fm.title && fm.title.length > 200) err('BLOG', `${rel}: title > 200 Zeichen.`);
    if (fm.slug && !/^[a-z0-9-]{1,80}$/.test(fm.slug)) err('BLOG', `${rel}: slug "${fm.slug}" ist ungültig (nur [a-z0-9-], ≤ 80).`);
    if (fm.slug && fm.slug !== name.replace(/\.md$/, '')) err('BLOG', `${rel}: slug "${fm.slug}" passt nicht zum Dateinamen.`);
    if (fm.date !== undefined && fm.date !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(fm.date)) err('BLOG', `${rel}: date muss JJJJ-MM-TT oder leer sein.`);
    if (fm.coverImage && fm.coverImage.length > 2000) err('BLOG', `${rel}: coverImage > 2000 Zeichen.`);
    if (fm.excerpt && fm.excerpt.length > 500) err('BLOG', `${rel}: excerpt > 500 Zeichen.`);
    if (fm.coverImageAlt && fm.coverImageAlt.length > 200) err('BLOG', `${rel}: coverImageAlt > 200 Zeichen.`);
    if (fm.draft !== undefined && !/^(true|false)$/.test(fm.draft)) err('BLOG', `${rel}: draft muss Boolean sein.`);
  }
}

// ------------------------------------------------------ 3. Security/Header ---
if (existsSync(join(ROOT, 'vercel.json'))) {
  const vercel = readJson('vercel.json');
  const rules = vercel.headers ?? [];
  const flat = JSON.stringify(vercel);
  if (/X-Frame-Options/i.test(flat)) {
    err('SECURITY', 'X-Frame-Options ist gesetzt — blockiert das CMS-Iframe. Darf nirgends vorkommen.');
  }
  const cspRules = rules.filter((r) => (r.headers ?? []).some((h) => h.key.toLowerCase() === 'content-security-policy'));
  if (cspRules.length === 0) err('SECURITY', 'Kein Content-Security-Policy in vercel.json.');
  for (const rule of cspRules) {
    const csp = rule.headers.find((h) => h.key.toLowerCase() === 'content-security-policy').value;
    const guarded = Array.isArray(rule.has) && rule.has.some((h) => h.type === 'host');
    const guardText = rule.has
      ? `has: ${rule.has.map((h) => `${h.type}=${h.value}`).join(', ')}`
      : 'ohne has-Guard (gilt für ALLE Hosts inkl. Live-Domain)';
    const fa = /frame-ancestors([^;]*)/.exec(csp);
    if (!fa) {
      err('SECURITY-CSP', `CSP (${rule.source}, ${guardText}) enthält kein frame-ancestors → CMS-Iframe wird geblockt.`);
      continue;
    }
    const list = fa[1].trim();
    if (list.includes("'none'")) {
      err('SECURITY-CSP', `CSP (${rule.source}, ${guardText}): frame-ancestors 'none' blockiert jede Einbettung.`);
      continue;
    }
    // Konkrete Origin zuerst; ersatzweise eine Wildcard, die die Origin abdeckt.
    const host = new URL(CMS_ORIGIN).host;
    const covered =
      list.includes(CMS_ORIGIN) ||
      (host.endsWith('.vercel.app') && /https:\/\/\*\.vercel\.app/.test(list));
    if (!covered) {
      err(
        'SECURITY-CSP',
        `CSP (${rule.source}, ${guardText}) erlaubt die CMS-Origin ${CMS_ORIGIN} nicht in ` +
          `frame-ancestors "${list}" → das CMS-Iframe wird auf diesem Host geblockt.`
      );
    } else if (!list.includes(CMS_ORIGIN)) {
      warn(
        'SECURITY-CSP',
        `CSP (${rule.source}, ${guardText}) erlaubt die CMS-Origin nur über die Wildcard ` +
          `"https://*.vercel.app" statt konkret "${CMS_ORIGIN}". Funktional, aber präziser wäre die konkrete Origin.`
      );
    }
    if (!guarded) {
      warn('SECURITY-CSP', `Regel ${rule.source} ohne has-Guard gilt für alle Hosts inkl. der Live-Domain.`);
    }
  }
}

// ------------------------------------------------------------ 4. Bridge ---
const BASE_LAYOUT = join(ROOT, 'src/layouts/BaseLayout.astro');
if (!existsSync(BASE_LAYOUT)) err('BRIDGE', 'src/layouts/BaseLayout.astro fehlt.');
else {
  const layout = readFileSync(BASE_LAYOUT, 'utf8');
  const originsMatch = /CMS_ORIGINS\s*=\s*\[([^\]]*)\]/.exec(layout);
  if (!originsMatch) err('BRIDGE', 'CMS_ORIGINS nicht gefunden — Bridge-Script fehlt oder ist verändert.');
  else {
    const origins = originsMatch[1]
      .split(',')
      .map((s) => s.trim().replace(/^["']|["']$/g, ''))
      .filter(Boolean);
    if (origins.length === 0) err('BRIDGE', 'CMS_ORIGINS ist leer — die Vorschau ist stumm.');
    if (!origins.includes(CMS_ORIGIN)) {
      err('BRIDGE', `CMS_ORIGINS enthält nicht die CMS-Origin ${CMS_ORIGIN} (gefunden: ${origins.join(', ') || '—'}).`);
    }
    for (const o of origins) {
      if (/deine-agentur|example\.com|example\.org|cms\.invalid|localhost:\d+[^,]/.test(o) && o !== LOCALHOST_ORIGIN) {
        err('BRIDGE', `CMS_ORIGINS enthält den Platzhalter "${o}".`);
      }
      if (o === 'window.location.origin' || o === 'location.origin') {
        err('BRIDGE', `CMS_ORIGINS enthält "${o}" — das ist die Website selbst, nicht das CMS.`);
      }
    }
  }
  if (!/window\.self\s*!==\s*window\.top/.test(layout)) err('BRIDGE', 'Iframe-Erkennung (window.self !== window.top) fehlt.');
  if (/postMessage\(\s*\{[^}]*\}\s*,\s*["']\*["']/.test(layout)) err('BRIDGE', 'postMessage(..., "*") ist verboten.');
  if (/innerText/.test(layout)) err('BRIDGE', 'Bridge nutzt innerText — das zerstört verschachteltes Markup und Icons.');
  if (!/CSS\.escape/.test(layout)) err('BRIDGE', 'CSS.escape wird nicht verwendet.');
  if (!/CMS_ORIGINS\.includes\(\s*event\.origin\s*\)/.test(layout)) err('BRIDGE', 'Keine event.origin-Prüfung — fremde Seiten dürfen die Vorschau umschreiben.');
  if (!/event\.source\s*!==\s*window\.parent/.test(layout)) err('BRIDGE', 'Keine event.source-Prüfung.');
  if (!/CMS_BRIDGE_READY/.test(layout)) err('BRIDGE', 'CMS_BRIDGE_READY (Bridge v2) wird nicht gesendet.');
  if (!/CMS_FIELD_UPDATE/.test(layout)) err('BRIDGE', 'CMS_FIELD_UPDATE wird nicht verarbeitet.');
  if (!/CMS_SELECT_MODE/.test(layout)) err('BRIDGE', 'CMS_SELECT_MODE wird nicht verarbeitet.');
  if (!/CMS_FIELD_SELECT/.test(layout)) err('BRIDGE', 'CMS_FIELD_SELECT wird nicht gesendet.');
  if (/data-cms-field/.test(layout) && /innerHTML/.test(layout)) err('BRIDGE', 'Bridge nutzt innerHTML.');
}

// --------------------------------------------------------- 5. Gebaute HTML ---
const htmlFiles = collectHtmlFiles(DIST);
if (htmlFiles.length === 0) {
  err('BUILD', `Kein HTML in ${relative(ROOT, DIST)} gefunden — bitte erst bauen (npm run build).`);
} else {
  const markerUse = new Map();
  const sectionUse = new Map();
  const missingSections = new Set();
  const imageFields = fieldById.size > 0 ? [...fieldById.values()].filter((f) => f.type === 'image').map((f) => f.id) : [];

  for (const file of htmlFiles) {
    const page = '/' + relative(DIST, file).replace(/index\.html$/, '').replace(/\\/g, '/');
    const html = readFileSync(file, 'utf8');
    const body = visibleHtml(html);

    if (!/CMS_BRIDGE_READY/.test(html)) err('BRIDGE', `${page}: Brücken-Script fehlt.`);

    // Marker ↔ Manifest
    for (const m of body.matchAll(/data-cms-field="([^"]+)"/g)) {
      if (!fieldById.has(m[1])) err('MARKER', `${page}: data-cms-field="${m[1]}" existiert nicht im Manifest.`);
      if (!markerUse.has(m[1])) markerUse.set(m[1], new Set());
      markerUse.get(m[1]).add(page);
    }
    for (const m of body.matchAll(/data-cms-section="([^"]+)"/g)) {
      if (!sectionUse.has(m[1])) sectionUse.set(m[1], new Set());
      sectionUse.get(m[1]).add(page);
    }

    // Verschachtelte Marker: der Bridge-TextContent würde innere Marker löschen
    for (const m of body.matchAll(/<(\w+)([^>]*?)data-cms-field="([^"]+)"([^>]*)>([\s\S]*?)<\/\1>/g)) {
      if (/data-cms-field=/.test(m[5])) {
        err('MARKER', `${page}: Marker "${m[3]}" ist verschachtelt — die Bridge würde innere Marker löschen.`);
      }
    }

    // Bild-Marker: eigenständiges <img>, kein srcset/sizes, kein <picture>
    for (const id of imageFields) {
      for (const m of body.matchAll(new RegExp(`<img([^>]*data-cms-field="${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*)>`, 'g'))) {
        const attrs = m[1];
        if (/\bsrcset=/.test(attrs)) err('BILD', `${page}: Bild-Marker "${id}" hat srcset — die Vorschau bricht.`);
        if (/\bsizes=/.test(attrs)) err('BILD', `${page}: Bild-Marker "${id}" hat sizes.`);
        if (/\bwidths=/.test(attrs)) err('BILD', `${page}: Bild-Marker "${id}" hat widths.`);
      }
      if (new RegExp(`<picture[^>]*>[\\s\\S]{0,400}?data-cms-field="${id}"`).test(body)) {
        err('BILD', `${page}: Bild-Marker "${id}" liegt in <picture>.`);
      }
    }

    // Sektionen werden nach der Schleife geprüft (eine Sektion kann auf einer späteren Seite stehen)
  }

  for (const s of sections) {
    if (s.id && !sectionUse.has(s.id)) missingSections.add(s.id);
  }

  // Manifest-Felder ohne Marker
  if (missingSections.size) {
    warn(
      'SEKTION-AGG',
      `${missingSections.size} Manifest-Sektion(en) haben auf keiner Seite einen data-cms-section-Marker: ` +
        `${[...missingSections].join(', ')}. Reserve für CMS-Sprünge, kein Vorschau-Blocker.`
    );
  }
  const justified = /(\.rating$|\.enabled$|\.variant$|^kontakt\.messages\.|^kontakt\.form\.submitSending$|Alt$|imageAlt$)/;
  // Marker können auch in einem bedingten Zweig liegen, der im aktuellen Build nicht
  // gerendert wurde. Deshalb zusätzlich die Templates durchsuchen.
  const templateSources = collectFiles(join(ROOT, 'src'), ['.astro']);
  const sourceText = templateSources.map((f) => readFileSync(f, 'utf8')).join('\n');
  for (const f of fieldById.values()) {
    if (markerUse.has(f.id)) continue;
    const inSource = sourceText.includes(`data-cms-field="${f.id}"`) || sourceText.includes(`data-cms-field={\`${f.id}`);
    if (justified.test(f.id)) {
      warn('MARKER', `Feld "${f.id}" hat keinen data-cms-field-Marker (Ausnahme: Zahl/Boolean/Laufzeitmeldung — im Report begründen).`);
    } else if (inSource) {
      warn(
        'MARKER-BEDINGT',
        `Feld "${f.id}" hat einen Marker im Template, erscheint aber im aktuellen Build nicht ` +
          '(nur in einem bedingten Zweig gerendert). Vorschau zeigt das Feld erst, wenn der Zweig aktiv ist.'
      );
    } else {
      err('MARKER', `Feld "${f.id}" (${f.file}#${f.path}) hat weder im HTML noch im Template einen data-cms-field-Marker.`);
    }
  }

  // Draft-Artikel dürfen nicht ausgeliefert werden
  if (existsSync(blogDir)) {
    for (const name of readdirSync(blogDir).filter((n) => n.endsWith('.md'))) {
      const raw = readFileSync(join(ROOT, 'src/content/blog', name), 'utf8');
      const d = /^draft:\s*(\S+)/m.exec(raw);
      const isDraft = !d || d[1] !== 'false'; // fehlend = laut Contract nicht öffentlich
      const slug = name.replace(/\.md$/, '');
      const built = existsSync(join(DIST, 'blog', slug, 'index.html'));
      if (isDraft && built) {
        err('DRAFT', `Artikel "${slug}" ist Entwurf (draft=${d ? d[1] : 'fehlt'}), liegt aber in dist/ — wird öffentlich ausgeliefert.`);
      }
    }
  }
}

// ------------------------------------------------------------------ Report ---
const line = '─'.repeat(72);
console.log(line);
console.log(`cms-check — ${fields.length} Felder / ${sections.length} Sektionen / ${htmlFiles.length} HTML-Dateien`);
console.log(`CMS-Origin erwartet: ${CMS_ORIGIN}`);
console.log(line);

report(warnings, 'WARNUNGEN — nicht blockierend');
report(errors, 'FEHLER — blockierend');

if (errors.length) {
  console.log(`\n${line}\nERGEBNIS: FEHLER — ${errors.length} Fehler, ${warnings.length} Warnungen\n`);
  process.exit(1);
}
console.log(`\nERGEBNIS: OK — 0 Fehler, ${warnings.length} Warnungen\n`);
