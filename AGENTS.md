# AGENTS.md — Klarwerk Fenster & Türen GmbH

> Hinweis: `requirements.md` ist die **Single Source of Truth** für Fachlichkeit, Design-System, CMS-Schnittstellen und DSGVO-Anforderungen. Diese Datei beschreibt die technische Arbeitsweise im Repo.

## Projektüberblick

Statische Unternehmenswebsite für einen lokalen Fenster- & Türen-Handwerksbetrieb in Hannover. Sie dient gleichzeitig als **Referenz-Implementierung für ein Headless CMS** (Iframe-Preview, Feld-Mapping via DOM-Markern, Manifest-basierte Editierbarkeit). Vollständig DSGVO-konform, Zero-JS-Default, keine externen CDN-Aufrufe.

## Tech-Stack

- **Astro 5** (SSG, Static Output) — einziges Runtime-Dependency
- **Tailwind CSS v4** via `@tailwindcss/vite` (kein PostCSS-Setup; Tokens in `@theme` in `src/styles/global.css`)
- **TypeScript strict** (`astro/tsconfigs/strict`, plus `strictNullChecks` + `noUncheckedIndexedAccess`)
- **Astro Content Layer** (`src/content.config.ts`) mit Zod-Validierung (inkl. `maxLength`-Grenzen)
- Pfad-Alias `@/*` → `src/*`
- Deployment auf **Vercel** (`vercel.json` mit Security-Headern)

## Build- und Prüfkommandos

```bash
npm run dev       # Dev-Server
npm run build     # Produktions-Build → dist/ (Definition of Done: Exit 0)
npm run check     # astro check (Definition of Done: 0 Fehler)
npm run preview   # Build lokal ansehen
```

Es gibt **keine Tests und keinen Linter/Formatter** im Projekt. Verifikation erfolgt ausschließlich über `npm run check` und `npm run build`.

## Code-Organisation

- `src/pages/` — 4 Seiten: `index`, `kontakt`, `impressum`, `datenschutz`
- `src/layouts/BaseLayout.astro` — einziges Layout: Meta, Font-Preloads, **CMS-Preview-Bridge** (Inline-Script), Skip-Link, Cookie-Banner
- `src/components/sections/` — Homepage-Sektionen (Hero, TrustBar, Services, Why, Testimonials, FinalCta)
- `src/components/` — Header, Footer, CookieBanner; `src/components/icons/` — reine Inline-SVGs (FontAwesome Free, lokal), als Astro-Komponenten
- `src/content/` — **der einzige Ort für Inhalte**:
  - `site.json` — alle Unternehmens-Fakten (Adresse, Telefon, Öffnungszeiten, `shortName`/`tagline` für den Header …)
  - `pages/home.json` — alle Marketingtexte der Startseite
  - `pages/kontakt.json` — alle sichtbaren Texte der Kontaktseite inkl. Formular-Statusmeldungen (`messages`, im Template via `data-messages`-Attribut ans Inline-Script übergeben)
  - `cms.manifest.json` — kundeneditierbare Felder, **Version 2**: `{ "version": 2, "features": { "blog": false }, "sections": [...] }`; Sektionen (`id`, `title` DE, `page`) gruppieren Felder (`id`, `label` DE, `type`, `file`, `path`, `maxLength`). Details siehe `CMS-REFERENCE.md` (geht vor).
- `src/lib/content.ts` — Zugriffs-Helper `getSite()` / `getPage('home' | 'kontakt')` über `getEntry` (Overloads liefern `HomeContent`/`KontaktContent` aus `src/content.config.ts`; das Pages-Schema ist intern `partial`, damit beide JSON-Dateien gegen dasselbe Schema validieren)
- `src/styles/global.css` — Tailwind-Import, `@theme`-Tokens, lokale `@font-face`
- `src/assets/fonts/` — lokale `.woff2` (Inter, Plus Jakarta Sans)

## Zentrale Konventionen (strikt einhalten)

1. **Niemals Fakten oder Marketingtexte im Template hart codieren.** Fakten kommen aus `site.json`, Texte aus `pages/*.json` — via `src/lib/content.ts`. Zod-Schemas erzwingen Längenlimits.
2. **DOM-Marker für CMS:** editierbare Elemente tragen `data-cms-field="home.hero.title"`, Section-Wrapper `data-cms-section`. Das Manifest (`cms.manifest.json`) muss bei neuen editierbaren Feldern mitgepflegt werden (nur Text/Bild — keine URLs, Nav, Keys, SEO).
3. **DSGVO:** keine externen CDNs (Fonts/Icons lokal), Formular via Web3Forms mit Honeypot + Datenschutz-Hinweis, Consent-Banner per localStorage vorbereitet (aktuell kein Tracking).
4. **Iframe-Preview:** Zwei Header-Regeln in `vercel.json`: Auf `klarwerk-fenster.de` (`has`-Bedingung auf Host) gilt `frame-ancestors 'self'`; überall sonst (Preview/localhost) `frame-ancestors 'self' http://localhost:* https://*.vercel.app`. **Niemals** `X-Frame-Options: DENY` hinzufügen. Die Preview-Bridge in `BaseLayout.astro` läuft nur im Iframe, ist **verbatim aus `CMS-REFERENCE.md` (Abschnitt 7)** mit `CMS_ORIGINS`-Allowlist und **zwei-wege**: eingehend `CMS_FIELD_UPDATE` (aktualisiert alle Vorkommen via `querySelectorAll` + `CSS.escape`) und `CMS_SELECT_MODE`, ausgehend `CMS_FIELD_SELECT` bei Klick auf ein markiertes Feld (nur mit gültigem Ziel-Origin, niemals `"*"`) inkl. Hover-/Selektions-Outline. Daher müssen `data-cms-field`-Marker an **allen** Vorkommen eines Werts stehen (z.B. `site.phone` in Header, Footer, FinalCta, Kontakt).
5. **Remote-Bilder** nur von `*.supabase.co` (freigegeben in `astro.config.mjs`).
6. **Accessibility/CRO:** WCAG 2.2 AA (Kontraste, Fokus-Ringe, Touch-Targets ≥ 44 px), Mobile-First, genau 1 primärer CTA pro Viewport.

## Umgebung & Secrets

- `.env` mit `PUBLIC_WEB3FORMS_KEY` (Vorlage: `.env.example`) — öffentlicher Client-Key für das Kontaktformular; `.env` ist nicht versioniert und darf nicht committet werden.

## Sprache

Code-Kommentare, UI-Texte, Manifest-Labels und Dokumentation sind **Deutsch**. Neue Beiträge in deutscher Sprache verfassen.
