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

/** Pelinäkymän päälle avautuvat paneelit. Poissulkevat: yksi kerrallaan tai ei mitään,
 * ja tyyppi kantaa sen sijaan että neljä totuusarvoa nollattaisiin erikseen. */
export type Panel = "rules" | "records" | "checker" | "settings";

export type RulesTab = "words" | "controls" | "terms" | "about";

/** Laudan kehystys: skaalaus ja siirto (zoom+pan). */
export interface Frame {
  scale: number;
  tx: number;
  ty: number;
}
/** Näkymän vieritysasema pikseleinä. */
export interface ScrollPos {
  left: number;
  top: number;
}
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
  /** Avoin paneeli, tai null kun pelinäkymä on esillä. */
  panel: Panel | null;
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
  /** Viimeksi sovellettu kehystys. Pidetään paikallaan kunnes asetetut nopat eivät enää
   * mahdu näkyviin → vähemmän "hyppimistä" (ks. `frameBoard`). null = kehystä tuoreesti. */
  currentFrame: Frame | null;
  /** Vieritysasema säilyy täällä, koska `render()` rakentaa viewportin uudelleen ja
   * selaimen vieritys nollautuu sen mukana. null = keskitä seuraavalla renderillä. */
  viewScroll: ScrollPos | null;
  /** Tarkastajan tuloksen päivitys ilman renderiä; `renderChecker` asettaa, lemmapaketin
   * valmistuminen kutsuu. null = Tarkastaja ei ole ollut auki tällä sivulatauksella. */
  checkerRefresh: (() => void) | null;
  /** Lemmapaketin lataus on kesken: analyysirivin tilalle latausmerkki, ja `ensureLemmas`
   * käyttää samaa lippua estämään päällekkäisen latauksen. */
  lemmasLoading: boolean;
  /** Telineen aktiivinen järjestys (`SORT_KEYS`, ryhmävälejä varten). Levylle tallennettu
   * valinta luetaan `game.ts`:n `loadSort`illa, tässä on vain käytössä oleva arvo. */
  rackSort: string;
  /** Telineen näkymäjärjestys: dieIndex-permutaatio. Tyhjä tai eri mittainen kuin nopat
   * ⇒ näkymä käyttää heiton omaa järjestystä. */
  rackOrder: number[];
}

export const ui: ViewState = {
  panel: null,
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
  currentFrame: null,
  viewScroll: null,
  checkerRefresh: null,
  lemmasLoading: false,
  // Sama oletus kuin `game.ts`:n DEFAULT_SORT; `newRoll` korvaa tämän levyltä luetulla.
  rackSort: "abc",
  rackOrder: [],
};

/** Ääniasetuksen ainoa kirjoitustie: tila ja levy pysyvät yhdessä. */
export function setSoundEnabled(on: boolean): void {
  ui.soundEnabled = on;
  saveSoundEnabled(on);
}
