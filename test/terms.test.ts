// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Termimoduulin testit: moottorin kontrakti (TERMIMODUULI.md) + datan eheys.
import { describe, expect, it } from "vitest";
import {
  TERMS,
  TERM_CATEGORIES,
  findTerm,
  splitWithGlossary,
  type TermEntry,
} from "../src/rules/terms";

const mk = (term: string, match: string[]): TermEntry => ({
  term,
  match,
  selitys: "x",
  kategoria: "peli",
});

describe("splitWithGlossary (moottorin kontrakti)", () => {
  it("löytää täsmäosuman sanarajoilla, ei sanan sisältä", () => {
    const entries = [mk("kasa", ["kasa"])];
    const hit = splitWithGlossary("kortti kasa pöydällä", entries);
    expect(hit.filter((p) => p.isTerm).map((p) => p.term)).toEqual(["kasa"]);
    // "kasaan" EI osu ilman vartalotähteä
    const miss = splitWithGlossary("kortit kasaan", entries);
    expect(miss.some((p) => p.isTerm)).toBe(false);
  });

  it("vartalohaku (*) osuu taivutusmuotoihin, sanaraja kattaa ä/ö", () => {
    const entries = [mk("teline", ["teline*"])];
    const parts = splitWithGlossary("Nopat telineessä odottavat.", entries);
    const hit = parts.find((p) => p.isTerm);
    expect(hit?.text).toBe("telineessä");
    expect(hit?.term).toBe("teline");
  });

  it("ei osu vartaloon keskellä sanaa (sanaraja vasemmalla)", () => {
    const entries = [mk("teline", ["teline*"])];
    const parts = splitWithGlossary("kuvateline seinällä", entries);
    expect(parts.some((p) => p.isTerm)).toBe(false);
  });

  it("pisin match voittaa", () => {
    const entries = [mk("kakkonen", ["kakkonen"]), mk("kova kakkonen", ["kova kakkonen"])];
    const parts = splitWithGlossary("pelaa kova kakkonen heti", entries);
    const hits = parts.filter((p) => p.isTerm);
    expect(hits).toHaveLength(1);
    expect(hits[0].term).toBe("kova kakkonen");
  });

  it("case-insensitive; palauttaa alkuperäisen kirjoitusasun ja kanonisen termin", () => {
    const entries = [mk("jokeri", ["jokeri*"])];
    const parts = splitWithGlossary("Jokeri on tyhjä.", entries);
    const hit = parts.find((p) => p.isTerm);
    expect(hit?.text).toBe("Jokeri");
    expect(hit?.term).toBe("jokeri");
  });

  it("useampi osuma pilkotaan järjestyksessä ja välitekstit säilyvät", () => {
    const entries = [mk("teline", ["teline*"]), mk("jokeri", ["jokeri*"])];
    const parts = splitWithGlossary("jokeri telineessä", entries);
    expect(parts.map((p) => p.text).join("")).toBe("jokeri telineessä");
    expect(parts.filter((p) => p.isTerm).map((p) => p.term)).toEqual(["jokeri", "teline"]);
  });

  it("tyhjä termistö → koko teksti yhtenä ei-termiosana", () => {
    expect(splitWithGlossary("mitä vain", [])).toEqual([{ text: "mitä vain", isTerm: false }]);
  });
});

describe("TERMS-data (eheys)", () => {
  it("termit ovat uniikkeja ja kentät täytetty", () => {
    const names = TERMS.map((t) => t.term);
    expect(new Set(names).size).toBe(names.length);
    for (const t of TERMS) {
      expect(t.selitys.length).toBeGreaterThan(0);
      expect(t.match.length).toBeGreaterThan(0);
    }
  });

  it("jokainen kategoria on TERM_CATEGORIES-listassa", () => {
    const keys = new Set(TERM_CATEGORIES.map((c) => c.key));
    for (const t of TERMS) expect(keys.has(t.kategoria)).toBe(true);
  });

  it("findTerm: tuntematon → null (ei näytetä mitään)", () => {
    expect(findTerm("höpöhöpö")).toBeNull();
    expect(findTerm("vokaalisointu")?.term).toBe("vokaalisointu");
  });

  it("sääntötekstien avaintermit osuvat pelidatalla", () => {
    // Poimintoja rules/content.ts:n teksteistä — moduulin todellinen käyttökohde.
    const texts = [
      "Sanakirja on tuomari.",
      "takavokaalit (a, o, u), neutraalit (e, i) ja etuvokaalit (ä, ö, y)",
      "suomalaisessa sanassa (vokaalisointu)",
      "Jokeri: napauta laudalla olevaa jokeria",
    ];
    const found = new Set(
      texts.flatMap((t) => splitWithGlossary(t).filter((p) => p.isTerm).map((p) => p.term)),
    );
    for (const expected of ["sanakirja", "takavokaali", "neutraali vokaali", "etuvokaali", "vokaalisointu", "jokeri"]) {
      expect(found).toContain(expected);
    }
  });
});
