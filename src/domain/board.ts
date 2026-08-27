// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Lautadomain: nopat asetetaan ruudukkoon, ja tästä poimitaan vaaka- ja
// pystysuuntaiset sanat (yhtenäiset ≥2 ruudun jonot). Puhdas logiikka,
// erillään UI:sta — sama poiminta ajaa sekä live-validoinnin että pisteytyksen.
import { JOKER, type Face } from "./dice";

export interface PlacedTile {
  /** Nopan indeksi (0..12) — yksilöi fyysisen nopan laudalla. Ilmaiskirjaimella -1. */
  dieIndex: number;
  /** Nopan näkyvä tahko. Ilmaiskirjaimella = letter. */
  face: Face;
  /** Jokerin valittu kirjain; muilla = face. Validointi käyttää tätä. */
  letter: Face;
  /** Ilmaiskirjain: laudalle kirjoitettu kirjain ilman noppaa (ITU.md › Ilmaiskirjaimet).
   * 0 pistettä, ei ruutubonuksia, sallittu vain sanan lopussa — säännöt vartioi
   * freeLetterViolations. */
  free?: boolean;
}

export type Cells = ReadonlyMap<string, PlacedTile>;

export function cellKey(row: number, col: number): string {
  return `${row},${col}`;
}

export function parseKey(key: string): { row: number; col: number } {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

export interface BoardWord {
  /** "H" = vaaka, "V" = pysty. */
  dir: "H" | "V";
  /** Sanan ruudut järjestyksessä (vasemmalta/ylhäältä). */
  keys: string[];
  /** Validoitava merkkijono (jokerin valittu kirjain mukana), gemenana. */
  text: string;
}

/**
 * Poimii kaikki vaaka- ja pystysanat: maksimaaliset yhtenäiset ≥2 ruudun jonot.
 * Yksittäinen irrallinen noppa ei muodosta sanaa.
 */
export function extractWords(cells: Cells): BoardWord[] {
  const words: BoardWord[] = [];

  const scan = (dir: "H" | "V") => {
    const seen = new Set<string>();
    for (const key of cells.keys()) {
      const { row, col } = parseKey(key);
      // Aloita jonon alusta: edellinen ruutu (vasen/ylä) on tyhjä.
      const prev = dir === "H" ? cellKey(row, col - 1) : cellKey(row - 1, col);
      if (cells.has(prev)) continue;

      const keys: string[] = [];
      let text = "";
      let r = row;
      let c = col;
      for (;;) {
        const k = cellKey(r, c);
        const tile = cells.get(k);
        if (!tile) break;
        keys.push(k);
        text += tile.letter.toLowerCase();
        if (dir === "H") c++;
        else r++;
      }
      if (keys.length >= 2) {
        words.push({ dir, keys, text });
        for (const k of keys) seen.add(k);
      }
    }
  };

  scan("H");
  scan("V");
  return words;
}

/** Ilmaiskirjainten katto per sana (ITU.md › Ilmaiskirjaimet, vahvistettu 27.8.2026). */
export const MAX_FREE_LETTERS = 2;

/**
 * Ilmaiskirjainsääntöjä rikkovien ruutujen avaimet (ITU.md › Pisteytys › Ilmaiskirjaimet):
 * ilmaiskirjain saa esiintyä vain YHDEN sanan yhtenäisenä loppupäänä, enintään
 * MAX_FREE_LETTERS per sana, ei koskaan risteyksessä, ei sanan alussa/keskellä,
 * ei koko sanana eikä irrallaan. `words` on extractWords(cells):n tulos.
 */
export function freeLetterViolations(cells: Cells, words: BoardWord[]): Set<string> {
  const bad = new Set<string>();
  const freeKeys: string[] = [];
  for (const [k, t] of cells) if (t.free) freeKeys.push(k);
  if (!freeKeys.length) return bad;

  // Monessako sanassa kukin ilmaisruutu on: 0 = irrallinen, 2 = risteys → rikkomus.
  const wordCount = new Map<string, number>();
  for (const w of words)
    for (const k of w.keys)
      if (cells.get(k)!.free) wordCount.set(k, (wordCount.get(k) ?? 0) + 1);
  for (const k of freeKeys) if ((wordCount.get(k) ?? 0) !== 1) bad.add(k);

  for (const w of words) {
    // Yhtenäinen loppupää: montako ilmaisruutua sanan hännässä on.
    let tail = 0;
    while (tail < w.keys.length && cells.get(w.keys[w.keys.length - 1 - tail])!.free) tail++;
    const freeInWord = w.keys.reduce((n, k) => n + (cells.get(k)!.free ? 1 : 0), 0);
    // Rikkomus: ilmaisia muualla kuin hännässä, katto ylittyy tai sana on pelkkiä ilmaisia.
    if (freeInWord > tail || tail > MAX_FREE_LETTERS || tail >= w.keys.length) {
      for (const k of w.keys) if (cells.get(k)!.free) bad.add(k);
    }
  }
  return bad;
}

/** Yhden yhtenäisen komponentin ruudut alkaen `start`:sta (4-naapuruus, flood-fill). */
function floodComponent(cells: Cells, start: string): Set<string> {
  const stack = [start];
  const visited = new Set<string>([start]);
  while (stack.length) {
    const { row, col } = parseKey(stack.pop()!);
    for (const n of [
      cellKey(row - 1, col),
      cellKey(row + 1, col),
      cellKey(row, col - 1),
      cellKey(row, col + 1),
    ]) {
      if (cells.has(n) && !visited.has(n)) {
        visited.add(n);
        stack.push(n);
      }
    }
  }
  return visited;
}

/** Tosi, jos kaikki asetetut nopat muodostavat yhden yhtenäisen ryhmän (ristikko). */
export function isConnected(cells: Cells): boolean {
  if (cells.size <= 1) return true;
  const start = cells.keys().next().value!;
  return floodComponent(cells, start).size === cells.size;
}

/**
 * Ruudut jotka EIVÄT kuulu suurimpaan yhtenäiseen komponenttiin — eli irralliset
 * saarekkeet. Tyhjä joukko = ristikko on yhtenäinen (tai ≤1 ruutua). Tasakokoisten
 * komponenttien tapauksessa "suurin" on ensiksi löytyvä, jolloin loput jäävät
 * saarekkeiksi. Käytetään UI:ssa korostamaan MISSÄ ristikko on poikki.
 */
export function disconnectedCells(cells: Cells): Set<string> {
  const island = new Set<string>();
  if (cells.size <= 1) return island;
  // Etsi kaikki komponentit; pidä suurin, palauta loput.
  const remaining = new Set(cells.keys());
  let largest = new Set<string>();
  const components: Set<string>[] = [];
  while (remaining.size) {
    const start = remaining.values().next().value!;
    const comp = floodComponent(cells, start);
    for (const k of comp) remaining.delete(k);
    components.push(comp);
    if (comp.size > largest.size) largest = comp;
  }
  for (const comp of components) {
    if (comp === largest) continue;
    for (const k of comp) island.add(k);
  }
  return island;
}

/** Tosi, jos noppa on jokeri jolle ei ole vielä valittu kirjainta. */
export function isUnassignedJoker(tile: PlacedTile): boolean {
  return tile.face === JOKER && tile.letter === JOKER;
}
