// Noppadata — lukittu 12.6.2026, ks. ITU.md. Älä muuta ilman designpäätöstä:
// jakauma (78 tahkoa = 37V + 40K + 1 jokeri) ja per-noppa-poissulkevuus
// (Ö nopalla 11, D+jokeri nopalla 13, A:t kahdeksalla nopalla) ovat testien vartioimia.
// 14.6.2026: G lisätty (nopalla 8, T6→T5). Syy: nk→ng-astevaihtelu tuottaa
// tuhansia natiiveja muotoja (kengät, kaupungin) + ng-sanat (hengittää, rengas);
// b/c/f pysyvät poissa (vain lainoissa). G nopalla 8:lla ilman N:ää → ng muodostuu.

export const JOKER = "*";

export type Face = string;
export type Die = readonly Face[];

export const DICE: readonly Die[] = [
  ["A", "E", "O", "T", "N", "S"],
  ["A", "I", "U", "T", "K", "L"],
  ["A", "E", "I", "N", "S", "M"],
  ["A", "I", "Ä", "T", "K", "R"],
  ["A", "E", "O", "N", "L", "V"],
  ["A", "I", "U", "S", "T", "H"],
  ["A", "E", "Ä", "K", "N", "J"],
  ["A", "I", "O", "G", "S", "M"],
  ["E", "U", "Y", "K", "L", "R"],
  ["E", "O", "Ä", "N", "T", "P"],
  ["I", "Y", "Ö", "S", "M", "H"],
  ["I", "Ä", "K", "L", "R", "J"],
  ["O", "U", "N", "V", "D", JOKER],
];

export const DICE_COUNT = DICE.length;

export type JokerCount = 1 | 2 | 3;

// Lisäjokerit korvaavat A-tahkon (yleisin kirjain kestää ohenemisen,
// harvinaiset säilyvät). Eri nopilla, jotta useampi jokeri voi näkyä kerralla.
const EXTRA_JOKER_SLOTS: ReadonlyArray<{ die: number; face: Face }> = [
  { die: 7, face: "A" }, // noppa 8
  { die: 5, face: "A" }, // noppa 6
];

export function diceWithJokers(jokerCount: JokerCount): Die[] {
  const dice = DICE.map((d) => [...d]);
  for (const slot of EXTRA_JOKER_SLOTS.slice(0, jokerCount - 1)) {
    const i = dice[slot.die].indexOf(slot.face);
    dice[slot.die][i] = JOKER;
  }
  return dice;
}

// Suomalaisen Scrabblen kirjainarvot pelin kirjaimistolle.
export const LETTER_VALUES: Readonly<Record<Face, number>> = {
  A: 1, I: 1, N: 1, T: 1, E: 1, S: 1,
  K: 2, L: 2, O: 2, Ä: 2,
  U: 3, M: 3,
  R: 4, H: 4, V: 4, J: 4, P: 4, Y: 4,
  D: 7, Ö: 7, G: 7,
  [JOKER]: 0,
};

export const VOWELS: ReadonlySet<Face> = new Set([
  "A", "E", "I", "O", "U", "Y", "Ä", "Ö",
]);

// Jokeri lasketaan vokaaliksi vokaalitakuussa, koska se voi toimia sellaisena.
export function countsAsVowel(face: Face): boolean {
  return VOWELS.has(face) || face === JOKER;
}
