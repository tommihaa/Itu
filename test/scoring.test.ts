// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { describe, expect, it } from "vitest";
import { JOKER } from "../src/domain/dice";
import {
  faceValue,
  finalScore,
  scoreWord,
  sumValues,
  timeBonus,
} from "../src/domain/scoring";
import type { PremiumCell } from "../src/domain/premium";

describe("pisteytys", () => {
  it("käyttää suomi-Scrabblen arvoja", () => {
    expect(faceValue("A")).toBe(1);
    expect(faceValue("O")).toBe(2);
    expect(faceValue("U")).toBe(3);
    expect(faceValue("R")).toBe(4);
    expect(faceValue("D")).toBe(7);
    expect(faceValue("Ö")).toBe(7);
    expect(faceValue(JOKER)).toBe(0);
    expect(() => faceValue("B")).toThrow();
  });

  it("summaa tahkojen arvot", () => {
    // TALO = 1+1+2+2
    expect(sumValues(["T", "A", "L", "O"])).toBe(6);
    expect(sumValues([])).toBe(0);
  });

  it("aikabonus on +1 piste / 5 säästettyä sekuntia, katto 6, kun kynnys täyttyy", () => {
    expect(timeBonus(0, 13)).toBe(0);
    expect(timeBonus(4, 13)).toBe(0);
    expect(timeBonus(5, 11)).toBe(1);
    expect(timeBonus(30, 11)).toBe(6); // katto
    expect(timeBonus(47, 13)).toBe(6); // katto
    expect(timeBonus(180, 13)).toBe(6); // katto
    expect(timeBonus(-10, 13)).toBe(0);
  });

  it("aikabonus on 0 jos käytettyjä kirjaimia < 11, vaikka aikaa olisi säästössä", () => {
    expect(timeBonus(120, 10)).toBe(0);
    expect(timeBonus(120, 0)).toBe(0);
    // Tasan kynnyksessä bonus aukeaa:
    expect(timeBonus(120, 11)).toBe(6);
  });

  it("laskee loppupisteet: sanat - jämät + aikabonus (kynnys täynnä)", () => {
    const score = finalScore({
      wordPoints: 30,
      unusedFaces: ["D", "U"], // 7 + 3
      secondsRemaining: 25,
      lettersUsed: 11,
      timeBonusEnabled: true,
    });
    expect(score).toEqual({
      wordPoints: 30,
      unusedPenalty: 10,
      timeBonus: 5,
      bingo: 0,
      total: 25,
    });
  });

  it("loppupisteet: aikabonus jää pois kun käytettyjä kirjaimia liian vähän", () => {
    const score = finalScore({
      wordPoints: 30,
      unusedFaces: ["D", "U"], // 7 + 3
      secondsRemaining: 25,
      lettersUsed: 8, // alle kynnyksen
      timeBonusEnabled: true,
    });
    expect(score.timeBonus).toBe(0);
    expect(score.total).toBe(20); // 30 - 10, ei bonusta
  });

  it("käyttämätön jokeri ei maksa mitään", () => {
    const score = finalScore({
      wordPoints: 10,
      unusedFaces: [JOKER],
      secondsRemaining: 0,
      lettersUsed: 12,
      timeBonusEnabled: true,
    });
    expect(score.unusedPenalty).toBe(0);
    expect(score.total).toBe(10);
  });

  it("aikabonus pois päältä ei vaikuta", () => {
    const score = finalScore({
      wordPoints: 10,
      unusedFaces: [],
      secondsRemaining: 100,
      lettersUsed: 13,
      timeBonusEnabled: false,
    });
    expect(score.timeBonus).toBe(0);
    expect(score.total).toBe(10);
  });

  it("bingo-bonus summautuu loppupisteisiin", () => {
    const score = finalScore({
      wordPoints: 40,
      unusedFaces: [],
      secondsRemaining: 0,
      lettersUsed: 13,
      timeBonusEnabled: false,
      bingo: 20,
    });
    expect(score.bingo).toBe(20);
    expect(score.total).toBe(60);
  });
});

describe("scoreWord (premium-kertoimet)", () => {
  const none: PremiumCell = { letter: 1, word: 1 };

  it("premiums=null → pelkkä summa (identtinen vanhaan)", () => {
    // TALO = 1+1+2+2 = 6
    expect(scoreWord([1, 1, 2, 2], null)).toBe(6);
    expect(scoreWord([], null)).toBe(0);
  });

  it("kaikki perustasolla = summa", () => {
    expect(scoreWord([1, 1, 2, 2], [none, none, none, none])).toBe(6);
  });

  it("DL kaksinkertaistaa yhden kirjaimen", () => {
    // O (arvo 2) DL-ruudussa: 1 + 1 + 2*2 + 2 = 8
    const dl: PremiumCell = { letter: 2, word: 1 };
    expect(scoreWord([1, 1, 2, 2], [none, none, dl, none])).toBe(8);
  });

  it("TL kolminkertaistaa yhden kirjaimen", () => {
    const tl: PremiumCell = { letter: 3, word: 1 };
    expect(scoreWord([1, 1, 2, 2], [none, none, none, tl])).toBe(10); // 1+1+2+2*3
  });

  it("TW kolminkertaistaa koko sanan summan", () => {
    const tw: PremiumCell = { letter: 1, word: 3 };
    expect(scoreWord([1, 1, 2, 2], [tw, none, none, none])).toBe(18); // 6 * 3
  });

  it("kirjain- ja sanakertoimet yhdistyvät (DL + DW)", () => {
    const dl: PremiumCell = { letter: 2, word: 1 };
    const dw: PremiumCell = { letter: 1, word: 2 };
    // (1 + 1*2 + 2) * 2 = 10
    expect(scoreWord([1, 1, 2], [none, dl, dw])).toBe(10);
  });
});
