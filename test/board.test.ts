// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { describe, it, expect } from "vitest";
import {
  cellKey,
  extractWords,
  isConnected,
  disconnectedCells,
  freeLetterViolations,
  type PlacedTile,
} from "../src/domain/board";
import { JOKER } from "../src/domain/dice";

function tile(face: string, letter = face, dieIndex = 0): PlacedTile {
  return { dieIndex, face, letter };
}

function boardOf(spec: Record<string, string>): Map<string, PlacedTile> {
  const m = new Map<string, PlacedTile>();
  let i = 0;
  for (const [key, face] of Object.entries(spec)) m.set(key, tile(face, face, i++));
  return m;
}

describe("extractWords", () => {
  it("poimii vaakasanan", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
      [cellKey(0, 2)]: "L",
      [cellKey(0, 3)]: "O",
    });
    const words = extractWords(cells);
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({ dir: "H", text: "talo" });
  });

  it("poimii risteävät vaaka- ja pystysanat", () => {
    // T A L O  (vaaka, rivi 0)
    //     A    (L:n alle 'ala' pysty: L,A,...) -> tehdään pysty L-A-T
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
      [cellKey(0, 2)]: "L",
      [cellKey(1, 2)]: "A",
      [cellKey(2, 2)]: "T",
    });
    const words = extractWords(cells);
    const texts = words.map((w) => w.text).sort();
    expect(texts).toEqual(["lat", "tal"]);
  });

  it("ei poimi yksittäistä irrallista noppaa", () => {
    const cells = boardOf({ [cellKey(0, 0)]: "A" });
    expect(extractWords(cells)).toHaveLength(0);
  });

  it("käyttää jokerin valittua kirjainta", () => {
    const cells = new Map<string, PlacedTile>([
      [cellKey(0, 0), tile("K")],
      [cellKey(0, 1), tile(JOKER, "i", 1)],
      [cellKey(0, 2), tile("S")],
      [cellKey(0, 3), tile("S")],
      [cellKey(0, 4), tile("A")],
    ]);
    expect(extractWords(cells)[0].text).toBe("kissa");
  });
});

describe("isConnected", () => {
  it("tunnistaa yhtenäisen ristikon", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
      [cellKey(1, 1)]: "I",
    });
    expect(isConnected(cells)).toBe(true);
  });

  it("tunnistaa erilliset ryhmät", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
      [cellKey(5, 5)]: "I",
    });
    expect(isConnected(cells)).toBe(false);
  });
});

describe("disconnectedCells", () => {
  it("yhtenäinen ristikko → tyhjä joukko", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
      [cellKey(1, 1)]: "I",
    });
    expect(disconnectedCells(cells).size).toBe(0);
  });

  it("≤1 ruutua → tyhjä joukko", () => {
    expect(disconnectedCells(boardOf({})).size).toBe(0);
    expect(disconnectedCells(boardOf({ [cellKey(3, 3)]: "A" })).size).toBe(0);
  });

  it("palauttaa pienemmän saarekkeen, ei suurinta komponenttia", () => {
    // Suuri komponentti (3 ruutua) rivillä 0; irrallinen saareke (1 ruutu) kaukana.
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
      [cellKey(0, 2)]: "L",
      [cellKey(5, 5)]: "I",
    });
    const island = disconnectedCells(cells);
    expect([...island]).toEqual([cellKey(5, 5)]);
  });

  it("tasakokoiset komponentit → toinen jää saarekkeeksi (ei molempia, ei kumpikaan)", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "A",
      [cellKey(0, 1)]: "B",
      [cellKey(5, 5)]: "C",
      [cellKey(5, 6)]: "D",
    });
    expect(disconnectedCells(cells).size).toBe(2);
  });
});

describe("freeLetterViolations (ilmaiskirjaimet, ITU.md › Pisteytys)", () => {
  const free = (letter: string): PlacedTile => ({
    dieIndex: -1,
    face: letter,
    letter,
    free: true,
  });

  it("laillinen häntä: 1-2 ilmaista sanan lopussa → ei rikkomuksia", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
      [cellKey(0, 2)]: "L",
      [cellKey(0, 3)]: "O",
    });
    cells.set(cellKey(0, 4), free("T"));
    expect(freeLetterViolations(cells, extractWords(cells)).size).toBe(0);
    cells.set(cellKey(0, 5), free("A"));
    expect(freeLetterViolations(cells, extractWords(cells)).size).toBe(0);
  });

  it("ilmainen keskellä sanaa → rikkomus", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
      [cellKey(0, 3)]: "O",
      [cellKey(0, 4)]: "T",
    });
    cells.set(cellKey(0, 2), free("L"));
    const bad = freeLetterViolations(cells, extractWords(cells));
    expect(bad.has(cellKey(0, 2))).toBe(true);
  });

  it("katto: kolme ilmaista hännässä → koko häntä rikkoo", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
    });
    cells.set(cellKey(0, 2), free("L"));
    cells.set(cellKey(0, 3), free("O"));
    cells.set(cellKey(0, 4), free("T"));
    const bad = freeLetterViolations(cells, extractWords(cells));
    expect(bad.size).toBe(3);
  });

  it("risteys: ilmainen kahdessa sanassa → rikkomus", () => {
    // Vaaka: T A + ilmainen L (0,2). Pysty: L:n alle noppa A → pystysana "la".
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
      [cellKey(1, 2)]: "A",
    });
    cells.set(cellKey(0, 2), free("L"));
    const bad = freeLetterViolations(cells, extractWords(cells));
    expect(bad.has(cellKey(0, 2))).toBe(true);
  });

  it("irrallinen ilmainen (ei missään sanassa) → rikkomus", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
    });
    cells.set(cellKey(5, 5), free("L"));
    const bad = freeLetterViolations(cells, extractWords(cells));
    expect([...bad]).toEqual([cellKey(5, 5)]);
  });

  it("kokonaan ilmaisista koostuva sana → rikkomus", () => {
    const cells = new Map<string, PlacedTile>();
    cells.set(cellKey(0, 0), free("T"));
    cells.set(cellKey(0, 1), free("A"));
    const bad = freeLetterViolations(cells, extractWords(cells));
    expect(bad.size).toBe(2);
  });

  it("ilman ilmaisia → tyhjä joukko (nollakustannus nykypelille)", () => {
    const cells = boardOf({
      [cellKey(0, 0)]: "T",
      [cellKey(0, 1)]: "A",
    });
    expect(freeLetterViolations(cells, extractWords(cells)).size).toBe(0);
  });
});
