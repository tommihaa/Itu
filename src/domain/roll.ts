import { countsAsConsonant, countsAsVowel, diceWithJokers, type Face, type JokerCount } from "./dice";
import { createRng, type Rng } from "./rng";

export const MIN_VOWELS = 4;
// Konsonanteilla sama minimivaatimus kuin vokaaleilla — estää rappeutuneet heitot
// (esim. 1 konsonantti), joista ei saa ristikkoa kokoon.
export const MIN_CONSONANTS = MIN_VOWELS;

export interface RollOptions {
  jokerCount?: JokerCount;
}

export interface Roll {
  /** Näkyvä tahko per noppa, indeksi = nopan numero - 1. */
  faces: Face[];
  /** Montako kertaa vokaalitakuu laukesi ennen kelvollista heittoa. */
  rerolls: number;
}

function rollOnce(dice: readonly (readonly Face[])[], rng: Rng): Face[] {
  return dice.map((die) => die[Math.floor(rng() * die.length)]);
}

/**
 * Heittää kaikki 13 noppaa deterministisesti siemenestä. Takuu: alle MIN_VOWELS
 * vokaalia TAI alle MIN_CONSONANTS konsonanttia (jokeri lasketaan kumpaankin) → uusi
 * heitto samasta satunnaisvirrasta, joten lopputulos on yhä siemenen funktio.
 */
export function rollDice(seed: string | number, opts: RollOptions = {}): Roll {
  const dice = diceWithJokers(opts.jokerCount ?? 1);
  const rng = createRng(seed);
  let rerolls = 0;
  for (;;) {
    const faces = rollOnce(dice, rng);
    const vowels = faces.filter(countsAsVowel).length;
    const consonants = faces.filter(countsAsConsonant).length;
    if (vowels >= MIN_VOWELS && consonants >= MIN_CONSONANTS) {
      return { faces, rerolls };
    }
    rerolls++;
  }
}
