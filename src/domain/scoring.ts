// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { LETTER_VALUES, type Face } from "./dice";
import type { PremiumCell } from "./premium";

export function faceValue(face: Face): number {
  const value = LETTER_VALUES[face];
  if (value === undefined) throw new Error(`Tuntematon tahko: ${face}`);
  return value;
}

export function sumValues(faces: readonly Face[]): number {
  return faces.reduce((sum, f) => sum + faceValue(f), 0);
}

/**
 * Yhden sanan pisteet. `premiums === null` → pelkkä kirjainarvojen summa (perustila,
 * identtinen vanhaan pisteytykseen). Muuten Scrabblen ristipisteytys:
 *   Σ(arvo_i × kirjainkerroin_i) × Π(sanakerroin_i).
 * `premiums` on samanpituinen ja -järjestyksinen kuin `letterValues`. Risteysnoppa:
 * H- ja V-sana pisteytetään erikseen, joten kumpikin saa omat kertoimensa luonnostaan.
 */
export function scoreWord(
  letterValues: readonly number[],
  premiums: readonly PremiumCell[] | null,
): number {
  if (!premiums) return letterValues.reduce((s, v) => s + v, 0);
  let sum = 0;
  let wordMult = 1;
  for (let i = 0; i < letterValues.length; i++) {
    sum += letterValues[i] * premiums[i].letter;
    wordMult *= premiums[i].word;
  }
  return sum * wordMult;
}

export const TIME_BONUS_SECONDS_PER_POINT = 5;
export const GAME_DURATION_SECONDS = 180;
/** Aikabonus aukeaa vasta kun vähintään näin moni noppa on käytetty kelvollisissa sanoissa. */
export const TIME_BONUS_MIN_LETTERS_USED = 11;
/** Aikabonuksen katto, ettei se dominoi sanapisteitä eikä houkuta kiirehtimään. */
export const TIME_BONUS_MAX = 6;

/**
 * Aikabonus: +1 piste / 5 säästettyä sekuntia (kattoon `TIME_BONUS_MAX` asti), mutta VAIN kun
 * teline on (lähes) ratkaistu — vähintään `TIME_BONUS_MIN_LETTERS_USED` noppaa kelvollisissa
 * sanoissa. Näin bonus palkitsee tehokkuuden (nopea JA täydellinen), ei pelkkää aikaista
 * lukitsemista. Alle kynnyksen jäänyt ratkaisu ei saa bonusta (käyttämättömät nopat
 * sakotetaan jo erikseen arvoillaan → ei tuplarangaistusta).
 */
export function timeBonus(secondsRemaining: number, lettersUsed: number): number {
  if (lettersUsed < TIME_BONUS_MIN_LETTERS_USED) return 0; // teline ei riittävän ratkaistu
  const raw = Math.floor(Math.max(0, secondsRemaining) / TIME_BONUS_SECONDS_PER_POINT);
  return Math.min(TIME_BONUS_MAX, raw);
}

export interface ScoreInput {
  /** Sanojen pisteet: noppien arvot, risteysnoppa kahdesti. UI/lauta laskee. */
  wordPoints: number;
  /** Käyttämättä jääneiden noppien tahkot (jokeri = 0, ei sakkoa). */
  unusedFaces: readonly Face[];
  secondsRemaining: number;
  /** Kelvollisissa sanoissa käytettyjen noppien määrä (aikabonuksen kynnystä varten). */
  lettersUsed: number;
  timeBonusEnabled: boolean;
  /** Bingo-bonus (premium-moodi: kaikki nopat käytetty + keskusankkuri); 0 jos ei sovellu. */
  bingo?: number;
}

export interface ScoreBreakdown {
  wordPoints: number;
  unusedPenalty: number;
  timeBonus: number;
  bingo: number;
  total: number;
}

export function finalScore(input: ScoreInput): ScoreBreakdown {
  const unusedPenalty = sumValues(input.unusedFaces);
  const bonus = input.timeBonusEnabled
    ? timeBonus(input.secondsRemaining, input.lettersUsed)
    : 0;
  const bingo = input.bingo ?? 0;
  return {
    wordPoints: input.wordPoints,
    unusedPenalty,
    timeBonus: bonus,
    bingo,
    total: input.wordPoints - unusedPenalty + bonus + bingo,
  };
}
