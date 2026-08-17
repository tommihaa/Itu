// Näkymän oma tila. Nämä yhdeksän kenttää ovat ne moduulitason muuttujat joita
// `ui/game.ts`:ssä luetaan VAIN näkymä- ja elefunktioista: yksikään lukupaikka ei kutsu
// domainia eikä yksikään domainfunktio kirjoita niitä. Siksi ne ovat erotettavissa ilman
// yhtään domainsiirtoa, ja ne muodostavat rajan johon loput näkymätila voi siirtyä
// yksi muuttuja kerrallaan.
//
// Tämä EI ole näkymämalli Superjatsin `ui/view.ts`:n merkityksessä: se on domainista
// johdettu ja joka renderillä uudelleen laskettava kopio, tämä on näkymän itse omistamaa
// tilaa jota mikään ei laske uudelleen (välilehtivalinta, toggle, eleiden ajastus,
// ääniasetus). Ne ovat saman rajan kaksi puolta: johdettu virtaa domainista näkymään,
// tämä ei virtaa mistään.
import { GAME_DURATION_SECONDS } from "../domain/scoring";

export type RulesTab = "words" | "controls" | "terms" | "about";
export type RecordMode = "itu" | "scrabble";
export type RecordsSort = "total" | "rate";

// Äänet (valinnainen, oletus POIS): kevyt torvi & kantele -teema Web Audio -synteesillä.
// Pelirauha-periaate (ITU.md) koskee oletustilaa — päätös 7.7.2026, ks. principle_itu_offline.
// Avain ja molemmat levyfunktiot asuvat täällä, koska asetus itse asuu täällä; äänimoottorin
// kytkentä (`setSfxEnabled`) jää kutsujalle, jotta tämä moduuli pysyy ilman sivuvaikutuksia.
const SOUND_KEY = "itu:sound:v1";
function loadSoundEnabled(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === "1";
  } catch {
    return false;
  }
}
function saveSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    /* yksityistila — valinta ei säily, peli toimii silti */
  }
}

export interface ViewState {
  /** Säännöt-näkymän aktiivinen välilehti. */
  rulesTab: RulesTab;
  /** Opi-moodin teemapalkin ⓘ-toggle: kuvaukset auki/kiinni. */
  learnDescOpen: boolean;
  /** Ääniasetus (säilyy localStoragessa; kirjoita `setSoundEnabled`illa). */
  soundEnabled: boolean;
  /** 🏆-näkymän aktiivinen pistemoodi-välilehti. */
  recordsTab: RecordMode;
  /** 🏆-näkymän aktiivinen kesto-välilehti (s). */
  recordsDurationTab: number;
  /** 🏆 lajittelu: kokonaispisteet (per kesto) vs sanapistettä/min (kestot yhdessä). */
  recordsSort: RecordsSort;
  /** Napautuksen jälkeen tuleva synteettinen ruutuklikkaus vaimennetaan tähän hetkeen asti. */
  suppressCellClickUntil: number;
  /** Tuplanapautus (kosketus/hiiri): viimeisin napautettu noppa. */
  lastTapDie: number;
  /** Tuplanapautus: viimeisimmän napautuksen hetki. */
  lastTapAt: number;
}

export const ui: ViewState = {
  rulesTab: "words",
  learnDescOpen: false,
  soundEnabled: loadSoundEnabled(),
  recordsTab: "itu",
  // Sama vakio kuin `game.ts`:n DEFAULT_DURATION; molemmat johtavat sen domainista,
  // jotta oletuskestosta ei tule kahta totuutta.
  recordsDurationTab: GAME_DURATION_SECONDS,
  recordsSort: "total",
  suppressCellClickUntil: 0,
  lastTapDie: -1,
  lastTapAt: 0,
};

/** Ääniasetuksen ainoa kirjoitustie: tila ja levy pysyvät yhdessä. */
export function setSoundEnabled(on: boolean): void {
  ui.soundEnabled = on;
  saveSoundEnabled(on);
}
