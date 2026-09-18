// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Mittaus: kahdennusnopan katto per ristikko (ITU.md > Jatkoideat > Kahdennusnoppa,
// Tommin paatos 18.9.2026: katto on ristikon eika sanan ominaisuus, ja se mitataan
// ennen kuin luku valitaan).
//
// Saannot mittarissa ovat ITU.md:n 18.9.2026 paatokset:
//   - kahdennettu noppa vie kaksi vierekkaista ruutua sanan suunnassa, sama kirjain molemmissa
//   - nopan arvo asuu ensimmaisessa ruudussa, toinen ruutu on 0 pistetta molempiin suuntiin
//   - toinen ruutu ottaa sanakertoimen (DW, TW) muttei kirjainkerrointa (DL, TL)
//   - katto: enintaan N kahdennusta yhdessa ristikossa (N = 0..6 ja rajaton)
//
// Ratkaisija on sama rajattu haku kuin mittaa_premium_ulottuvuus.ts:ssa (sana A vaakaan
// keskustan kautta, B pystyyn A:n kautta, C ristiin), laajennettuna niin etta sanan
// kirjaimet voi ottaa telineesta kahdennuksin. Luvut ovat alarajoja, ja sama raja koskee
// kaikkia katon arvoja, mika on vertailun tarkoitus. Katto 0 on nykypeli (vertailukohta
// premium_ulottuvuus_A.json:iin, sama siemensarja).
// Ei kirjoita public/dict/:iin. Ajo: npx vite-node build/mittaa_kahdennus.ts [siemenia] [katto]
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
// Toinen argumentti rajaa ajon yhteen kattoon (0..6 tai R = rajaton), jotta ajot voi ajaa rinnakkain.
const ONLY = process.argv[3]?.toUpperCase();
const UNLIMITED = 99;

// ---- sanasto ----
const meta: DawgMeta = JSON.parse(readFileSync(resolve(ROOT, "public/dict/sanasto-fi-v2.meta.json"), "utf8"));
const buf = readFileSync(resolve(ROOT, "public/dict/sanasto-fi-v2.dawg"));
const edges = new Uint32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const dawg = new Dawg({ edges, meta });

// ---- layout (nykyinen premium.ts) ----
type Seeds = ReadonlyArray<{ kind: PremiumKind; seeds: ReadonlyArray<readonly [number, number]> }>;
const SEEDS_NYKY: Seeds = [
  { kind: "TW", seeds: [[5, 0]] },
  { kind: "DW", seeds: [[2, 2]] },
  { kind: "TL", seeds: [[4, 1]] },
  { kind: "DL", seeds: [[2, 0], [1, 1], [3, 2]] },
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
const LAYOUT = buildLayout(SEEDS_NYKY);

// ---- heitto (sama rng ja sama 5/5-takuu kuin roll.ts) ----
function roll(seed: string): Face[] {
  const rng = createRng(seed);
  for (;;) {
    const faces = DICE.map((d) => d[Math.floor(rng() * d.length)]);
    if (faces.filter(countsAsVowel).length >= MIN_VOWELS && faces.filter(countsAsConsonant).length >= MIN_CONSONANTS) return faces;
  }
}

// ---- teline ja kahdennettu otto ----
type Rack = Map<Face, number>;
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
/** Teline jossa jokainen tahko on kahdesti: sanahaun ylaraja kahdennuksin. */
function doubledFaces(r: Rack): Face[] {
  const out: Face[] = [];
  for (const [f, n] of r) for (let i = 0; i < (f === JOKER ? n : 2 * n); i++) out.push(f);
  return out;
}

/** Yksi ruutu: face on noppa, letter nakyva kirjain, second = kahdennuksen toinen ruutu (0 p). */
interface Tile { face: Face; letter: Face; second: boolean }

/**
 * Ota sanan kirjaimet telineesta kahdennuksin. Kahdennus kattaa kaksi vierekkaista samaa
 * kirjainta yhdella nopalla. Kahdennuksia kaytetaan vain sen verran kuin nopat eivat riita
 * (jokeri ensin), ja enintaan `budget`. `fixed` on risteyskohdan indeksi jota kahdennus
 * ei saa kattaa (se kirjain on toisen nopan). null jos ei riita.
 */
function takeD(rack: Rack, letters: string[], budget: number, fixed = -1): { rack: Rack; tiles: Tile[]; doublings: number } | null {
  const L = letters.map((c) => c.toUpperCase() as Face);
  // Tarve per kirjain (risteyskohta ei tarvitse noppaa).
  const need = new Map<Face, number>();
  L.forEach((c, i) => { if (i !== fixed) need.set(c, (need.get(c) ?? 0) + 1); });
  // Mahdolliset kahdennusparit per kirjain, ei paallekkain, ei risteyskohdan yli.
  const pairs = new Map<Face, number[]>();
  for (let i = 0; i + 1 < L.length; i++) {
    if (L[i] !== L[i + 1] || i === fixed || i + 1 === fixed) continue;
    const list = pairs.get(L[i]) ?? [];
    if (list.length && list[list.length - 1] === i - 1) continue; // paallekkainen edellisen kanssa
    list.push(i); pairs.set(L[i], list);
  }
  let jokers = rack.get(JOKER) ?? 0;
  const r = new Map(rack);
  const useDouble = new Map<Face, number>(); // montako paria kahdennetaan
  const useJoker = new Map<Face, number>();
  // Vajeet: ensin kirjaimet joilla on vahiten pareja saavat jokerin.
  const deficits = [...need].map(([c, n]) => ({ c, d: Math.max(0, n - (c === JOKER ? 0 : r.get(c) ?? 0)), p: (pairs.get(c) ?? []).length }))
    .filter((x) => x.d > 0).sort((a, b) => a.p - b.p);
  let doublings = 0;
  for (const x of deficits) {
    let d = x.d;
    const j = Math.min(jokers, Math.max(0, d - x.p)); // jokeri vain siihen mita parit eivat kata
    jokers -= j; useJoker.set(x.c, j); d -= j;
    if (d > x.p) { const j2 = Math.min(jokers, d - x.p); jokers -= j2; useJoker.set(x.c, j + j2); d -= j2; }
    if (d > x.p) return null;
    useDouble.set(x.c, d); doublings += d;
  }
  if (doublings > budget) {
    // Yrita korvata kahdennuksia jokerilla, jos jokereita jai.
    for (const x of deficits) {
      while (doublings > budget && jokers > 0 && (useDouble.get(x.c) ?? 0) > 0) {
        useDouble.set(x.c, useDouble.get(x.c)! - 1); useJoker.set(x.c, (useJoker.get(x.c) ?? 0) + 1); jokers--; doublings--;
      }
    }
    if (doublings > budget) return null;
  }
  // Rakenna ruudut.
  const tiles: Tile[] = [];
  const secondAt = new Set<number>();
  for (const [c, n] of useDouble) for (const i of (pairs.get(c) ?? []).slice(0, n)) secondAt.add(i + 1);
  for (let i = 0; i < L.length; i++) {
    const c = L[i];
    if (i === fixed) { tiles.push({ face: c, letter: c, second: false }); continue; }
    if (secondAt.has(i)) { tiles.push({ face: c, letter: c, second: true }); continue; }
    if ((r.get(c) ?? 0) > 0 && c !== JOKER) { r.set(c, r.get(c)! - 1); tiles.push({ face: c, letter: c, second: false }); }
    else if ((useJoker.get(c) ?? 0) > 0) { useJoker.set(c, useJoker.get(c)! - 1); r.set(JOKER, r.get(JOKER)! - 1); tiles.push({ face: JOKER, letter: c, second: false }); }
    else return null; // ei pitaisi tapahtua
  }
  return { rack: r, tiles, doublings };
}

const wordValue = (w: string) => [...w].reduce((s, c) => s + (LETTER_VALUES[c.toUpperCase()] ?? 0), 0);
const byBest = (a: string, b: string) => b.length - a.length || wordValue(b) - wordValue(a) || a.localeCompare(b);

interface Solution { cells: Map<string, PlacedTile>; seconds: Set<string>; rack: Rack; words: string[]; doublings: number }
interface Scored { score: number; premiumCells: number; hits: Record<PremiumKind, number>; diceUsed: number; letters: number; bingo: boolean; words: string[]; doublings: number }

function evaluate(sol: Solution): Scored | null {
  const words = extractWords(sol.cells);
  if (!words.length || !sol.cells.has(CENTER)) return null;
  for (const w of words) if (!dawg.has(w.text)) return null;
  let score = 0;
  for (const w of words) {
    const values = w.keys.map((k) => (sol.seconds.has(k) ? 0 : LETTER_VALUES[sol.cells.get(k)!.face]));
    const prem = w.keys.map((k) => {
      const kind = LAYOUT.get(k);
      if (!kind) return NONE;
      return sol.seconds.has(k) ? { letter: 1, word: KIND_CELL[kind].word } : KIND_CELL[kind];
    });
    score += scoreWord(values, prem);
  }
  const hits: Record<PremiumKind, number> = { DL: 0, TL: 0, DW: 0, TW: 0 };
  let premiumCells = 0;
  for (const k of sol.cells.keys()) {
    const kind = LAYOUT.get(k);
    if (kind && k !== CENTER) { hits[kind]++; premiumCells++; }
  }
  const letters = sol.cells.size;
  const diceUsed = letters - sol.seconds.size;
  const bingo = diceUsed === DICE.length;
  if (bingo) score += BINGO_BONUS;
  return { score, premiumCells, hits, diceUsed, letters, bingo, words: words.map((w) => w.text), doublings: sol.doublings };
}

function placeTiles(sol: Solution, tiles: Tile[], r0: number, c0: number, dir: "H" | "V", skip: number, word: string): Solution | null {
  const cells = new Map(sol.cells);
  const seconds = new Set(sol.seconds);
  let idx = cells.size + 100;
  for (let j = 0; j < tiles.length; j++) {
    if (j === skip) continue;
    const r = dir === "H" ? r0 : r0 + j;
    const c = dir === "H" ? c0 + j : c0;
    if (r < 0 || c < 0 || r >= BOARD_SIZE || c >= BOARD_SIZE) return null;
    const k = cellKey(r, c);
    if (cells.has(k)) return null;
    cells.set(k, { dieIndex: idx++, face: tiles[j].face, letter: tiles[j].letter });
    if (tiles[j].second) seconds.add(k);
  }
  return { cells, seconds, rack: sol.rack, words: [...sol.words, word], doublings: sol.doublings };
}

/** Risti sana `w` olemassa olevan ruudun kirjaimen kautta suuntaan `dir`, kahdennuksin. */
function crossings(sol: Solution, w: string, dir: "H" | "V", cap: number): Solution[] {
  const out: Solution[] = [];
  const budget = cap - sol.doublings;
  for (const [k, tile] of sol.cells) {
    const [row, col] = k.split(",").map(Number);
    for (let i = 0; i < w.length; i++) {
      if (w[i].toUpperCase() !== tile.letter) continue;
      const t = takeD(sol.rack, [...w], budget, i);
      if (!t) continue;
      const r0 = dir === "H" ? row : row - i;
      const c0 = dir === "H" ? col - i : col;
      const next = placeTiles({ ...sol, rack: t.rack, doublings: sol.doublings + t.doublings }, t.tiles, r0, c0, dir, i, w);
      if (next) out.push(next);
    }
  }
  return out;
}

const TOP_A = 100, TOP_B = 60, TOP_C = 50, KEEP = 30;

function solve(faces: Face[], cap: number): Scored {
  const rack0 = rackOf(faces);
  // Ehdokkaat ovat kahden listan yhdiste: parhaat ilman kahdennusta ja parhaat kahdennuksin.
  // Pelkka kahdennettu teline tayttaisi listan pitkilla kahdennetuilla sanoilla ja pudottaisi
  // nykypelin parhaat pois, jolloin katto N voisi mitata huonommin kuin katto 0 (havaittu
  // viiden siemenen koeajossa: 338 vs 370). Yhdiste pitaa katon 0 ratkaisut mukana.
  const search = (r: Rack, extra: Iterable<Face>, min: number, top: number): string[] => {
    const ex = [...extra];
    const plain = dawg.wordsFromRack([...rackFaces(r), ...ex]).filter((w) => w.length >= min).sort(byBest).slice(0, top);
    if (cap === 0) return plain;
    const dbl = dawg.wordsFromRack([...doubledFaces(r), ...ex]).filter((w) => w.length >= min).sort(byBest).slice(0, top);
    return [...new Set([...plain, ...dbl])].sort(byBest);
  };
  const aWords = search(rack0, [], 3, TOP_A);
  let best: Scored = { score: 0, premiumCells: 0, hits: { DL: 0, TL: 0, DW: 0, TW: 0 }, diceUsed: 0, letters: 0, bingo: false, words: [], doublings: 0 };
  const consider = (s: Scored | null) => { if (s && s.score > best.score) best = s; };
  const level2: { sol: Solution; sc: number }[] = [];
  const empty: Solution = { cells: new Map(), seconds: new Set(), rack: rack0, words: [], doublings: 0 };

  for (const a of aWords) {
    const t = takeD(rack0, [...a], cap);
    if (!t) continue;
    const bWords = search(t.rack, new Set([...a].map((c) => c.toUpperCase() as Face)), 2, TOP_B);
    for (let off = 0; off < a.length; off++) {
      const sol1 = placeTiles({ ...empty, rack: t.rack, doublings: t.doublings }, t.tiles, CENTER_INDEX, CENTER_INDEX - off, "H", -1, a);
      if (!sol1) continue;
      consider(evaluate(sol1));
      for (const b of bWords) {
        for (const sol2 of crossings(sol1, b, "V", cap)) {
          const ev = evaluate(sol2);
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
    const cWords = search(sol.rack, onBoard, 2, TOP_C);
    for (const c of cWords) {
      for (const dir of ["H", "V"] as const) {
        for (const sol3 of crossings(sol, c, dir, cap)) consider(evaluate(sol3));
      }
    }
  }
  return best;
}

// ---- katot ja ajo ----
const CAPS: { nimi: string; cap: number }[] = [
  ...[0, 1, 2, 3, 4, 6].map((n) => ({ nimi: `${n}`, cap: n })),
  { nimi: "R", cap: UNLIMITED },
];
const seeds = Array.from({ length: N_SEEDS }, (_, i) => `mittaus-${i + 1}`);
const tulos: Record<string, unknown> = {
  siemenia: N_SEEDS,
  huomautus: "katto = kahdennuksia per ristikko, R = rajaton; ratkaisija on rajattu haku (enintaan 3 sanaa), luvut ovat alarajoja; sama raja kaikilla katoilla; katto 0 on nykypeli",
};
const t0 = Date.now();
for (const v of CAPS) {
  if (ONLY && v.nimi !== ONLY) continue;
  const acc = { score: 0, premiumCells: 0, DL: 0, TL: 0, DW: 0, TW: 0, diceUsed: 0, letters: 0, bingo: 0, anyTW: 0, anyDW: 0, words: 0, doublings: 0, longest: 0, any14: 0 };
  const jakauma: Record<number, number> = {};
  const esimerkit: string[] = [];
  for (const s of seeds) {
    const faces = roll(s);
    const b = solve(faces, v.cap);
    acc.score += b.score; acc.premiumCells += b.premiumCells;
    acc.DL += b.hits.DL; acc.TL += b.hits.TL; acc.DW += b.hits.DW; acc.TW += b.hits.TW;
    acc.diceUsed += b.diceUsed; acc.letters += b.letters; acc.bingo += b.bingo ? 1 : 0;
    acc.anyTW += b.hits.TW > 0 ? 1 : 0; acc.anyDW += b.hits.DW > 0 ? 1 : 0; acc.words += b.words.length;
    acc.doublings += b.doublings; jakauma[b.doublings] = (jakauma[b.doublings] ?? 0) + 1;
    const longest = Math.max(0, ...b.words.map((w) => w.length));
    acc.longest += longest; acc.any14 += longest >= 14 ? 1 : 0;
    if (esimerkit.length < 3) esimerkit.push(`${faces.join("")} -> ${b.words.join("+")} = ${b.score} (kahdennuksia ${b.doublings})`);
  }
  const n = N_SEEDS;
  const r = (x: number, d = 2) => +(x / n).toFixed(d);
  tulos[`katto ${v.nimi}`] = {
    keskipisteet: r(acc.score), kerroinruutuja_per_ristikko: r(acc.premiumCells),
    osumat_per_ristikko: { DL: r(acc.DL), TL: r(acc.TL), DW_ei_keskusta: r(acc.DW), TW: r(acc.TW) },
    osuus_heitoista_joissa_TW: r(acc.anyTW, 3), osuus_heitoista_joissa_DW: r(acc.anyDW, 3),
    noppia_kaytetty: r(acc.diceUsed), kirjaimia_laudalla: r(acc.letters), bingo_osuus: r(acc.bingo, 3),
    sanoja_per_ristikko: r(acc.words), pisin_sana_keskim: r(acc.longest), osuus_heitoista_joissa_14plus: r(acc.any14, 3),
    kahdennuksia_kaytetty_keskim: r(acc.doublings), kahdennusten_jakauma: jakauma,
    esimerkit,
  };
  console.error(`katto ${v.nimi} valmis, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
writeFileSync(resolve(HERE, "mittaus", `kahdennus_katto${ONLY ? "_" + ONLY : ""}.json`), JSON.stringify(tulos, null, 2) + "\n");
console.log(JSON.stringify(tulos, null, 2));
