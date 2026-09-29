#!/usr/bin/env node
/**
 * check-cms-images.mjs — Vorprüfung der CMS-Bilder vor dem Build.
 *
 * Warum das nötig ist: Astro lädt Remote-Bilder zur Build-Zeit. Ist eine im CMS
 * hinterlegte Bild-URL nicht erreichbar, bricht der Build ab — und mit ihm der
 * Vercel-Deploy. Das Skript prüft die URLs vorher und nennt die konkrete
 * Content-Datei und den Pfad, damit der Fehler sofort behebbar ist.
 *
 * Zusätzlich wird die Dateigröße gemessen. Das CMS soll Bilder auf ≤ 500 KB
 * normalisieren (CMS-REFERENCE §9). Übergroße Dateien werden zunächst nur
 * gemeldet: die Datei gehört dem Kunden, und ein blockierter Build würde die
 * komplette Seite einfrieren. Für die Freigabe gibt es den strengen Modus:
 *
 *   node scripts/check-cms-images.mjs            → Größe = Warnung (Standard, prebuild)
 *   node scripts/check-cms-images.mjs --strict   → Größe = Fehler (Release-Gate)
 *
 * Ein nicht erreichbares Bild ist immer ein Fehler: daran scheitert der Build.
 *
 * Aufruf: node scripts/check-cms-images.mjs [--strict]
 * Exit:   1 = Bild-URL nicht erreichbar (bzw. im --strict-Modus: Bild zu groß)
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const STRICT = process.argv.includes('--strict');
const SOFT_LIMIT_KB = 500; // Zielwert laut CMS-REFERENCE §9
const HARD_LIMIT_KB = 1500; // darüber ist es kein „Bild" mehr, sondern ein Blocker

const readJson = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

function getPath(obj, dotPath) {
  const segments = dotPath
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter((s) => s !== '');
  let cur = obj;
  for (const seg of segments) {
    if (cur === null || typeof cur !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, seg)) return undefined;
    cur = cur[seg];
  }
  return cur;
}

/**
 * Liest einen Wert aus dem YAML-Frontmatter und beherrscht die vom CMS
 * verwendete Block-Skalar-Schreibweise:
 *   coverImage: >-
 *     https://…/bild.png
 * sowie einfache und doppelt gequotete Werte.
 */
export function parseFrontmatterValue(raw, key) {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === '---');
  if (start === -1) return null;
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') break;
    const inline = new RegExp(`^${key}:\\s*(.*)$`).exec(line);
    if (!inline) continue;
    const value = inline[1].trim();
    if (/^[>|][-+]?\d*$/.test(value)) {
      // Block-Skalar: Folgezeilen einsammeln, bis eine neue Option folgt.
      const block = [];
      for (let j = i + 1; j < lines.length; j++) {
        const next = lines[j];
        if (/^\S/.test(next) || next.trim() === '---') break;
        block.push(next.trim());
      }
      return block.join(' ').trim();
    }
    return value.replace(/^["']|["']$/g, '').trim();
  }
  return null;
}

// Alle CMS-Bildwerte einsammeln: aus dem Manifest (maßgeblich) + Blog-Frontmatter.
const images = [];

const manifest = readJson('src/content/cms.manifest.json');
for (const section of manifest.sections ?? []) {
  for (const field of section.fields ?? []) {
    if (field.type !== 'image' || !existsSync(join(ROOT, field.file))) continue;
    const value = getPath(readJson(field.file), field.path);
    if (typeof value === 'string' && /^https?:\/\//.test(value)) {
      images.push({ where: `${field.file}#${field.path}`, fieldId: field.id, url: value });
    }
  }
}

const blogDir = join(ROOT, 'src/content/blog');
if (existsSync(blogDir)) {
  for (const name of readdirSync(blogDir).filter((n) => n.endsWith('.md'))) {
    const raw = readFileSync(join(blogDir, name), 'utf8');
    // Das CMS schreibt lange URLs als YAML-Block-Skalar: "coverImage: >-" + Folgezeile.
    // Nur die erste Zeile zu lesen ergäbe ">-" und würde das Bild übersehen.
    const coverImage = parseFrontmatterValue(raw, 'coverImage');
    if (coverImage && /^https?:\/\//.test(coverImage)) {
      images.push({ where: `src/content/blog/${name}#coverImage`, fieldId: null, url: coverImage });
    }
  }
}

if (images.length === 0) {
  console.log('check-cms-images — keine Remote-Bilder im Content. OK.');
  process.exit(0);
}

// Doppelte URLs nur einmal prüfen, aber alle Fundstellen nennen.
const byUrl = new Map();
for (const img of images) {
  if (!byUrl.has(img.url)) byUrl.set(img.url, []);
  byUrl.get(img.url).push(img.where);
}

const errors = [];
const warnings = [];

for (const [url, places] of byUrl) {
  let sizeKb = null;
  try {
    const res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, redirect: 'follow' });
    if (!res.ok && res.status !== 206) {
      throw new Error(`HTTP ${res.status}`);
    }
    const cr = res.headers.get('content-range');
    if (cr) {
      const total = Number(cr.split('/')[1]);
      if (Number.isFinite(total)) sizeKb = Math.round(total / 1024);
    } else {
      const len = res.headers.get('content-length');
      if (len) sizeKb = Math.round(Number(len) / 1024);
    }
    // Antwortkörper nicht nötig → Verbindung schließen
    if (res.body) await res.body.cancel();
  } catch (e) {
    errors.push(
      `Bild-URL nicht erreichbar (${e.message}):\n      ${url}\n      verwendet in: ${places.join(', ')}`
    );
    continue;
  }

  if (sizeKb !== null && sizeKb > HARD_LIMIT_KB) {
    const msg =
      `Bild ist ${sizeKb} kB groß (Grenze ${HARD_LIMIT_KB} kB):\n      ${url}\n      verwendet in: ${places.join(', ')}`;
    if (STRICT) errors.push(msg);
    else warnings.push(msg + `\n      → verlangsamt die Seite messbar (LCP/Transfer). Für die Freigabe mit --strict prüfen.`);
  } else if (sizeKb !== null && sizeKb > SOFT_LIMIT_KB) {
    warnings.push(
      `Bild ist ${sizeKb} kB groß (Ziel ≤ ${SOFT_LIMIT_KB} kB laut CMS-REFERENCE §9):\n      ${url}\n      verwendet in: ${places.join(', ')}`
    );
  } else {
    console.log(`  ok  ${String(sizeKb ?? '?').padStart(5)} kB  ${places.join(', ')}`);
  }
}

console.log(
  `check-cms-images — ${images.length} Bildverweise in ${byUrl.size} URLs geprüft (Modus: ${STRICT ? 'strict' : 'standard'}).`
);

if (warnings.length) {
  console.log(`\nWARNUNGEN (${warnings.length}):`);
  for (const w of warnings) console.log('  ! ' + w);
}
if (errors.length) {
  console.log(`\nFEHLER (${errors.length}) — Build wird gestoppt, damit keine halbe Seite live geht:`);
  for (const e of errors) console.log('  ✗ ' + e);
  console.log(
    '\nMaßnahme: Bild im CMS neu hochladen (lange Seite ≤ 1600 px, ≤ 500 KB) oder die URL\n' +
      'auf einen erreichbaren, öffentlichen http(s)-Pfad setzen. Content-Dateien werden dabei\n' +
      'nicht umformatiert und keine Schlüssel gelöscht.'
  );
  process.exit(1);
}
process.exit(0);
