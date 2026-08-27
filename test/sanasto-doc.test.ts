// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Tarkistin: SANASTO.md <-> build/gen_wordforms.py.
//
// SANASTO.md sanoo itse: "Tämä dokumentti ja gen_wordforms.py pidetään yhtenevinä;
// jos ne eroavat, se on bugi." Ennen tätä testiä mikään ei mitannut eroa, ja se
// näkyi: 22.6.2026 (dd07a0b) skriptiin lisättiin 4. infinitiivi (+Der/minen), ja
// dokumentin §2 jäi luettelemaan vain kolme infinitiiviä 16.8.2026 asti.
//
// RAJAUS, jotta lupausta ei lueta liian laajaksi. Tämä vertaa niitä väitteitä
// jotka esiintyvät kirjaimellisesti molemmissa tiedostoissa. Se ei tarkista
// FST:n sisäistä notaatiota (+Pss+Ind+Prs+Pe4, +Act+InfA+Sg+Lat), jonka
// dokumentti tarkoituksella abstrahoi, eikä se siis todista dokumenttia
// oikeaksi. Sama vaihtokauppa kuin Kaanonin aakkoset.py:ssä: kattavuus
// uhrataan tarkkuudelle, koska väärää hälytystä antava portti lakkaa olemasta
// portti.
//
// Jos jokin väite muuttuu tarkoituksella, muutos kuuluu MOLEMPIIN tiedostoihin
// ja tämän testin poimintaan. Testin kaatuminen kertoo eron, ei kumpi on oikeassa.
// Tiedostot luetaan Viten ?raw-importilla eikä node:fs:llä: tsconfig kattaa myös
// test-kansion, eikä projektilla ole Node-tyyppejä (types: ["vite/client"]).
// node:fs kaataisi siis `npm run build`in ja sen mukana tuotantodeployn.
import DOC from "../SANASTO.md?raw";
import SCRIPT from "../build/gen_wordforms.py?raw";
import { describe, expect, it } from "vitest";

/** Skriptin koodi ilman kommentteja ja docstringejä. Poistaa vain kokonaiset
 *  kommenttirivit, jotta esimerkiksi "+Cmp#" kommentissa ei näytä pyynnöltä. */
const CODE = SCRIPT.replace(/"""[\s\S]*?"""/g, "")
  .split("\n")
  .filter((line) => !/^\s*#/.test(line))
  .join("\n");

/** Poimii dokumentista tai skriptistä yhden ryhmän. Kaatuu selkeästi jos
 *  sanamuoto on muuttunut, koska silloin tarkistin ei enää mittaa mitään. */
function grab(source: string, re: RegExp, mita: string): string {
  const m = source.match(re);
  expect(m, `Poimintaa ei löytynyt: ${mita}. Jos sanamuoto muuttui tarkoituksella, päivitä tämä testi.`).not.toBeNull();
  return (m as RegExpMatchArray)[1];
}

const words = (s: string) => s.match(/[A-Za-zÄÖäö/0-9]+/g) ?? [];

describe("SANASTO.md §1: merkistö ja pituus", () => {
  const docRegex = grab(DOC, /täsmäävät: `([^`]+)`/, "dokumentin merkistöregex");
  const scriptRegex = grab(SCRIPT, /ALLOWED = re\.compile\(r"([^"]+)"\)/, "skriptin ALLOWED");

  it("regex on merkki merkiltä sama molemmissa", () => {
    expect(docRegex).toBe(scriptRegex);
  });

  it("sallittujen kirjainten luettelo ja luku vastaavat regexiä", () => {
    const luokka = grab(scriptRegex, /^\^\[([a-zäö]+)\]/, "regexin merkkiluokka");
    const luku = Number(grab(DOC, /Sallitut kirjaimet \((\d+)\)/, "dokumentin kirjainluku"));
    const luettelo = grab(DOC, /Sallitut kirjaimet \(\d+\):\*\* ([a-zäö ]+)/, "dokumentin kirjainluettelo")
      .trim()
      .split(/\s+/);

    expect(luettelo.join("")).toBe(luokka);
    expect(luku).toBe(luokka.length);
  });

  it("pituusväli on sama molemmissa", () => {
    const m = grab(DOC, /Pituus (\d+–\d+)/, "dokumentin pituusväli").split("–");
    expect(`{${m[0]},${m[1]}}`).toBe(grab(scriptRegex, /(\{\d+,\d+\})/, "regexin pituuskvanttori"));
  });
});

describe("SANASTO.md §2: mitä taivutetaan täydesti", () => {
  const sijat = words(grab(SCRIPT, /^CASES = \[([\s\S]*?)\]/m, "skriptin CASES"))
    .filter((w) => w.length === 3);

  it("sijaluettelo ja sijaluku vastaavat skriptin CASES-listaa", () => {
    const docSijat = words(grab(DOC, /\{(Nom[^}]+)\}/, "dokumentin sijaluettelo"));
    const docLuku = Number(grab(DOC, /\((\d+) sijaa\)/, "dokumentin sijaluku"));

    expect(docSijat).toEqual(sijat);
    expect(docLuku).toBe(sijat.length);
  });

  it("täydesti taivutettavat sanaluokat vastaavat POS_MAPia", () => {
    const posMap = grab(SCRIPT, /POS_MAP = \{([\s\S]*?)\n\}/, "skriptin POS_MAP");
    const luokat = [...posMap.matchAll(/"(\w+)":/g)].map((m) => m[1]);
    const docLuokat = words(grab(DOC, /Sanaluokat \*\*([^*]+)\*\* taivutetaan/, "dokumentin sanaluokat"))
      .map((w) => w.toLowerCase());

    expect(docLuokat).toEqual(luokat);
  });

  it("vertailuasteet koskevat adjektiiveja eivätkä substantiiveja", () => {
    expect(DOC).toMatch(/vertailuasteet\*\* \(perus, komparatiivi,\s*\n?superlatiivi\)/);
    expect(CODE).toMatch(/degrees = \[""\] if pos == "N" else \["", "\+Comp", "\+Superl"\]/);
  });

  it("persoonat ovat samat kuuden listana", () => {
    expect(words(grab(SCRIPT, /^PERSONS = \[([^\]]+)\]/m, "skriptin PERSONS")))
      .toEqual(["Sg1", "Sg2", "Sg3", "Pl1", "Pl2", "Pl3"]);
    expect(DOC).toMatch(/persoonat Sg1–3 \/ Pl1–3/);
  });

  it("modukset ovat samat: indikatiivin kaksi aikamuotoa, konditionaali, potentiaali", () => {
    expect(words(grab(CODE, /for tense in \[([^\]]+)\]/, "skriptin aikamuodot"))).toEqual(["Prs", "Prt"]);
    expect(words(grab(CODE, /for mood in \[([^\]]+)\]/, "skriptin modukset"))).toEqual(["Cond", "Pot"]);
    expect(DOC).toMatch(/indikatiivi \(preesens, imperfekti\),\s*\n?\s*konditionaali, potentiaali/);
  });

  it("MA-infinitiivin sijat ovat samat", () => {
    const skripti = words(grab(CODE, /InfMa\+Sg\+\{c\}" for c in \[([^\]]+)\]/, "skriptin MA-infinitiivi"));
    const dokumentti = words(grab(DOC, /MA-infinitiivi \(([^)]+)\)/, "dokumentin MA-infinitiivi"));
    expect(dokumentti).toEqual(skripti);
  });

  it("teonnimi on dokumentissa jos ja vain jos skripti pyytää sen", () => {
    // Tämä on se ero jonka takia koko tarkistin kirjoitettiin (dd07a0b, 22.6.2026).
    const skriptiPyytaa = /\+Der\/minen/.test(CODE);
    const dokumenttiKertoo = /teonnimi|4\. infinitiivi/i.test(DOC);
    expect(dokumenttiKertoo).toBe(skriptiPyytaa);
  });

  it("teonnimi taipuu samassa luku- ja sijaparadigmassa kuin dokumentti väittää", () => {
    expect(CODE).toMatch(/Der\/minen\+\{num\}\+\{case\}" for num in NUMBERS for case in CASES/);
    expect(DOC).toMatch(/4\. infinitiivi\*\* \(\*-minen\*\) taipuu nominina \(Sg\/Pl × 14 sijaa\)/);
  });
});

describe("SANASTO.md §3: mitä jätetään perusmuotoon", () => {
  it("adverbit, numeraalit ja pronominit eivät ole POS_MAPissa", () => {
    const posMap = grab(SCRIPT, /POS_MAP = \{([\s\S]*?)\n\}/, "skriptin POS_MAP");
    for (const luokka of ["adverbi", "numeraali", "pronomini"]) {
      expect(DOC.toLowerCase()).toContain(luokka);
      expect(posMap).not.toContain(luokka);
    }
  });

  it("erisnimet ja lyhenteet pudotetaan isosta alkukirjaimesta", () => {
    expect(DOC).toMatch(/kaikki isolla alkavat Kotus-lemmat pudotetaan/);
    expect(CODE).toMatch(/if word\[:1\]\.isupper\(\):\s*\n\s*continue/);
  });
});

describe("SANASTO.md §4: mitä ei koskaan hyväksytä", () => {
  it("kiellettyjä tageja ei pyydetä generaattorilta", () => {
    for (const tagi of ["+Foc", "+Px", "+Cmp"]) {
      expect(DOC, `dokumentin §4 ei enää nimeä tagia ${tagi}`).toContain(tagi);
      expect(CODE, `skripti pyytää kiellettyä tagia ${tagi}`).not.toContain(tagi);
    }
  });
});

describe("SANASTO.md §5 ja §7: yhdyssanat ja tunnetut rajoitteet", () => {
  it("loppuosaperintä on olemassa molemmissa", () => {
    expect(DOC).toMatch(/taivutus peritään pisimmästä loppuosasta/);
    expect(CODE).toMatch(/def fallback_by_suffix\(/);
  });

  it("no_output-varamuoto tallettaa perusmuodon", () => {
    expect(DOC).toMatch(/no_output-varamuoto/);
    expect(CODE).toMatch(/stats\["no_output"\] \+= 1[\s\S]{0,200}add\(lower, word, "Base"\)/);
  });
});
