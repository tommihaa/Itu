import { countsAsVowel, diceWithJokers, type Face, type JokerCount } from "./dice";
import { createRng, type Rng } from "./rng";

export const MIN_VOWELS = 4;

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
 * Heittää kaikki 13 noppaa deterministisesti siemenestä. Vokaalitakuu:
 * alle MIN_VOWELS vokaalia (jokeri mukaan lukien) → uusi heitto samasta
 * satunnaisvirrasta, joten lopputulos on yhä siemenen funktio.
 */
export function rollDice(seed: string | number, opts: RollOptions = {}): Roll {
  const dice = diceWithJokers(opts.jokerCount ?? 1);
  const rng = createRng(seed);
  let rerolls = 0;
  for (;;) {
    const faces = rollOnce(dice, rng);
    if (faces.filter(countsAsVowel).length >= MIN_VOWELS) {
      return { faces, rerolls };
    }
    rerolls++;
  }
}
