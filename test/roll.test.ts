import { describe, expect, it } from "vitest";
import { countsAsConsonant, countsAsVowel, diceWithJokers, JOKER } from "../src/domain/dice";
import { MIN_CONSONANTS, MIN_VOWELS, rollDice } from "../src/domain/roll";

describe("heitto", () => {
  it("on deterministinen: sama siemen → sama heitto", () => {
    const a = rollDice("testi-siemen");
    const b = rollDice("testi-siemen");
    expect(a).toEqual(b);
  });

  it("eri siemenet tuottavat eri heittoja", () => {
    const rolls = new Set<string>();
    for (let i = 0; i < 50; i++) rolls.add(rollDice(`siemen-${i}`).faces.join(""));
    expect(rolls.size).toBeGreaterThan(45);
  });

  it("jokainen tahko tulee omalta nopaltaan", () => {
    for (let i = 0; i < 20; i++) {
      const { faces } = rollDice(`noppa-${i}`);
      const dice = diceWithJokers(1);
      faces.forEach((face, d) => expect(dice[d]).toContain(face));
    }
  });

  it("täyttää vokaalitakuun (>= 4, jokeri lasketaan) kaikilla siemenillä", () => {
    let rerollsSeen = 0;
    for (let i = 0; i < 2000; i++) {
      const { faces, rerolls } = rollDice(i);
      expect(faces.filter(countsAsVowel).length).toBeGreaterThanOrEqual(MIN_VOWELS);
      rerollsSeen += rerolls;
    }
    // Takuun pitää laueta joskus, mutta harvoin. rerolls kattaa nyt sekä vokaali- että
    // konsonanttitakuun, joten yläraja on väljempi kuin pelkällä vokaalitakuulla.
    expect(rerollsSeen).toBeGreaterThan(0);
    expect(rerollsSeen).toBeLessThan(400);
  });

  it("täyttää konsonanttitakuun (>= 4, jokeri lasketaan) kaikilla siemenillä", () => {
    for (let i = 0; i < 2000; i++) {
      const { faces } = rollDice(i);
      expect(faces.filter(countsAsConsonant).length).toBeGreaterThanOrEqual(MIN_CONSONANTS);
    }
  });

  it("kunnioittaa jokerimääräasetusta", () => {
    let seen = 0;
    for (let i = 0; i < 500; i++) {
      const { faces } = rollDice(`jokeri-${i}`, { jokerCount: 3 });
      seen += faces.filter((f) => f === JOKER).length;
    }
    // 3 jokeritahkoa à 1/6 → odotusarvo 250 näkymää 500 heitossa.
    expect(seen).toBeGreaterThan(150);
    expect(seen).toBeLessThan(350);
  });
});
