# CMS-REFERENCE.md — Verbindlicher Contract: Agency CMS ↔ Website

- **Version:** 1.5 · **Stand:** 2026-09-29
- **Geprüft gegen:** CMS-Repo `main`, Commit `6e42853` (Testsuite: 91 Tests bestanden)
- **Diese Datei gewinnt:** Bei Widerspruch zwischen dieser Referenz, `AGENTS.md`, `README.md`, `requirements.md` und den Agentur-Prompts gilt **immer diese Datei**.
- **Adressat:** KI-Coding-Agenten und Entwickler, die eine Website **neu** CMS-kompatibel bauen oder eine bestehende umbauen. Kein Vorwissen über das CMS nötig.
- **Einzige Quelle der Wahrheit:** Diese Datei liegt im CMS-Repo. Die Prompts enthalten **keine** CMS-Detailregeln mehr, sondern verweisen hierher.

---

## 1. Kurzfassung

Das Agency CMS lässt Kunden Texte, Bilder und Blog-Artikel selbst bearbeiten. Das CMS schreibt Änderungen per GitHub-API als Commits auf `main`; Vercel deployed automatisch.

Die Website muss dafür genau drei Dinge liefern:

| # | Lieferung | Ohne sie passiert |
|---|---|---|
| **a** | **Manifest** `src/content/cms.manifest.json` | Felder erscheinen nicht im Editor |
| **b** | **Content-Dateien** `src/content/site.json` + `src/content/pages/*.json` | Publish schlägt fehl (Typen/Pfade) |
| **c** | **Vorschau-Brücke** (Script + DOM-Marker) | Tippen ist unsichtbar, Klicks ins Leere |

**Standardziel:** Jeder sichtbare Text und jedes sichtbare Bild auf allen Seiten ist per CMS editierbar. Ausnahmen sind nur, was das CMS technisch nicht kann — und die sind in Abschnitt 5 **abschließend** aufgelistet. Alles andere ist Pflicht.

---

## 2. Registry — feste Werte

Diese Werte sind **nicht verhandelbar** und **nirgends zu raten**. Ein Platzhalter hier ist die häufigste Ursache für eine tote Vorschau.

| Was | Wert |
|---|---|
| **CMS-Origin (Produktion)** | `https://agency-cms-teal.vercel.app` |
| CMS-Origin (lokal, nur Entwicklung) | `http://localhost:3000` |
| Manifest-Pfad | `src/content/cms.manifest.json` |
| Unternehmensdaten | `src/content/site.json` |
| Seiteninhalte | `src/content/pages/[name].json` |
| Blog-Artikel | `src/content/blog/[slug].md` |
| Branch | `main` — Vercel **muss** `main` als Produktion deployen |
| JSON-Schreibformat (CMS-seitig) | `JSON.stringify(data, null, 2)` |
| Supabase-Storage-Bucket für Bilder | `cms-media` (öffentlich) |

> **Regel:** Taucht in einer Website `cms.deine-agentur.de`, `cms.example.com`, `cms.invalid` oder ein leerer Wert auf, ist das ein **Fehler**, kein Platzhalter zum Ausfüllen. Sofort ersetzen durch `https://agency-cms-teal.vercel.app`.

---

## 3. Manifest-Format

```json
{
  "version": 2,
  "features": { "blog": true },
  "sections": [
    {
      "id": "hero",
      "title": "Hero-Bereich",
      "page": "Startseite",
      "fields": [
        { "id": "hero.title", "label": "Titel", "type": "text", "file": "src/content/pages/home.json", "path": "hero.title", "placeholder": "Willkommen …", "maxLength": 90 },
        { "id": "hero.bild", "label": "Hintergrundbild", "type": "image", "file": "src/content/pages/home.json", "path": "hero.image", "aspectRatio": "16:9" },
        { "id": "hero.preis", "label": "Preis (€)", "type": "number", "file": "src/content/pages/home.json", "path": "hero.price" }
      ]
    }
  ]
}
```

### 3.1 Schlüssel

| Schlüssel | Pflicht | Regel (gegen den CMS-Code geprüft) |
|---|---|---|
| `version` | nein | Wird vom CMS **nicht ausgewertet**. Nur Konvention — `2` setzen, damit die Datei lesbar bleibt. |
| `sections[].id` | ja | Beliebig. Fehlt er, vergibt das CMS `section-N` **und zeigt eine Warnung** im Editor. |
| `sections[].title` | ja | Anzeigetext. Fallback-Kette im CMS: `label` → `title` → `sectionLabel` → `id` → `section`. |
| `sections[].page` | nein | **Wirksam.** Gruppiert die Seiten-Tabs im Editor. Ohne Angabe rät der Editor per Stichwort-Heuristik über ID/Titel, sonst über den Dateinamen. **Für Kundenprojekte immer setzen** — die Vorschau-URL leitet sich daraus ab. |
| `sections[].fields[]` | ja | Leere Sektionen werden ausgeblendet **und** gemeldet. |
| `fields[].id` | ja | **Global eindeutig — zwingend.** |
| `fields[].label` | ja | Anzeigetext. Fallback `title` → `id`. Deutsche, nutzerverständliche Beschriftung. |
| `fields[].type` | ja | Einer der 9 Typen aus Abschnitt 4. |
| `fields[].file` | ja | Nur `src/content/site.json` oder `src/content/pages/*.json`. |
| `fields[].path` | ja | Dot-Path, siehe 3.3. |
| `fields[].placeholder` | nein | Beispieltext im Editor. |
| `fields[].maxLength` | nein | **Ganze Zahl 1–10000.** Alles andere blockiert den Publish dieser Datei. |
| `fields[].aspectRatio` | nein | Nur bei `type: "image"`. Erlaubt sind **exakt** `"16:9"`, `"1:1"`, `"4:3"`. Andere Werte werden ignoriert (kein Fehler). |
| `features.blog` | nein | `true` oder `{ "enabled": true }` blendet den Blog-Tab ein. |

### 3.2 Zwei Regeln, die den ganzen Publish blockieren

> **Regel 1 — IDs müssen global eindeutig sein.**
> Zwei Felder mit derselben `id` ⇒ das CMS lehnt **jede** Veröffentlichung mit HTTP 400 ab: *„Feld X ist doppelt vergeben … es wurde nichts veröffentlicht, Entwürfe bleiben erhalten."* Das ist der häufigste Totalausfall in der Praxis. Es gibt keine Teilveröffentlichung als Ausweg.
>
> **Regel 2 — Ein Schreibziel, ein Feld.**
> Zwei Felder dürfen **nicht** auf dasselbe Paar `file` + `path` zeigen. `items[0].x` und `items.0.x` gelten als dasselbe Ziel. Für einen mehrfach dargestellten Wert wird **ein** Feld angelegt und an allen Stellen mit derselben ID markiert.

### 3.3 Feld-IDs und Pfade

**Feld-IDs:** Verwende `[a-z0-9._-]`, klein, ohne Leerzeichen. Großbuchstaben im camelCase (`site.header.ctaLabel`) funktionieren und sind erlaubt.

Trotzdem zwei echte Fallen:

1. **Das Manifest lädt IDs ohne Zeichenfilter.** Eine ID wie `Titel "Hero"` wird *nicht* verworfen — sie erscheint ganz normal im Editor.
2. **Der Klick-Pfad filtert aber.** Der Editor verwirft eingehende `CMS_FIELD_SELECT`-Nachrichten still, sobald die ID eines von `< > " ' \`` oder Leerzeichen enthält (`isSafeFieldId`).

Ergebnis: Solche Felder sind im CMS sichtbar, reagieren aber auf keinen Klick. Saubere IDs sind deshalb keine Formalität.

**Pfade:**
- Höchstens **20 Ebenen**, höchstens **500 Zeichen**, Listen-Index höchstens **9999**.
- Verboten als Segment: `__proto__`, `constructor`, `prototype`.
- Verboten: leere Abschnitte (`a..b`), nicht-numerische Klammern (`[name]`, `[0`).
- `items[0].title` und `items.0.title` sind dasselbe Ziel.

---

## 4. Die 9 Feldtypen

| Typ | Editor | Wert in der JSON-Datei | Prüfung Entwurf → Publish |
|---|---|---|---|
| `text` | einzeilig | `"Willkommen"` | beliebig, leer erlaubt; `"true"` bleibt Text |
| `textarea` | mehrzeilig | `"Zeile 1\nZeile 2"` | wie `text` |
| `image` | Upload + URL | `"https://….supabase.co/…/foto.jpg"` | http(s) **oder** sicherer interner Pfad (`/bilder/x.jpg`, `logo.png`); abgelehnt: `javascript:`, `data:`, `..`, Leerzeichen, Quotes |
| `number` | Zahlfeld | `19.9` — **echte JSON-Zahl** | Entwurf: `"42"`, `"19,90"` ok. Publish: echte endliche Zahl; leer blockiert die Datei |
| `email` | Textfeld | `"info@beispiel.de"` | Form `a@b.cc` |
| `phone` | Textfeld | `"+49 171 123456"` | beginnt mit `+` oder Ziffer, mindestens 5 Zeichen |
| `url` | Textfeld | `"https://beispiel.de"` | wie `image`, zusätzlich `http://` erlaubt |
| `date` | Datum | `"2026-09-26"` | exakt `JJJJ-MM-TT` **und** echtes Kalenderdatum |
| `boolean` | Schalter | `true` — **echter JSON-Boolean** | Entwurf: `"true"`/`"false"`. Publish: echter Boolean; leer blockiert die Datei |

**Grundregel aller Typen:** Der Endstand nach Publish enthält in deklarierten Feldern **niemals** `null`, falsche Typen oder überlange Texte. Sonst bleibt die Datei Entwurf (400 mit Grund), saubere Dateien gehen trotzdem live (`partial: true`).

**Keine anderen Feldtypen.** `color`, `select`, `richtext`, `link`, `toggle`, `date-range` o. ä. existieren nicht. Ein unbekannter Typ wird im Editor stillschweigend zu `text` **und** gemeldet — im Publish wird er dagegen **hart abgelehnt**. Deshalb: Manifest und Code-Stand prüfen, bevor man Typen erfindet.

---

## 5. Grenzen des CMS — was es nicht kann

**Das Wichtigste zum Nachschlagen.** Diese Punkte sind technische Grenzen, keine Design-Vorgaben. Wer sie umgehen „löst", erzeugt Felder, die in der Vorschau nichts tun.

| # | Das CMS kann **nicht** | Stattdessen |
|---|---|---|
| **L1** | **Keine Alt-Texte für Content-Bilder.** Es gibt kein Feld dafür. | `alt` fest im Template (sprechend formuliert). Editierbar ist nur das **Bild selbst**. `coverImageAlt` im Blog-Frontmatter ist eine eigene Sache (siehe 8). |
| **L2** | **Keine Listen vergrößern oder verkleinern.** | Bestehende Einträge sind wie normale Felder änderbar. Neue Einträge legt die Agentur im Repo an. |
| **L3** | **Keine Listeneinträge löschen.** | Wird vom CMS abgelehnt (400). |
| **L4** | **Keine Steuerfelder live in der Vorschau.** | Werte, die nur ein Aussehen steuern (Banner `enabled`/`variant`, Sternebewertung, Platzhalter-Attribute) brauchen **keinen** Marker. Sie wirken nach dem Veröffentlichen — das ist korrekt, kein Fehler. |
| **L5** | **Kein CSS-Hintergrundbild editierbar.** | Jedes sichtbare Bild als eigenständiges `<img>` ausgeben. |
| **L6** | **Keine Markdown-Dateien als Feldziel.** | Nur `.json` unter `src/content/site.json` und `src/content/pages/`. Blog läuft über die Blog-API (Abschnitt 8). |
| **L7** | **Keine Bildbearbeitung.** | Kein Zuschneiden, Drehen oder Filtern. Die Website muss das Layout für beliebige Seitenverhältnisse tolerieren. |
| **L8** | **Kein Feld für Ziele/Links.** | `tel:`-, `mailto:`- und Button-URLs werden aus Telefon/E-Mail bzw. festen Pfaden abgeleitet und sind nicht frei editierbar. |

### 5.1 Fallstrick: Bild in Astro-`<Image>` mit `widths`

Die Brücke setzt bei `IMG` eine **neue `src`** und **entfernt `srcset`**. Erzeugt Astro ein `srcset` (das passiert bei `widths`/`sizes` oder `<Picture>`), bricht die Vorschau damit die responsive Darstellung ab — sichtbar andere Proportionen als auf der Live-Seite.

> **Regel:** Am `data-cms-field` eines Bildfeldes **kein `widths`, kein `sizes`, kein `<Picture>`** verwenden. Feste `width`/`height` für stabile Maße sind erlaubt und gewünscht. Ohne diese Einschränkung entsteht kein `srcset`, und `src`/Alt/`srcset`-Verhalten der Brücke ist unkritisch.
>
> Vor dem Umbau prüfen: `grep 'srcset=' dist/**/*.html` — findet sich `srcset` an einem Bild-Marker, ist das ein Fehler.

---

## 6. Content-Dateien

### 6.1 `src/content/site.json`

```json
{
  "firma": { "name": "Malerbetrieb Schmidt", "telefon": "+49 171 123456" },
  "banner": { "enabled": false, "variant": "info", "text": "" }
}
```

Der Rest der Datei ist frei. Das `banner`-Objekt muss **exakt** `{ enabled, variant, text }` sein — unbekannte Schlüssel darin werden abgelehnt. Standard für neue Websites: `{ "enabled": false, "variant": "info", "text": "" }`. Bei `enabled: false` darf `variant` jeder der drei erlaubten Stile sein, `text` darf leer bleiben.

### 6.2 `src/content/pages/home.json`

Beliebig tief. **Listen sind fest** (siehe L2).

```json
{
  "hero": { "title": "Willkommen", "image": "https://….supabase.co/…/hero.jpg" },
  "faq": { "items": [{ "frage": "Wie schnell?", "antwort": "In 48 Stunden." }] }
}
```

Dateiname: `src/content/pages/<name>.json`, wobei `<name>` auf `[A-Za-z0-9][A-Za-z0-9._-]*` passt. Maximale Pfadlänge 200 Zeichen.

### 6.3 Website-Pflichten für Content-Dateien

- **Nie umformatieren.** JSON wird vom CMS als `JSON.stringify(data, null, 2)` zurückgeschrieben; andere Einrückung erzeugt Rauschen im Diff und in der Historie.
- **Fremde Schlüssel stehen lassen.** Der CMS entfernt nichts, was es nicht kennt — aber die Website sollte auch keine fremden Schlüssel erzeugen.
- **Kundenwerte nie „korrigieren".** Auch nicht offensichtliche Testreste: das ist eine Entscheidung der Agentur, nicht des Umbau-Agenten.

---

## 7. DOM-Marker und Vorschau-Brücke

### 7.1 Marker

- `data-cms-section="<sektions-id>"` — Strukturinformation, reserviert für spätere Sprünge. Immer setzen.
- `data-cms-field="<feld-id>"` — am **innersten editierbaren Element**.

> **Marker-Regel:** Der Marker sitzt **immer am innersten Element mit dem Text bzw. dem Bild**. Nie auf einem Wrapper, der noch einen anderen Marker enthält — die Brücke setzt `textContent` und würde den inneren Marker dabei löschen.
>
> Verschachteltes Markup (Icons, `<strong>`, `<br>`) gehört **in** das markierte Element, nicht darum herum.

```astro
---
import { getEntry } from "astro:content";
const home = await getEntry("pages", "home");
const site = await getEntry("site");
---
<section data-cms-section="hero">
  <h1 data-cms-field="hero.title">{home.data.hero.title}</h1>
  <img data-cms-field="hero.image" src={home.data.hero.image} alt="Hochwertige Fensterfassade" width="800" height="600" />
  <a href={`tel:${site.data.firma.telefon}`}>
    <span data-cms-field="kontakt.telefonAnzeige">{site.data.firma.telefon}</span>
  </a>
</section>
```

Bei **mehrfach dargestellten Werten** tragen **alle** Vorkommen dieselbe `data-cms-field` — die Brücke aktualisiert sie gemeinsam. Beispiel: Telefonnummer in Header, Kontakt, Footer und Impressum; Firmenname in Footer, Impressum und JSON-LD.

Bei **leeren oder zunächst ausgeblendeten Inhalten** (z. B. ein Akkordeon-Panel, ein `hidden`-Attribut) trotzdem markieren. Die Brücke aktualisiert auch Elemente, die gerade nicht sichtbar sind.

### 7.2 Brücke — bitte verbatim übernehmen

Dieses Skript gehört in `<head>` des **Root-Layouts**, damit es auf jeder Seite wirkt. Es ist gegen den CMS-Code geprüft.

> **Vier Regeln, die in diesem Skript nicht verhandelbar sind:**
> 1. **Niemals `postMessage(…, "*")`.** Antworten gehen immer an den verifizierten Origin (`cmsOrigin` bzw. das Ergebnis von `cmsTargetOrigin()`).
> 2. **`event.origin` wird immer gegen `CMS_ORIGINS` geprüft**, `event.source` immer gegen `window.parent`.
> 3. **`textContent`, nie `innerText`.** `innerText` ersetzt das Element samt Kindknoten und zerstört Icons und verschachteltes Markup.
> 4. **Kein `window.location.origin` in `CMS_ORIGINS`.** Die eigene Website ist keine CMS-Origin; sonst gilt jede Seite desselben Origins als CMS.

```html
<script is:inline>
  if (window.self !== window.top) {
    const CMS_ORIGINS = [
      "https://agency-cms-teal.vercel.app",
      "http://localhost:3000",
    ];
    let selectMode = true; // true = "Finden", false = "Surfen"
    // Gemerkte CMS-Herkunft aus geprüften CMS-Nachrichten (stärker als
    // document.referrer): Nach Navigation über einen In-Preview-Link ist der
    // Referrer die Website-Seite, der gemerkte Origin bleibt die CMS-Domain.
    let cmsOrigin = null;
    let bridgeBereitGemeldet = false;
    function meldeBridgeBereit() {
      if (bridgeBereitGemeldet || !cmsOrigin) return;
      bridgeBereitGemeldet = true;
      window.parent.postMessage({ type: "CMS_BRIDGE_READY", version: 2 }, cmsOrigin);
    }
    window.addEventListener("message", (event) => {
      if (!CMS_ORIGINS.includes(event.origin)) return;   // 1. Origin
      if (event.source !== window.parent) return;        // 2. Quelle
      cmsOrigin = event.origin; meldeBridgeBereit();
      if (event.data?.type === "CMS_SELECT_MODE") { selectMode = event.data.enabled !== false; return; }
      if (event.data?.type !== "CMS_FIELD_UPDATE") return;
      if (typeof event.data.field !== "string" || typeof event.data.value !== "string") return; // 3. Form
      if (/[<>"'`]/.test(event.data.field)) return;      // 4. keine Injection
      document.querySelectorAll(`[data-cms-field="${CSS.escape(event.data.field)}"]`).forEach((el) => {
        if (el.tagName === "IMG") { el.src = event.data.value; el.removeAttribute("srcset"); }
        else if (el.tagName === "SOURCE") { el.srcset = event.data.value; }
        else { el.textContent = event.data.value; }
      });
    });
    function cmsTargetOrigin() {
      if (cmsOrigin) return cmsOrigin;
      try { const ref = new URL(document.referrer); if (CMS_ORIGINS.includes(ref.origin)) return ref.origin; }
      catch { /* nichts senden */ } return null;
    }
    document.addEventListener("click", (event) => {
      if (!selectMode) return;
      const el = event.target.closest("[data-cms-field]"); if (!el) return;
      const target = cmsTargetOrigin(); if (!target) return;
      event.preventDefault(); event.stopPropagation();
      document.querySelectorAll(".cms-selected").forEach((n) => n.classList.remove("cms-selected"));
      el.classList.add("cms-selected");
      window.parent.postMessage({ type: "CMS_FIELD_SELECT", field: el.getAttribute("data-cms-field") }, target);
    }, true);
    const style = document.createElement("style");
    style.textContent = `[data-cms-field]:hover{outline:2px solid #2563eb;outline-offset:2px;cursor:pointer}.cms-selected{outline:2px solid #2563eb!important;outline-offset:2px}`;
    document.head.appendChild(style);
  }
</script>
```

### 7.3 Protokoll

| Richtung | Nachricht | Zweck |
|---|---|---|
| CMS → Website | `CMS_FIELD_UPDATE { field, value }` | Wert sofort setzen (beim Tippen) |
| CMS → Website | `CMS_SELECT_MODE { enabled }` | „Finden" / „Surfen" umschalten; wird bei **jedem** Iframe-Neuladen erneut gesendet |
| Website → CMS | `CMS_FIELD_SELECT { field }` | Nur die Feld-ID, **nie** Inhalte |
| Website → CMS | `CMS_BRIDGE_READY { version: 2 }` | Einmal je geladener Seite, nachdem die erste geprüfte CMS-Nachricht ankam |

Unbekannte oder ungültige Nachrichten werden **still ignoriert** — kein Fehler, kein Fallback.

### 7.4 Vier Fallen, die bewusst still bleiben

1. **`CMS_ORIGINS` muss Scheme + Host + Port exakt treffen.** `https://…` ≠ `http://…`, und ein Port `:3000` zählt mit. Ein falscher Wert bricht **je Richtung** lautlos.
2. **Kein Platzhalter-Domainwert.** Siehe Abschnitt 2.
3. **`document.referrer` ist nur Fallback.** Kam noch keine CMS-Nachricht an (Direktaufruf ohne CMS, strenge Referrer-Policy), sendet das Skript nichts — Finden-Klicks gehen dann lautlos verloren. Genau dafür gibt es `CMS_BRIDGE_READY`.
4. **Kein `X-Frame-Options` auf der Website.** Der Header blockiert das CMS-Iframe unabhängig von CSP. Siehe Abschnitt 9.

### 7.5 Vorschau-URL je Seiten-Tab

Der Editor leitet die Vorschau-Adresse aus den Manifest-Dateinamen ab: `src/content/pages/<slug>.json` → `<preview_url>/<slug>`. `home`, `index`, `start`, `startseite` → Basis-URL.

> **Folge für den Manifest-Aufbau:** Wenn ein Tab Sektionen aus **mehreren** Seiten-Dateien zusammenführt, zeigt die Vorschau nur die **häufigste** Datei. Leg Impressum und Datenschutz also nicht in denselben `page`-Wert, sonst ist eines der beiden in der Vorschau unsichtbar. Je Tab eine Seite.

---

## 8. Blog

**Blog nur, wenn die Website einen hat.** Erkennung: Gibt es einen Blog-Bereich, eine Artikelliste, Artikeldetailseiten oder vorhandene Beiträge? Dann ja. Gibt es nichts davon: `features.blog: false` und keine Blog-Routen. **Einen Blog zu erfinden ist eine Erweiterung und gehört nicht ungefragt in einen Umbau.**

```markdown
---
title: "Willkommen im Blog"
slug: "willkommen"
date: "2026-09-26"
coverImage: "https://….supabase.co/…/cover.jpg"
coverImageAlt: "Werkstatt von innen"
excerpt: "Erster Artikel in zwei Sätzen."
draft: false
---

Artikeltext in Markdown …
```

| Feld | Regel |
|---|---|
| `title` | Pflicht, 1–200 Zeichen |
| `slug` | aus dem Titel: klein, ä→ae/ö→oe/ü→ue/ß→ss, nur `[a-z0-9-]`, maximal 80 Zeichen |
| `date` | optional; leer = heute. Format `JJJJ-MM-TT` |
| `coverImage` | optional, höchstens 2000 Zeichen, http(s) oder interner `/`-Pfad |
| `coverImageAlt` | optional, höchstens 200 Zeichen, **leer = Titel gilt** |
| `excerpt` | optional, höchstens 500 Zeichen |
| `draft` | optional; **fehlend = nicht öffentlich**. Auf **allen** öffentlichen Ausgaben filtern: Übersicht, Detailseite, Sitemap, strukturierte Daten, Suche |

Blogbeiträge werden ausschließlich über die CMS-Blog-API verwaltet, nicht über Manifest-Felder. Sie sind damit bewusst **kein** Teil der „jeder sichtbare Text"-Regel.

---

## 9. Hosting- und Sicherheitskonfiguration

### 9.1 Warum das Thema überhaupt auftaucht

Das CMS bettet die Website in ein `<iframe>` ein. Dafür muss die Website das Einbetten erlauben — ohne die eigene Absicherung aufzugeben.

### 9.2 `vercel.json`

Zwei getrennte Regelblöcke. **Nur** Vercel-Preview-Domains dürfen breit sein; die Live-Domain bleibt streng.

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "has": [{ "type": "host", "value": "www.beispiel-domain.de" }],
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://<projekt>.supabase.co data:; font-src 'self'; connect-src 'self' https://api.web3forms.com; frame-ancestors 'self'; base-uri 'self'; form-action 'self' https://api.web3forms.com"
        }
      ]
    },
    {
      "source": "/(.*)",
      "has": [{ "type": "host", "value": "vercel.app" }],
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https://<projekt>.supabase.co data:; font-src 'self'; connect-src 'self' https://api.web3forms.com; frame-ancestors 'self' http://localhost:* https://agency-cms-teal.vercel.app; base-uri 'self'; form-action 'self' https://api.web3forms.com"
        }
      ]
    }
  ]
}
```

> **Beide Blöcke brauchen einen `has`-Guard.** Ohne ihn greift der lockere Block auch auf der Live-Domain und die Produktion ist faktisch mit eingebettet. `frame-ancestors 'self'` allein reicht **nicht**, um ein anderes CMS zu erlauben — die CMS-Origin muss **explizit** genannt werden. Kein `https://*.vercel.app` als Ersatz für den Produktionsschutz.

### 9.3 `public/_headers` (Netlify/Cloudflare-Stil)

Wenn eine `_headers`-Datei existiert: **kein `X-Frame-Options`** darin. Die Datei wird sonst unter Umständen nach den Vercel-Headern ausgeliefert und blockiert die Vorschau.

### 9.4 `astro.config.mjs`

```js
image: {
  remotePatterns: [
    { protocol: "https", hostname: "<projekt>.supabase.co" },
  ],
}
```

**Pflicht**, sobald Bilder aus dem CMS kommen. Ohne diesen Eintrag schlägt der Website-Build fehl, sobald der Kunde das erste Bild hochlädt. Kein Wildcard unter `image.domains`; den **konkreten** Supabase-Projekt-Host eintragen.

`image.service.config.limitInputPixels: false` nicht setzen — das deaktiviert Astros Schutz gegen über große Bilder.

---

## 10. Validierung & Schemas

```ts
// src/content.config.ts — die Prüfung muss beim Laden wirklich laufen.
const banner = z.object({
  enabled: z.boolean(),
  variant: z.enum(["vacation", "emergency", "info"]),
  text: z.string().max(160),
});

const blog = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  date: z.string().optional(),
  coverImage: z.string().max(2000).optional(),
  coverImageAlt: z.string().max(200).optional(),
  excerpt: z.string().max(500).optional(),
  draft: z.boolean().optional(),
});
```

Grundsätze: `text`, `number` und `boolean` sauber trennen. Telefon-Anzeige, `tel:`-/`mailto:`-Ziele, Öffnungszeiten und strukturierte Daten aus **derselben** Quelle ableiten — sonst widersprechen sie sich nach der ersten Kundenänderung. Keine Teil-Schemata mit anschließend behaupteter vollständiger Typsicherheit.

---

## 11. Selbst-Check

Die Prüfliste ist maschinell prüfbar. Im Website-Repo ausführen:

```bash
node scripts/cms-check.mjs
```

Der Check meldet als **Fehler** (blockiert den Kundenbetrieb) unter anderem: doppelte Feld-IDs, gleiche Schreibziele, `postMessage(…, "*")`, `X-Frame-Options`, Platzhalter-Domains, fehlende CMS-Origin in `frame-ancestors`, fehlendes `image.remotePatterns`. Als **Warnung**: Felder ohne Marker, unbekannte Typen, `aspectRatio`-Werte außerhalb der drei erlaubten, `srcset` an einem Bild-Marker.

**Verbindliche Checkliste zusätzlich zum Skript** — Dinge, die ein Skript nicht beurteilen kann:

- [ ] Jeder **sichtbare Text** auf allen Seiten ist aus einer Content-Datei bezogen und trägt `data-cms-field` mit exakt der Manifest-ID.
- [ ] Jedes **sichtbare Bild** ist ein eigenständiges `<img>` mit `data-cms-field` — auch in Karten, Grids, Slidern und Hintergrund-Sektionen. Keine CSS-Hintergrundbilder (L5).
- [ ] Kein `data-cms-field` auf einem Wrapper, der einen anderen Marker enthält.
- [ ] Telefon, E-Mail, `tel:`/`mailto:` und strukturierte Daten kommen aus **einer** Quelle und stimmen überein.
- [ ] Brücke steht verbatim aus Abschnitt 7.2 im Root-Layout, mit echten Origins aus Abschnitt 2.
- [ ] `vercel.json`: kein `X-Frame-Options`, Live-Domain mit `has`-Guard und `frame-ancestors 'self'`, Preview-Host mit expliziter CMS-Origin.
- [ ] `astro.config.mjs` enthält `image.remotePatterns` für den Supabase-Host.
- [ ] Branch `main` wird als Produktion deployed; `package.json` hat ein **Build-Skript**, das `astro build` aufruft.
- [ ] Blog, falls vorhanden: `draft` wird auf allen öffentlichen Ausgaben gefiltert (Übersicht, Detail, Sitemap, JSON-LD, Suche).
- [ ] `astro check` und `astro build` laufen mit Exit-Code 0 durch.
- [ ] Keine Platzhalter in ausgelieferten Inhalten: keine `cms.invalid`/`example.com`, keine Lorem-Ipsum-Reste, keine Teststrings.

---

## 12. Häufige Fehler

| Fehler | Konsequenz | Richtig |
|---|---|---|
| Zwei Felder mit derselben `id` | **Jede Veröffentlichung 400** | Abschnitt 3.2, `cms-check` |
| Zwei Felder auf dasselbe `file`+`path` | Publish-Abweisung | ein Feld, alle Vorkommen markiert |
| `CMS_ORIGINS` mit `cms.deine-agentur.de` oder leer | Vorschau komplett stumm | Abschnitt 2 |
| `postMessage(…, "*")` | fremde eingebettete Seiten schreiben die Vorschau um | Abschnitt 7.2 verbatim |
| `X-Frame-Options: DENY` | CMS-Iframe bleibt leer | entfernen, `frame-ancestors` nutzen |
| `frame-ancestors 'self'` ohne CMS-Origin | Vorschau bleibt leer | CMS-Origin explizit nennen |
| `lockerer` CSP-Block ohne `has`-Guard | Live-Domain mit eingebettet | zwei Blöcke, beide mit Guard |
| `innerText` statt `textContent` | Icons/Markup werden beim Tippen zerstört | Abschnitt 7.2 |
| Kein `CSS.escape` | Selektor-Injection bei Sonderzeichen | Abschnitt 7.2 |
| `data-cms-field` auf einem Wrapper | innerer Marker wird gelöscht | Abschnitt 7.1 |
| Feld-ID im Template abgetippt statt kopiert | Feld aktualisiert sich nicht | IDs aus dem Manifest kopieren |
| `alt` als CMS-Feld | Feld ohne Wirkung in der Vorschau | L1 |
| `<Image>`/`<Picture>` mit `widths` am Bild-Marker | responsive Darstellung bricht in der Vorschau ab | Abschnitt 5.1 |
| `type: "emial"` | still `text` im Editor, hart abgelehnt beim Publish | Abschnitt 4 |
| Zahl als `"19,90"` in der JSON-Datei | Publish blockiert die Datei | echte Zahl `19.9` |
| Per Entwurf Liste verlängern/gekürzen | Publish blockiert die Datei | im Repo anlegen (L2) |
| Banner-Stil `"party"` | Publish blockiert `site.json` | nur `vacation`/`emergency`/`info` |
| Content-Datei umformatiert oder umgeschrieben | Diff/Historie unbrauchbar | nie schreiben, nur lesen |
| `image.remotePatterns` fehlt | Build bricht beim ersten CMS-Bild | Abschnitt 9.4 |
| Platzhalter in `.env.example` (`cms.example.com`) | Wert bleibt leer, Vorschau tot | Abschnitt 2 |

---

## 13. Pflege

Diese Datei ist die einzige Stelle, an der CMS-Detailregeln stehen. Die Agentur-Prompts (`prompts/01-meta.md`, `02-predeployment.md`, `03-konvertierung.md` im CMS-Repo) verweisen hierher und enthalten **keine** eigenen CMS-Regeln.

**Änderungsregel (für die Agentur):**
1. Jede Änderung wird gegen den **CMS-Code** geprüft, nicht gegen Erwartungen. Bestehende Tests: `npm run test:unit` und `npm run test`.
2. Die **Versionszeile oben** wird mit Datum angehoben.
3. Änderungen werden in das betroffene Website-Repo **ausgerollt** (Datei kopieren). `cms-check.mjs` meldet abweichende Versionszeilen.
4. Was der Code nicht kann, wandert nach Abschnitt 5 — nicht in eine Prompt-Liste und nicht in ein TODO.
5. Die Versionshistorie liegt in `CMS-REFERENCE-HISTORY.md` im CMS-Repo, **nicht** in dieser Datei. Diese Datei enthält nur geltende Regeln.
