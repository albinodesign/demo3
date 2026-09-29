import { getEntry } from 'astro:content';
import {
  blogPageSchema,
  datenschutzSchema,
  homeSchema,
  impressumSchema,
  kontaktSchema,
  type DatenschutzContent,
  type HomeContent,
  type ImpressumContent,
  type BlogPageContent,
  type KontaktContent,
} from '../content.config';

// ---------------------------------------------------------------- §10 Regeln
// CMS-REFERENCE §10: "Telefon-Anzeige, `tel:`-/`mailto:`-Ziele, Öffnungszeiten und
// strukturierte Daten aus DERSelben Quelle ableiten — sonst widersprechen sie sich
// nach der ersten Kundenänderung."
// Die Ableitungen unten sind die einzige Quelle. In `site.json` verbliebene
// Duplikate (`phoneHref`, `hours.schema`) werden bewusst ignoriert, damit sie
// nicht auseinanderlaufen können — die Datei wird nie umgeschrieben.

/**
 * Anzeige-Nummer → `tel:`-Ziel (CMS-REFERENCE §5 L8: Linkziele sind abgeleitet).
 * `0511 8976543` → `+495118976543`; `+49 151 123` → `+49151123`.
 */
export function toTelHref(display: string): string {
  const trimmed = display.trim();
  const international = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return trimmed;
  if (international) return `+${digits}`;
  // Nationale Nummer: führende 0 = Vorwahl des Landes, hier Deutschland (49).
  const national = digits.startsWith('0') ? digits.slice(1) : digits;
  return `+49${national}`;
}

const DAY_CODES: Record<string, string> = {
  mo: 'Mo',
  montag: 'Mo',
  di: 'Tu',
  dienstag: 'Tu',
  mi: 'We',
  mittwoch: 'We',
  do: 'Th',
  donnerstag: 'Th',
  fr: 'Fr',
  freitag: 'Fr',
  sa: 'Sa',
  samstag: 'Sa',
  so: 'Su',
  sonntag: 'Su',
};

/**
 * Anzeige-Öffnungszeiten → schema.org `openingHours`, z. B.
 * `Mo - Do: 07:30 - 16:30 Uhr` → `Mo-Th 07:30-16:30`.
 * Unerkennbare Zeilen werden übersprungen — lieber keine als falsche Daten
 * in den strukturierten Daten.
 */
export function toOpeningHours(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const times = [...line.matchAll(/(\d{1,2})\s*[:.]\s*(\d{2})\s*(?:Uhr)?\s*(?:-|–|—|bis)\s*(\d{1,2})\s*[:.]\s*(\d{2})/g)];
    if (times.length === 0) continue;
    const first = times[0]!;
    const before = line.slice(0, first.index ?? 0).toLowerCase();
    const tokens = [...before.matchAll(/[a-zäöüß]+/g)]
      .map((t) => DAY_CODES[t[0]])
      .filter((c): c is string => Boolean(c));
    if (tokens.length === 0) continue;
    const day = tokens.length === 1 ? tokens[0] : `${tokens[0]}-${tokens[tokens.length - 1]}`;
    const pad = (n: string) => n.padStart(2, '0');
    for (const t of times) {
      out.push(`${day} ${pad(t[1]!)}:${t[2]}-${pad(t[3]!)}:${t[4]}`);
    }
  }
  return out;
}

// --------------------------------------------------------------- Zugriffslayer
export async function getSite() {
  const entry = await getEntry('site', 'site');
  if (!entry) throw new Error('site.json nicht gefunden');
  const site = entry.data;
  return {
    ...site,
    // Abgeleitet, nicht aus der Datei gelesen (siehe Kommentar oben).
    phoneHref: toTelHref(site.phone),
    openingHours: toOpeningHours([site.hours.monThu, site.hours.fri]),
  };
}

export type Site = Awaited<ReturnType<typeof getSite>>;

// Die Sammlung nutzt ein zusammengeführtes Partial-Schema, damit alle
// Seiten-Dateien gegen dasselbe Schema validiert werden. Für den Zugriff wird
// deshalb pro Seite noch einmal streng geparst — CMS-REFERENCE §10 verbietet
// "Teil-Schemata mit anschließend behaupteter vollständiger Typsicherheit".
const PAGE_SCHEMAS = {
  home: homeSchema,
  kontakt: kontaktSchema,
  impressum: impressumSchema,
  datenschutz: datenschutzSchema,
  blog: blogPageSchema,
} as const;

type PageId = keyof typeof PAGE_SCHEMAS;

export function getPage(id: 'kontakt'): Promise<KontaktContent>;
export function getPage(id: 'home'): Promise<HomeContent>;
export function getPage(id: 'impressum'): Promise<ImpressumContent>;
export function getPage(id: 'datenschutz'): Promise<DatenschutzContent>;
export function getPage(id: 'blog'): Promise<BlogPageContent>;
export async function getPage(id: PageId) {
  const entry = await getEntry('pages', id);
  if (!entry) throw new Error(`Seite "${id}" nicht gefunden`);
  // Wirft mit klarer Meldung, statt still einen unvollständigen Inhalt zu rendern.
  return PAGE_SCHEMAS[id].parse(entry.data) as
    | HomeContent
    | KontaktContent
    | ImpressumContent
    | DatenschutzContent
    | BlogPageContent;
}
