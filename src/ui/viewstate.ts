// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Näkymän oma tila: se osa `ui/game.ts`:n moduulitilasta joka kuvaa mitä ruudulla on
// esillä ja mitä pelaaja on parhaillaan tekemässä. Kertyi kuudessa erässä, ja raja johon
// se on kerätty on se johon loput näkymätila voi siirtyä yksi muuttuja kerrallaan.
//
// Tämä EI ole näkymämalli Superjatsin `ui/view.ts`:n merkityksessä: se on domainista
// johdettu ja joka renderillä uudelleen laskettava kopio, tämä on näkymän itse omistamaa
// tilaa jota mikään ei laske uudelleen (välilehtivalinta, toggle, eleiden ajastus).
// Ne ovat saman rajan kaksi puolta: johdettu virtaa domainista näkymään, tämä ei virtaa
// mistään.
//
// Kaksi rajausta. Levylle tallennetut valinnat eivät kuulu tänne vaan `settings.ts`:ään,
// koska nämä kentät katoavat sivun uudelleenlatauksessa ja ne eivät. Ja `drag` kantaa
// DOM-viittauksia, joten tämä ei ole kokonaan serialisoitavaa tilaa.
import { DEFAULT_DURATION } from "./settings";

/** Pelinäkymän päälle avautuvat paneelit. Poissulkevat: yksi kerrallaan tai ei mitään,
 * ja tyyppi kantaa sen sijaan että neljä totuusarvoa nollattaisiin erikseen. */
export type Panel = "rules" | "records" | "checker" | "settings";

export type RulesTab = "words" | "controls" | "terms" | "about";

/** Kirjoitussuunta laudalla. */
export type Dir = "H" | "V";
/** Kirjoituskursori: ruutu ja suunta. */
export interface Caret {
  row: number;
  col: number;
  dir: Dir;
}

/**
 * Osoitinpohjainen raahaus (hiiri + kosketus + kynä). HTML5 DnD ei toimi mobiilissa,
 * joten käytämme pointer-eventtejä + kelluvaa "haamulaattaa" kaikille. Haamu luodaan
 * vasta ensimmäisellä liikkeellä, jotta paikallaan pysyvä painallus voi muuttua pitkäksi
 * painallukseksi (= poisto) ilman haamun vilkkumista.
 */
export interface Drag {
  die: number;
  tileEl: HTMLElement; // lähde-elementti (sm-dragging-luokkaa varten)
  ghost: HTMLElement | null; // null kunnes raahaus alkaa (liike > kynnys)
  startX: number;
  startY: number;
  moved: boolean;
  hover: HTMLElement | null;
  longPress?: ReturnType<typeof setTimeout>; // pitkän painalluksen ajastin
  consumed?: boolean; // pitkä painallus jo hoiti → pointerup ei käsittele napautusta
}

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

export interface ViewState {
  /** Avoin paneeli, tai null kun pelinäkymä on esillä. */
  panel: Panel | null;
  /** Haastemodaali (aloita haaste / vastaa) laudan päällä. Oma kenttä eikä `panel`in arvo,
   * koska Esc sulkee tämän ENNEN paneeleita ja modaali elää pelinäkymän päällä. */
  showChallenge: boolean;
  /** Ottelun loppuyhteenveto. Oma kenttä eikä `panel`in arvo, koska Esc ei sulje tätä:
   * yhteenvedosta poistutaan ottelun omilla napeilla (`exitMatch`, `advanceMatch`). */
  showMatchSummary: boolean;
  /** Säännöt-näkymän aktiivinen välilehti. */
  rulesTab: RulesTab;
  /** Opi-moodin teemapalkin ⓘ-toggle: kuvaukset auki/kiinni. */
  learnDescOpen: boolean;
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
  /** Telineen näkymäjärjestys: dieIndex-permutaatio. Tyhjä tai eri mittainen kuin nopat
   * ⇒ näkymä käyttää heiton omaa järjestystä. */
  rackOrder: number[];
  /** Kirjoituskursori laudalla, tai null kun sitä ei ole. */
  caret: Caret | null;
  /** Näppäilytila: tosi kun pelaaja ohjaa kursoria (klikkaa ruutua / näppäilee), epätosi
   * raahatessa. Kehystys pitää kursorin näkyvissä VAIN näppäiltäessä, jotta raahauksen
   * "ei hyppimistä" -logiikka säilyy ennallaan (ks. `frameBoard`). */
  kbdMode: boolean;
  /** Napauta-ja-aseta: telineestä "nostettu" nappula (dieIndex) odottaa ruudun napautusta. */
  lifted: number | null;
  /** Käynnissä oleva raahaus, tai null. */
  drag: Drag | null;
}

export const ui: ViewState = {
  panel: null,
  showChallenge: false,
  showMatchSummary: false,
  rulesTab: "words",
  learnDescOpen: false,
  recordsTab: "itu",
  recordsDurationTab: DEFAULT_DURATION,
  recordsSort: "total",
  suppressCellClickUntil: 0,
  lastTapDie: -1,
  lastTapAt: 0,
  currentFrame: null,
  viewScroll: null,
  checkerRefresh: null,
  lemmasLoading: false,
  rackOrder: [],
  caret: null,
  kbdMode: false,
  lifted: null,
  drag: null,
};
