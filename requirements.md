# Requirements — Klarwerk Fenster & Türen GmbH (Referenz-Website für Headless CMS)

> **Single Source of Truth.** Alle nachfolgenden Phasen richten sich strikt nach diesem Dokument.

## 1. Projektziel

Hochkonvertierende, extrem performante, 100 % DSGVO-konforme Unternehmenswebsite für einen lokalen Fenster- & Türen-Handwerksbetrieb in Hannover. Die Website dient als **Referenz-Implementierung für ein Headless-CMS** (Iframe-Preview, Feld-Mapping via DOM-Marker, Manifest-basierte Editierbarkeit).

## 2. Unternehmens-Fakten (niemals halluzinieren, niemals hart codieren)

| Feld | Wert |
|---|---|
| Name | Klarwerk Fenster & Türen GmbH |
| Inhaber | Jonas Weber (Handwerksmeister) |
| Adresse | Handwerkerstraße 14, 30165 Hannover |
| Telefon | 0511 8976543 |
| E-Mail | anfrage@klarwerk-fenster.de |
| Öffnungszeiten | Mo – Do: 07:30 – 16:30 Uhr, Fr: 07:30 – 13:30 Uhr |
| Leistungen | Fenster-Modernisierung, Haustüren-Montage, Einbruchschutz & Smart-Home-Sicherheit, Reparatur & Wartung |
| USPs | 25 Jahre Garantie, Eigene deutsche Fertigung, Montage in 1 Tag, Festpreisgarantie |

Diese Daten leben **ausschließlich** in `src/content/site.json`. Marketingtexte leben ausschließlich in `src/content/pages/home.json`.

## 3. Tech-Stack

- **Framework:** Astro 5 (Static Site Generation, Zero-JS-Default)
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite`)
- **Sprache:** TypeScript (`strict`, via `astro/tsconfigs/strict`)
- **Content:** Astro Content Layer (`src/content.config.ts`) + Zod-Validierung
- **Fonts:** Lokal als `.woff2` in `src/assets/fonts/` (@font-face + preload) — keine Google-Fonts-CDN-Aufrufe (DSGVO)
- **Icons:** Reine Inline-SVGs als Astro-Komponenten in `src/components/icons/` (FontAwesome Free, lokal)
- **Bilder:** Astro `<Image />`, lokal; Remote-Domain `*.supabase.co` freigegeben
- **Formular:** Web3Forms (`PUBLIC_WEB3FORMS_KEY` via `.env`), Honeypot, clientseitige Validierung
- **Consent:** Lokales Cookie-Banner (Vanilla JS, localStorage), blockiert optionale Skripte bis Consent
- **Deployment:** Vercel (`vercel.json` mit Security-Headern)

## 4. Design-System

### Farb-Variablen (Tailwind v4 `@theme`, `src/styles/global.css`)

| Token | Hex | Verwendung |
|---|---|---|
| `--color-primary` | `#1B4F72` | Tiefes Vertrauensblau — Buttons, Überschriften-Akzente |
| `--color-primary-dark` | `#123A55` | Hover/Active, Footer |
| `--color-accent` | `#E8A33D` | Warmes Handwerker-Amber — CTAs, Highlights |
| `--color-accent-dark` | `#C58425` | CTA-Hover |
| `--color-surface` | `#F7F8FA` | Helle Sektions-Hintergründe |
| `--color-ink` | `#1C2430` | Fließtext |
| `--color-ink-muted` | `#55606E` | Sekundärtext |
| `--color-trust` | `#2E7D4F` | Trust-Badges, Erfolg/Verifizierung |

### Typografie

- **Headlines:** Plus Jakarta Sans (700/800), lokal `.woff2`
- **Body:** Inter (400/500/600), lokal `.woff2`
- Fallbacks: `system-ui, sans-serif`

### Prinzipien

- Mobile-First, Breakpoints: `sm 640 / md 768 / lg 1024 / xl 1280`
- WCAG 2.2 AA: Kontrast ≥ 4.5:1, Fokus-Ringe, semantisches HTML, Touch-Targets ≥ 44 px
- CRO: Pro Viewport genau 1 primärer CTA, Sticky-Mobile-CTA, Trust-Signale nahe an Conversion-Punkten

## 5. CMS-Schnittstellen (Headless-Referenz)

1. **Content Layer:** `src/content.config.ts` mit Zod-Schemas; `site.json` (Fakten), `pages/home.json` (Marketing).
2. **Manifest:** `src/content/cms.manifest.json` — 15–25 kundeneditierbare Felder mit `id`, `label` (DE), `type`, `file`, `path`, `maxLength`. Nur editierbare Felder. Keine URLs, Nav, Formular-Keys, SEO-Tags.
3. **DOM-Marker:** `data-cms-section` auf Section-Wrappers, `data-cms-field` auf editierbaren Text-/Bild-Tags. IDs im Format `home.hero.title`.
4. **Preview-Bridge:** Inline-Script im `<head>` des Layouts — lauscht (nur im Iframe) auf `postMessage` vom Typ `CMS_FIELD_UPDATE` und patched `innerText`/`img.src` live.
5. **Iframe-Einbettung:** CSP `frame-ancestors 'self' http://localhost:* https://*.vercel.app` — **kein** `X-Frame-Options: DENY`.
6. **Remote-Bilder:** `*.supabase.co` in `astro.config.mjs` freigegeben.

## 6. Security-Header (`vercel.json`)

- `Content-Security-Policy` (inkl. `frame-ancestors` für CMS-Preview, `default-src 'self'`, `connect-src` für Web3Forms)
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (Kamera/Mikro/Geo aus)
- `Strict-Transport-Security`
- **Explizit kein** `X-Frame-Options: DENY`

## 7. DSGVO-Anforderungen

- Keine externen CDN-Aufrufe ohne Consent (Fonts/Icons lokal)
- Cookie-/Consent-Banner vor jeglichem Tracking (es gibt aktuell kein Tracking — Banner ist vorbereitet & dokumentiert)
- Kontaktformular mit Datenschutz-Hinweis + Link, Honeypot-Spam-Schutz
- Impressum & Datenschutz als eigene Seiten, Fakten aus `site.json`

## 8. Meilensteine / Phasen

| Phase | Umfang | Status |
|---|---|---|
| 1 | Setup, requirements.md, Tailwind/TS strict, vercel.json, astro.config | ✅ |
| 2 | Design-System, Fonts, Icons, Content Layer, Manifest, DOM-Marker, Preview-Bridge | ✅ |
| 3 | Seiten (Start, Kontakt, Impressum, Datenschutz), strikte Content-Entkopplung | ✅ |
| 4 | Formular + Web3Forms, Consent-Banner, WCAG/Schema.org, Build & `astro check` grün | ✅ |

## 9. Definition of Done (Gesamt)

- `npm run build` → Exit Code 0
- `npx astro check` → 0 Fehler
- Kein Fakt/Kein Marketingtext hart im Template codiert
- Lighthouse-Ziele: Performance ≥ 95, Accessibility ≥ 95, SEO 100
