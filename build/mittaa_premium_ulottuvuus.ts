// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Mittaus: kuinka hyvin paras loydettava ristikko osuu Scrabble-pistemoodin
// kerroinruutuihin kolmella vaihtoehdolla (ITU.md-keskustelu 18.9.2026):
//   A) 13 noppaa, nykyinen premium-layout
//   B) 13 noppaa, layout siirretty yhden ruudun sisemmas (TW 5->4, TL (4,1)->(3,1),
//      DL (3,2)->(2,1); DW (2,2) ja keskusta ennallaan)
//   C) 15 noppaa (nopat 1 ja 4 kahdennettuna sijaisena), nykyinen layout
// Ratkaisija on rajattu haku: sana A vaakaan keskustan kautta, sana B pystyyn
// A:n kirjaimen kautta, sana C ristiin A:n tai B:n kautta. Se ei loyda kaikkea,
// joten luvut ovat alarajoja, mutta sama raja koskee kaikkia kolmea vaihtoehtoa,
// mika on vertailun tarkoitus. Ilmaiskirjaimia ei kayteta (eivat osu kertoimiin).
// Ei kirjoita public/dict/:iin. Ajo: npx vite-node build/mittaa_premium_ulottuvuus.ts [siemenia]
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Dawg } from "../src/dict/dawg";
import type { DawgMeta } from "../src/dict/builder";
import { DICE, JOKER, LETTER_VALUES, countsAsConsonant, countsAsVowel, type Face } from "../src/domain/dice";
import { createRng } from "../src/domain/rng";
import { MIN_CONSONANTS, MIN_VOWELS } from "../src/domain/roll";
import { cellKey, extractWords, type PlacedTile } from "../src/domain/board";
import { scoreWord } from "../src/domain/scoring";
import { BINGO_BONUS, BOARD_SIZE, CENTER_INDEX, type PremiumCell, type PremiumKind } from "../src/domain/premium";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const N_SEEDS = Number(process.argv[2] ?? 100);
// Valinnainen kolmas argumentti rajaa ajon yhteen vaihtoehtoon (A, B tai C), jotta kolme ajoa voi ajaa rinnakkain.
const ONLY = process.argv[3]?.toUpperCase();

// ---- sanasto ----
const meta: DawgMeta = JSON.parse(readFileSync(resolve(ROOT, "public/dict/sanasto-fi-v2.meta.json"), "utf8"));
const buf = readFileSync(resolve(ROOT, "public/dict/sanasto-fi-v2.dawg"));
const edges = new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const dawg = new Dawg({ edges, meta });

// ---- layoutit (kopio premium.ts:n rakenteesta, siemenet parametrina) ----
type Seeds = ReadonlyArray<{ kind: PremiumKind; seeds: ReadonlyArray<readonly [number, number]> }>;
const SEEDS_NYKY: Seeds = [
  { kind: "TW", seeds: [[5, 0]] },
  { kind: "DW", seeds: [[2, 2]] },
  { kind: "TL", seeds: [[4, 1]] },
  { kind: "DL", seeds: [[2, 0], [1, 1], [3, 2]] },
];
const SEEDS_SISEMPI: Seeds = [
  { kind: "TW", seeds: [[4, 0]] },
  { kind: "DW", seeds: [[2, 2]] },
  { kind: "TL", seeds: [[3, 1]] },
  { kind: "DL", seeds: [[2, 0], [1, 1], [2, 1]] },
];
const KIND_CELL: Readonly<Record<PremiumKind, PremiumCell>> = {
  DL: { letter: 2, word: 1 }, TL: { letter: 3, word: 1 }, DW: { letter: 1, word: 2 }, TW: { letter: 1, word: 3 },
};
const NONE: PremiumCell = { letter: 1, word: 1 };
const CENTER = cellKey(CENTER_INDEX, CENTER_INDEX);

function buildLayout(seeds: Seeds): Map<string, PremiumKind> {
  const m = new Map<string, PremiumKind>();
  for (const { kind, seeds: ss } of seeds) {
    for (const [a, b] of ss) {
      for (const [x, y] of [[a, b], [b, a]] as const) {
        for (const sx of [1, -1]) for (const sy of [1, -1]) {
          const key = cellKey(CENTER_INDEX + sx * x, CENTER_INDEX + sy * y);
          if (!m.has(key)) m.set(key, kind);
        }
      }
    }
  }
  m.set(CENTER, "DW");
  return m;
}

// ---- heitto (sama rng ja sama 5/5-takuu kuin roll.ts, noppajoukko parametrina) ----
function roll(seed: string, dice: readonly (readonly Face[])[]): Face[] {
  const rng = createRng(seed);
  for (;;) {
    const faces = dice.map((d) => d[Math.floor(rng() * d.length)]);
    if (faces.filter(countsAsVowel).length >= MIN_VOWELS && faces.filter(countsAsConsonant).length >= MIN_CONSONANTS) return faces;
  }
}

// ---- ratkaisija ----
type Rack = Map<Face, number>; // tahko -> maara, jokeri avaimella JOKER
function rackOf(faces: Face[]): Rack {
  const r: Rack = new Map();
  for (const f of faces) r.set(f, (r.get(f) ?? 0) + 1);
  return r;
}
function rackFaces(r: Rack): Face[] {
  const out: Face[] = [];
  for (const [f, n] of r) for (let i = 0; i < n; i++) out.push(f);
  return out;
}
/** Ota sanan kirjaimet telineesta (oikea tahko ensin, jokeri varalla). null jos ei riita. */
function take(rack: Rack, letters: string[]): { rack: Rack; tiles: { face: Face; letter: Face }[] } | null {
  const r = new Map(rack);
  const tiles: { face: Face; letter: Face }[] = [];
  for (const l of letters) {
    const L = l.toUpperCase();
    if ((r.get(L) ?? 0) > 0) { r.set(L, r.get(L)! - 1); tiles.push({ face: L, letter: L }); }
    else if ((r.get(JOKER) ?? 0) > 0) { r.set(JOKER, r.get(JOKER)! - 1); tiles.push({ face: JOKER, letter: L }); }
    else return null;
  }
  return { rack: r, tiles };
}
const wordValue = (w: string) => [...w].reduce((s, c) => s + (LETTER_VALUES[c.toUpperCase()] ?? 0), 0);
const byBest = (a: string, b: string) => b.length - a.length || wordValue(b) - wordValue(a) || a.localeCompare(b);

interface Solution { cells: Map<string, PlacedTile>; rack: Rack; words: string[] }
interface Scored { score: number; premiumCells: number; hits: Record<PremiumKind, number>; diceUsed: number; bingo: boolean; words: string[] }

function evaluate(sol: Solution, layout: Map<string, PremiumKind>, diceCount: number): Scored | null {
  const words = extractWords(sol.cells);
  if (!words.length || !sol.cells.has(CENTER)) return null;
  for (const w of words) if (!dawg.has(w.text)) return null;
  let score = 0;
  for (const w of words) {
    const values = w.keys.map((k) => LETTER_VALUES[sol.cells.get(k)!.face]);
    const prem = w.keys.map((k) => { const kind = layout.get(k); return kind ? KIND_CELL[kind] : NONE; });
    score += scoreWord(values, prem);
  }
  const hits: Record<PremiumKind, number> = { DL: 0, TL: 0, DW: 0, TW: 0 };
  let premiumCells = 0;
  for (const k of sol.cells.keys()) {
    const kind = layout.get(k);
    if (kind && k !== CENTER) { hits[kind]++; premiumCells++; }
  }
  const diceUsed = sol.cells.size;
  const bingo = diceUsed === diceCount;
  if (bingo) score += BINGO_BONUS;
  return { score, premiumCells, hits, diceUsed, bingo, words: words.map((w) => w.text) };
}

function place(cells: Map<string, PlacedTile>, tiles: { face: Face; letter: Face }[], row: number, col: number, dir: "H" | "V"): Map<string, PlacedTile> | null {
  const out = new Map(cells);
  let idx = 100;
  for (let i = 0; i < tiles.length; i++) {
    const r = dir === "H" ? row : row + i;
    const c = dir === "H" ? col + i : col;
    if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) return null;
    const k = cellKey(r, c);
    if (out.has(k)) return null;
    out.set(k, { dieIndex: idx++, face: tiles[i].face, letter: tiles[i].letter });
  }
  return out;
}

/** Yrita ristia sana `w` olemassa olevan sanan kirjaimen kautta suuntaan `dir`. */
function crossings(sol: Solution, w: string, dir: "H" | "V"): Solution[] {
  const out: Solution[] = [];
  for (const [k, tile] of sol.cells) {
    const [row, col] = k.split(",").map(Number);
    for (let i = 0; i < w.length; i++) {
      if (w[i].toUpperCase() !== tile.letter) continue;
      const rest = [...w.slice(0, i), ...w.slice(i + 1)];
      const t = take(sol.rack, rest);
      if (!t) continue;
      const tiles = [...t.tiles.slice(0, i), { face: tile.face, letter: tile.letter }, ...t.tiles.slice(i)];
      const r0 = dir === "H" ? row : row - i;
      const c0 = dir === "H" ? col - i : col;
      // sijoita muut kuin risteyskohta
      let cells: Map<string, PlacedTile> | null = new Map(sol.cells);
      for (let j = 0; j < tiles.length && cells; j++) {
        if (j === i) continue;
        const r = dir === "H" ? r0 : r0 + j;
        const c = dir === "H" ? c0 + j : c0;
        if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE || cells.has(cellKey(r, c))) { cells = null; break; }
        cells.set(cellKey(r, c), { dieIndex: 200 + j, face: tiles[j].face, letter: tiles[j].letter });
      }
      if (cells) out.push({ cells, rack: t.rack, words: [...sol.words, w] });
    }
  }
  return out;
}

const TOP_A = 100, TOP_B = 60, TOP_C = 50, KEEP = 30;

function solve(faces: Face[], layout: Map<string, PremiumKind>): Scored {
  const rack0 = rackOf(faces);
  const all = dawg.wordsFromRack(faces).filter((w) => w.length >= 3).sort(byBest);
  const aWords = all.slice(0, TOP_A);
  let best: Scored = { score: 0, premiumCells: 0, hits: { DL: 0, TL: 0, DW: 0, TW: 0 }, diceUsed: 0, bingo: false, words: [] };
  const consider = (s: Scored | null) => { if (s && s.score > best.score) best = s; };
  let level2: { sol: Solution; sc: number }[] = [];

  for (const a of aWords) {
    const t = take(rack0, [...a]);
    if (!t) continue;
    const bWords = dawg.wordsFromRack([...rackFaces(t.rack), ...new Set([...a].map((c) => c.toUpperCase()))])
      .filter((w) => w.length >= 2).sort(byBest).slice(0, TOP_B);
    for (let off = 0; off < a.length; off++) {
      const cells = place(new Map(), t.tiles, CENTER_INDEX, CENTER_INDEX - off, "H");
      if (!cells) continue;
      const sol1: Solution = { cells, rack: t.rack, words: [a] };
      consider(evaluate(sol1, layout, faces.length));
      for (const b of bWords) {
        for (const sol2 of crossings(sol1, b, "V")) {
          const ev = evaluate(sol2, layout, faces.length);
          if (!ev) continue;
          consider(ev);
          level2.push({ sol: sol2, sc: ev.score });
        }
      }
    }
  }
  level2.sort((x, y) => y.sc - x.sc);
  for (const { sol } of level2.slice(0, KEEP)) {
    const onBoard = new Set([...sol.cells.values()].map((t) => t.letter));
    const cWords = dawg.wordsFromRack([...rackFaces(sol.rack), ...onBoard]).filter((w) => w.length >= 2).sort(byBest).slice(0, TOP_C);
    for (const c of cWords) {
      for (const dir of ["H", "V"] as const) {
        for (const sol3 of crossings(sol, c, dir)) consider(evaluate(sol3, layout, faces.length));
      }
    }
  }
  return best;
}

// ---- vaihtoehdot ja ajo ----
const DICE15 = [...DICE, DICE[0], DICE[3]];
const VARIANTS = [
  { nimi: "A: 13 noppaa, nykyinen layout", dice: DICE, layout: buildLayout(SEEDS_NYKY) },
  { nimi: "B: 13 noppaa, layout sisemmas", dice: DICE, layout: buildLayout(SEEDS_SISEMPI) },
  { nimi: "C: 15 noppaa, nykyinen layout", dice: DICE15, layout: buildLayout(SEEDS_NYKY) },
];

const seeds = Array.from({ length: N_SEEDS }, (_, i) => `mittaus-${i + 1}`);
const tulos: Record<string, unknown> = { siemenia: N_SEEDS, huomautus: "ratkaisija on rajattu haku (enintaan 3 sanaa), luvut ovat alarajoja; sama raja kaikissa vaihtoehdoissa" };
const t0 = Date.now();
for (const v of VARIANTS) {
  if (ONLY && !v.nimi.startsWith(ONLY + ":")) continue;
  const acc = { score: 0, premiumCells: 0, DL: 0, TL: 0, DW: 0, TW: 0, diceUsed: 0, bingo: 0, anyTW: 0, anyDW: 0, words: 0 };
  const esimerkit: string[] = [];
  for (const s of seeds) {
    const faces = roll(s, v.dice);
    const b = solve(faces, v.layout);
    acc.score += b.score; acc.premiumCells += b.premiumCells;
    acc.DL += b.hits.DL; acc.TL += b.hits.TL; acc.DW += b.hits.DW; acc.TW += b.hits.TW;
    acc.diceUsed += b.diceUsed; acc.bingo += b.bingo ? 1 : 0;
    acc.anyTW += b.hits.TW > 0 ? 1 : 0; acc.anyDW += b.hits.DW > 0 ? 1 : 0; acc.words += b.words.length;
    if (esimerkit.length < 3) esimerkit.push(`${faces.join("")} -> ${b.words.join("+")} = ${b.score}`);
  }
  const n = N_SEEDS;
  const r = (x: number, d = 2) => +(x / n).toFixed(d);
  tulos[v.nimi] = {
    keskipisteet: r(acc.score), kerroinruutuja_per_ristikko: r(acc.premiumCells),
    osumat_per_ristikko: { DL: r(acc.DL), TL: r(acc.TL), DW_ei_keskusta: r(acc.DW), TW: r(acc.TW) },
    osuus_heitoista_joissa_TW: r(acc.anyTW, 3), osuus_heitoista_joissa_DW: r(acc.anyDW, 3),
    noppia_kaytetty: r(acc.diceUsed), noppia_yhteensa: v.dice.length, bingo_osuus: r(acc.bingo, 3), sanoja_per_ristikko: r(acc.words),
    esimerkit,
  };
  console.error(`${v.nimi} valmis, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
writeFileSync(resolve(HERE, "mittaus", `premium_ulottuvuus${ONLY ? "_" + ONLY : ""}.json`), JSON.stringify(tulos, null, 2) + "\n");
console.log(JSON.stringify(tulos, null, 2));
