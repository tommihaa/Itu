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

  it("aikabonus on +1 piste / 5 säästettyä sekuntia", () => {
    expect(timeBonus(0)).toBe(0);
    expect(timeBonus(4)).toBe(0);
    expect(timeBonus(5)).toBe(1);
    expect(timeBonus(47)).toBe(9);
    expect(timeBonus(180)).toBe(36);
    expect(timeBonus(-10)).toBe(0);
  });

  it("laskee loppupisteet: sanat - jämät + aikabonus", () => {
    const score = finalScore({
      wordPoints: 30,
      unusedFaces: ["D", "U"], // 7 + 3
      secondsRemaining: 25,
      timeBonusEnabled: true,
    });
    expect(score).toEqual({
      wordPoints: 30,
      unusedPenalty: 10,
      timeBonus: 5,
      total: 25,
    });
  });

  it("käyttämätön jokeri ei maksa mitään", () => {
    const score = finalScore({
      wordPoints: 10,
      unusedFaces: [JOKER],
      secondsRemaining: 0,
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
      timeBonusEnabled: false,
    });
    expect(score.timeBonus).toBe(0);
    expect(score.total).toBe(10);
  });
});
