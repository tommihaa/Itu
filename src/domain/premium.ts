// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Premium-pistemoodi (valinnainen): Scrabble-tyyliset kertoimet kiinteällä,
// symmetrisellä layoutilla + bingo. Puhdas domain, ei UI-riippuvuutta.
//
// Layout on kiinteä ja keskitetty lautaan (keskipiste = keskusankkuri ★). Premiumit
// määritellään oktantin siemenistä (a,b), a≥b≥0, ja peilataan 8-kertaisesti → täysi
// symmetria on rakenteellisesti taattu (testin vartioima). Etäisyydet on mitoitettu
// 13 nopan ulottuvuuteen (säde ≤5), ja premiumeja on enemmän kuin nopat ehtii kattaa
// → sijoittelusta tulee aito kompromissi ("mahdollisuuksien maksimointi").
//
// TÄRKEÄÄ: tämä on PUHDAS pistemekaniikka — ei muuta sanaston validointia (DAWG) eikä
// noppia/heittoa. Ei Scrabble-suomen pelitoteutusta (ks. SANASTO.md / parkkipäätökset).
import { cellKey } from "./board";

/** Lauta on kiinteä 21×21 (ks. game.ts BOARD); pidetään tässä erikseen domainille. */
export const BOARD_SIZE = 21;
/** Keskiruudun rivi/sarake = keskusankkuri. */
export const CENTER_INDEX = Math.floor(BOARD_SIZE / 2); // 10
/** Keskiruudun avain — ristikon on katettava tämä premium-moodissa (★). */
export const CENTER = cellKey(CENTER_INDEX, CENTER_INDEX);

/**
 * Bingo-bonus: kaikki 13 noppaa käytetty kelvollisissa sanoissa (ja keskusankkuri katettu).
 * Mitoitettu merkittäväksi mutta ei dominoivaksi — tyypillinen premium-ristikko tuottaa
 * karkeasti 40–80 p, joten +20 palkitsee täyskäytön ilman että pelkkä bingo ratkaisee.
 */
export const BINGO_BONUS = 20;

export type PremiumKind = "DL" | "TL" | "DW" | "TW";

export interface PremiumCell {
  /** Kirjainkerroin: DL=2, TL=3, muuten 1. */
  letter: 1 | 2 | 3;
  /** Sanakerroin: DW=2, TW=3, muuten 1. */
  word: 1 | 2 | 3;
}

const NONE: PremiumCell = { letter: 1, word: 1 };

const KIND_CELL: Readonly<Record<PremiumKind, PremiumCell>> = {
  DL: { letter: 2, word: 1 },
  TL: { letter: 3, word: 1 },
  DW: { letter: 1, word: 2 },
  TW: { letter: 1, word: 3 },
};

/** Oktantin siemenet (a,b), a≥b≥0; peilataan 8-kertaisesti. Keskusta = DW (★) erikseen. */
const SEEDS: ReadonlyArray<{ kind: PremiumKind; seeds: ReadonlyArray<readonly [number, number]> }> = [
  { kind: "TW", seeds: [[5, 0]] }, // akselien kärjet — vaativat pitkän sanan keskeltä
  { kind: "DW", seeds: [[2, 2]] }, // lähidiagonaali
  { kind: "TL", seeds: [[4, 1]] }, // ulompi hajonta
  { kind: "DL", seeds: [[2, 0], [1, 1], [3, 2]] }, // tiheämpi lähikenttä
];

/** Peilaa siemenen (a,b) 8-kertaisesti: {(±a,±b),(±b,±a)} (duplikaatit poistettu). */
function expand(a: number, b: number): Array<[number, number]> {
  const out = new Set<string>();
  for (const [x, y] of [[a, b], [b, a]] as const) {
    for (const sx of [1, -1] as const) {
      for (const sy of [1, -1] as const) out.add(`${sx * x},${sy * y}`);
    }
  }
  return [...out].map((s) => s.split(",").map(Number) as [number, number]);
}

const LAYOUT: ReadonlyMap<string, PremiumKind> = (() => {
  const m = new Map<string, PremiumKind>();
  for (const { kind, seeds } of SEEDS) {
    for (const [a, b] of seeds) {
      for (const [dr, dc] of expand(a, b)) {
        const key = cellKey(CENTER_INDEX + dr, CENTER_INDEX + dc);
        if (!m.has(key)) m.set(key, kind);
      }
    }
  }
  m.set(CENTER, "DW"); // keskusankkuri = tähti + kaksinkertainen sana
  return m;
})();

/** Premium-laji ruudussa, tai null jos tavallinen ruutu (UI-luokat + legenda). */
export function premiumKindAt(key: string): PremiumKind | null {
  return LAYOUT.get(key) ?? null;
}

/** Kertoimet ruudussa; tavallinen ruutu = {letter:1, word:1}. */
export function premiumAt(key: string): PremiumCell {
  const kind = LAYOUT.get(key);
  return kind ? KIND_CELL[kind] : NONE;
}

/** Koko layout (UI-legendaa ja testejä varten). */
export function premiumLayout(): ReadonlyMap<string, PremiumKind> {
  return LAYOUT;
}
