// Lautadomain: nopat asetetaan ruudukkoon, ja tästä poimitaan vaaka- ja
// pystysuuntaiset sanat (yhtenäiset ≥2 ruudun jonot). Puhdas logiikka,
// erillään UI:sta — sama poiminta ajaa sekä live-validoinnin että pisteytyksen.
import { JOKER, type Face } from "./dice";

export interface PlacedTile {
  /** Nopan indeksi (0..12) — yksilöi fyysisen nopan laudalla. */
  dieIndex: number;
  /** Nopan näkyvä tahko. */
  face: Face;
  /** Jokerin valittu kirjain; muilla = face. Validointi käyttää tätä. */
  letter: Face;
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

/** Tosi, jos kaikki asetetut nopat muodostavat yhden yhtenäisen ryhmän (ristikko). */
export function isConnected(cells: Cells): boolean {
  if (cells.size <= 1) return true;
  const start = cells.keys().next().value!;
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
  return visited.size === cells.size;
}

/** Tosi, jos noppa on jokeri jolle ei ole vielä valittu kirjainta. */
export function isUnassignedJoker(tile: PlacedTile): boolean {
  return tile.face === JOKER && tile.letter === JOKER;
}
