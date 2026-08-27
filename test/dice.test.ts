// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { describe, expect, it } from "vitest";
import {
  DICE,
  DICE_COUNT,
  diceWithJokers,
  JOKER,
  LETTER_VALUES,
  VOWELS,
} from "../src/domain/dice";

// Lukittu jakauma 12.6.2026, G lisätty 14.6.2026 (T6→T5, +G1) — ks. ITU.md.
// Testi hajoaa, jos data muuttuu.
const LOCKED_COUNTS: Record<string, number> = {
  A: 8, I: 7, E: 6, O: 5, U: 4, Ä: 4, Y: 2, Ö: 1,
  T: 5, N: 6, S: 5, K: 5, L: 4, M: 3, R: 3, H: 2, V: 2, J: 2, P: 1, D: 1, G: 1,
  [JOKER]: 1,
};

function countFaces(dice: readonly (readonly string[])[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const die of dice) {
    for (const face of die) counts.set(face, (counts.get(face) ?? 0) + 1);
  }
  return counts;
}

describe("noppadata", () => {
  it("on 13 noppaa à 6 tahkoa", () => {
    expect(DICE_COUNT).toBe(13);
    for (const die of DICE) expect(die).toHaveLength(6);
  });

  it("vastaa lukittua tahkojakaumaa (78 = 37V + 40K + 1 jokeri)", () => {
    const counts = countFaces(DICE);
    expect(Object.fromEntries(counts)).toEqual(LOCKED_COUNTS);
    let vowels = 0;
    let consonants = 0;
    for (const [face, n] of counts) {
      if (face === JOKER) continue;
      if (VOWELS.has(face)) vowels += n;
      else consonants += n;
    }
    expect(vowels).toBe(37);
    expect(consonants).toBe(40);
  });

  it("ei toista kirjainta samalla nopalla", () => {
    for (const die of DICE) expect(new Set(die).size).toBe(6);
  });

  it("hajauttaa harvinaiset tahkot: Ö eri nopalla, D ja jokeri jakavat nopan 13", () => {
    const dieOf = (face: string) => DICE.findIndex((d) => d.includes(face));
    // D ja jokeri samalla nopalla → poissulkevia; Ö voi näkyä kumman tahansa kanssa.
    expect(dieOf("D")).toBe(12);
    expect(dieOf(JOKER)).toBe(12);
    expect(dieOf("Ö")).toBe(10);
  });

  it("jokaisella tahkolla on pistearvo", () => {
    for (const die of DICE) {
      for (const face of die) expect(LETTER_VALUES[face]).toBeDefined();
    }
    expect(LETTER_VALUES[JOKER]).toBe(0);
  });

  it("lisäjokerit korvaavat A-tahkot nopilla 8 ja 6", () => {
    expect(diceWithJokers(1).flat().filter((f) => f === JOKER)).toHaveLength(1);
    const two = diceWithJokers(2);
    expect(two.flat().filter((f) => f === JOKER)).toHaveLength(2);
    expect(two[7]).not.toContain("A");
    const three = diceWithJokers(3);
    expect(three.flat().filter((f) => f === JOKER)).toHaveLength(3);
    expect(three[5]).not.toContain("A");
    // jokerit eri nopilla, jotta useampi voi näkyä samassa heitossa
    expect(three[12]).toContain(JOKER);
    expect(three[7]).toContain(JOKER);
    expect(three[5]).toContain(JOKER);
  });

  it("ei muuta lukittua perusdataa jokerivarianteissa", () => {
    diceWithJokers(3);
    expect(DICE[7]).toContain("A");
    expect(DICE[5]).toContain("A");
  });
});
