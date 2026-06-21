import { LETTER_VALUES, type Face } from "./dice";

export function faceValue(face: Face): number {
  const value = LETTER_VALUES[face];
  if (value === undefined) throw new Error(`Tuntematon tahko: ${face}`);
  return value;
}

export function sumValues(faces: readonly Face[]): number {
  return faces.reduce((sum, f) => sum + faceValue(f), 0);
}

export const TIME_BONUS_SECONDS_PER_POINT = 5;
export const GAME_DURATION_SECONDS = 180;
/** Aikabonus aukeaa vasta kun tämä osuus ajasta on kulunut (loppukolmannes). */
export const TIME_BONUS_ELAPSED_FRACTION = 2 / 3;
/** Aikabonuksen katto, ettei se dominoi sanapisteitä eikä houkuta kiirehtimään. */
export const TIME_BONUS_MAX = 6;

/**
 * Aikabonus: +1 piste / 5 säästettyä sekuntia, mutta VAIN kun ≥2/3 ajasta on kulunut
 * (eli ≤1/3 jäljellä), ja kattoon `TIME_BONUS_MAX` asti. Näin alussa ei kannata
 * kiirehtiä — bonus palkitsee tehokkuuden vasta loppukolmanneksella.
 */
export function timeBonus(secondsRemaining: number): number {
  const opensAt = GAME_DURATION_SECONDS * (1 - TIME_BONUS_ELAPSED_FRACTION); // = /3
  if (secondsRemaining > opensAt) return 0; // ei vielä 2/3 kulunut → ei bonusta
  const raw = Math.floor(Math.max(0, secondsRemaining) / TIME_BONUS_SECONDS_PER_POINT);
  return Math.min(TIME_BONUS_MAX, raw);
}

export interface ScoreInput {
  /** Sanojen pisteet: noppien arvot, risteysnoppa kahdesti. UI/lauta laskee. */
  wordPoints: number;
  /** Käyttämättä jääneiden noppien tahkot (jokeri = 0, ei sakkoa). */
  unusedFaces: readonly Face[];
  secondsRemaining: number;
  timeBonusEnabled: boolean;
}

export interface ScoreBreakdown {
  wordPoints: number;
  unusedPenalty: number;
  timeBonus: number;
  total: number;
}

export function finalScore(input: ScoreInput): ScoreBreakdown {
  const unusedPenalty = sumValues(input.unusedFaces);
  const bonus = input.timeBonusEnabled ? timeBonus(input.secondsRemaining) : 0;
  return {
    wordPoints: input.wordPoints,
    unusedPenalty,
    timeBonus: bonus,
    total: input.wordPoints - unusedPenalty + bonus,
  };
}
