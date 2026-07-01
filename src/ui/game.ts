// Ruudukko-UI: nopat raahataan telineestä lautaan ja toisiinsa ristikoksi.
// Live-validointi värittää sanat DAWG-tuomarilla. Pelilogiikka on domainissa
// (board.ts, scoring.ts); tämä on ohut näkymä- ja raahauskerros.
import { JOKER, LETTER_VALUES, type Face } from "../domain/dice";
import {
  faceValue,
  finalScore,
  scoreWord,
  GAME_DURATION_SECONDS,
  TIME_BONUS_MIN_LETTERS_USED,
  type ScoreBreakdown,
} from "../domain/scoring";
import {
  CENTER,
  BINGO_BONUS,
  premiumAt,
  premiumKindAt,
  type PremiumKind,
} from "../domain/premium";
import { rollDice } from "../domain/roll";
import { randomSeed } from "../domain/rng";
import {
  cellKey,
  parseKey,
  extractWords,
  isConnected,
  disconnectedCells,
  type Cells,
  type PlacedTile,
} from "../domain/board";
import type { WordJudge } from "../dict/judge";
import { loadJudge } from "../dict/load";
import { loadLemmas, type LemmaLookup } from "../dict/lemmas";
import { describeCode } from "../dict/morph";
import {
  THEME_BY_ID,
  detectThemes,
  pickDailyTargets,
  pickDuelThemes,
  weeklyProgress,
  recordThemeSession,
  coveredTargets,
  duelWinner,
  DUEL_THEME_COUNT,
  dateKey,
  weekStartKey,
  type LearnProgress,
} from "../domain/learn";
import { renderWordsContent, renderControlsContent } from "../rules/view";

// Iso sisäinen lauta, jotta tila ei lopu kesken; näkymä kehystää käytetyn alueen.
const BOARD = 21;
// Automaattisen kehystyksen marginaali (ruutua käytetyn alueen ympärille) ja
// suurin sallittu zoom (ettei yksi noppa zoomaa liikaa).
const FRAME_MARGIN = 2;
const MAX_SCALE = 2.8;
// Aikabonus (valinnainen asetus, oletus PÄÄLLÄ). Bonus vaatii ≥11 käytettyä noppaa
// (scoring.ts TIME_BONUS_MIN_LETTERS_USED) → palkitsee nopean JA täyden ratkaisun.
// Pois → ajastin näkyy yhä, mutta jäljellä oleva aika ei tuo bonuspisteitä.
// Kuten premiumMode: paikallinen, pelkkä pistesääntö (ei muuta lautaa) → ei riko siemenjakoa.
const TIME_BONUS_KEY = "itu:timebonus:v1";
function loadTimeBonus(): boolean {
  try {
    return localStorage.getItem(TIME_BONUS_KEY) !== "0"; // oletus päällä
  } catch {
    return true;
  }
}
function saveTimeBonus(on: boolean): void {
  try {
    localStorage.setItem(TIME_BONUS_KEY, on ? "1" : "0");
  } catch {
    /* yksityistila — valinta ei säily, peli toimii silti */
  }
}
let timeBonusEnabled = loadTimeBonus();

// Pelin kirjaimet (jokerin valittavissa olevat); sama joukko kuin nopissa/sanastossa.
const PLAY_LETTERS = "adeghijklmnoprstuvyäö".split("");

interface Tile {
  dieIndex: number;
  face: Face;
  letter: Face; // jokerin valittu kirjain; muilla = face
  cell: string | null; // null = telineessä
  /** Jokeri: pelaaja lukinnut kirjaimen käsin (auto-päättely ei muuta). */
  locked?: boolean;
}

let tiles: Tile[] = [];
let rackOrder: number[] = []; // telineen näkymäjärjestys (dieIndex-permutaatio)
// Viimeksi sovellettu kehystys (zoom+siirto). Pidetään paikallaan kunnes asetetut
// nopat eivät enää mahdu näkyviin → vähemmän "hyppimistä" (ks. frameBoard).
let currentFrame: { scale: number; tx: number; ty: number } | null = null;
// Zoom pois käytöstä toistaiseksi (käyttäjän pyyntö): kiinteä koko + vieritettävä näkymä.
// Vanha automaattinen kehystys (zoom/pan) jää lipun taakse, helppo palauttaa myöhemmin.
const ZOOM_ENABLED = false;
// Vieritysasema säilytetään moduulitilassa, koska render() rakentaa viewportin uudelleen
// (jolloin selaimen vieritys nollautuu). null = keskitä seuraavalla renderillä.
let viewScroll: { left: number; top: number } | null = null;
let rackSort = "abc"; // aktiivinen järjestys (ryhmävälejä varten); newRoll asettaa tallennetun
let seed = "";
let judge: WordJudge | null = null;
let root: HTMLElement;
let showRules = false;
let rulesTab: "words" | "controls" = "words"; // Säännöt-näkymän aktiivinen välilehti
let showChecker = false; // Tarkastaja (pelin ulkopuolinen sanahaku + selitys)
let showSettings = false; // ⚙️ Asetukset-paneeli (toistaiseksi: Scrabble-pistemoodi)

// Opettavuus: muoto -> lemma (lazy-ladattu paketti, ks. dict/lemmas.ts).
let lemmas: LemmaLookup | null = null;
let lemmasLoading = false;
let endWords: string[] = []; // kierroksen kelvolliset sanat (loppunäytön perusmuodot)
let endWordScores: number[] = []; // ^samassa järjestyksessä: kunkin sanan pisteet (kertoimineen)
let checkerRefresh: (() => void) | null = null; // tarkistimen tuloksen päivitys ilman renderiä
let jokerPicker: number | null = null; // avoinna olevan jokerin dieIndex (kirjainvalitsin)
let showChallenge = false; // offline-haastemodaali (aloita haaste / vastaa)
let learnDescOpen = false; // Opi-moodin teemapalkin ⓘ-toggle: kuvaukset auki/kiinni

// --- Monikierroshaaste (offline, linkki kantaa tulokset 2-suuntaisesti) ---
const ROUND_OPTIONS = [1, 3, 5, 10];
const NAME_KEY = "itu:name";

// Telineen järjestysvalinta säilyy heitosta toiseen (localStorage).
const SORT_KEY = "itu:sort:v1";
const SORT_KEYS = ["abc", "aanne"]; // "Pisteet"/"Vokaalisointu" karsittu; "Äänneryhmät" = konsonantit + vokaaliharmonia
const DEFAULT_SORT = "abc";
function loadSort(): string {
  try {
    const s = localStorage.getItem(SORT_KEY);
    return s && SORT_KEYS.includes(s) ? s : DEFAULT_SORT; // vanha "haro" → oletus
  } catch {
    return DEFAULT_SORT;
  }
}
function saveSort(k: string): void {
  try {
    localStorage.setItem(SORT_KEY, k);
  } catch {
    /* yksityistila — valinta ei säily, peli toimii silti */
  }
}

// Scrabble-pistemoodi (valinnainen): premium-ruudut + bingo + keskusankkuri.
// Kerrostuu nykyisen päälle; OFF = identtinen perinteinen Itu. Säilyy localStoragessa.
const PREMIUM_KEY = "itu:premium:v1";
function loadPremiumMode(): boolean {
  try {
    return localStorage.getItem(PREMIUM_KEY) === "1";
  } catch {
    return false;
  }
}
function savePremiumMode(on: boolean): void {
  try {
    localStorage.setItem(PREMIUM_KEY, on ? "1" : "0");
  } catch {
    /* yksityistila — valinta ei säily, peli toimii silti */
  }
}
let premiumMode = loadPremiumMode();

// Opi-moodi (valinnainen, oletus POIS): adaptiivinen kielioppi-PÄIVÄHAASTE. Kerää laudan
// valmiiden sanojen kielioppiteemoja (sija/luku/aikamuoto/…) muutaman päivätavoitteen verran.
// PEHMEÄ: ei estä pelaamista, EI muuta pisteytystä/sanastoa/lautaa → ei riko siemenjakoa eikä
// ennätyksiä. Domain src/domain/learn.ts (puhdas); tämä on vain näkymä + tallennus.
const LEARN_MODE_KEY = "itu:learnmode:v1"; // päällä/pois
const LEARN_PROGRESS_KEY = "itu:learn:v1"; // LearnProgress (seen/hits/lastHit per teema)
function loadLearnMode(): boolean {
  try {
    return localStorage.getItem(LEARN_MODE_KEY) === "1";
  } catch {
    return false;
  }
}
function saveLearnMode(on: boolean): void {
  try {
    localStorage.setItem(LEARN_MODE_KEY, on ? "1" : "0");
  } catch {
    /* yksityistila — valinta ei säily, peli toimii silti */
  }
}
function loadLearnProgress(): LearnProgress {
  try {
    const raw = localStorage.getItem(LEARN_PROGRESS_KEY);
    const o = raw ? JSON.parse(raw) : {};
    return o && typeof o === "object" ? (o as LearnProgress) : {};
  } catch {
    return {};
  }
}
function saveLearnProgress(p: LearnProgress): void {
  try {
    localStorage.setItem(LEARN_PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* tila täynnä tai yksityistila — peli toimii silti */
  }
}
let learnMode = loadLearnMode();
let learnProgress = loadLearnProgress();
// Päivän teemasetti JÄÄDYTETÄÄN ensimmäisellä laskennalla (localStorage) → sama setti koko
// päivän, vaikka edistymä muuttuu pelien välissä (OPIMOODI.md: "avaa uudelleen samana
// päivänä → samat teemat"). Ilman jäädytystä rankThemes nostaisi joka pelin jälkeen uudet
// tarjoamattomat teemat kärkeen ja "Päivän teemat" vaihtuisi peli peliltä.
const LEARN_DAILY_KEY = "itu:learn:daily:v1"; // { date, targets }
function dailyTargets(): string[] {
  const today = dateKey();
  try {
    const raw = localStorage.getItem(LEARN_DAILY_KEY);
    if (raw) {
      const o = JSON.parse(raw) as { date?: string; targets?: string[] };
      if (o.date === today && Array.isArray(o.targets) && o.targets.every((id) => THEME_BY_ID[id])) {
        return o.targets;
      }
    }
  } catch {
    /* rikkinäinen talletus → lasketaan uusi */
  }
  const targets = pickDailyTargets(learnProgress, today);
  try {
    localStorage.setItem(LEARN_DAILY_KEY, JSON.stringify({ date: today, targets }));
  } catch {
    /* yksityistila — setti eläisi pelien välissä, peli toimii silti */
  }
  return targets;
}
// Viimeisen lukitun kierroksen Opi-tulos (loppunäyttöä varten).
let lastLearnTargets: string[] = [];
let lastLearnAchieved: Set<string> = new Set();

// Kierroksen kesto (valinnainen asetus, oletus 3 min = GAME_DURATION_SECONDS).
// Presetit 1/2/3/5 min; tietokoneajan dynaaminen valinta, ei kiveen hakattu. Kuten
// premiumMode ja aikabonus: pelkkä aikaraamikerros — EI kosketa lautaa/siementä/noppia,
// joten saman siemenen ratkaisut pysyvät vertailukelpoisina. Aikabonus laskee yhä
// jäljellä olevasta ajasta riippumatta kestosta (lyhyt kesto ≠ enemmän bonusta).
const DURATION_KEY = "itu:duration:v1";
const DURATION_OPTIONS: number[] = [60, 120, 180, 300];
const DEFAULT_DURATION = GAME_DURATION_SECONDS; // 180 s = 3 min
/** Sallittu kesto tai oletus (saapuva haastelinkki + rikki/tuntematon storage). */
function coerceDuration(n: unknown): number {
  return typeof n === "number" && DURATION_OPTIONS.includes(n) ? n : DEFAULT_DURATION;
}
function loadDuration(): number {
  try {
    return coerceDuration(Number(localStorage.getItem(DURATION_KEY)));
  } catch {
    return DEFAULT_DURATION;
  }
}
function saveDuration(s: number): void {
  try {
    localStorage.setItem(DURATION_KEY, String(s));
  } catch {
    /* yksityistila — valinta ei säily, peli toimii silti */
  }
}
let gameDuration = loadDuration();
/** Kesto-presetin lyhyt suomenkielinen otsikko (60 → "1 min", muuten "N s"). */
function durationLabel(s: number): string {
  return s % 60 === 0 ? `${s / 60} min` : `${s} s`;
}

// Otteluissa pistemoodi JA kesto LUKITAAN haastelinkin mukaisiksi (reilu vertailu: molemmat
// pelaavat samat heitot SAMOILLA pistesäännöillä JA samalla aikaraamilla — estää 90 s vs
// 5 min samalla siemenellä). Oma ⚙️-asetus on vapaapelin oletus eikä vaikuta käynnissä
// olevaan otteluun. Vapaapelissä = oma asetus.
function activePremium(): boolean {
  return match ? match.premium : premiumMode;
}
function activeDuration(): number {
  return match ? match.duration : gameDuration;
}

/** Vastustajan tulokset (haasteessa toinen osapuoli). */
interface Opp {
  name: string;
  scores: number[];
  themeHits?: string[]; // teemahaaste: vastapelaajan osumat jaettuun tavoitesettiin
}
interface Match {
  base: string; // perussiemen; kierroksen i siemen = roundSeed(base, i)
  rounds: number; // N kierrosta
  premium: boolean; // ottelun lukittu pistemoodi (haastelinkistä); ei muutu kesken ottelun
  duration: number; // ottelun lukittu kierroskesto (s, haastelinkistä); ei muutu kesken ottelun
  current: number; // 0-pohjainen nykyinen kierros
  myScores: number[]; // omat kierrospisteet
  myName: string;
  opp?: Opp; // läsnä kun vastaat haasteeseen tai katsot lopputulosta
  final?: boolean; // molemmat pelanneet → vain katselu (ei jako-osiota)
  // Kaveri-teemahaaste (Opi-moodi vaihe 2): jaettu kielioppi-tavoitesetti linkissä.
  // Voittaja kattavuudesta (montako tavoiteteemaa osui), pisteet tasurina.
  themes?: string[]; // jaetut tavoiteteemat (läsnä ⇒ teemahaaste); sama molemmille
  myThemeHits?: Set<string>; // omat osumat tavoitteeseen (kumuloituu kierroksittain)
}
let match: Match | null = null;
let showMatchSummary = false;
let myName = loadName();

// Osoitinpohjainen raahaus (hiiri + kosketus + kynä). HTML5 DnD ei toimi mobiilissa,
// joten käytämme pointer-eventtejä + kelluvaa "haamulaattaa" kaikille.
// Haamu luodaan vasta ensimmäisellä liikkeellä, jotta paikallaan pysyvä painallus
// voi muuttua pitkäksi painallukseksi (= poisto) ilman haamun vilkkumista.
interface Drag {
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
let drag: Drag | null = null;

// Napauta-ja-aseta: telineestä "nostettu" nappula (dieIndex) odottaa ruudun napautusta.
let lifted: number | null = null;
// Kumoa-pino (Ctrl+Z): viimeisimmät lautamuutokset (die + ruutu ennen muutosta).
let history: { die: number; prevCell: string | null }[] = [];
// Napautuksen jälkeen tuleva synteettinen ruutuklikkaus vaimennetaan (estää tuplakäsittely).
let suppressCellClickUntil = 0;
// Tuplanapautus (kosketus/hiiri): viimeisin napautettu noppa + aika.
let lastTapDie = -1;
let lastTapAt = 0;
const LONG_PRESS_MS = 450;
const DOUBLE_TAP_MS = 300;

// Näppäimistösyöttö: kirjoituskursori laudalla (suunta H/V). Drag toimii rinnalla.
type Dir = "H" | "V";
interface Caret {
  row: number;
  col: number;
  dir: Dir;
}
let caret: Caret | null = null;
// Näppäilytila: tosi kun pelaaja ohjaa kursoria (klikkaa ruutua / näppäilee),
// epätosi raahatessa. Kehystys pitää kursorin näkyvissä VAIN näppäiltäessä, jotta
// raahauksen "ei hyppimistä" -logiikka säilyy ennallaan (ks. frameBoard).
let kbdMode = false;

// Kierroksen tila: ajastin loppuu hetkellä roundEndsAt; lukitus tai aika lopettaa.
let roundEndsAt = 0;
let roundOver = false;
let timerHandle: ReturnType<typeof setInterval> | undefined;
let endBreakdown: ScoreBreakdown | null = null;
let endRemaining = 0; // jäljellä ollut aika lukitushetkellä (näyttöä varten)
let endLettersUsed = 0; // käytetyt nopat lukitushetkellä (aikabonusselitettä varten)

interface Suggestions {
  leftover: string[]; // käyttämättä jääneet kirjaimet
  withLeftover: string[]; // sanat jotka käyttävät jämäkirjaimia
  best: string[]; // pisimmät/arvokkaimmat sanat joita olisi voinut tehdä
}
let endSuggestions: Suggestions | null = null;

// --- Ennätykset (localStorage): top-10 tulosta PER (pistemoodi × kesto) + kunkin ruudukko ---
// v2: erilliset listat Itu- ja Scrabble-moodille (premiumin kertoimet+bingo tekevät pisteistä
// eri mittakaavan). Lisäksi kategorisoidaan KESTON mukaan: enemmän aikaa → enemmän/pidempiä
// sanoja → eri pistemittakaava, joten kullakin (moodi × kesto) on oma top-10. Sama vertailtavuus-
// periaate kuin moodilla, ulotettuna kestoon. Vanhat v2-tietueet ilman `duration`-kenttää
// kohdellaan oletuskestoisina (DEFAULT_DURATION) → pysyvät valideina (ei avaimen bumppausta).
const RECORDS_KEY = "itu:records:v2";
const MAX_RECORDS = 10;

type RecordMode = "itu" | "scrabble";

interface ScoreRecord {
  total: number;
  wordPoints: number;
  date: number; // Date.now()
  seed: string;
  mode: RecordMode; // millä pistemoodilla tulos pelattiin (oma top-10 per moodi × kesto)
  duration?: number; // kierroskesto sekunteina (vanhoilta tietueilta puuttuu → DEFAULT_DURATION)
  words: string[]; // muodostetut kelvolliset sanat
  wordScores?: number[]; // ^samassa järjestyksessä: kunkin sanan pisteet (vanhoilta tietueilta puuttuu)
  placed: { cell: string; face: Face; letter: Face }[]; // ruudukko (asetetut nopat)
}

/** Tietueen kategoria-avain: pistemoodi + kesto (oma top-10 per yhdistelmä). */
function recordCategory(r: ScoreRecord): string {
  return `${r.mode ?? "itu"}:${r.duration ?? DEFAULT_DURATION}`;
}

/** Sanapistettä minuutissa = tuottavuus, vertailukelpoinen kestojen yli. Tarkoituksella
 * VAIN sanapisteet (ei aikabonusta/sakkoja) → ei kasaannu aikabonuksen kanssa (aikabonus
 * palkitsee jo nopeudesta). Vanha tietue ilman kestoa → DEFAULT_DURATION. */
function wordRate(r: ScoreRecord): number {
  const mins = (r.duration ?? DEFAULT_DURATION) / 60;
  return mins > 0 ? r.wordPoints / mins : 0;
}
function fmtRate(rate: number): string {
  return (Math.round(rate * 10) / 10).toFixed(1);
}

type RecordsSort = "total" | "rate";
let showRecords = false;
let recordsTab: RecordMode = "itu"; // 🏆-näkymän aktiivinen pistemoodi-välilehti
let recordsDurationTab = DEFAULT_DURATION; // 🏆-näkymän aktiivinen kesto-välilehti (s)
let recordsSort: RecordsSort = "total"; // 🏆 lajittelu: kokonaispisteet (per kesto) vs sanapistettä/min (kestot yhdessä)
let lastRecordRank = 0; // tämän pelin sija OMAN (moodi × kesto) -listansa top-10:ssä (0 = ei listalle)
let currentRecord: ScoreRecord | null = null; // tämän pelin merkintä (★-korostus)

function loadRecords(): ScoreRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return []; // rikki / yksityistila → kohdellaan tyhjänä
  }
}

function saveRecords(recs: ScoreRecord[]): void {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(recs));
  } catch {
    /* tila täynnä tai yksityistila — peli toimii silti */
  }
}

function secondsLeft(): number {
  return Math.max(0, Math.ceil((roundEndsAt - Date.now()) / 1000));
}

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function startRound(): void {
  roundEndsAt = Date.now() + activeDuration() * 1000;
  roundOver = false;
  endBreakdown = null;
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(tick, 500);
}

function tick(): void {
  if (roundOver) return;
  const left = secondsLeft();
  const el = root.querySelector<HTMLElement>("#sm-timer");
  if (el) el.textContent = fmtTime(left);
  if (left <= 0) endRound();
}

/** Lukitsee kierroksen (käsin tai ajan loputtua) ja laskee lopullisen tuloksen. */
function endRound(): void {
  if (roundOver) return;
  roundOver = true;
  if (timerHandle) clearInterval(timerHandle);
  endRemaining = secondsLeft();
  const v = validate();
  endLettersUsed = v.lettersUsed;
  endBreakdown = finalScore({
    wordPoints: v.wordPoints, // vain kelvolliset sanat
    unusedFaces: v.unusedFaces, // teline + laudalle jääneet ei-sanat (sama logiikka)
    secondsRemaining: endRemaining,
    lettersUsed: v.lettersUsed, // ≥11 → aikabonus aukeaa
    timeBonusEnabled,
    bingo: v.bingo, // premium-moodi: kaikki nopat käytetty + keskusankkuri
  });
  computeSuggestions();
  recordResult(v);
  const validWords = v.words.filter((w) => w.valid);
  endWords = validWords.map((w) => w.text);
  endWordScores = validWords.map((w) => w.points);
  // Opi-moodi: kerää kierroksen kielioppiteemat ja päivitä adaptiivinen edistymä. Vaatii
  // analyysipaketin (esiladattu kun moodi on päällä); jos ei vielä ladannut, ohitetaan.
  // Teemahaaste (vaihe 2): tavoitteet tulevat jaetusta setistä (match.themes), eivät
  // henkilökohtaisesta pickDailyTargets:sta, ja osumat kumuloidaan match.myThemeHits:iin.
  const themeMatch = !!(match && match.themes);
  if ((learnMode || themeMatch) && lemmas) {
    const lk = lemmas;
    lastLearnAchieved = detectThemes(endWords, (w) => lk.lookup(w));
    lastLearnTargets = themeMatch ? match!.themes! : dailyTargets();
    if (themeMatch) {
      const acc = match!.myThemeHits ?? new Set<string>();
      for (const id of coveredTargets(match!.themes!, lastLearnAchieved)) acc.add(id);
      match!.myThemeHits = acc; // kattavuus kumuloituu kaikista kierroksista
    }
    learnProgress = recordThemeSession(learnProgress, lastLearnTargets, lastLearnAchieved, dateKey());
    saveLearnProgress(learnProgress);
  } else {
    lastLearnTargets = [];
    lastLearnAchieved = new Set();
  }
  ensureLemmas(); // analyysit loppunäyttöön + ratkaisijan ehdotuksiin (lazy)
  if (match) match.myScores[match.current] = endBreakdown.total;
  render();
}

/** Tallentaa tuloksen ennätyslistalle (top-10) jos pisteet > 0; asettaa sijan. */
function recordResult(v: Validation): void {
  lastRecordRank = 0;
  currentRecord = null;
  if (!endBreakdown || endBreakdown.total <= 0) return;
  const mode: RecordMode = activePremium() ? "scrabble" : "itu";
  const rec: ScoreRecord = {
    total: endBreakdown.total,
    wordPoints: endBreakdown.wordPoints,
    date: Date.now(),
    seed,
    mode,
    duration: activeDuration(), // kategorisointi: oma top-10 per (moodi × kesto)
    words: v.words.filter((w) => w.valid).map((w) => w.text),
    wordScores: v.words.filter((w) => w.valid).map((w) => w.points),
    placed: tiles
      .filter((t) => t.cell)
      .map((t) => ({ cell: t.cell!, face: t.face, letter: t.letter })),
  };
  const recs = loadRecords();
  recs.push(rec);
  recs.sort((a, b) => b.total - a.total || a.date - b.date); // korkein ensin, tasapeli vanhin ensin
  // Trimmaus PER kategoria (moodi × kesto): kullakin yhdistelmällä oma top-10. Kuljetetaan
  // järjestyksessä ja pidetään kustakin kategoriasta enintään MAX_RECORDS → mikään kategoria
  // ei syrjäytä toista listalta.
  const kept: ScoreRecord[] = [];
  const counts = new Map<string, number>();
  for (const r of recs) {
    const cat = recordCategory(r);
    const n = counts.get(cat) ?? 0;
    if (n < MAX_RECORDS) {
      counts.set(cat, n + 1);
      kept.push(r);
    }
  }
  // Sija lasketaan oman kategorian (moodi × kesto) listalla.
  const cat = recordCategory(rec);
  lastRecordRank = kept.filter((r) => recordCategory(r) === cat).indexOf(rec) + 1;
  if (lastRecordRank > 0) currentRecord = rec;
  saveRecords(kept);
}

/** Mitä kirjaimista olisi voinut tehdä: ratkaisija + jämäkirjainten korostus. */
function computeSuggestions(): void {
  endSuggestions = null;
  if (!judge) return;
  const faces = tiles.map((t) => t.face); // koko heitto (jokeri = wildcard)
  const placed = new Set(extractWords(buildCells()).map((w) => w.text));
  const all = judge.wordsFromRack(faces).filter((w) => !placed.has(w));

  const leftoverSet = new Set(
    tiles.filter((t) => !t.cell).map(letterOf).filter((c): c is string => c !== null),
  );
  const value = (w: string) =>
    [...w].reduce((s, c) => s + (LETTER_VALUES[c.toUpperCase()] ?? 0), 0);
  const byBest = (a: string, b: string) =>
    b.length - a.length || value(b) - value(a) || a.localeCompare(b, "fi");

  // Korosta vain HARVINAISET jämäkirjaimet (arvo ≥4: R H V J P Y D Ö G) — juuri
  // ne joita on vaikea sijoittaa. Yleiset (a,n,t…) eivät ole pelaajan ongelma.
  const hard = new Set(
    [...leftoverSet].filter((c) => (LETTER_VALUES[c.toUpperCase()] ?? 0) >= 4),
  );

  endSuggestions = {
    leftover: [...hard],
    withLeftover: hard.size
      ? all.filter((w) => [...w].some((c) => hard.has(c))).sort(byBest).slice(0, 10)
      : [],
    best: [...all].sort(byBest).slice(0, 12),
  };
}

export function mountGame(el: HTMLElement): void {
  root = el;
  // Ikkunan koon muuttuessa kehystä uudelleen (responsiivinen zoom).
  window.addEventListener("resize", () => {
    if (!showRules) {
      currentFrame = null; // koon muutos → kehystä uudelleen näkymään sopivaksi
      frameBoard();
    }
  });
  // Näppäimistösyöttö: kirjoita sanoja kursorin kohdalle.
  window.addEventListener("keydown", onKeyDown);
  // URL-hash: #c=… = haaste (ottelu), muuten #siemen = yksittäinen jaettu heitto.
  const rawHash = location.hash.replace(/^#/, "");
  if (rawHash.startsWith("c=")) {
    const p = decodeChallenge(rawHash.slice(2));
    if (p) handleIncoming(p);
    else newRoll(randomSeed());
  } else {
    const hashSeed = decodeURIComponent(rawHash);
    newRoll(hashSeed || randomSeed());
  }
  // Sanasto ladataan taustalla; kun valmis, validointi aktivoituu.
  // Lykätään 874 KB:n haku ENSIMMÄISEN maalauksen yli, jottei se kilpaile
  // kaistasta LCP-ikkunassa (mobiiliperformanssi). requestIdleCallback antaa
  // selaimen maalata laudan ensin; setTimeout-varalla selaimille joilla ei rIC:tä.
  const startDictLoad = () => {
    loadJudge()
      .then((j) => {
        judge = j;
        render();
      })
      .catch((e) => console.error("Sanaston lataus epäonnistui", e));
  };
  const ric = (window as unknown as {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => void;
  }).requestIdleCallback;
  if (ric) ric(startDictLoad, { timeout: 1500 });
  else setTimeout(startDictLoad, 200);
  // Opi-moodi päällä → esilataa analyysipaketti, jotta teemasirut syttyvät reaaliajassa.
  if (learnMode) ensureLemmas();
}

function newRoll(s: string): void {
  seed = s;
  // Vapaapelissä siemen URL-hashiin (jaettavissa). Ottelussa hash on #c=… (vastaaja)
  // tai tyhjä (haastaja) → ei ylikirjoiteta kierrossiemenellä.
  if (!match) location.hash = encodeURIComponent(s);
  const { faces } = rollDice(s);
  tiles = faces.map((face, dieIndex) => ({
    dieIndex,
    face,
    letter: face === JOKER ? JOKER : face,
    cell: null,
  }));
  // Järjestysvalinta säilyy heitosta toiseen (oletus: Aakkoset).
  rackSort = loadSort();
  rackOrder = computeRackOrder(rackSort);
  lastRecordRank = 0;
  currentRecord = null;
  // Ei oletuskursoria: tyhjällä laudalla aloitusopaste (sm-board-hint) on ainoa CTA, eikä
  // keskelle piirretty kursori kilpaile sen kanssa. Näppäily luo kursorin keskelle itse
  // (typeAt), ja ruudun napautus asettaa sen — kummassakin opaste väistyy.
  caret = null;
  kbdMode = false; // tuore heitto: kehystä raahauslogiikalla kunnes pelaaja näppäilee
  lifted = null; // nostot ja kumoa-historia kuuluvat yhteen heittoon
  history = [];
  currentFrame = null; // uusi heitto kehystää tuoreesti (keskelle)
  viewScroll = null; // keskitä näkymä uudelleen (zoom-off)
  startRound();
  render();
}

function buildCells(): Cells {
  const m = new Map<string, PlacedTile>();
  for (const t of tiles) {
    if (t.cell) m.set(t.cell, { dieIndex: t.dieIndex, face: t.face, letter: t.letter });
  }
  return m;
}

function tileAt(cell: string): Tile | undefined {
  return tiles.find((t) => t.cell === cell);
}

/**
 * Kirjaimet jotka tekevät KAIKKI jokerin läpi kulkevat sanat kelvollisiksi.
 * Risteyksessä (vaaka + pysty) ehto leikkaa → yleensä yksikäsitteinen.
 * Tyhjä = jokeri ei ole sanassa, tai mikään kirjain ei kelpaa kaikkiin.
 */
function jokerCandidates(t: Tile): string[] {
  if (!judge || !t.cell) return [];
  const cells = buildCells();
  const key = t.cell;
  const through = extractWords(cells).filter((w) => w.keys.includes(key));
  if (!through.length) return [];
  const out: string[] = [];
  for (const L of PLAY_LETTERS) {
    const ok = through.every(
      (w) =>
        judge!.judge(
          w.keys.map((k) => (k === key ? L : cells.get(k)!.letter.toLowerCase())).join(""),
        ) === "valid",
    );
    if (ok) out.push(L);
  }
  return out;
}

/**
 * Auto-päättely: jokainen lukitsematon jokeri saa kirjaimen joka tekee sen
 * sanoista kelvollisia. Yksikäsitteinen ratkeaa itsestään; monitulkintaisessa
 * valitaan aakkosjärjestyksen ensimmäinen (pelaaja voi vaihtaa valitsimesta).
 */
function resolveJokers(): void {
  if (!judge) return;
  for (const t of tiles) {
    if (t.face !== JOKER || !t.cell || t.locked) continue;
    const cands = jokerCandidates(t);
    t.letter = cands.length
      ? cands.sort((a, b) => a.localeCompare(b, "fi"))[0]
      : JOKER;
  }
}

interface Validation {
  cellValid: Map<string, boolean>; // ruutu → kuuluuko vain kelvollisiin sanoihin
  // points = sanan oma pistesumma (premium-moodissa kertoimineen); 0 kelvottomalle.
  words: { text: string; valid: boolean; points: number }[];
  /** Pisteet vain KELVOLLISista sanoista (risteysnoppa kahdesti). */
  wordPoints: number;
  /** Sakotettavat tahkot: telineessä TAI laudalla mutta ei missään kelvollisessa sanassa. */
  unusedFaces: Face[];
  /** Kelvollisissa sanoissa käytettyjen noppien määrä (aikabonuksen kynnystä varten). */
  lettersUsed: number;
  /** Kierroksen aikainen näyttöpiste: wordPoints − käyttämättömät (ei aikabonusta). */
  total: number;
  invalidCount: number;
  connected: boolean;
  /** Irrallisten saarekkeiden ruudut (ei suurimmassa komponentissa); tyhjä = yhtenäinen. */
  islandCells: Set<string>;
  /** Premium-moodi: ristikko kattaa keskiruudun (★). Aina tosi kun premium-moodi pois. */
  anchored: boolean;
  /** Premium-moodin bingo-bonus (kaikki nopat käytetty + ankkuri); 0 muuten. */
  bingo: number;
}

function validate(): Validation {
  resolveJokers(); // jokerit saavat kirjaimensa ennen sanojen poimintaa
  const cells = buildCells();
  const words = extractWords(cells);
  const cellValid = new Map<string, boolean>();
  const wordResults: { text: string; valid: boolean; points: number }[] = [];
  let wordPoints = 0;
  let invalidCount = 0;

  // Tuottavat ruudut = kuuluvat ≥1 kelvolliseen sanaan (näiden nopat eivät ole sakkoa).
  const productiveCells = new Set<string>();

  for (const w of words) {
    const valid = judge ? judge.judge(w.text) === "valid" : false;
    if (!valid) invalidCount++;
    for (const k of w.keys) {
      const prev = cellValid.get(k);
      cellValid.set(k, prev === undefined ? valid : prev && valid);
    }
    // Vain kelvolliset sanat kerryttävät pisteitä; risteysnoppa summautuu kahdesti
    // (kuuluu kahteen sanaan), mikä syntyy luonnostaan kun molemmat sanat ovat valideja.
    // Premium-moodissa kukin sana saa omat kirjain-/sanakertoimensa (Scrabblen ristipisteytys).
    let points = 0;
    if (valid) {
      const vals = w.keys.map((k) => faceValue(cells.get(k)!.face));
      const prem = activePremium() ? w.keys.map((k) => premiumAt(k)) : null;
      points = scoreWord(vals, prem);
      wordPoints += points;
      for (const k of w.keys) productiveCells.add(k);
    }
    wordResults.push({ text: w.text, valid, points });
  }

  // Premium-moodi: ristikon on katettava keskiruutu (★); bingo = kaikki nopat käytetty.
  const anchored = !activePremium() || cells.has(CENTER);
  const bingo =
    activePremium() && anchored && productiveCells.size === tiles.length ? BINGO_BONUS : 0;

  // Sakko: telineessä olevat JA laudalle asetetut jotka eivät ole missään
  // kelvollisessa sanassa (esim. kelvottoman "rut":n r ja u). Jokeri = 0 → ei sakkoa.
  const unusedFaces = tiles
    .filter((t) => !t.cell || !productiveCells.has(t.cell))
    .map((t) => t.face);

  const breakdown = finalScore({
    wordPoints,
    unusedFaces,
    secondsRemaining: 0,
    lettersUsed: productiveCells.size,
    timeBonusEnabled: false,
    bingo,
  });

  return {
    cellValid,
    words: wordResults,
    wordPoints,
    unusedFaces,
    lettersUsed: productiveCells.size,
    total: breakdown.total,
    invalidCount,
    connected: isConnected(cells),
    islandCells: disconnectedCells(cells),
    anchored,
    bingo,
  };
}

function render(): void {
  if (showRules) {
    renderRules();
    return;
  }
  if (showRecords) {
    renderRecords();
    return;
  }
  if (showChecker) {
    renderChecker();
    return;
  }
  if (showSettings) {
    renderSettings();
    return;
  }
  if (showMatchSummary) {
    if (match && match.themes) renderThemeMatchSummary();
    else renderMatchSummary();
    return;
  }
  const v = validate();
  // Opi-moodi: mitkä päivän teemat laudan kelvolliset sanat jo toteuttavat (reaaliaikainen
  // sirujen syttyminen). Vaatii ladatun analyysipaketin; muuten tyhjä → sirut näkyvät himmeinä.
  const themeMatch = !!(match && match.themes); // kaveri-teemahaaste: jaettu tavoitesetti
  let learnHits: Set<string> = new Set();
  if ((learnMode || themeMatch) && lemmas) {
    const lk = lemmas;
    learnHits = detectThemes(
      v.words.filter((w) => w.valid).map((w) => w.text),
      (w) => lk.lookup(w),
    );
  }
  const anyPlaced = tiles.some((t) => t.cell); // ankkuri-varoitus vasta kun jotain on laudalla
  const matchTag = match
    ? `<span class="sm-match-tag">🎯 Kierros ${match.current + 1}/${match.rounds} · ⏳ ${durationLabel(match.duration)}${match.premium ? " · 🟦 Scrabble" : ""}</span>`
    : "";
  // Nappipalkki kolmeen ryhmään: toiminnot (muuttavat pelitilaa) | näkymät (avaavat
  // paneelin) | tila (vain luku). Erotin näkyy vain kun toiminnot-ryhmässä on nappeja.
  const hasActions = !match || !roundOver;
  // Elävä kirjainmittari: tekee aikabonuksen piilokynnyksen (≥11/13) näkyväksi maaliksi
  // jo pelin aikana, ei vasta tulosruudussa. "Auki" = kynnys täynnä ja bonus käytössä.
  const bonusReady = timeBonusEnabled && v.lettersUsed >= TIME_BONUS_MIN_LETTERS_USED;
  const usedTitle = !timeBonusEnabled
    ? "Aikabonus pois käytöstä — käytä silti mahdollisimman monta noppaa"
    : bonusReady
      ? "Aikabonus auki"
      : `Aikabonus aukeaa kun ≥${TIME_BONUS_MIN_LETTERS_USED} noppaa on käytetty`;
  const usedChip = `<span class="sm-used${bonusReady ? " sm-used-ready" : ""}" title="${usedTitle}">Kirjaimia: <b>${v.lettersUsed}</b>/${tiles.length}${bonusReady ? " ⚡" : ""}</span>`;
  root.innerHTML = `
    <div class="sm-game">
    <header class="sm-head">
      <h1>Itu</h1>
      <span class="sm-seed">siemen: ${seed}</span>
      ${matchTag}
    </header>
    <div class="sm-bar">
      <div class="sm-bar-group sm-bar-actions">
        ${match ? "" : `<button id="sm-new" class="sm-primary">🎲 Heitä uudet</button>`}
        ${roundOver ? "" : `<button id="sm-lock">🔒 Lukitse</button>`}
      </div>
      ${hasActions ? `<span class="sm-bar-sep" aria-hidden="true"></span>` : ""}
      <div class="sm-menu">
        <input type="checkbox" id="sm-menu-cb" class="sm-menu-cb" aria-hidden="true" tabindex="-1" />
        <label for="sm-menu-cb" class="sm-menu-btn" title="Lisää" aria-label="Lisää valikko">☰ Lisää</label>
        <div class="sm-bar-group sm-bar-views">
          <button id="sm-rules">📜 Säännöt</button>
          <button id="sm-checker">🔎 Sanapoliisi</button>
          <button id="sm-records">🏆 Ennätykset</button>
          <button id="sm-settings">⚙️ Asetukset</button>
          ${match ? "" : `<button id="sm-challenge">🎯 Haaste</button>`}
        </div>
      </div>
      <div class="sm-bar-status">
        ${roundOver ? "" : `<span class="sm-timer" id="sm-timer">${fmtTime(secondsLeft())}</span>`}
        ${roundOver ? "" : usedChip}
        <span class="sm-score">${
          roundOver ? "Kierros päättyi" : `Pisteet: <b>${v.total}</b>`
        }${v.invalidCount ? ` · ${v.invalidCount} kelvotonta` : ""}${
          !v.connected ? " · ristikko ei yhtenäinen" : ""
        }${activePremium() && !roundOver && anyPlaced && !v.anchored ? ' · aloita <span class="sm-star">★</span>-ruudusta' : ""}${
          v.bingo ? " · ⚡ bingo!" : ""
        }</span>
      </div>
    </div>
    ${activePremium() && !roundOver ? premLegendHtml(true) : ""}
    ${(learnMode || themeMatch) && !roundOver ? learnTargetsHtml(learnHits, themeMatch ? match!.themes! : undefined) : ""}
    ${roundOver ? resultHtml() : ""}
    ${roundOver && match ? matchNavHtml() : ""}
    ${boardHtml(v)}
    ${roundOver ? "" : controlsHintHtml()}
    ${rackHtml()}
    ${wordsHtml(v)}
    ${judge ? "" : '<p class="sm-words pending">Ladataan sanastoa…</p>'}
    ${jokerPicker !== null ? jokerPickerHtml() : ""}
    ${showChallenge ? challengeHtml() : ""}
    </div>
  `;
  wireEvents();
  frameBoard(); // automaattinen zoom/keskitys käytetyn alueen mukaan
}

function resultHtml(): string {
  if (!endBreakdown) return "";
  const b = endBreakdown;
  const reason = endRemaining > 0 ? "lukittu" : "aika loppui";
  const s = endSuggestions;
  const sugHtml =
    s && (s.withLeftover.length || s.best.length)
      ? `<div class="sm-sug">
          ${
            s.leftover.length && s.withLeftover.length
              ? `<h3>Käyttämättä jäi <b>${s.leftover.map((c) => c.toUpperCase()).join(" ")}</b> — niillä olisi voinut tehdä</h3>
                 ${wordRows(s.withLeftover)}`
              : ""
          }
          <h3>Näillä kirjaimilla olisi voinut tehdä myös</h3>
          ${wordRows(s.best)}
        </div>`
      : "";

  const banner = lastRecordRank
    ? `<p class="sm-record-banner">🏆 ${
        lastRecordRank === 1
          ? "Uusi paras tulos!"
          : `Ennätyslistalle — sija ${lastRecordRank}.`
      }</p>`
    : "";

  // Omat sanat + Tarkastaja-selitteet (perusmuoto, sija, sijan vaikutus).
  const lemmaHtml = endWords.length
    ? `<div class="sm-sug sm-lemmas">
        <h3>Sanasi ja niiden muodot</h3>
        ${wordRows(endWords, endWordScores)}
      </div>`
    : "";

  // Opi-yhteenveto kierroksen lopussa myös teemahaasteessa (vaikkei Opi-moodi olisi päällä).
  const learnHtml = learnMode || (match && match.themes) ? learnResultHtml() : "";

  return `<div class="sm-result">
    <h2>Lopputulos <small>(${reason})</small></h2>
    ${banner}
    ${learnHtml}
    <table class="sm-breakdown">
      <tr><td>Sanapisteet</td><td>${b.wordPoints}</td></tr>
      <tr><td>Käyttämättä jääneet nopat</td><td>−${b.unusedPenalty}</td></tr>
      <tr><td>Aikabonus${endRemaining > 0 ? ` (${endRemaining} s säästöön)` : ""}${
        b.timeBonus === 0 && endRemaining > 0 && endLettersUsed < TIME_BONUS_MIN_LETTERS_USED
          ? ` <span class="sm-bonus-note">— vaatii ≥${TIME_BONUS_MIN_LETTERS_USED} käytettyä kirjainta (käytit ${endLettersUsed})</span>`
          : ""
      }</td><td>+${b.timeBonus}</td></tr>
      ${b.bingo ? `<tr><td>Bingo (kaikki nopat) ⚡</td><td>+${b.bingo}</td></tr>` : ""}
      <tr class="sm-total"><td>Yhteensä</td><td>${b.total}</td></tr>
    </table>
    ${lemmaHtml}
    ${sugHtml}
  </div>`;
}

/** Selkosäännöt + ohjaus eri välilehdillä — sama sisältö pelissä ja tulosteessa (@media print). */
function renderRules(): void {
  const tab = (key: "words" | "controls", label: string) =>
    `<button class="sm-tab${key === rulesTab ? " sm-tab-active" : ""}" data-rtab="${key}">${label}</button>`;
  const content = rulesTab === "controls" ? renderControlsContent() : renderWordsContent();
  root.innerHTML = `
    <div class="sm-bar sm-no-print">
      <button id="sm-rules-close">← Takaisin peliin</button>
      <button id="sm-rules-print" class="sm-primary">Tulosta</button>
    </div>
    <div class="sm-tabs sm-no-print">${tab("words", "Sanat")}${tab("controls", "Ohjaus")}</div>
    ${content}
  `;
  root.querySelector<HTMLButtonElement>("#sm-rules-close")!.onclick = () => {
    showRules = false;
    render();
  };
  root.querySelector<HTMLButtonElement>("#sm-rules-print")!.onclick = () => window.print();
  for (const b of root.querySelectorAll<HTMLElement>("[data-rtab]")) {
    b.addEventListener("click", () => {
      rulesTab = b.dataset.rtab as "words" | "controls";
      renderRules();
    });
  }
}

// Premium-ruutujen suomenkieliset lyhenteet (K = kirjain, S = sana; ×2/×3 = kerroin).
// Korvaavat aiemmat englannin DL/TL/DW/TW-koodit, jotta selite avautuu suomeksi.
const PREM_FI: Record<PremiumKind, string> = { DL: "K×2", TL: "K×3", DW: "S×2", TW: "S×3" };
const PREM_TITLE: Record<PremiumKind, string> = {
  DL: "Kirjain ×2",
  TL: "Kirjain ×3",
  DW: "Sana ×2",
  TW: "Sana ×3",
};

/** Premium-kertoimien legenda (väri → merkitys). Jaettu Asetusten ja pelinäytön kesken. */
function premLegendHtml(game = false): string {
  const order: PremiumKind[] = ["DL", "TL", "DW", "TW"];
  const chips = order
    .map(
      (k) =>
        `<span class="sm-prem-chip sm-prem sm-prem-${k.toLowerCase()}" title="${PREM_TITLE[k]}">${PREM_FI[k]}</span>`,
    )
    .join("");
  return `<div class="sm-prem-legend${game ? " sm-prem-legend-game" : ""}" aria-label="Pistemoodin kertoimet">
    ${chips}
    <span class="sm-prem-chip"><span class="sm-star">★</span> aloitus</span>
  </div>`;
}

/** Opi-moodin päivän teemasirut laudan yllä; osutut korostuvat reaaliajassa.
 * `forced` = jaettu teemahaastesetti (vaihe 2); kun annettu, syrjäyttää päivätavoitteet
 * ja viikkokoonti piilotetaan (haasteessa mitataan kattavuus, ei henkilökohtaista viikkoa). */
function learnTargetsHtml(hits: Set<string>, forced?: string[]): string {
  const targets = forced ?? dailyTargets();
  const chips = targets
    .map((id) => {
      const t = THEME_BY_ID[id];
      if (!t) return "";
      const hit = hits.has(id);
      return `<span class="sm-learn-chip${hit ? " sm-learn-hit" : ""}" title="${escapeHtml(t.describe)}">${hit ? "✓ " : ""}${escapeHtml(t.label)}</span>`;
    })
    .join("");
  const loading = !lemmas ? ' <span class="sm-learn-loading">(ladataan…)</span>' : "";
  const title = forced ? "🎯📚 Teemahaaste:" : "📚 Tänään:";
  const tail = forced
    ? ""
    : (() => {
        const wk = weeklyProgress(learnProgress, weekStartKey());
        return `<span class="sm-learn-week" title="Viikon eri teemat">${wk.covered}/${wk.goal}${wk.covered >= wk.goal ? " ✓" : ""} viikossa</span>`;
      })();
  // ⓘ avaa/sulkee kaikkien teemojen selkokuvaukset (mobiilissa hover ei toimi → tähdättävä
  // tieto näkyviin ennen peliä). Tila JS:ssä (learnDescOpen) → säilyy renderin yli.
  const info = `<button id="sm-learn-info" class="sm-learn-info" aria-expanded="${learnDescOpen}" aria-label="${learnDescOpen ? "Piilota teemojen kuvaukset" : "Näytä mitä teemat tarkoittavat"}" title="Mitä teemat tarkoittavat?">ⓘ</button>`;
  const descs = learnDescOpen ? learnDescListHtml(targets, hits) : "";
  return `<div class="sm-learn-bar" aria-label="Opi-moodin teemat">
    <span class="sm-learn-title">${title}</span>
    ${chips}${loading}
    ${info}
    ${tail}
  </div>${descs}`;
}

/** Teemojen selkokuvaukset (nimi — mihin vastaa · esim.). Jaettu pelipalkin ⓘ-laajennuksen,
 * haastemodaalin ja loppunäytön kesken. `hits` korostaa osutut; `markMissed` näyttää ohitetut
 * ○:lla (loppunäyttö, jossa "et osunut" on merkityksellinen — pelipalkissa/modaalissa ei). */
function learnDescListHtml(
  ids: readonly string[],
  hits: Set<string> = new Set(),
  markMissed = false,
): string {
  const rows = ids
    .map((id) => {
      const t = THEME_BY_ID[id];
      if (!t) return "";
      const hit = hits.has(id);
      const mark = hit ? "✓ " : markMissed ? "○ " : "";
      return `<li class="sm-learn-desc-row${hit ? " sm-learn-hit-row" : ""}">
        <span class="sm-learn-desc-name">${mark}${escapeHtml(t.label)}</span>
        <span class="sm-learn-desc-q">${escapeHtml(t.describe)}</span>
        <span class="sm-learn-desc-ex">esim. ${escapeHtml(t.example)}</span>
      </li>`;
    })
    .join("");
  return `<ul class="sm-learn-desc">${rows}</ul>`;
}

/** Loppunäytön Opi-yhteenveto: päivän tavoitteet (osuit/et) + bonusosumat + viikkopalkki. */
function learnResultHtml(): string {
  if (!lastLearnTargets.length) {
    return `<div class="sm-learn-result">
      <h3>📚 Opi-moodi</h3>
      <p class="sm-words pending">Teemat tallentuvat kun sanasto on latautunut — pelaa uusi kierros.</p>
    </div>`;
  }
  // Kuvaukset + esimerkit myös loppunäytöllä (oppimishetki): osutut ✓, ohitetut ○.
  const targetList = learnDescListHtml(lastLearnTargets, lastLearnAchieved, true);
  const extra = [...lastLearnAchieved].filter((id) => !lastLearnTargets.includes(id));
  const extraChips = extra.length
    ? `<p class="sm-learn-extra">Lisäksi osuit:</p>${learnDescListHtml(extra, new Set(extra))}`
    : "";
  const wk = weeklyProgress(learnProgress, weekStartKey());
  const pct = wk.goal > 0 ? Math.min(100, Math.round((wk.covered / wk.goal) * 100)) : 0;
  const hitCount = lastLearnTargets.filter((id) => lastLearnAchieved.has(id)).length;
  return `<div class="sm-learn-result">
    <h3>📚 Päivän teemat ${hitCount}/${lastLearnTargets.length}</h3>
    ${targetList}
    ${extraChips}
    <div class="sm-learn-weekbar" title="Viikon eri teemat">
      <div class="sm-learn-weekfill" style="width:${pct}%"></div>
      <span class="sm-learn-weeklabel">Viikko: ${wk.covered}/${wk.goal}${wk.covered >= wk.goal ? " ✓" : ""} teemaa</span>
    </div>
  </div>`;
}

/** ⚙️ Asetukset — Scrabble-pistemoodi + aikabonus (molemmat paikallisia pistesääntöjä). */
function renderSettings(): void {
  root.innerHTML = `
    <div class="sm-bar sm-no-print">
      <button id="sm-settings-close">← Takaisin peliin</button>
    </div>
    <div class="sm-settings">
      <h2>Asetukset</h2>
      <div class="sm-setting-row sm-setting-block">
        <span class="sm-setting-text">
          <b>⏳ Kierroksen kesto</b>
          <small>Kuinka kauan aikaa per heitto. Oletus 3 min. Aikabonus lasketaan jäljellä
          olevasta ajasta riippumatta kestosta, joten lyhyt kesto ei tuo enempää bonusta.
          Haasteessa kesto lukitaan linkkiin, jotta molemmat pelaavat saman ajan.
          <b>Kullakin kestolla on oma ennätyslistansa</b> (sama aika kaikille = reilu vertailu).</small>
        </span>
        <div class="sm-duration-opts" role="group" aria-label="Kierroksen kesto">
          ${DURATION_OPTIONS.map(
            (s) =>
              `<button class="sm-tool sm-dur-opt${s === gameDuration ? " sm-tool-active" : ""}" data-dur="${s}" aria-pressed="${s === gameDuration}">${durationLabel(s)}</button>`,
          ).join("")}
        </div>
      </div>
      <label class="sm-setting-row">
        <input type="checkbox" id="sm-set-timebonus"${timeBonusEnabled ? " checked" : ""} />
        <span class="sm-setting-text">
          <b>⏱️ Aikabonus</b>
          <small>Nopeasta ja täydestä ratkaisusta lisäpisteitä: jäljellä oleva aika palkitaan,
          kun käytät ≥${TIME_BONUS_MIN_LETTERS_USED} noppaa. Pois päältä ajastin näkyy yhä, mutta
          aika ei tuo bonuspisteitä — voit pohtia rauhassa.</small>
        </span>
      </label>
      <label class="sm-setting-row">
        <input type="checkbox" id="sm-set-learn"${learnMode ? " checked" : ""} />
        <span class="sm-setting-text">
          <b>📚 Opi-moodi</b>
          <small>Päivän kielioppihaaste: muutama teema (sija, monikko, aikamuoto, …)
          kerättäväksi laudan sanoilla. Pehmeä — ei estä pelaamista eikä muuta pisteitä,
          vaan näyttää mitä muotoja muodostit. Adaptiivinen: tarjoaa sitä mitä harjoittelet
          vähiten, viikkotavoite löysänä koontina. Edistymä tallentuu vain tälle laitteelle.</small>
        </span>
      </label>
      <label class="sm-setting-row">
        <input type="checkbox" id="sm-set-premium"${premiumMode ? " checked" : ""} />
        <span class="sm-setting-text">
          <b>🟦 Scrabble-pistemoodi</b>
          <small>Premium-ruudut (kirjain ×2/×3, sana ×2/×3), bingo-bonus kaikkien noppien
          käytöstä ja keskusankkuri (★). Kerrostuu nykyisen pisteytyksen päälle — aikabonus ja
          ajastin säilyvät. Pois päältä peli on perinteinen Itu.</small>
        </span>
      </label>
      ${premLegendHtml()}
      <p class="sm-ch-note sm-prem-key">K = kirjain, S = sana · ×2 ja ×3 ovat kertoimia. Sama selite näkyy laudan yllä Scrabble-moodissa.</p>
    </div>
  `;
  root.querySelector<HTMLButtonElement>("#sm-settings-close")!.onclick = () => {
    showSettings = false;
    render();
  };
  for (const b of root.querySelectorAll<HTMLElement>("[data-dur]")) {
    b.addEventListener("click", () => {
      gameDuration = coerceDuration(Number(b.dataset.dur));
      saveDuration(gameDuration);
      renderSettings(); // päivitä valinta heti; huomioidaan seuraavan kierroksen alkaessa
    });
  }
  root.querySelector<HTMLInputElement>("#sm-set-timebonus")!.onchange = (e) => {
    timeBonusEnabled = (e.target as HTMLInputElement).checked;
    saveTimeBonus(timeBonusEnabled);
    renderSettings(); // päivitä valinta heti; huomioidaan kun lukitset kierroksen
  };
  root.querySelector<HTMLInputElement>("#sm-set-premium")!.onchange = (e) => {
    premiumMode = (e.target as HTMLInputElement).checked;
    savePremiumMode(premiumMode);
    renderSettings(); // päivitä valinta heti; lauta päivittyy kun palataan peliin
  };
  root.querySelector<HTMLInputElement>("#sm-set-learn")!.onchange = (e) => {
    learnMode = (e.target as HTMLInputElement).checked;
    saveLearnMode(learnMode);
    if (learnMode) ensureLemmas(); // teemasirut tarvitsevat analyysipaketin
    renderSettings(); // päivitä valinta heti; teemasirut näkyvät kun palataan peliin
  };
}

/** Lataa lemma-paketti kerran (lazy); valmistuttua päivittää avoinna olevan näkymän. */
function ensureLemmas(): void {
  if (lemmas || lemmasLoading) return;
  lemmasLoading = true;
  loadLemmas()
    .then((l) => {
      lemmas = l;
      if (showChecker) checkerRefresh?.();
      else render();
    })
    .catch((e) => console.error("Lemma-paketin lataus epäonnistui", e))
    .finally(() => {
      lemmasLoading = false;
    });
}

/**
 * Perusmuodon linkit ulkoisiin sanakirjoihin. EI hallusinointia: linkki vie HAKUUN
 * auktoritatiiviseen lähteeseen (emme generoi määritelmää). Harvinainen johoslemma voi
 * näyttää lähteen oman "ei hakutuloksia" -viestin — se on lähteen totuus, ei meidän arvaus.
 * Kaksi lähdettä: Kielitoimiston sanakirja (Kotus, sama kuin pelin sanaston pohja) +
 * fi.Wiktionary (laajempi, johdokset/taulukot). Lemma on raaka → encodeURIComponent ä/ö:lle.
 */
function dictLinks(lemma: string): string {
  const enc = encodeURIComponent(lemma);
  const a = (href: string, label: string, title: string) =>
    `<a class="sm-dict-link" href="${href}" target="_blank" rel="noopener noreferrer" title="${title}">${label}</a>`;
  return (
    ` <span class="sm-dict">(katso: ` +
    a(`https://www.kielitoimistonsanakirja.fi/${enc}`, "Kotus", `Hae “${escapeHtml(lemma)}” Kielitoimiston sanakirjasta`) +
    ` · ` +
    a(`https://fi.wiktionary.org/wiki/${enc}`, "Wikt", `Hae “${escapeHtml(lemma)}” Wikisanakirjasta`) +
    `)</span>`
  );
}

/** Tarkastaja: kaikki pätevät tulkinnat sanalle (perusmuoto + sija + vaikutus +
 * selkoesimerkki). Kukin rivi auktoritatiivisesta FST-analyysista; tyhjä jos ei
 * tietoa (mieluummin vaiti kuin arvaus). Lemmat/esimerkit escapataan. */
function analysisLines(word: string): string[] {
  if (!lemmas) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const a of lemmas.lookup(word)) {
    let line: string;
    if (a.code === "Base") {
      // Sana ON perusmuotonsa → linkki sanaan itseensä; muuten linkki taustalemmaan.
      line =
        a.lemma === word
          ? `perusmuoto${dictLinks(a.lemma)}`
          : `perusmuoto sanasta <b>${escapeHtml(a.lemma)}</b>${dictLinks(a.lemma)}`;
    } else {
      const d = describeCode(a.code);
      if (!d) continue; // tuntematon koodi → ei arvausta
      const parts = [d.text];
      if (d.effect) parts.push(`<span class="sm-q">${d.effect}</span>`);
      parts.push(`perusmuoto <b>${escapeHtml(a.lemma)}</b>${dictLinks(a.lemma)}`);
      if (d.example && d.example !== word) parts.push(`kuten <i>${escapeHtml(d.example)}</i>`);
      line = parts.join(" · ");
    }
    if (!seen.has(line)) {
      seen.add(line);
      out.push(line);
    }
  }
  return out;
}

/** Sanalista, jossa kunkin sanan alla sen Tarkastaja-tulkinnat (loppunäyttö +
 * ratkaisijan ehdotukset). Lataus kesken → "…". Valinnaiset `scores` (samassa
 * järjestyksessä) näyttävät kunkin sanan tuottamat pisteet — käytössä omissa sanoissa,
 * ei hypoteettisissa ehdotuksissa. */
function wordRows(words: string[], scores?: number[]): string {
  return words
    .map((w, i) => {
      const lines = analysisLines(w);
      const body = lines.length
        ? lines.map((l) => `<div class="sm-ana">${l}</div>`).join("")
        : lemmasLoading
          ? `<div class="sm-ana">…</div>`
          : "";
      const pts =
        scores && scores[i] !== undefined
          ? `<span class="sm-word-pts">${scores[i]} p</span>`
          : "";
      return `<div class="sm-lemma-row"><b>${escapeHtml(w)}</b>${pts}${body}</div>`;
    })
    .join("");
}

/** Tarkastaja: pelin ulkopuolinen sanahaku (sama DAWG-tuomari) + selitys siitä,
 * mikä muoto sana on ja mistä perusmuodosta. */
function renderChecker(): void {
  root.innerHTML = `
    <div class="sm-bar">
      <button id="sm-check-close">← Takaisin peliin</button>
      <h2 class="sm-records-title">🔎 Sanapoliisi</h2>
    </div>
    <div class="sm-checker">
      <p class="sm-ch-note">Kokeile käykö jokin sana — esim. <b>kuusta</b>, <b>rankin</b>, <b>kellutetuissa</b>. Pelin sanakirja vastaa kuten pelissä, ja Sanapoliisi kertoo perusmuodon, sijamuodon ja mitä se tarkoittaa.</p>
      <input id="sm-check-input" class="sm-ch-link" placeholder="Kirjoita sana"
        autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" />
      <p id="sm-check-result" class="sm-check-result"></p>
      <div class="sm-check-note">
        <h4>Erisnimet</h4>
        <p>Erisnimi ei kelpaa niminä, mutta moni etunimi on myös tavallinen sana ja
        kelpaa pienellä kirjoitettuna: <b>tarmo</b>, <b>kaino</b>, <b>into</b>,
        <b>aamu</b>, <b>vieno</b>. Sanakirja katsoo sanaa, ei isoa alkukirjainta.</p>
      </div>
    </div>
  `;
  const input = root.querySelector<HTMLInputElement>("#sm-check-input")!;
  const result = root.querySelector<HTMLElement>("#sm-check-result")!;
  // Päivitä tulos suoraan DOM:iin (ei full-renderiä → syöttökenttä säilyttää fokuksen).
  const update = () => {
    const w = input.value.trim().toLowerCase();
    if (!w) {
      result.textContent = "";
      result.className = "sm-check-result";
    } else if (!judge) {
      result.textContent = "Ladataan sanastoa…";
      result.className = "sm-check-result pending";
    } else if (judge.judge(w) === "valid") {
      const lines = analysisLines(w);
      const body = lines.length
        ? `<div class="sm-ana-list">${lines.map((l) => `<div class="sm-ana">${l}</div>`).join("")}</div>`
        : lemmasLoading
          ? ` <span class="sm-lemma">…</span>`
          : "";
      result.innerHTML = `<span class="sm-check-ok-line">✓ ”${escapeHtml(w)}” kelpaa</span>${body}`;
      result.className = "sm-check-result ok";
    } else {
      result.textContent = `✗ ”${w}” ei kelpaa`;
      result.className = "sm-check-result bad";
    }
  };
  checkerRefresh = update;
  input.addEventListener("input", update);
  input.focus();
  ensureLemmas(); // lataa perusmuodot taustalla
  root.querySelector<HTMLButtonElement>("#sm-check-close")!.onclick = () => {
    showChecker = false;
    render();
  };
}

/** 🏆-näkymä: top-10 tulokset per (pistemoodi × kesto). Kaksi välilehtiriviä:
 * pistemoodi (Itu / Scrabble) ja kesto (1/2/3/5 min). Lista suodattuu molemmilla. */
function renderRecords(): void {
  const all = loadRecords();
  const modeRecs = all.filter((r) => (r.mode ?? "itu") === recordsTab);
  const rateMode = recordsSort === "rate";
  // Tuottavuuslajittelu yhdistää kestot (vertailu kestojen yli); kokonaispistelajittelu
  // suodattaa valitulla kestolla (sama aika kaikille = reilu vertailu).
  const recs = rateMode
    ? modeRecs
        .slice()
        .sort((a, b) => wordRate(b) - wordRate(a) || b.wordPoints - a.wordPoints || a.date - b.date)
        .slice(0, MAX_RECORDS)
    : modeRecs.filter((r) => (r.duration ?? DEFAULT_DURATION) === recordsDurationTab);
  const modeTab = (key: RecordMode, label: string) =>
    `<button class="sm-tab${key === recordsTab ? " sm-tab-active" : ""}" data-rectab="${key}">${label}</button>`;
  const durTab = (s: number) =>
    `<button class="sm-tab${s === recordsDurationTab ? " sm-tab-active" : ""}" data-recdur="${s}">${durationLabel(s)}</button>`;
  const sortTab = (key: RecordsSort, label: string) =>
    `<button class="sm-tab${key === recordsSort ? " sm-tab-active" : ""}" data-recsort="${key}">${label}</button>`;
  const modeName = recordsTab === "scrabble" ? "Scrabble-moodin " : "Itu-";
  const empty = rateMode
    ? `Ei vielä ${modeName}ennätyksiä — pelaa kierros ja lukitse tulos! Pistettä/min vertaa eri kestoja keskenään.`
    : `Ei vielä ${modeName}ennätyksiä kestolla ${durationLabel(recordsDurationTab)} — pelaa kierros tällä asetuksella ja lukitse tulos!`;
  const list = recs.length
    ? recs.map((r, i) => recordHtml(r, i + 1, rateMode)).join("")
    : `<p class="sm-words pending">${empty}</p>`;
  root.innerHTML = `
    <div class="sm-bar">
      <button id="sm-records-close">← Takaisin peliin</button>
      <h2 class="sm-records-title">🏆 Ennätykset</h2>
    </div>
    <div class="sm-tabs">${modeTab("itu", "Itu")}${modeTab("scrabble", "🟦 Scrabble")}</div>
    <div class="sm-tabs sm-tabs-sort">${sortTab("total", "Kokonaispisteet")}${sortTab("rate", "⚡ Pistettä/min")}</div>
    ${rateMode ? "" : `<div class="sm-tabs sm-tabs-dur">${DURATION_OPTIONS.map(durTab).join("")}</div>`}
    ${rateMode ? `<p class="sm-ch-note sm-rate-note">Sanapisteet jaettuna kierroksen kestolla (min). Aikabonus ja sakot eivät vaikuta → vertaa puhdasta tuottavuutta eri kestojen yli.</p>` : ""}
    <div class="sm-records">${list}</div>
  `;
  root.querySelector<HTMLButtonElement>("#sm-records-close")!.onclick = () => {
    showRecords = false;
    render();
  };
  for (const b of root.querySelectorAll<HTMLElement>("[data-rectab]")) {
    b.addEventListener("click", () => {
      recordsTab = b.dataset.rectab as RecordMode;
      renderRecords();
    });
  }
  for (const b of root.querySelectorAll<HTMLElement>("[data-recsort]")) {
    b.addEventListener("click", () => {
      recordsSort = b.dataset.recsort as RecordsSort;
      renderRecords();
    });
  }
  for (const b of root.querySelectorAll<HTMLElement>("[data-recdur]")) {
    b.addEventListener("click", () => {
      recordsDurationTab = Number(b.dataset.recdur);
      renderRecords();
    });
  }
}

function recordHtml(r: ScoreRecord, rank: number, showRate = false): string {
  const isCurrent = currentRecord !== null && r.date === currentRecord.date;
  const d = new Date(r.date);
  const date = `${d.getDate()}.${d.getMonth() + 1}.`;
  // Rate-tilassa pääluku on sanapistettä/min + alarivi (sanapisteet · kesto, koska kestot
  // sekaisin); kokonaispistetilassa pelkkä kokonaispistemäärä (kesto on välilehdessä).
  const primary = showRate
    ? `<span class="sm-record-total">${fmtRate(wordRate(r))} p/min</span><span class="sm-record-rate-sub">${r.wordPoints} sanap · ${durationLabel(r.duration ?? DEFAULT_DURATION)}</span>`
    : `<span class="sm-record-total">${r.total} p</span>`;
  // Per-sana-pisteet (kertoimineen) jos tallennettu; vanhoilta tietueilta puuttuu → pelkkä sana.
  const words = r.words
    .map((w, i) => {
      const p =
        r.wordScores && r.wordScores[i] !== undefined
          ? `<span class="sm-rec-word-pts">${r.wordScores[i]}</span>`
          : "";
      return `<span class="sm-sug-word">${escapeHtml(w)}${p}</span>`;
    })
    .join(" ");
  return `<div class="sm-record${isCurrent ? " sm-record-cur" : ""}">
    <div class="sm-record-head">
      <span class="sm-record-rank">${rank}.</span>
      ${primary}
      ${isCurrent ? '<span class="sm-record-star">★</span>' : ""}
      <span class="sm-record-meta">${date} · siemen ${r.seed}</span>
    </div>
    ${recordBoardHtml(r)}
    ${words ? `<p class="sm-record-words">${words}</p>` : ""}
  </div>`;
}

/** Tallennetun pelin ruudukko staattisena pienoiskuvana (vain käytetty alue). */
function recordBoardHtml(r: ScoreRecord): string {
  if (!r.placed.length) return "";
  const cells = new Map(r.placed.map((t) => [t.cell, t]));
  const ps = r.placed.map((t) => parseKey(t.cell));
  const rows = ps.map((p) => p.row);
  const cols = ps.map((p) => p.col);
  const minR = Math.min(...rows),
    maxR = Math.max(...rows),
    minC = Math.min(...cols),
    maxC = Math.max(...cols);
  let html = `<div class="sm-mini" style="grid-template-columns:repeat(${maxC - minC + 1},1.5rem)">`;
  for (let row = minR; row <= maxR; row++) {
    for (let col = minC; col <= maxC; col++) {
      const t = cells.get(cellKey(row, col));
      const glyph = t ? (t.face === JOKER ? t.letter.toUpperCase() : t.face) : "";
      html += `<div class="sm-mini-cell${t ? " sm-mini-tile" : ""}">${glyph}</div>`;
    }
  }
  return html + "</div>";
}

/** Laitekohtainen ohjevihje laudan alla (hiiri vs. kosketus/kynä). Heuristiikka:
 * `pointer: fine` ≈ hiiri/kynä, muuten kosketus. Kaikki eleet toimivat silti aina. */
function controlsHintHtml(): string {
  const fine = typeof matchMedia === "function" && matchMedia("(pointer: fine)").matches;
  // Yksi ydinrivi per syöttötapa; täysi komentolista (poisto, Ctrl+Z, ⌫) elää
  // Säännöt › Ohjaus -välilehdellä (rules/content.ts CONTROLS) — ei kahdenneta tähän.
  const boardEmpty = tiles.every((t) => !t.cell);
  const arrow = caret ? (caret.dir === "V" ? "↓" : "→") : "";
  const parts: string[] = [];
  // Tyhjällä laudalla aloitusopaste (sm-board-hint) kantaa "raahaa"-pääviestin → ei toisteta tässä.
  if (!boardEmpty) {
    parts.push(
      fine
        ? "Raahaa nappula laudalle — tai napauta nappula, sitten ruutu."
        : "Napauta nappula ja sitten ruutu — tai raahaa.",
    );
  }
  // Suunnanvaihto, vain kun kirjoituskohta on auki. Kosketuslaitteella EI näppäimistöä →
  // näytä napautusohje (napauta valittua ruutua = setCaret vaihtaa suunnan), ei väli/sarkain.
  if (caret) {
    parts.push(
      fine
        ? `Kirjoita: väli tai sarkain vaihtaa suunnan ${arrow}.`
        : `Napauta valittua ruutua vaihtaaksesi suunnan ${arrow}.`,
    );
  }
  parts.push(`<span class="sm-hint-more">Lisää: 📜 Säännöt › Ohjaus</span>`);
  return `<p class="sm-kbd-hint">${parts.join(" ")}</p>`;
}

function boardHtml(v: Validation): string {
  let html = `<div class="sm-board" style="grid-template-columns:repeat(${BOARD},var(--cell))">`;
  for (let r = 0; r < BOARD; r++) {
    for (let c = 0; c < BOARD; c++) {
      const key = cellKey(r, c);
      const tile = tileAt(key);
      const valid = v.cellValid.get(key);
      const cls =
        valid === undefined ? "" : valid ? " sm-valid" : " sm-invalid";
      // Irrallinen saareke: korostetaan MISSÄ ristikko on poikki (eri kuin sm-invalid = "ei sana").
      const islandCls = v.islandCells.has(key) ? " sm-island" : "";
      // Premium-moodi: ruudun pohjaväri (laji) + keskiruudun ★ (näkyy vain tyhjänä).
      const premKind = activePremium() ? premiumKindAt(key) : null;
      const premCls = premKind ? ` sm-prem sm-prem-${premKind.toLowerCase()}` : "";
      const isCaret = !roundOver && caret !== null && caret.row === r && caret.col === c;
      const caretCls = isCaret ? " sm-caret" : "";
      // Kursorinuoli piirretään myös asetetun nopan PÄÄLLE, jotta sanan päällä näkee missä mennään.
      const caretMark = isCaret ? `<span class="sm-caret-arrow">${caret!.dir === "H" ? "→" : "↓"}</span>` : "";
      const starMark =
        activePremium() && key === CENTER ? `<span class="sm-center-star">★</span>` : "";
      const inner = tile ? `${tileHtml(tile)}${caretMark}` : `${starMark}${caretMark}`;
      html += `<div class="sm-cell${cls}${islandCls}${premCls}${caretCls}" data-cell="${key}">${inner}</div>`;
    }
  }
  html += `</div>`; // sulje sm-board (avattiin html:n alussa) — ettei sulku mene väärään diviin
  // Tyhjän laudan aloitusopaste: kutsuu ensisiirtoon ilman ohjekappaleen lukemista.
  // pointer-events:none (CSS) → ei estä raahausta; katoaa heti kun ensimmäinen noppa on laudalla.
  // Opaste vain ennen ensimmäistä toimintoa: piilota heti kun kursori on asetettu (pelaaja
  // valitsi ruudun) tai noppa on laudalla → valittu ruutu ei koskaan jää tekstin alle.
  const boardEmpty = !roundOver && !caret && tiles.every((t) => !t.cell);
  const startHint = boardEmpty
    ? `<div class="sm-board-hint">Raahaa kirjaimia ruudukkoon ja kokoa niistä sanaristikko</div>`
    : "";
  // Näkymä (sm-viewport) rajaa ja vierittää; opaste on kääreen (sm-board-wrap) lapsi JA viewportin
  // SIBLING — EI vierittyvän viewportin sisällä, jotta se pysyy näkyvän alueen keskellä eikä
  // ankkuroidu vieritettyyn lautaan. sm-board suljetaan yllä, joten divit menevät tasan.
  return `<div class="sm-board-wrap"><div class="sm-viewport">${html}</div>${startHint}</div>`;
}

/** Vieritysasema joka keskittää annetun ruudun näkymään (zoom-off-tila). */
function cellCenterScroll(
  viewport: HTMLElement,
  board: HTMLElement,
  row: number,
  col: number,
): { left: number; top: number } {
  const cell = board.querySelector<HTMLElement>(`[data-cell="${cellKey(row, col)}"]`);
  if (!cell) return { left: 0, top: 0 };
  return {
    left: cell.offsetLeft + cell.offsetWidth / 2 - viewport.clientWidth / 2,
    top: cell.offsetTop + cell.offsetHeight / 2 - viewport.clientHeight / 2,
  };
}

/** Säätää viewScrollia minimaalisesti niin, että kursoriruutu pysyy näkyvissä (ei zoom). */
function keepCaretVisible(viewport: HTMLElement, board: HTMLElement): void {
  if (!caret || !viewScroll) return;
  const cell = board.querySelector<HTMLElement>(`[data-cell="${cellKey(caret.row, caret.col)}"]`);
  if (!cell) return;
  const pad = 8;
  const { offsetLeft: cl, offsetTop: ct, offsetWidth: cw, offsetHeight: ch } = cell;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if (cl < viewScroll.left + pad) viewScroll.left = cl - pad;
  else if (cl + cw > viewScroll.left + vw - pad) viewScroll.left = cl + cw - vw + pad;
  if (ct < viewScroll.top + pad) viewScroll.top = ct - pad;
  else if (ct + ch > viewScroll.top + vh - pad) viewScroll.top = ct + ch - vh + pad;
}

/**
 * Automaattinen kehystys: skaalaa + keskittää laudan niin, että asetetut nopat
 * (+ marginaali) täyttävät näkymän. Geometria mitataan offsetLeft/Top:lla (jättävät
 * transformin huomiotta).
 *
 * "Pidä kehys, kehystä vain kun tarpeen": jos kaikki asetetut nopat mahtuvat yhä
 * näkyviin nykyisellä kehyksellä, sitä EI lasketa uusiksi → lauta pysyy paikallaan
 * pudotusten välillä (ei levotonta hyppimistä). Vasta kun noppa lähestyy reunaa,
 * kehystetään uudelleen — silloin pehmeästi animoiden edellisestä kehyksestä.
 */
function frameBoard(): void {
  const viewport = root.querySelector<HTMLElement>(".sm-viewport");
  const board = root.querySelector<HTMLElement>(".sm-board");
  if (!viewport || !board) return;

  // Zoom pois käytöstä: ei skaalausta, näkymä vieritettävissä. Vieritysasema säilytetään
  // (render rakentaa DOM:in uusiksi), keskitetään kerran/heitto, ja näppäiltäessä
  // vieritetään kursori näkyviin — vieritys, EI zoom.
  if (!ZOOM_ENABLED) {
    board.style.transform = "none";
    // Tallenna käyttäjän oma vieritys (kerran per viewport-elementti).
    if (!viewport.dataset.scrollBound) {
      viewport.dataset.scrollBound = "1";
      viewport.addEventListener("scroll", () => {
        viewScroll = { left: viewport.scrollLeft, top: viewport.scrollTop };
      });
    }
    if (viewScroll === null) {
      viewScroll = cellCenterScroll(viewport, board, BOARD_MID, BOARD_MID); // keskitä aloitus
    } else if (kbdMode && caret && !roundOver) {
      keepCaretVisible(viewport, board); // pidä kirjoituskohta näkyvissä vierittämällä
    }
    viewport.scrollLeft = viewScroll.left; // selain rajaa kelvolliseen väliin
    viewport.scrollTop = viewScroll.top;
    return;
  }

  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if (vw === 0 || vh === 0) return;

  // Asetettujen noppien rajat (ilman marginaalia) = "sisältö", jonka pitää pysyä näkyvissä.
  const placed = tiles.filter((t) => t.cell).map((t) => parseKey(t.cell!));
  const mid = Math.floor(BOARD / 2);
  let cMinR: number, cMaxR: number, cMinC: number, cMaxC: number;
  if (placed.length === 0) {
    cMinR = cMinC = mid - 3;
    cMaxR = cMaxC = mid + 3; // tyhjänä: keskeinen 7×7
  } else {
    const rows = placed.map((p) => p.row);
    const cols = placed.map((p) => p.col);
    cMinR = Math.min(...rows);
    cMaxR = Math.max(...rows);
    cMinC = Math.min(...cols);
    cMaxC = Math.max(...cols);
  }

  // Näppäiltäessä kirjoituskohta (kursori) kuuluu näkyvään sisältöön: muuten kursori
  // karkaa reunan yli ja jokainen kirjain laukaisee yllättävän uudelleenkehystyksen
  // (etenkin kapealla näytöllä → "kohdistin hyppii"). Raahatessa kursoria ei huomioida.
  if (kbdMode && !roundOver && caret) {
    cMinR = Math.min(cMinR, caret.row);
    cMaxR = Math.max(cMaxR, caret.row);
    cMinC = Math.min(cMinC, caret.col);
    cMaxC = Math.max(cMaxC, caret.col);
  }

  // Mahtuuko sisältö yhä nykyisellä kehyksellä? Jos kyllä, pidä se (vain uudelleenaseta
  // transform tuoreelle DOM:lle ilman animaatiota) → ei hyppimistä.
  if (currentFrame) {
    const ctl = board.querySelector<HTMLElement>(`[data-cell="${cellKey(cMinR, cMinC)}"]`);
    const cbr = board.querySelector<HTMLElement>(`[data-cell="${cellKey(cMaxR, cMaxC)}"]`);
    if (ctl && cbr) {
      const { scale, tx, ty } = currentFrame;
      const pad = 6; // px-turvamarginaali reunaan
      const sx0 = ctl.offsetLeft * scale + tx;
      const sy0 = ctl.offsetTop * scale + ty;
      const sx1 = (cbr.offsetLeft + cbr.offsetWidth) * scale + tx;
      const sy1 = (cbr.offsetTop + cbr.offsetHeight) * scale + ty;
      if (sx0 >= pad && sy0 >= pad && sx1 <= vw - pad && sy1 <= vh - pad) {
        applyFrame(board, currentFrame, false);
        return;
      }
    }
  }

  // Kehystä uudelleen: sovita sisältö + marginaali näkymään.
  const minR = Math.max(0, cMinR - FRAME_MARGIN);
  const maxR = Math.min(BOARD - 1, cMaxR + FRAME_MARGIN);
  const minC = Math.max(0, cMinC - FRAME_MARGIN);
  const maxC = Math.min(BOARD - 1, cMaxC + FRAME_MARGIN);
  const tl = board.querySelector<HTMLElement>(`[data-cell="${cellKey(minR, minC)}"]`);
  const br = board.querySelector<HTMLElement>(`[data-cell="${cellKey(maxR, maxC)}"]`);
  if (!tl || !br) return;
  const boxLeft = tl.offsetLeft;
  const boxTop = tl.offsetTop;
  const boxW = br.offsetLeft + br.offsetWidth - boxLeft;
  const boxH = br.offsetTop + br.offsetHeight - boxTop;
  if (boxW <= 0 || boxH <= 0) return;

  const scale = Math.min(MAX_SCALE, vw / boxW, vh / boxH);
  const tx = (vw - boxW * scale) / 2 - boxLeft * scale;
  const ty = (vh - boxH * scale) / 2 - boxTop * scale;
  const next = { scale, tx, ty };
  // Animoi edellisestä kehyksestä uuteen (jos sellainen on); muuten aseta suoraan.
  applyFrame(board, next, currentFrame !== null);
  currentFrame = next;
}

/**
 * Asettaa kehyksen transformina. animate=true → animoi edellisestä kehyksestä
 * (lauta rakennetaan uudelleen joka renderissä, joten asetetaan ensin edellinen
 * arvo ja vasta seuraavassa framessa uusi, jotta CSS-transition käynnistyy).
 */
function applyFrame(
  board: HTMLElement,
  f: { scale: number; tx: number; ty: number },
  animate: boolean,
): void {
  const css = `translate(${f.tx}px, ${f.ty}px) scale(${f.scale})`;
  if (animate && currentFrame) {
    const p = currentFrame;
    board.style.transform = `translate(${p.tx}px, ${p.ty}px) scale(${p.scale})`;
    void board.offsetWidth; // pakota reflow → transition lähtee edellisestä arvosta
    requestAnimationFrame(() => {
      board.style.transform = css;
    });
  } else {
    board.style.transform = css;
  }
}

function rackHtml(): string {
  const order = rackOrder.length === tiles.length ? rackOrder : [...tiles.keys()];
  const rackDice = order.filter((die) => !tiles[die].cell);
  // Äänneryhmittäin: himmeä otsikko ennen kutakin ryhmää (konsonantit / vokaaliperheet).
  const grouped = rackSort === "aanne";
  let prevGroup = -1;
  const parts: string[] = [];
  for (const die of rackDice) {
    if (grouped) {
      const g = aanneGroup(die);
      if (g !== prevGroup) {
        parts.push(
          `<span class="sm-rack-glabel" data-short="${AANNE_SHORT[g]}">${AANNE_LABELS[g]}</span>`,
        );
        prevGroup = g;
      }
    }
    parts.push(`<div class="sm-slot">${tileHtml(tiles[die])}</div>`);
  }
  const tools = roundOver ? "" : rackToolsHtml();
  const head = roundOver ? "" : rackHeadHtml(rackDice.length);
  return `${tools}${head}<div class="sm-rack" data-rack="1">${parts.join("")}</div>`;
}

/** Telineen otsikko: nimi + montako noppaa vielä telineessä + raahausvihje. */
function rackHeadHtml(remaining: number): string {
  return `<div class="sm-rack-head">
    <span class="sm-rack-title">Telineesi</span>
    <span class="sm-rack-count">${remaining} jäljellä</span>
    <span class="sm-rack-drag">raahaa ruudukkoon</span>
  </div>`;
}

function rackToolsHtml(): string {
  const b = (key: string, label: string) =>
    `<button class="sm-tool${key === rackSort ? " sm-tool-active" : ""}" data-sort="${key}">${label}</button>`;
  return `<div class="sm-rack-tools">
    <span class="sm-tools-label">Järjestys:</span>
    ${b("abc", "Aakkoset")}${b("aanne", "Äänneryhmät")}
  </div>`;
}

// --- Telineen järjestely ---

const BACK_VOWELS = new Set(["a", "o", "u"]);
const NEUTRAL_VOWELS = new Set(["e", "i"]);
const FRONT_VOWELS = new Set(["ä", "ö", "y"]);

/** Nopan efektiivinen kirjain (jokerin valittu); null = valitsematon jokeri. */
function letterOf(t: Tile): string | null {
  if (t.face === JOKER) return t.letter === JOKER ? null : t.letter.toLowerCase();
  return t.face.toLowerCase();
}

function alphaKey(die: number): string {
  return letterOf(tiles[die]) ?? "￿"; // valitsematon jokeri viimeiseksi
}

function isVowel(ch: string): boolean {
  return BACK_VOWELS.has(ch) || NEUTRAL_VOWELS.has(ch) || FRONT_VOWELS.has(ch);
}

/** Äänneryhmä: konsonantit (0) → takavokaalit a,o,u (1) → neutraalit e,i (2)
 * → etuvokaalit ä,ö,y (3) → valitsematon jokeri (4). Yhdistää entisen
 * "Konsonantit"- ja "Vokaalisointu"-jaon: vokaaliperheet näkyvät erikseen, koska
 * taka- ja etuvokaalit eivät esiinny samassa suomalaisessa sanassa (vokaalisointu). */
function aanneGroup(die: number): number {
  const ch = letterOf(tiles[die]);
  if (ch === null) return 4; // jokeri viimeiseksi
  if (!isVowel(ch)) return 0; // konsonantit
  if (BACK_VOWELS.has(ch)) return 1;
  if (NEUTRAL_VOWELS.has(ch)) return 2;
  return 3; // etuvokaalit
}

const AANNE_LABELS: Record<number, string> = {
  0: "konsonantit",
  1: "takavokaalit",
  2: "neutraalit (e, i)",
  3: "etuvokaalit",
  4: "jokeri",
};

// Lyhyet otsikot puhelimelle (CSS vaihtaa nämä täysien tilalle ::before-pseudolla,
// jotta koko teline mahtuu ~2 riville). Vokaaliryhmät näytetään omilla kirjaimillaan
// — lyhyin JA intuitiivisin muoto (a·o·u = takavokaalit). Ks. styles.css .sm-rack-glabel. */
const AANNE_SHORT: Record<number, string> = {
  0: "kons.",
  1: "a·o·u",
  2: "e·i",
  3: "ä·ö·y",
  4: "★",
};

/** Telineen näkymäjärjestys valitulle moodille (deterministinen, ei satunnaisuutta). */
function computeRackOrder(key: string): number[] {
  const byAlpha = (a: number, b: number) => alphaKey(a).localeCompare(alphaKey(b), "fi");
  const order = [...tiles.keys()];
  if (key === "aanne") {
    return order.sort((a, b) => aanneGroup(a) - aanneGroup(b) || byAlpha(a, b));
  }
  return order.sort(byAlpha); // "abc" ja tuntemattomat → aakkoset
}

function applyRackSort(key: string): void {
  rackSort = key;
  saveSort(key); // valinta säilyy seuraaviin heittoihin
  rackOrder = computeRackOrder(key);
  render();
}

// --- Offline-haaste: monikierrosottelu, linkki kantaa tulokset ---

/** Hyväksyy joko pelkän siemenen tai koko linkin (#-jälkeinen osa). */
function parseSeed(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const hash = raw.indexOf("#");
  const s = hash >= 0 ? raw.slice(hash + 1) : raw;
  try {
    return decodeURIComponent(s).trim();
  } catch {
    return s.trim();
  }
}

// --- Nimimerkki (localStorage) ---
function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}
function saveName(n: string): void {
  myName = n;
  try {
    localStorage.setItem(NAME_KEY, n);
  } catch {
    /* yksityistila — nimi ei säily, peli toimii silti */
  }
}

// --- Ottelun kulku ---
function roundSeed(base: string, i: number): string {
  return `${base}.${i + 1}`;
}

function startMatch(rounds: number, base: string, premium: boolean, duration: number, opp?: Opp): void {
  match = { base, rounds, premium, duration, current: 0, myScores: [], myName, ...(opp ? { opp } : {}) };
  showChallenge = false;
  showMatchSummary = false;
  if (!opp) location.hash = ""; // haastaja aloittaa puhtaalta; vastaajan #c=… säilyy URL:ssa
  newRoll(roundSeed(base, 0));
}

/**
 * Aloittaa kaveri-teemahaasteen (Opi-moodi vaihe 2). Jaettu tavoitesetti `themes`
 * kulkee linkissä molemmille samana → reilu. Pisteet lasketaan silti (tasuri).
 * Esilataa analyysipaketin, jotta teemasirut syttyvät heti. Pistemoodi seuraa nykyistä.
 */
function startThemeMatch(rounds: number, base: string, themes: string[], opp?: Opp): void {
  match = {
    base,
    rounds,
    premium: premiumMode,
    duration: gameDuration,
    current: 0,
    myScores: [],
    myName,
    themes,
    myThemeHits: new Set(),
    ...(opp ? { opp } : {}),
  };
  showChallenge = false;
  showMatchSummary = false;
  if (!opp) location.hash = "";
  ensureLemmas(); // teemojen tunnistus vaatii analyysipaketin
  newRoll(roundSeed(base, 0));
}

function advanceMatch(): void {
  if (!match) return;
  match.current++;
  if (match.current < match.rounds) {
    newRoll(roundSeed(match.base, match.current));
  } else {
    showMatchSummary = true;
    render();
  }
}

function exitMatch(): void {
  match = null;
  showMatchSummary = false;
}

// --- Haastekoodaus (base64url JSON URL-hashiin: #c=…) ---
interface ChallengePayload {
  v: number;
  b: string; // perussiemen
  n: number; // kierrokset
  m?: 0 | 1; // pistemoodi: 1 = Scrabble (premium), 0/puuttuu = perinteinen Itu
  d?: number; // kierroskesto sekunteina (puuttuu/tuntematon → oletus 3 min)
  th?: string[]; // teemahaaste: jaetut tavoiteteemat (läsnä ⇒ kaveri-teemahaaste)
  a: { name: string; s: number[]; t: number; h?: string[] }; // haastaja (h=teemaosumat)
  r?: { name: string; s: number[]; t: number; h?: string[] }; // vastaaja (paluulinkissä)
}

function b64e(s: string): string {
  return btoa(encodeURIComponent(s)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64d(s: string): string {
  return decodeURIComponent(atob(s.replace(/-/g, "+").replace(/_/g, "/")));
}
function challengeLink(p: ChallengePayload): string {
  return `${location.origin}${location.pathname}#c=${b64e(JSON.stringify(p))}`;
}
function decodeChallenge(code: string): ChallengePayload | null {
  try {
    const p = JSON.parse(b64d(code)) as ChallengePayload;
    if (p && p.b && p.n && p.a && Array.isArray(p.a.s)) return p;
  } catch {
    /* viallinen koodi */
  }
  return null;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** Teemahaasteen osumat tavoitejärjestyksessä (tyhjä taulukko jätetään pois linkistä). */
function myThemeHitsList(m: Match): string[] | undefined {
  if (!m.themes) return undefined;
  return coveredTargets(m.themes, m.myThemeHits ?? new Set());
}
function myChallengeLink(): string {
  const m = match!;
  const h = myThemeHitsList(m);
  return challengeLink({
    v: 1,
    b: m.base,
    n: m.rounds,
    m: m.premium ? 1 : 0,
    d: m.duration,
    ...(m.themes ? { th: m.themes } : {}),
    a: { name: m.myName, s: m.myScores, t: sum(m.myScores), ...(h ? { h } : {}) },
  });
}
function myResultLink(): string {
  const m = match!;
  const h = myThemeHitsList(m);
  return challengeLink({
    v: 1,
    b: m.base,
    n: m.rounds,
    m: m.premium ? 1 : 0,
    d: m.duration,
    ...(m.themes ? { th: m.themes } : {}),
    a: {
      name: m.opp!.name,
      s: m.opp!.scores,
      t: sum(m.opp!.scores),
      ...(m.opp!.themeHits ? { h: m.opp!.themeHits } : {}),
    },
    r: { name: m.myName, s: m.myScores, t: sum(m.myScores), ...(h ? { h } : {}) },
  });
}

function shareLink(url: string, text: string): void {
  if (navigator.share) {
    navigator.share({ title: "Itu — haaste", text, url }).catch(() => {});
  } else {
    copyToClipboard(url);
  }
}

/** Saapuva haaste URL:sta: joko lopputulos (a+r) tai vastattava haaste (vain a). */
function handleIncoming(p: ChallengePayload): void {
  if (p.r) {
    match = {
      base: p.b,
      rounds: p.n,
      premium: p.m === 1,
      duration: coerceDuration(p.d),
      current: p.n,
      myScores: p.a.s,
      myName: p.a.name,
      opp: { name: p.r.name, scores: p.r.s, ...(p.r.h ? { themeHits: p.r.h } : {}) },
      final: true,
      ...(p.th ? { themes: p.th, myThemeHits: new Set(p.a.h ?? []) } : {}),
    };
    showMatchSummary = true;
    render();
  } else if (p.th) {
    // Kaveri-teemahaaste: vastaa jaettuun tavoitesettiin. Pistemoodi/kesto linkistä.
    premiumMode = p.m === 1;
    gameDuration = coerceDuration(p.d);
    startThemeMatch(p.n, p.b, p.th, { name: p.a.name, scores: p.a.s, ...(p.a.h ? { themeHits: p.a.h } : {}) });
  } else {
    startMatch(p.n, p.b, p.m === 1, coerceDuration(p.d), { name: p.a.name, scores: p.a.s });
  }
}

function challengeHtml(): string {
  const nameEsc = myName.replace(/"/g, "&quot;");
  const rounds = ROUND_OPTIONS.map(
    (n) =>
      `<button class="sm-tool sm-ch-rounds" data-rounds="${n}">${n === 1 ? "1 kierros" : `${n} kierrosta`}</button>`,
  ).join("");
  return `<div class="sm-ch-backdrop" data-ch-close="1">
    <div class="sm-ch">
      <h3>🎯 Haaste</h3>
      <section>
        <h4>Nimimerkki <span class="sm-ch-note">(valinnainen)</span></h4>
        <input id="sm-ch-name" class="sm-ch-link" maxlength="20" placeholder="Sinä" value="${nameEsc}" />
      </section>
      <section>
        <h4>Aloita haaste</h4>
        <p class="sm-ch-note">Pelaat valitun määrän kierroksia, sitten lähetät tuloslinkin kaverille. Hän pelaa samat heitot ${premiumMode ? "<b>Scrabble-pistemoodilla</b>" : "perinteisellä Itu-pisteytyksellä"} — näette kumpi voitti.${premiumMode ? "" : " (Vaihda pistemoodi ⚙️ Asetuksista ennen aloitusta.)"}</p>
        <div class="sm-ch-row sm-ch-wrap">${rounds}</div>
      </section>
      ${learnMode ? themeChallengeSectionHtml() : ""}
      <section>
        <h4>Vastaa haasteeseen</h4>
        <p class="sm-ch-note">Liitä saamasi haastelinkki (tai pelkkä siemen yksittäiseen peliin).</p>
        <div class="sm-ch-row">
          <input id="sm-ch-input" class="sm-ch-link" placeholder="Liitä linkki tai siemen" />
          <button id="sm-ch-open" class="sm-primary">Avaa</button>
        </div>
      </section>
      <button id="sm-ch-close" class="sm-ch-clear">Sulje</button>
    </div>
  </div>`;
}

/** Haaste-modaalin Teemahaaste-osio (vaihe 2, näkyy kun Opi-moodi on päällä).
 * Jaettu tavoitesetti = adaptiiviset teemat napsautettuna; sama linkki molemmille. */
function themeChallengeSectionHtml(): string {
  const targets = pickDuelThemes(learnProgress, dateKey(), DUEL_THEME_COUNT);
  // Modaalissa tilaa on → näytetään kuvaukset aina (mitä teemat tarkoittavat ennen aloitusta).
  const descs = learnDescListHtml(targets);
  const rounds = ROUND_OPTIONS.map(
    (n) =>
      `<button class="sm-tool sm-ch-th-rounds" data-rounds="${n}">${n === 1 ? "1 kierros" : `${n} kierrosta`}</button>`,
  ).join("");
  return `<section class="sm-ch-theme">
    <h4>🎯📚 Teemahaaste <span class="sm-ch-note">(Opi-moodi)</span></h4>
    <p class="sm-ch-note">Sama heitto JA sama kielioppi-tavoitesetti molemmille. Voittaja = kuka osui useampaan teemaan (pisteet ratkaisevat tasan). Tavoiteteemat:</p>
    ${descs}
    <div class="sm-ch-row sm-ch-wrap">${rounds}</div>
  </section>`;
}

/** Kierrosten välinen navigointi loppunäytössä (ottelutilassa). */
function matchNavHtml(): string {
  if (!match) return "";
  const i = match.current; // juuri pelattu kierros (0-pohjainen)
  const last = i + 1 >= match.rounds;
  const oppRound = match.opp ? match.opp.scores[i] : null;
  return `<div class="sm-match-nav">
    <span>Kierros ${i + 1}/${match.rounds}${oppRound != null ? ` · haastaja sai ${oppRound} p` : ""}</span>
    <button id="sm-next" class="sm-primary">${last ? "Näytä ottelun tulos →" : "Seuraava kierros →"}</button>
  </div>`;
}

/** Ottelun yhteenveto: kierrosrivit, yhteispisteet, voittaja + jako/paluulinkki. */
function renderMatchSummary(): void {
  const m = match!;
  const myTotal = sum(m.myScores);
  const opp = m.opp;
  const oppTotal = opp ? sum(opp.scores) : null;
  const myLabel = m.myName || "Sinä";
  const oppLabel = opp ? opp.name || "Haastaja" : null;

  const rows = Array.from({ length: m.rounds }, (_, i) => {
    const mine = m.myScores[i] ?? 0;
    const o = opp ? (opp.scores[i] ?? 0) : null;
    return `<tr><td>Kierros ${i + 1}</td><td>${mine}</td>${o != null ? `<td>${o}</td>` : ""}</tr>`;
  }).join("");

  let banner = "";
  if (oppTotal != null) {
    banner =
      myTotal > oppTotal
        ? `<p class="sm-record-banner">🏆 ${myLabel} voitti ${myTotal}–${oppTotal}!</p>`
        : myTotal < oppTotal
          ? `<p class="sm-record-banner">${oppLabel} voitti ${oppTotal}–${myTotal}.</p>`
          : `<p class="sm-record-banner">Tasapeli ${myTotal}–${oppTotal}!</p>`;
  }

  let share = "";
  if (!m.final) {
    const link = (opp ? myResultLink() : myChallengeLink()).replace(/"/g, "&quot;");
    const heading = opp ? "Lähetä tulos takaisin" : "Lähetä haaste kaverille";
    const note = opp
      ? "Näin haastaja näkee lopputuloksen."
      : `Hän pelaa samat ${m.rounds === 1 ? "kierroksen" : m.rounds + " kierrosta"} ja näkee tuloksesi.`;
    share = `<section>
      <h4>${heading}</h4>
      <p class="sm-ch-note">${note}</p>
      <input class="sm-ch-link" readonly value="${link}" />
      <div class="sm-ch-row">
        <button id="sm-ms-share" class="sm-primary">Jaa…</button>
        <button id="sm-ms-copy">Kopioi linkki</button>
      </div>
    </section>`;
  }

  root.innerHTML = `
    <div class="sm-bar">
      <button id="sm-ms-new" class="sm-primary">Uusi peli</button>
      <h2 class="sm-records-title">🎯 Ottelun tulos <small>(${m.rounds === 1 ? "1 kierros" : m.rounds + " kierrosta"} · ⏳ ${durationLabel(m.duration)}${m.premium ? " · 🟦 Scrabble" : ""})</small></h2>
    </div>
    <div class="sm-result sm-match-result">
      ${banner}
      <table class="sm-breakdown sm-match-table">
        <tr><td></td><td>${escapeHtml(myLabel)}</td>${oppLabel ? `<td>${escapeHtml(oppLabel)}</td>` : ""}</tr>
        ${rows}
        <tr class="sm-total"><td>Yhteensä</td><td>${myTotal}</td>${oppTotal != null ? `<td>${oppTotal}</td>` : ""}</tr>
      </table>
      ${share}
    </div>
  `;
  root.querySelector<HTMLButtonElement>("#sm-ms-new")!.onclick = () => {
    exitMatch();
    location.hash = "";
    newRoll(randomSeed());
  };
  const link = () => (opp ? myResultLink() : myChallengeLink());
  root.querySelector<HTMLButtonElement>("#sm-ms-share")?.addEventListener("click", () =>
    shareLink(link(), opp ? "Itu — tulokseni" : "Itu — haaste"),
  );
  root.querySelector<HTMLButtonElement>("#sm-ms-copy")?.addEventListener("click", (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    copyToClipboard(link());
    const o = btn.textContent;
    btn.textContent = "Kopioitu!";
    setTimeout(() => (btn.textContent = o), 1500);
  });
}

/** Kaveri-teemahaasteen (vaihe 2) loppunäyttö: jaetun tavoitesetin kattavuusvertailu.
 * Voittaja teemakattavuudesta (duelWinner), pisteet tasurina ja toissijaisena tietona. */
function renderThemeMatchSummary(): void {
  const m = match!;
  const themes = m.themes!;
  const opp = m.opp;
  const myHits = m.myThemeHits ?? new Set<string>();
  const oppHits = new Set(opp?.themeHits ?? []);
  const myCov = coveredTargets(themes, myHits).length;
  const oppCov = opp ? coveredTargets(themes, oppHits).length : null;
  const myTotal = sum(m.myScores);
  const oppTotal = opp ? sum(opp.scores) : null;
  const myLabel = m.myName || "Sinä";
  const oppLabel = opp ? opp.name || "Haastaja" : null;

  // Teemarivit: jokainen tavoiteteema + kummankin osuma (✓ / –).
  const cell = (hit: boolean) => (hit ? `<span class="sm-th-yes">✓</span>` : `<span class="sm-th-no">–</span>`);
  const themeRows = themes
    .map((id) => {
      const t = THEME_BY_ID[id];
      const label = escapeHtml(t?.label ?? id);
      const desc = escapeHtml(t?.describe ?? "");
      return `<tr><td title="${desc}">${label}</td><td>${cell(myHits.has(id))}</td>${
        opp ? `<td>${cell(oppHits.has(id))}</td>` : ""
      }</tr>`;
    })
    .join("");

  let banner = "";
  if (oppCov != null && oppTotal != null) {
    const w = duelWinner(myCov, oppCov, myTotal, oppTotal);
    const coverTie = myCov === oppCov; // kattavuus tasan → pisteet ratkaisivat voiton
    const n = themes.length;
    const winLabel = w === "a" ? myLabel : oppLabel!;
    if (w === "tie") {
      banner = `<p class="sm-record-banner">Tasapeli — molemmat ${myCov}/${n} teemaa, pisteet ${myTotal}–${oppTotal}.</p>`;
    } else if (coverTie) {
      // Sama teemakattavuus → pisteet ratkaisivat; älä väitä "useampaan teemaan".
      const ws = Math.max(myTotal, oppTotal);
      const ls = Math.min(myTotal, oppTotal);
      banner = `<p class="sm-record-banner">${w === "a" ? "🏆 " : ""}${escapeHtml(winLabel)} voitti pisteillä — molemmat ${myCov}/${n} teemaa, pisteet ${ws}–${ls}.</p>`;
    } else {
      const wc = Math.max(myCov, oppCov);
      const lc = Math.min(myCov, oppCov);
      banner = `<p class="sm-record-banner">${w === "a" ? "🏆 " : ""}${escapeHtml(winLabel)} osui useampaan teemaan — ${wc}/${n}–${lc}/${n}.</p>`;
    }
  } else {
    banner = `<p class="sm-record-banner">Osuit ${myCov}/${themes.length} teemaan. Lähetä haaste kaverille!</p>`;
  }

  let share = "";
  if (!m.final) {
    const link = (opp ? myResultLink() : myChallengeLink()).replace(/"/g, "&quot;");
    const heading = opp ? "Lähetä tulos takaisin" : "Lähetä teemahaaste kaverille";
    const note = opp
      ? "Näin haastaja näkee kumpi kattoi enemmän teemoja."
      : `Hän pelaa samat ${m.rounds === 1 ? "kierroksen" : m.rounds + " kierrosta"} ja samat tavoiteteemat — näette kumpi osui useampaan.`;
    share = `<section>
      <h4>${heading}</h4>
      <p class="sm-ch-note">${note}</p>
      <input class="sm-ch-link" readonly value="${link}" />
      <div class="sm-ch-row">
        <button id="sm-ms-share" class="sm-primary">Jaa…</button>
        <button id="sm-ms-copy">Kopioi linkki</button>
      </div>
    </section>`;
  }

  root.innerHTML = `
    <div class="sm-bar">
      <button id="sm-ms-new" class="sm-primary">Uusi peli</button>
      <h2 class="sm-records-title">🎯📚 Teemahaaste <small>(${m.rounds === 1 ? "1 kierros" : m.rounds + " kierrosta"} · ⏳ ${durationLabel(m.duration)}${m.premium ? " · 🟦 Scrabble" : ""})</small></h2>
    </div>
    <div class="sm-result sm-match-result">
      ${banner}
      <table class="sm-breakdown sm-match-table sm-th-table">
        <tr><td>Tavoiteteema</td><td>${escapeHtml(myLabel)}</td>${oppLabel ? `<td>${escapeHtml(oppLabel)}</td>` : ""}</tr>
        ${themeRows}
        <tr class="sm-total"><td>Kattavuus</td><td>${myCov}/${themes.length}</td>${oppCov != null ? `<td>${oppCov}/${themes.length}</td>` : ""}</tr>
        <tr class="sm-th-score"><td>Pisteet (tasuri)</td><td>${myTotal}</td>${oppTotal != null ? `<td>${oppTotal}</td>` : ""}</tr>
      </table>
      ${share}
    </div>
  `;
  root.querySelector<HTMLButtonElement>("#sm-ms-new")!.onclick = () => {
    exitMatch();
    location.hash = "";
    newRoll(randomSeed());
  };
  const link = () => (opp ? myResultLink() : myChallengeLink());
  root.querySelector<HTMLButtonElement>("#sm-ms-share")?.addEventListener("click", () =>
    shareLink(link(), opp ? "Itu — teematulokseni" : "Itu — teemahaaste"),
  );
  root.querySelector<HTMLButtonElement>("#sm-ms-copy")?.addEventListener("click", (e) => {
    const btn = e.currentTarget as HTMLButtonElement;
    copyToClipboard(link());
    const o = btn.textContent;
    btn.textContent = "Kopioitu!";
    setTimeout(() => (btn.textContent = o), 1500);
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function copyToClipboard(text: string): void {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text: string): void {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch {
    /* ei tuettu — käyttäjä voi kopioida kentästä käsin */
  }
  ta.remove();
}

function tileHtml(t: Tile): string {
  const isJoker = t.face === JOKER;
  const assigned = isJoker && t.letter !== JOKER;
  const glyph = isJoker ? (assigned ? t.letter.toUpperCase() : "◇") : t.face;
  // Jokerille, jolla on kirjain, pieni ◇-merkki → näkee että on jokeri ja sen voi vaihtaa.
  const mark = assigned ? `<span class="sm-joker-mark">◇</span>` : "";
  const liftedCls = t.dieIndex === lifted ? " sm-lifted" : "";
  // Jalometalli: arvoluokka väritystä varten (puu → kulta). Jokeri (arvo 0) jää neutraaliksi.
  const valCls = isJoker ? "" : ` sm-tval-${faceValue(t.face)}`;
  return `<div class="sm-tile${isJoker ? " sm-joker" : ""}${valCls}${liftedCls}"
    data-die="${t.dieIndex}">${glyph}${mark}<span class="sm-val">${faceValue(t.face) || ""}</span></div>`;
}

function wordsHtml(v: Validation): string {
  if (!v.words.length) return "";
  const items = v.words
    .map((w) => {
      if (w.valid) return `<span class="ok">${w.text}</span>`;
      // Elävä syy: erottaa "väärä kirjain" (ei pelin kirjaimistossa) ja "ei sanakirjassa".
      const badLetter = [...w.text].some((c) => !PLAY_LETTERS.includes(c));
      const reason = badLetter ? "väärä kirjain" : "ei sanakirjassa";
      return `<span class="bad">${w.text}<span class="sm-bad-why"> (${reason})</span></span>`;
    })
    .join(" · ");
  return `<p class="sm-words">Sanat: ${items}</p>`;
}

function wireEvents(): void {
  root.querySelector<HTMLButtonElement>("#sm-new")?.addEventListener("click", () =>
    newRoll(randomSeed()),
  );
  root.querySelector<HTMLButtonElement>("#sm-rules")!.onclick = () => {
    showRules = true;
    render();
  };
  root.querySelector<HTMLButtonElement>("#sm-lock")?.addEventListener("click", endRound);
  root.querySelector<HTMLButtonElement>("#sm-learn-info")?.addEventListener("click", () => {
    learnDescOpen = !learnDescOpen;
    render();
  });
  root.querySelector<HTMLButtonElement>("#sm-records")?.addEventListener("click", () => {
    // Avaa oletuksena juuri pelatun (tai aktiivisen) moodin + keston välilehdet.
    recordsTab = currentRecord ? currentRecord.mode : activePremium() ? "scrabble" : "itu";
    recordsDurationTab = currentRecord?.duration ?? activeDuration();
    showRecords = true;
    render();
  });
  root.querySelector<HTMLButtonElement>("#sm-checker")?.addEventListener("click", () => {
    showChecker = true;
    render();
  });
  root.querySelector<HTMLButtonElement>("#sm-settings")?.addEventListener("click", () => {
    showSettings = true;
    render();
  });

  // Offline-haaste: avaus + modaalin toiminnot (toimii myös loppunäytössä).
  root.querySelector<HTMLButtonElement>("#sm-challenge")?.addEventListener("click", () => {
    showChallenge = true;
    render();
  });
  const closeChallenge = () => {
    showChallenge = false;
    render();
  };
  root.querySelector<HTMLButtonElement>("#sm-ch-close")?.addEventListener("click", closeChallenge);
  root.querySelector<HTMLElement>(".sm-ch-backdrop")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeChallenge();
  });
  root.querySelector<HTMLInputElement>("#sm-ch-name")?.addEventListener("input", (e) => {
    saveName((e.target as HTMLInputElement).value.trim());
  });
  for (const b of root.querySelectorAll<HTMLElement>(".sm-ch-rounds")) {
    b.addEventListener("click", () =>
      startMatch(Number(b.dataset.rounds), randomSeed(), premiumMode, gameDuration),
    );
  }
  for (const b of root.querySelectorAll<HTMLElement>(".sm-ch-th-rounds")) {
    b.addEventListener("click", () =>
      startThemeMatch(
        Number(b.dataset.rounds),
        randomSeed(),
        pickDuelThemes(learnProgress, dateKey(), DUEL_THEME_COUNT),
      ),
    );
  }
  root.querySelector<HTMLButtonElement>("#sm-ch-open")?.addEventListener("click", () => {
    const raw = root.querySelector<HTMLInputElement>("#sm-ch-input")?.value ?? "";
    const cm = raw.match(/c=([A-Za-z0-9\-_]+)/);
    if (cm) {
      const p = decodeChallenge(cm[1]);
      if (p) {
        showChallenge = false;
        handleIncoming(p);
        return;
      }
    }
    const s = parseSeed(raw);
    if (s) {
      showChallenge = false;
      exitMatch();
      location.hash = encodeURIComponent(s);
      newRoll(s);
    }
  });
  root.querySelector<HTMLButtonElement>("#sm-next")?.addEventListener("click", advanceMatch);

  // Jokerin kirjainvalitsin (jos avoinna): kirjainnapit + sulkeminen taustaa klikkaamalla.
  for (const b of root.querySelectorAll<HTMLElement>("[data-jp]")) {
    b.addEventListener("click", () => pickJoker(b.dataset.jp!));
  }
  root.querySelector<HTMLElement>("[data-jp-close]")?.addEventListener("click", (e) => {
    if (e.target === e.currentTarget) {
      jokerPicker = null;
      render();
    }
  });

  // Kierroksen päätyttyä lauta on jäässä — ei raahausta eikä jokerin valintaa.
  if (roundOver) return;

  for (const btn of root.querySelectorAll<HTMLElement>("[data-sort]")) {
    btn.addEventListener("click", () => applyRackSort(btn.dataset.sort!));
  }
  for (const tileEl of root.querySelectorAll<HTMLElement>(".sm-tile")) {
    tileEl.addEventListener("pointerdown", (e) => onTilePointerDown(e, tileEl));
    // Hiiren oikea klikkaus laudalle asetetun nopan päällä poistaa sen telineeseen.
    tileEl.addEventListener("contextmenu", (e) => {
      const die = Number(tileEl.dataset.die);
      if (tiles[die]?.cell) {
        e.preventDefault();
        unplaceTile(die);
      }
    });
  }
  // Ruudun klikkaus asettaa kirjoituskursorin (näppäimistösyöttö).
  for (const cellEl of root.querySelectorAll<HTMLElement>(".sm-cell")) {
    cellEl.addEventListener("click", () => {
      if (drag) return; // raahauksen pudotus hoitaa oman renderinsä
      if (performance.now() < suppressCellClickUntil) {
        suppressCellClickUntil = 0; // nopan napautus hoiti tämän eleen jo
        return;
      }
      if (lifted !== null) {
        placeTile(lifted, cellEl.dataset.cell!); // napauta-ja-aseta (placeTile nollaa noston)
        return;
      }
      const { row, col } = parseKey(cellEl.dataset.cell!);
      setCaret(row, col);
    });
  }
}

// --- Osoitinraahaus (hiiri + kosketus) ---

function onTilePointerDown(e: PointerEvent, tileEl: HTMLElement): void {
  if (roundOver || drag) return;
  if (e.button !== 0) return; // vain ykköspainike/kosketus/kynä raahaa (oikea = poisto, ks. contextmenu)
  e.preventDefault();
  const die = Number(tileEl.dataset.die);
  drag = { die, tileEl, ghost: null, startX: e.clientX, startY: e.clientY, moved: false, hover: null };
  // Laudalla olevan nopan paikallaan painaminen = pitkä painallus → poisto telineeseen.
  if (tiles[die]?.cell) {
    drag.longPress = setTimeout(() => {
      if (!drag || drag.die !== die || drag.moved) return;
      drag.consumed = true; // pointerup ei enää käsittele napautusta
      teardownDrag();
      drag = null;
      unplaceTile(die);
    }, LONG_PRESS_MS);
  }
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
}

/** Luo kelluva haamulaatta (vasta kun raahaus oikeasti alkaa). */
function startGhost(): void {
  if (!drag || drag.ghost) return;
  kbdMode = false; // raahaus: kehystä ilman kursorinseurantaa (säilytä "ei hyppimistä")
  const tileEl = drag.tileEl;
  const size = tileEl.offsetWidth;
  const ghost = tileEl.cloneNode(true) as HTMLElement;
  ghost.classList.add("sm-ghost");
  ghost.style.width = `${size}px`;
  ghost.style.height = `${size}px`;
  document.body.appendChild(ghost);
  drag.ghost = ghost;
  tileEl.classList.add("sm-dragging");
}

function moveGhost(x: number, y: number): void {
  if (!drag?.ghost) return;
  const g = drag.ghost;
  g.style.left = `${x - g.offsetWidth / 2}px`;
  g.style.top = `${y - g.offsetHeight / 2}px`;
}

function setHover(el: HTMLElement | null): void {
  if (!drag || drag.hover === el) return;
  drag.hover?.classList.remove("sm-drop");
  el?.classList.add("sm-drop");
  drag.hover = el;
}

function onPointerMove(e: PointerEvent): void {
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6) {
    drag.moved = true;
    if (drag.longPress) clearTimeout(drag.longPress); // liike → ei pitkä painallus
    startGhost();
  }
  if (!drag.moved) return;
  moveGhost(e.clientX, e.clientY);
  const under = document.elementFromPoint(e.clientX, e.clientY);
  setHover(under?.closest<HTMLElement>(".sm-cell") ?? null);
}

function teardownDrag(): void {
  if (drag?.longPress) clearTimeout(drag.longPress);
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerCancel);
  drag?.hover?.classList.remove("sm-drop");
  drag?.ghost?.remove();
}

function onPointerUp(e: PointerEvent): void {
  if (!drag) return;
  const { die, moved, consumed } = drag;
  const x = e.clientX;
  const y = e.clientY;
  teardownDrag();
  drag = null;
  if (consumed) return; // pitkä painallus jo hoiti
  if (!moved) {
    onTileTap(die);
    return;
  }
  const under = document.elementFromPoint(x, y);
  const cell = under?.closest<HTMLElement>(".sm-cell");
  const rack = under?.closest<HTMLElement>(".sm-rack");
  if (cell) placeTile(die, cell.dataset.cell!);
  else if (rack) unplaceTile(die);
  else render(); // pudotettu muualle → palauta ennalleen
}

/** Nopan napautus (ei raahaus): nosto/asetus, jokerin valinta, kursori tai tuplanapautus-poisto. */
function onTileTap(die: number): void {
  const t = tiles[die];
  // Vain laudan noppa on .sm-cell:n sisällä → vaimenna sen synteettinen ruutuklikkaus.
  // Telineen nappula ei ole ruudussa, joten seuraava ruutuklikkaus jää koskemattomaksi.
  if (t.cell) suppressCellClickUntil = performance.now() + 350;
  // Nostettu nappula odottaa: napautus laudan nopan päälle = aseta sen ruutuun (vaihto);
  // telineen nopan napautus = vaihda/peru nosto.
  if (lifted !== null) {
    if (t.cell) placeTile(lifted, t.cell);
    else {
      lifted = lifted === die ? null : die;
      render();
    }
    return;
  }
  // Tuplanapautus laudan nopan päällä → poisto telineeseen.
  const now = performance.now();
  if (t.cell && lastTapDie === die && now - lastTapAt < DOUBLE_TAP_MS) {
    lastTapDie = -1;
    unplaceTile(die);
    return;
  }
  lastTapDie = die;
  lastTapAt = now;
  if (t.cell) {
    if (t.face === JOKER) assignJoker(t); // laudan jokeri: kirjainvalitsin
    else {
      const { row, col } = parseKey(t.cell);
      setCaret(row, col); // laudan noppa: aseta kirjoituskursori
    }
  } else {
    lifted = die; // telineen nappula: nosta (napauta-ja-aseta)
    render();
  }
}

function onPointerCancel(): void {
  teardownDrag();
  drag = null;
  render();
}

function placeTile(die: number, target: string): void {
  const dragged = tiles[die];
  recordHistory(die); // kumoa: muistiin ruutu ennen asetusta
  const occupant = tileAt(target);
  if (occupant && occupant.dieIndex !== dragged.dieIndex) {
    // Vaihda: kohteessa ollut noppa raahatun lähtöruutuun (tai telineeseen).
    occupant.cell = dragged.cell;
  }
  dragged.cell = target;
  lifted = null; // asetus kuluttaa mahdollisen noston
  render();
}

function unplaceTile(die: number): void {
  recordHistory(die); // kumoa: muistiin ruutu ennen poistoa
  tiles[die].cell = null;
  render();
}

/** Tallenna nopan nykyinen ruutu kumoa-pinoon ennen muutosta. */
function recordHistory(die: number): void {
  history.push({ die, prevCell: tiles[die].cell });
}

/** Ctrl+Z: peru viimeisin lautamuutos (asetus/siirto/poisto). */
function undoLast(): void {
  if (roundOver) return;
  const last = history.pop();
  if (!last) return;
  const t = tiles[last.die];
  // Näppäimistöllä asetettu jokeri vapautuu palatessaan telineeseen (kuten ⌫).
  if (last.prevCell === null && t.face === JOKER && t.locked) {
    t.letter = JOKER;
    t.locked = false;
  }
  t.cell = last.prevCell;
  render();
}

// --- Näppäimistösyöttö (kirjoita sanoja kursorin kohdalle) ---

const BOARD_MID = Math.floor(BOARD / 2);

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < BOARD && c >= 0 && c < BOARD;
}
function stepCell(r: number, c: number, dir: Dir, back = false): [number, number] {
  const d = back ? -1 : 1;
  return dir === "H" ? [r, c + d] : [r + d, c];
}

/** Klikkaus ruutuun: aseta kursori; sama ruutu uudelleen vaihtaa suunnan. */
function setCaret(row: number, col: number): void {
  if (roundOver) return;
  // Klikkaus EI saa liikuttaa näkymää: kursori ilmestyy juuri napautettuun ruutuun.
  // Vasta kirjoittaminen/nuolet kytkee kursorinseurannan (kbdMode) takaisin päälle.
  kbdMode = false;
  caret =
    caret && caret.row === row && caret.col === col
      ? { row, col, dir: caret.dir === "H" ? "V" : "H" }
      : { row, col, dir: caret?.dir ?? "H" };
  render();
}

/** Kirjoita kirjain kursorin kohdalle (telineestä; jokeri jos kirjainta ei ole). */
function typeAt(ch: string): void {
  if (roundOver) return;
  kbdMode = true;
  if (!caret) caret = { row: BOARD_MID, col: BOARD_MID, dir: "H" };
  // Ohita varatut ruudut → ensimmäinen tyhjä suunnassa.
  let { row, col } = caret;
  const dir = caret.dir;
  while (inBounds(row, col) && tileAt(cellKey(row, col))) {
    [row, col] = stepCell(row, col, dir);
  }
  if (!inBounds(row, col)) return;
  let die = tiles.findIndex((t) => !t.cell && letterOf(t) === ch);
  let asJoker = false;
  if (die < 0) {
    die = tiles.findIndex((t) => !t.cell && t.face === JOKER);
    asJoker = die >= 0;
  }
  if (die < 0) return; // ei sopivaa noppaa telineessä
  if (asJoker) {
    tiles[die].letter = ch;
    tiles[die].locked = true;
  }
  recordHistory(die); // kumoa: muistiin ruutu (null) ennen asetusta
  tiles[die].cell = cellKey(row, col);
  const [nr, nc] = stepCell(row, col, dir);
  caret = inBounds(nr, nc) ? { row: nr, col: nc, dir } : { row, col, dir };
  render();
}

/** Poistaa nopan laudalta telineeseen: kumoa-historia + näppäinjokerin vapautus. */
function releaseTile(t: Tile): void {
  recordHistory(t.dieIndex);
  if (t.face === JOKER && t.locked) {
    t.letter = JOKER;
    t.locked = false; // näppäimistöllä asetettu jokeri vapautuu auto-päättelyyn
  }
  t.cell = null;
}

/** Askelpalautin: tyhjennä aktiivinen ruutu jos varattu (keskeltä poisto), muuten
 * astu taakse ja poista edellinen (kirjoituksen perän poisto). */
function backspaceCaret(): void {
  if (roundOver || !caret) return;
  kbdMode = true;
  const dir = caret.dir;
  // Aktiivinen ruutu varattu → tyhjennä SE; kursori jää paikalleen (intuitiivinen).
  const here = tileAt(cellKey(caret.row, caret.col));
  if (here) {
    releaseTile(here);
    render();
    return;
  }
  // Aktiivinen ruutu tyhjä → astu taakse ja poista edellinen.
  const [pr, pc] = stepCell(caret.row, caret.col, dir, true);
  if (!inBounds(pr, pc)) return;
  const t = tileAt(cellKey(pr, pc));
  if (t) releaseTile(t);
  caret = { row: pr, col: pc, dir };
  render();
}

function arrowCaret(dir: Dir, back: boolean): void {
  if (roundOver) return;
  kbdMode = true;
  if (!caret) {
    caret = { row: BOARD_MID, col: BOARD_MID, dir };
  } else {
    const [nr, nc] = stepCell(caret.row, caret.col, dir, back);
    caret = inBounds(nr, nc) ? { row: nr, col: nc, dir } : { ...caret, dir };
  }
  render();
}

function toggleCaretDir(): void {
  if (roundOver) return;
  kbdMode = true;
  caret = caret
    ? { ...caret, dir: caret.dir === "H" ? "V" : "H" }
    : { row: BOARD_MID, col: BOARD_MID, dir: "H" };
  render();
}

/** Esc: sulje avoin modaali/näkymä tai peru pelinäkymän valinta. true = jotain tehtiin. */
function handleEscape(): boolean {
  if (jokerPicker !== null) {
    jokerPicker = null;
    render();
    return true;
  }
  if (showChallenge) {
    showChallenge = false;
    render();
    return true;
  }
  if (showRules || showRecords || showChecker || showSettings) {
    showRules = showRecords = showChecker = showSettings = false;
    render();
    return true;
  }
  if (lifted !== null) {
    lifted = null; // peru napauta-ja-aseta -nosto
    render();
    return true;
  }
  if (caret) {
    caret = null; // tyhjennä kirjoituskursori
    render();
    return true;
  }
  return false;
}

function onKeyDown(e: KeyboardEvent): void {
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return; // tekstikentät hoitavat omansa
  // Enter/väli kohdistetulle napille: anna napin toimia (ei pelilogiikkaa päälle).
  if ((e.key === "Enter" || e.key === " ") && tag === "BUTTON") return;

  // Esc toimii myös modaalin/loppunäytön päällä: sulje avoin kerros tai peru valinta.
  if (e.key === "Escape") {
    if (handleEscape()) e.preventDefault();
    return;
  }

  // Muut näppäimet vain pelinäkymässä (ei modaalien/loppunäytön päällä).
  if (
    roundOver ||
    showRules ||
    showRecords ||
    showChecker ||
    showSettings ||
    showMatchSummary ||
    showChallenge ||
    jokerPicker !== null
  )
    return;

  // Ctrl/Cmd+Z = kumoa viimeisin lautamuutos (ennen muuta modifier-suodatusta).
  if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "z" || e.key === "Z")) {
    e.preventDefault();
    undoLast();
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k === "Enter") {
    e.preventDefault();
    endRound(); // Lukitse
  } else if (k.length === 1 && PLAY_LETTERS.includes(k.toLowerCase())) {
    e.preventDefault();
    typeAt(k.toLowerCase());
  } else if (k === "Backspace") {
    e.preventDefault();
    backspaceCaret();
  } else if (k === "ArrowRight") {
    e.preventDefault();
    arrowCaret("H", false);
  } else if (k === "ArrowLeft") {
    e.preventDefault();
    arrowCaret("H", true);
  } else if (k === "ArrowDown") {
    e.preventDefault();
    arrowCaret("V", false);
  } else if (k === "ArrowUp") {
    e.preventDefault();
    arrowCaret("V", true);
  } else if (k === " " || k === "Tab") {
    e.preventDefault();
    toggleCaretDir();
  }
}

/** Napautus jokerille avaa inline-kirjainvalitsimen (kelvolliset korostettu). */
function assignJoker(t: Tile): void {
  jokerPicker = t.dieIndex;
  render();
}

/** Pelaajan valinta valitsimesta: "" = tyhjennä (anna auto-päättelyn hoitaa). */
function pickJoker(letter: string): void {
  const t = tiles.find((x) => x.dieIndex === jokerPicker);
  if (t) {
    if (letter === "") {
      t.letter = JOKER;
      t.locked = false; // takaisin auto-päättelyyn
    } else if (PLAY_LETTERS.includes(letter)) {
      t.letter = letter;
      t.locked = true; // pelaaja lukitsi
    }
  }
  jokerPicker = null;
  render();
}

function jokerPickerHtml(): string {
  const t = tiles.find((x) => x.dieIndex === jokerPicker);
  if (!t) return "";
  const valid = new Set(jokerCandidates(t));
  const cur = t.letter === JOKER ? null : t.letter;
  const btns = PLAY_LETTERS.map(
    (L) =>
      `<button class="sm-jp-letter${valid.has(L) ? " sm-jp-valid" : ""}${
        cur === L ? " sm-jp-cur" : ""
      }" data-jp="${L}">${L.toUpperCase()}</button>`,
  ).join("");
  const hint = valid.size
    ? "Korostetut kirjaimet tekevät sanasta kelvollisen."
    : "Mikään kirjain ei tee kaikista sanoista kelvollisia — valitse silti haluamasi.";
  return `<div class="sm-jp-backdrop" data-jp-close="1">
    <div class="sm-jp">
      <h3>Jokerin kirjain</h3>
      <p class="sm-jp-hint">${hint}</p>
      <div class="sm-jp-grid">${btns}</div>
      <button class="sm-jp-clear" data-jp="">◇ Tyhjennä — anna pelin valita</button>
    </div>
  </div>`;
}
