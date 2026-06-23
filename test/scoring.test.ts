import { describe, expect, it } from "vitest";
import { JOKER } from "../src/domain/dice";
import {
  faceValue,
  finalScore,
  sumValues,
  timeBonus,
} from "../src/domain/scoring";

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
});
