// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { describe, it, expect } from "vitest";
import { buildDawg } from "../src/dict/builder";
import { Dawg } from "../src/dict/dawg";
import { ExactJudge } from "../src/dict/judge";

function dawgOf(words: string[]): Dawg {
  // buildDawg vaatii lajitellun, uniikin syötteen.
  return new Dawg(buildDawg([...words].sort()));
}

describe("buildDawg + Dawg.has", () => {
  it("löytää kaikki lisätyt sanat eikä muita", () => {
    const words = ["talo", "talot", "talon", "talossa", "kala", "kalat", "auto"];
    const d = dawgOf(words);
    for (const w of words) expect(d.has(w)).toBe(true);
    for (const w of ["tal", "talois", "kal", "aut", "autot", "x", ""]) {
      expect(d.has(w)).toBe(false);
    }
  });

  it("erottaa prefiksin omasta sanastaan (talo vs talot)", () => {
    const d = dawgOf(["talo", "talot"]);
    expect(d.has("talo")).toBe(true);
    expect(d.has("talot")).toBe(true);
    expect(d.has("tal")).toBe(false);
    expect(d.has("talo")).toBe(true);
  });

  it("yhdistää jaetut suffiksit (minimointi pienentää solmumäärää)", () => {
    // 'kissa' ja 'koira' eivät jaa suffiksia; 'kissat'/'koirat' jakavat 't'+final.
    const merged = buildDawg(["kissa", "kissat", "koira", "koirat"]);
    const separate = buildDawg(["aa", "ab"]); // pieni vertailupohja
    expect(merged.meta.nodeCount).toBeLessThan(
      "kissa".length + "koira".length + 4, // < naiivi trie-solmumäärä
    );
    expect(separate.meta.wordCount).toBe(2);
  });

  it("käsittelee ä/ö-kirjaimet", () => {
    const d = dawgOf(["pää", "pöllö", "äiti", "yö"]);
    for (const w of ["pää", "pöllö", "äiti", "yö"]) expect(d.has(w)).toBe(true);
    expect(d.has("paa")).toBe(false);
  });

  it("heittää lajittelemattomasta tai ei-uniikista syötteestä", () => {
    expect(() => buildDawg(["b", "a"])).toThrow();
    expect(() => buildDawg(["a", "a"])).toThrow();
  });

  it("heittää kirjaimistoon kuulumattomasta merkistä", () => {
    expect(() => buildDawg(["xyz"])).toThrow(/kuulumaton/);
  });
});

describe("wordsFromRack", () => {
  it("löytää kaikki muodostettavat sanat ja vain ne", () => {
    const d = dawgOf(["ala", "aamu", "kala", "kana", "talo"]);
    const found = new Set(d.wordsFromRack(["a", "l", "a", "k", "n"]));
    expect(found).toEqual(new Set(["ala", "kala", "kana"])); // aamu(m,u) ja talo(t,o) eivät onnistu
  });

  it("kunnioittaa kirjainmääriä (yksi a → 'la' kyllä, 'ala' ei)", () => {
    const d = dawgOf(["ala", "la"]);
    expect(new Set(d.wordsFromRack(["a", "l"]))).toEqual(new Set(["la"])); // 'ala' vaatii 2 a:ta
  });

  it("jokeri (*) toimii minä tahansa kirjaimena", () => {
    const d = dawgOf(["kala", "kana"]);
    // k, *, l, a  → jokeri = a → kala
    expect(d.wordsFromRack(["k", "*", "l", "a"])).toContain("kala");
  });
});

describe("ExactJudge", () => {
  it("antaa valid/invalid ja normalisoi kirjainkoon", () => {
    const judge = new ExactJudge(buildDawg(["talo", "talot"]));
    expect(judge.judge("talo")).toBe("valid");
    expect(judge.judge("TALO")).toBe("valid");
    expect(judge.judge("auto")).toBe("invalid");
    expect(judge.version).toBe("sanasto-fi-v2");
  });
});
