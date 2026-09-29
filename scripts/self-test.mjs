#!/usr/bin/env node
/**
 * self-test.mjs — Beweist, dass cms-check.mjs die Regeln aus CMS-REFERENCE v1.5
 * tatsächlich erkennt. Ein Prüfskript, das nie rot wird, ist wertlos.
 *
 * Kopiert die geprüften Dateien in ein Temp-Verzeichnis, bricht dort bewusst
 * eine Regel und erwartet einen Fehler. Das Projekt selbst wird nicht berührt.
 *
 * Aufruf: node scripts/self-test.mjs
 */

import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const CHECK = join(ROOT, 'scripts/cms-check.mjs');
const ITEMS = [
  'src/content/cms.manifest.json',
  'src/content/site.json',
  'src/content/pages',
  'src/content/blog',
  'src/layouts',
  'src/pages',
  'src/components',
  'src/styles',
  'vercel.json',
  'astro.config.mjs',
  'package.json',
  'CMS-REFERENCE.md',
  'public',
  'dist',
];

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'cmscheck-'));
  for (const item of ITEMS) {
    const from = join(ROOT, item);
    if (!existsSync(from)) continue;
    const to = join(dir, item);
    mkdirSync(dirname(to), { recursive: true });
    cpSync(from, to, { recursive: true });
  }
  return dir;
}

function runCheck(dir) {
  try {
    execFileSync(process.execPath, [CHECK], { cwd: dir, stdio: 'pipe' });
    return { code: 0, out: '' };
  } catch (e) {
    return { code: e.status ?? 1, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

/** Erwartet Fehlercode X in der Ausgabe. */
const cases = [
  {
    name: '§7.5  Zwei Content-Dateien in einem Seiten-Tab',
    code: 'VORSCHAU-TAB',
    mutate(dir) {
      const p = join(dir, 'src/content/cms.manifest.json');
      const m = JSON.parse(readFileSync(p, 'utf8'));
      const ds = m.sections.find((s) => s.id === 'datenschutz');
      ds.page = m.sections.find((s) => s.id === 'impressum').page;
      writeFileSync(p, JSON.stringify(m, null, 2));
    },
  },
  {
    name: '§3.2 Regel 2  Zwei Felder auf dasselbe file+path',
    code: 'SCHREIBZIEL',
    mutate(dir) {
      const p = join(dir, 'src/content/cms.manifest.json');
      const m = JSON.parse(readFileSync(p, 'utf8'));
      const hero = m.sections.find((s) => s.id === 'home-hero');
      const clone = { ...hero.fields.find((f) => f.id === 'home.hero.title') };
      clone.id = 'home.hero.title.kopie';
      hero.fields.push(clone);
      writeFileSync(p, JSON.stringify(m, null, 2));
    },
  },
  {
    name: '§3.2 Regel 1  Doppelte Feld-ID',
    code: 'FELD-ID',
    mutate(dir) {
      const p = join(dir, 'src/content/cms.manifest.json');
      const m = JSON.parse(readFileSync(p, 'utf8'));
      const s = m.sections.find((x) => x.id === 'home-hero');
      s.fields.push({ ...s.fields[0], path: 'hero.subtitle' });
      writeFileSync(p, JSON.stringify(m, null, 2));
    },
  },
  {
    name: '§3.3  Feld-ID mit Leerzeichen/Quotes (Klick-Pfad verwirft sie)',
    code: 'FELD-ID',
    mutate(dir) {
      const p = join(dir, 'src/content/cms.manifest.json');
      const m = JSON.parse(readFileSync(p, 'utf8'));
      m.sections.find((s) => s.id === 'home-hero').fields[0].id = 'home hero badge';
      writeFileSync(p, JSON.stringify(m, null, 2));
    },
  },
  {
    name: '§9.2  CSP-Block ohne has-Guard',
    code: 'SECURITY-CSP',
    mutate(dir) {
      const p = join(dir, 'vercel.json');
      const v = JSON.parse(readFileSync(p, 'utf8'));
      delete v.headers[1].has;
      writeFileSync(p, JSON.stringify(v, null, 2));
    },
  },
  {
    name: '§9.2  Wildcard *.vercel.app in frame-ancestors',
    code: 'SECURITY-CSP',
    mutate(dir) {
      const p = join(dir, 'vercel.json');
      const v = JSON.parse(readFileSync(p, 'utf8'));
      v.headers[1].headers[0].value = v.headers[1].headers[0].value.replace(
        /frame-ancestors[^;]*/,
        'frame-ancestors https://*.vercel.app'
      );
      writeFileSync(p, JSON.stringify(v, null, 2));
    },
  },
  {
    name: '§9.2  Live-Domain nicht mehr streng (CMS-Origin dort erlaubt)',
    code: 'SECURITY-CSP',
    mutate(dir) {
      const p = join(dir, 'vercel.json');
      const v = JSON.parse(readFileSync(p, 'utf8'));
      v.headers[0].headers[0].value = v.headers[0].headers[0].value.replace(
        /frame-ancestors 'self'/,
        "frame-ancestors 'self' https://agency-cms-teal.vercel.app"
      );
      writeFileSync(p, JSON.stringify(v, null, 2));
    },
  },
  {
    name: '§7.4  X-Frame-Options gesetzt',
    code: 'SECURITY',
    mutate(dir) {
      const p = join(dir, 'vercel.json');
      const v = JSON.parse(readFileSync(p, 'utf8'));
      v.headers[0].headers.push({ key: 'X-Frame-Options', value: 'DENY' });
      writeFileSync(p, JSON.stringify(v, null, 2));
    },
  },
  {
    name: '§2  Platzhalter-Domain in CMS_ORIGINS',
    code: 'BRIDGE',
    mutate(dir) {
      const p = join(dir, 'src/layouts/BaseLayout.astro');
      const s = readFileSync(p, 'utf8').replace('https://agency-cms-teal.vercel.app', 'https://cms.deine-agentur.de');
      writeFileSync(p, s);
    },
  },
  {
    name: '§7.2 Regel 4  window.location.origin in CMS_ORIGINS',
    code: 'BRIDGE',
    mutate(dir) {
      const p = join(dir, 'src/layouts/BaseLayout.astro');
      const s = readFileSync(p, 'utf8').replace('"http://localhost:3000"', '"window.location.origin"');
      writeFileSync(p, s);
    },
  },
  {
    name: '§7.2  postMessage(...,"*")',
    code: 'BRIDGE',
    mutate(dir) {
      const p = join(dir, 'src/layouts/BaseLayout.astro');
      const s = readFileSync(p, 'utf8').replace(
        'postMessage({ type: "CMS_BRIDGE_READY", version: 2 }, cmsOrigin)',
        'postMessage({ type: "CMS_BRIDGE_READY", version: 2 }, "*")'
      );
      writeFileSync(p, s);
    },
  },
  {
    name: '§7.2 Regel 3  innerText statt textContent',
    code: 'BRIDGE',
    mutate(dir) {
      const p = join(dir, 'src/layouts/BaseLayout.astro');
      const s = readFileSync(p, 'utf8').replace('else { el.textContent = event.data.value; }', 'else { el.innerText = event.data.value; }');
      writeFileSync(p, s);
    },
  },
  {
    name: '§9.4  image.remotePatterns fehlt',
    code: 'ASTRO-CONFIG',
    mutate(dir) {
      const p = join(dir, 'astro.config.mjs');
      writeFileSync(p, readFileSync(p, 'utf8').replace(/image:\s*\{[\s\S]*?\n  \},\n/, ''));
    },
  },
  {
    name: '§9.4  Supabase-Host fehlt in der CSP img-src',
    code: 'ASTRO-CONFIG',
    mutate(dir) {
      const p = join(dir, 'vercel.json');
      const v = JSON.parse(readFileSync(p, 'utf8'));
      for (const r of v.headers) {
        r.headers[0].value = r.headers[0].value.replace(/https:\/\/kolmzvevdvprhvfedswf\.supabase\.co/g, 'https://*.supabase.co');
      }
      writeFileSync(p, JSON.stringify(v, null, 2));
    },
  },
  {
    name: '§8  draft fehlt, Artikel liegt trotzdem in dist/',
    code: 'DRAFT',
    mutate(dir) {
      const p = join(dir, 'src/content/blog/einbruchschutz-nachruesten.md');
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^draft: false$/m, '# draft entfernt'));
    },
  },
  {
    name: '§6.1  ungültiger Banner-Stil',
    code: 'BANNER',
    mutate(dir) {
      const p = join(dir, 'src/content/site.json');
      const d = JSON.parse(readFileSync(p, 'utf8'));
      d.banner.variant = 'party';
      writeFileSync(p, JSON.stringify(d, null, 2));
    },
  },
  {
    name: '§4  Zahl als String in der Content-Datei',
    code: 'JSON-TYP',
    mutate(dir) {
      const p = join(dir, 'src/content/pages/home.json');
      const d = JSON.parse(readFileSync(p, 'utf8'));
      d.testimonials.items[0].rating = '5';
      writeFileSync(p, JSON.stringify(d, null, 2));
    },
  },
  {
    name: '§3.1  maxLength keine ganze Zahl',
    code: 'MAXLENGTH',
    mutate(dir) {
      const p = join(dir, 'src/content/cms.manifest.json');
      const m = JSON.parse(readFileSync(p, 'utf8'));
      m.sections.find((s) => s.id === 'home-hero').fields[0].maxLength = '90';
      writeFileSync(p, JSON.stringify(m, null, 2));
    },
  },
  {
    name: '§5 L1  Alt-Text als Manifest-Feld',
    code: 'ALT-TEXT',
    mutate(dir) {
      const p = join(dir, 'src/content/cms.manifest.json');
      const m = JSON.parse(readFileSync(p, 'utf8'));
      m.sections.find((s) => s.id === 'home-hero').fields.push({
        id: 'home.hero.bildAlt', label: 'Bildbeschreibung', type: 'text',
        file: 'src/content/pages/home.json', path: 'hero.imageAlt', maxLength: 120,
      });
      writeFileSync(p, JSON.stringify(m, null, 2));
    },
  },
  {
    name: '§5 L8  Feld für ein Linkziel',
    code: 'LINKZIEL',
    mutate(dir) {
      const p = join(dir, 'src/content/cms.manifest.json');
      const m = JSON.parse(readFileSync(p, 'utf8'));
      m.sections.find((s) => s.id === 'unternehmen').fields.push({
        id: 'site.telLink', label: 'Telefon-Link', type: 'url',
        file: 'src/content/site.json', path: 'phoneHref',
      });
      writeFileSync(p, JSON.stringify(m, null, 2));
    },
  },
  {
    name: '§5.1  srcset an einem Bild-Marker',
    code: 'BILD',
    mutate(dir) {
      const p = join(dir, 'dist/index.html');
      writeFileSync(p, readFileSync(p, 'utf8').replace(
        'data-cms-field="home.hero.image"',
        'data-cms-field="home.hero.image" srcset="/x.webp 800w"'
      ));
    },
  },
  {
    name: '§7.1  Marker auf einem Wrapper',
    code: 'MARKER',
    mutate(dir) {
      const p = join(dir, 'dist/index.html');
      writeFileSync(p, readFileSync(p, 'utf8').replace(
        'data-cms-field="home.hero.title"',
        'data-cms-field="home.hero.title"'
      ).replace(
        '<h1 data-cms-field="home.hero.title"',
        '<h1 data-cms-field="home.hero.title"'
      ).replace(
        /(<h1[^>]*data-cms-field="home\.hero\.title"[^>]*>)([\s\S]*?)(<\/h1>)/,
        '$1<span data-cms-field="home.hero.title2">x</span>$2$3'
      ));
    },
  },
  {
    name: 'Manifest-Feld ohne jeden Marker im HTML und Template',
    code: 'MARKER',
    mutate(dir) {
      const p = join(dir, 'src/content/cms.manifest.json');
      const m = JSON.parse(readFileSync(p, 'utf8'));
      m.sections.find((s) => s.id === 'home-services').fields.push({
        id: 'home.services.neu', label: 'Neuer Text', type: 'text',
        file: 'src/content/pages/home.json', path: 'services.ctaLabel',
      });
      writeFileSync(p, JSON.stringify(m, null, 2));
    },
  },
];

console.log('Selbsttest cms-check.mjs gegen CMS-REFERENCE v1.5\n');
console.log('Ausgangszustand muss sauber sein:');
const base = makeSandbox();
const baseRun = runCheck(base);
console.log(`  Ausgangsbuild: ${baseRun.code === 0 ? 'OK (Exit 0)' : 'FEHLER — Testbasis ist nicht grün!'}`);
if (baseRun.code !== 0) console.log(baseRun.out.split('\n').slice(-25).join('\n'));
rmSync(base, { recursive: true, force: true });
console.log();

let passed = 0;
const failed = [];
for (const c of cases) {
  const dir = makeSandbox();
  c.mutate(dir);
  const res = runCheck(dir);
  const detected = res.code !== 0 && res.out.includes(c.code);
  if (detected) {
    passed++;
    console.log(`  ✓ ${c.name}`);
  } else {
    failed.push(c.name);
    console.log(`  ✗ ${c.name}`);
    console.log(`      erwartet: Fehlercode ${c.code} — Exit war ${res.code}`);
  }
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${passed}/${cases.length} Regeln erkannt.`);
if (failed.length) {
  console.log(`Nicht erkannt:\n${failed.map((f) => '  - ' + f).join('\n')}`);
  process.exit(1);
}
console.log('Der Checker weist gebrochene Regeln zuverlässig nach.');
