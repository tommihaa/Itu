// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Pelaajan valinnat ja niiden levytallennus. Yksi koti kaikelle mikä on pelaajan valinta
// ja säilyy sivulatausten yli: pistemoodi, aikabonus, kierroksen kesto, Opi-moodin kytkin,
// äänet, telineen järjestys ja nimimerkki.
//
// Suhde `viewstate.ts`:ään: näkymätila katoaa sivun uudelleenlatauksessa eikä sitä
// tallenneta, nämä ovat päinvastoin juuri ne arvot jotka jäävät. Siksi ne eivät ole
// näkymätilan kenttiä vaikka näkymä lukee niitä joka renderillä.
//
// Mitä tänne EI kuulu: kerätty data (Opi-moodin edistymä, päivän tavoitesetti) ja tulokset
// (ennätyslistat). Ne asuvat localStoragessa siinä missä nämä, mutta ne eivät ole valintoja
// vaan kirjanpitoa, ja niiden koti on `game.ts` kunnes joku parempi löytyy.
//
// Levyvirheet vaietaan joka kohdassa samasta syystä: yksityistilassa localStorage heittää,
// eikä valinnan säilymättä jääminen ole syy kaataa peliä.
import { GAME_DURATION_SECONDS } from "../domain/scoring";

const PREMIUM_KEY = "itu:premium:v1";
const TIME_BONUS_KEY = "itu:timebonus:v1";
const DURATION_KEY = "itu:duration:v1";
const LEARN_MODE_KEY = "itu:learnmode:v1";
const SOUND_KEY = "itu:sound:v1";
const SORT_KEY = "itu:sort:v1";
const NAME_KEY = "itu:name";

/** Kesto-presetit sekunteina; muu arvo ei ole valittavissa eikä kelpaa levyltä. */
export const DURATION_OPTIONS: number[] = [60, 120, 180, 300];
export const DEFAULT_DURATION = GAME_DURATION_SECONDS; // 180 s = 3 min
/** Sallittu kesto tai oletus (saapuva haastelinkki + rikki/tuntematon storage). */
export function coerceDuration(n: unknown): number {
  return typeof n === "number" && DURATION_OPTIONS.includes(n) ? n : DEFAULT_DURATION;
}

const SORT_KEYS = ["abc", "aanne"]; // "Pisteet"/"Vokaalisointu" karsittu; "Äänneryhmät" = konsonantit + vokaaliharmonia
const DEFAULT_SORT = "abc";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* yksityistila tai tila täynnä — valinta ei säily, peli toimii silti */
  }
}

export interface Settings {
  /** Scrabble-pistemoodi: premium-ruudut + bingo + keskusankkuri. Kerrostuu nykyisen
   * päälle, ja POIS = identtinen perinteinen Itu. */
  premiumMode: boolean;
  /** Aikabonus (oletus PÄÄLLÄ). Bonus vaatii ≥11 käytettyä noppaa
   * (`scoring.ts` TIME_BONUS_MIN_LETTERS_USED) → palkitsee nopean JA täyden ratkaisun.
   * Pois → ajastin näkyy yhä, mutta jäljellä oleva aika ei tuo bonuspisteitä. */
  timeBonusEnabled: boolean;
  /** Kierroksen kesto sekunteina, aina jokin `DURATION_OPTIONS`in arvo. Pelkkä
   * aikaraamikerros: ei kosketa lautaa, siementä eikä noppia. */
  gameDuration: number;
  /** Opi-moodi (oletus POIS): adaptiivinen kielioppi-päivähaaste. PEHMEÄ, eli ei muuta
   * pisteytystä, sanastoa eikä lautaa. Edistymä itse on kerättyä dataa eikä asetus. */
  learnMode: boolean;
  /** Äänet (oletus POIS): kevyt torvi & kantele -teema. Pelirauha-periaate (ITU.md)
   * koskee oletustilaa, päätös 7.7.2026. Äänimoottorin kytkentä on kutsujan vastuulla. */
  soundEnabled: boolean;
  /** Telineen järjestysvalinta (`SORT_KEYS`); permutaatio itse on näkymätilaa. */
  rackSort: string;
  /** Nimimerkki haastelinkeissä; tyhjä = näytetään "Sinä". */
  myName: string;
}

export const settings: Settings = {
  premiumMode: read(PREMIUM_KEY) === "1",
  timeBonusEnabled: read(TIME_BONUS_KEY) !== "0", // oletus päällä
  gameDuration: coerceDuration(Number(read(DURATION_KEY))),
  learnMode: read(LEARN_MODE_KEY) === "1",
  soundEnabled: read(SOUND_KEY) === "1",
  rackSort: (() => {
    const s = read(SORT_KEY);
    return s && SORT_KEYS.includes(s) ? s : DEFAULT_SORT; // vanha "haro" → oletus
  })(),
  myName: read(NAME_KEY) ?? "",
};

// Yksi kirjoitustie per asetus: tila ja levy muuttuvat samassa lauseessa, joten ne eivät
// voi mennä eri tahtiin.

export function setPremiumMode(on: boolean): void {
  settings.premiumMode = on;
  write(PREMIUM_KEY, on ? "1" : "0");
}
export function setTimeBonusEnabled(on: boolean): void {
  settings.timeBonusEnabled = on;
  write(TIME_BONUS_KEY, on ? "1" : "0");
}
export function setGameDuration(seconds: number): void {
  settings.gameDuration = coerceDuration(seconds);
  write(DURATION_KEY, String(settings.gameDuration));
}
export function setLearnMode(on: boolean): void {
  settings.learnMode = on;
  write(LEARN_MODE_KEY, on ? "1" : "0");
}
export function setSoundEnabled(on: boolean): void {
  settings.soundEnabled = on;
  write(SOUND_KEY, on ? "1" : "0");
}
export function setRackSort(key: string): void {
  settings.rackSort = key;
  write(SORT_KEY, key);
}
export function setMyName(name: string): void {
  settings.myName = name;
  write(NAME_KEY, name);
}
