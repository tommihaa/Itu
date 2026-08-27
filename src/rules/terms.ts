// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Termimoduuli — Itun vendoroitu kopio Lahja-kokoelman jaetusta termiskeemasta.
// Speksi: TERMIMODUULI.md (Projects-juuri) · sisarkopio: Jako src/shared/glossary.js.
// Skeema jaetaan, DATA ei: termistö on pelin omaa (KÄSITTEISTÖ §0).
//
// Periaatteet:
// - Termi määritellään KERRAN; UI linkittää (säännöissä napautettava + Termit-lista).
// - Jokainen selitys on KÄSIN TODENNETTU designdokumenttia (ITU.md, rules/content.ts)
//   tai koodia (scoring.ts) vasten — ei ajonaikaista päättelyä, ei arvailua.
//   Tuntematon termi → ei näytetä mitään (sama malli kuin dict/morph.ts CASE_INFO,
//   joka on tämän skeeman rakenteellinen esi-isä: term/question/example).
// - Uusi termi = 1 rivi TERMS-taulukkoon; napautettavuus ja lista syntyvät itsestään.

export const TERM_SCHEMA_VERSION = 1;

export interface TermEntry {
  /** Kanoninen termi (näyttönimi). */
  term: string;
  /** Selkokielinen selite — käsin todennettu, ei arvattu. */
  selitys: string;
  /** Esiintymät joita sääntöteksteistä haetaan (case-insensitive); "vartalo*" = alkuosuma. */
  match: string[];
  /** Ryhmittelyavain Termit-listaa varten (TERM_CATEGORIES). */
  kategoria: string;
  /** Konkreettinen esimerkki (valinnainen). */
  esimerkki?: string;
}

export const TERM_CATEGORIES: { key: string; label: string }[] = [
  { key: "aanne", label: "Äänteet ja vokaalisointu" },
  { key: "peli", label: "Pelin osat" },
];

// Lähteet: äännetermit rules/content.ts (Äänneryhmät-osio) + ITU.md;
// pelitermit ITU.md (nopat, pisteytys) + domain/scoring.ts (aikabonuksen vakiot).
export const TERMS: TermEntry[] = [
  {
    kategoria: "aanne",
    term: "vokaalisointu",
    match: ["vokaalisoin*"],
    selitys:
      "Taka- ja etuvokaalit eivät esiinny samassa suomalaisessa sanassa: " +
      "sana on joko takavokaalinen tai etuvokaalinen. Neutraalit e ja i sopivat kumpaankin.",
    esimerkki: "talolla ✓ · pöydällä ✓ · talollä ✗",
  },
  {
    kategoria: "aanne",
    term: "takavokaali",
    match: ["takavokaal*"],
    selitys: "A, o ja u. Sanassa, jossa on takavokaaleja, ei ole etuvokaaleja (ä, ö, y).",
    esimerkki: "auto · katu",
  },
  {
    kategoria: "aanne",
    term: "etuvokaali",
    match: ["etuvokaal*"],
    selitys: "Ä, ö ja y. Sanassa, jossa on etuvokaaleja, ei ole takavokaaleja (a, o, u).",
    esimerkki: "pöytä · kylä",
  },
  {
    kategoria: "aanne",
    term: "neutraali vokaali",
    match: ["neutraal*"],
    selitys: "E ja i sopivat samaan sanaan sekä taka- että etuvokaalien kanssa.",
    esimerkki: "koti (o + i) · kesy (e + y)",
  },
  {
    kategoria: "aanne",
    term: "äänneryhmät",
    match: ["äänneryhm*"],
    selitys:
      "Telineen järjestystapa: konsonantit → takavokaalit (a, o, u) → neutraalit (e, i) → " +
      "etuvokaalit (ä, ö, y). Näyttää kerralla, mitkä vokaalit sopivat samaan sanaan.",
  },
  {
    kategoria: "peli",
    term: "teline",
    match: ["teline*"],
    selitys:
      "Hylly, jossa heitetyt nopat odottavat. Kierroksen lopussa käyttämättä jääneet " +
      "nopat vähentävät oman pistearvonsa, telineessä ja laudalla irrallaan olevat samalla tavalla.",
  },
  {
    kategoria: "peli",
    term: "jokeri",
    match: ["jokeri*"],
    selitys:
      "Tyhjä noppa, joka voi edustaa mitä tahansa kirjainta. Peli päättelee kirjaimen " +
      "laudalla automaattisesti; tarvittaessa valitset sen napauttamalla. Arvo 0 pistettä: " +
      "käyttämätönkään jokeri ei maksa mitään.",
  },
  {
    kategoria: "peli",
    term: "aikabonus",
    match: ["aikabonu*"],
    selitys:
      "Kun lukitset ennen ajan loppua, saat +1 pisteen jokaisesta 5 säästetystä sekunnista " +
      "(enintään +6), mutta vain jos vähintään 11 noppaa 13:sta on kelvollisissa sanoissa.",
  },
  {
    kategoria: "peli",
    term: "sanakirja",
    match: ["sanakirja*"],
    selitys:
      "Pelin tuomari: pakattu sanasto (Kotus-pohjainen, versio sanasto-fi-v2), jossa sanat " +
      "ovat taivutusmuotoineen. Jos muoto ei ole sanakirjassa, se ei kelpaa. Sama lähde myös " +
      "selittää muodot Sanapoliisissa: hyväksyjä ja selittäjä eivät voi olla eri mieltä.",
  },
];

// ── Moottori (jaettu kontrakti, ks. TERMIMODUULI.md) ─────────────────────────
// Sama algoritmi kuin Jakon splitWithGlossary: pisin match ensin, sanaraja
// kattaa ä/ö/å:n, "vartalo*" = alkuosuma, case-insensitive.

export interface TermPart {
  text: string;
  isTerm: boolean;
  /** Kanoninen termi kun isTerm — avain findTerm-hakuun. */
  term?: string;
}

const WORD_CHAR = "a-zA-ZäöåÄÖÅ0-9";
const escapeRx = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Pilkkoo tekstin osiin: termiesiintymät erotettuina väliteksteistä. */
export function splitWithGlossary(text: string, entries: TermEntry[] = TERMS): TermPart[] {
  const patterns = entries
    .flatMap((e) => e.match.map((m) => ({ m, term: e.term })))
    // pisin ensin; * ei laske pituuteen (vartalohaku)
    .sort((a, b) => {
      const la = a.m.endsWith("*") ? a.m.length - 1 : a.m.length;
      const lb = b.m.endsWith("*") ? b.m.length - 1 : b.m.length;
      return lb - la;
    });
  if (patterns.length === 0) return [{ text, isTerm: false }];
  const wL = `(?<![${WORD_CHAR}])`;
  const wR = `(?![${WORD_CHAR}])`;
  const rx = new RegExp(
    `(${patterns
      .map((p) =>
        p.m.endsWith("*")
          ? wL + escapeRx(p.m.slice(0, -1)) + `[${WORD_CHAR}]*`
          : wL + escapeRx(p.m) + wR,
      )
      .join("|")})`,
    "i",
  );
  const parts: TermPart[] = [];
  let rem = text;
  while (rem.length > 0) {
    const hit = rem.match(rx);
    if (!hit || hit.index === undefined) {
      parts.push({ text: rem, isTerm: false });
      break;
    }
    if (hit.index > 0) parts.push({ text: rem.slice(0, hit.index), isTerm: false });
    const canon =
      patterns.find((p) =>
        p.m.endsWith("*")
          ? hit[0].toLowerCase().startsWith(p.m.slice(0, -1).toLowerCase())
          : p.m.toLowerCase() === hit[0].toLowerCase(),
      )?.term ?? hit[0];
    parts.push({ text: hit[0], isTerm: true, term: canon });
    rem = rem.slice(hit.index + hit[0].length);
  }
  return parts;
}

/** Kanoninen termi → merkintä, tai null jos ei tunneta (→ ei näytetä mitään). */
export function findTerm(term: string, entries: TermEntry[] = TERMS): TermEntry | null {
  return entries.find((e) => e.term === term) ?? null;
}
