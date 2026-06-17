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

/** +1 piste / 5 säästettyä sekuntia (oletusasetus; voi kytkeä pois). */
export function timeBonus(secondsRemaining: number): number {
  return Math.floor(Math.max(0, secondsRemaining) / TIME_BONUS_SECONDS_PER_POINT);
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
