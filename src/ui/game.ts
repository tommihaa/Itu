// Ruudukko-UI: nopat raahataan telineestä lautaan ja toisiinsa ristikoksi.
// Live-validointi värittää sanat DAWG-tuomarilla. Pelilogiikka on domainissa
// (board.ts, scoring.ts); tämä on ohut näkymä- ja raahauskerros.
import { JOKER, LETTER_VALUES, type Face } from "../domain/dice";
import {
  faceValue,
  finalScore,
  GAME_DURATION_SECONDS,
  type ScoreBreakdown,
} from "../domain/scoring";
import { rollDice } from "../domain/roll";
import { createRng, randomSeed } from "../domain/rng";
import {
  cellKey,
  parseKey,
  extractWords,
  isConnected,
  type Cells,
  type PlacedTile,
} from "../domain/board";
import type { WordJudge } from "../dict/judge";
import { loadJudge } from "../dict/load";
import { loadLemmas, type LemmaLookup } from "../dict/lemmas";
import { renderRulesContent } from "../rules/view";

// Iso sisäinen lauta, jotta tila ei lopu kesken; näkymä kehystää käytetyn alueen.
const BOARD = 21;
// Automaattisen kehystyksen marginaali (ruutua käytetyn alueen ympärille) ja
// suurin sallittu zoom (ettei yksi noppa zoomaa liikaa).
const FRAME_MARGIN = 2;
const MAX_SCALE = 2.8;
// Aikabonus oletuksena päällä; asetukseksi (D) myöhemmin.
const TIME_BONUS_ENABLED = true;

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
let rackSort = "haro"; // aktiivinen järjestys (ryhmävälejä varten)
let seed = "";
let judge: WordJudge | null = null;
let root: HTMLElement;
let showRules = false;
let showChecker = false; // sanantarkistin (pelin ulkopuolinen "käykö sana")

// Opettavuus: muoto -> lemma (lazy-ladattu paketti, ks. dict/lemmas.ts).
let lemmas: LemmaLookup | null = null;
let lemmasLoading = false;
let endWords: string[] = []; // kierroksen kelvolliset sanat (loppunäytön perusmuodot)
let checkerRefresh: (() => void) | null = null; // tarkistimen tuloksen päivitys ilman renderiä
let jokerPicker: number | null = null; // avoinna olevan jokerin dieIndex (kirjainvalitsin)
let showChallenge = false; // offline-haastemodaali (aloita haaste / vastaa)

// --- Monikierroshaaste (offline, linkki kantaa tulokset 2-suuntaisesti) ---
const ROUND_OPTIONS = [1, 3, 5, 10];
const NAME_KEY = "itu:name";

/** Vastustajan tulokset (haasteessa toinen osapuoli). */
interface Opp {
  name: string;
  scores: number[];
}
interface Match {
  base: string; // perussiemen; kierroksen i siemen = roundSeed(base, i)
  rounds: number; // N kierrosta
  current: number; // 0-pohjainen nykyinen kierros
  myScores: number[]; // omat kierrospisteet
  myName: string;
  opp?: Opp; // läsnä kun vastaat haasteeseen tai katsot lopputulosta
  final?: boolean; // molemmat pelanneet → vain katselu (ei jako-osiota)
}
let match: Match | null = null;
let showMatchSummary = false;
let myName = loadName();

// Osoitinpohjainen raahaus (hiiri + kosketus). HTML5 DnD ei toimi mobiilissa,
// joten käytämme pointer-eventtejä + kelluvaa "haamulaattaa" molemmille.
interface Drag {
  die: number;
  ghost: HTMLElement;
  startX: number;
  startY: number;
  moved: boolean;
  hover: HTMLElement | null;
}
let drag: Drag | null = null;

// Näppäimistösyöttö: kirjoituskursori laudalla (suunta H/V). Drag toimii rinnalla.
type Dir = "H" | "V";
interface Caret {
  row: number;
  col: number;
  dir: Dir;
}
let caret: Caret | null = null;

// Kierroksen tila: ajastin loppuu hetkellä roundEndsAt; lukitus tai aika lopettaa.
let roundEndsAt = 0;
let roundOver = false;
let timerHandle: ReturnType<typeof setInterval> | undefined;
let endBreakdown: ScoreBreakdown | null = null;
let endRemaining = 0; // jäljellä ollut aika lukitushetkellä (näyttöä varten)

interface Suggestions {
  leftover: string[]; // käyttämättä jääneet kirjaimet
  withLeftover: string[]; // sanat jotka käyttävät jämäkirjaimia
  best: string[]; // pisimmät/arvokkaimmat sanat joita olisi voinut tehdä
}
let endSuggestions: Suggestions | null = null;

// --- Ennätykset (localStorage): top-10 tulosta + kunkin ruudukko ---
const RECORDS_KEY = "itu:records:v1";
const MAX_RECORDS = 10;

interface ScoreRecord {
  total: number;
  wordPoints: number;
  date: number; // Date.now()
  seed: string;
  words: string[]; // muodostetut kelvolliset sanat
  placed: { cell: string; face: Face; letter: Face }[]; // ruudukko (asetetut nopat)
}

let showRecords = false;
let lastRecordRank = 0; // tämän pelin sija top-10:ssä (0 = ei listalle)
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
  roundEndsAt = Date.now() + GAME_DURATION_SECONDS * 1000;
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
  endBreakdown = finalScore({
    wordPoints: v.wordPoints, // vain kelvolliset sanat
    unusedFaces: v.unusedFaces, // teline + laudalle jääneet ei-sanat (sama logiikka)
    secondsRemaining: endRemaining,
    timeBonusEnabled: TIME_BONUS_ENABLED,
  });
  computeSuggestions();
  recordResult(v);
  endWords = v.words.filter((w) => w.valid).map((w) => w.text);
  if (endWords.length) ensureLemmas(); // perusmuodot loppunäyttöön (lazy)
  if (match) match.myScores[match.current] = endBreakdown.total;
  render();
}

/** Tallentaa tuloksen ennätyslistalle (top-10) jos pisteet > 0; asettaa sijan. */
function recordResult(v: Validation): void {
  lastRecordRank = 0;
  currentRecord = null;
  if (!endBreakdown || endBreakdown.total <= 0) return;
  const rec: ScoreRecord = {
    total: endBreakdown.total,
    wordPoints: endBreakdown.wordPoints,
    date: Date.now(),
    seed,
    words: v.words.filter((w) => w.valid).map((w) => w.text),
    placed: tiles
      .filter((t) => t.cell)
      .map((t) => ({ cell: t.cell!, face: t.face, letter: t.letter })),
  };
  const recs = loadRecords();
  recs.push(rec);
  recs.sort((a, b) => b.total - a.total || a.date - b.date); // korkein ensin, tasapeli vanhin ensin
  const trimmed = recs.slice(0, MAX_RECORDS);
  const idx = trimmed.indexOf(rec);
  if (idx >= 0) {
    lastRecordRank = idx + 1;
    currentRecord = rec;
  }
  saveRecords(trimmed);
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
    if (!showRules) frameBoard();
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
  loadJudge()
    .then((j) => {
      judge = j;
      render();
    })
    .catch((e) => console.error("Sanaston lataus epäonnistui", e));
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
  // "Härö": nopat alustalle satunnaiseen järjestykseen, deterministisesti siemenestä.
  rackOrder = shuffled(createRng(`${s}:rack`));
  rackSort = "haro";
  lastRecordRank = 0;
  currentRecord = null;
  caret = { row: BOARD_MID, col: BOARD_MID, dir: "H" }; // valmis näppäimistösyöttöön
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
  words: { text: string; valid: boolean }[];
  /** Pisteet vain KELVOLLISista sanoista (risteysnoppa kahdesti). */
  wordPoints: number;
  /** Sakotettavat tahkot: telineessä TAI laudalla mutta ei missään kelvollisessa sanassa. */
  unusedFaces: Face[];
  /** Kierroksen aikainen näyttöpiste: wordPoints − käyttämättömät (ei aikabonusta). */
  total: number;
  invalidCount: number;
  connected: boolean;
}

function validate(): Validation {
  resolveJokers(); // jokerit saavat kirjaimensa ennen sanojen poimintaa
  const cells = buildCells();
  const words = extractWords(cells);
  const cellValid = new Map<string, boolean>();
  const wordResults: { text: string; valid: boolean }[] = [];
  let wordPoints = 0;
  let invalidCount = 0;

  // Tuottavat ruudut = kuuluvat ≥1 kelvolliseen sanaan (näiden nopat eivät ole sakkoa).
  const productiveCells = new Set<string>();

  for (const w of words) {
    const valid = judge ? judge.judge(w.text) === "valid" : false;
    if (!valid) invalidCount++;
    wordResults.push({ text: w.text, valid });
    for (const k of w.keys) {
      const prev = cellValid.get(k);
      cellValid.set(k, prev === undefined ? valid : prev && valid);
    }
    // Vain kelvolliset sanat kerryttävät pisteitä; risteysnoppa summautuu kahdesti
    // (kuuluu kahteen sanaan), mikä syntyy luonnostaan kun molemmat sanat ovat valideja.
    if (valid) {
      for (const k of w.keys) {
        wordPoints += faceValue(cells.get(k)!.face);
        productiveCells.add(k);
      }
    }
  }

  // Sakko: telineessä olevat JA laudalle asetetut jotka eivät ole missään
  // kelvollisessa sanassa (esim. kelvottoman "rut":n r ja u). Jokeri = 0 → ei sakkoa.
  const unusedFaces = tiles
    .filter((t) => !t.cell || !productiveCells.has(t.cell))
    .map((t) => t.face);

  const breakdown = finalScore({
    wordPoints,
    unusedFaces,
    secondsRemaining: 0,
    timeBonusEnabled: false,
  });

  return {
    cellValid,
    words: wordResults,
    wordPoints,
    unusedFaces,
    total: breakdown.total,
    invalidCount,
    connected: isConnected(cells),
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
  if (showMatchSummary) {
    renderMatchSummary();
    return;
  }
  const v = validate();
  const matchTag = match
    ? `<span class="sm-match-tag">🎯 Kierros ${match.current + 1}/${match.rounds}</span>`
    : "";
  root.innerHTML = `
    <header class="sm-head">
      <h1>Itu</h1>
      <span class="sm-seed">siemen: ${seed}</span>
      ${matchTag}
    </header>
    <div class="sm-bar">
      ${match ? "" : `<button id="sm-new" class="sm-primary">Heitä uudet</button>`}
      <button id="sm-rules">Säännöt</button>
      <button id="sm-checker">🔎 Tarkista</button>
      <button id="sm-records">🏆 Ennätykset</button>
      ${match ? "" : `<button id="sm-challenge">🎯 Haaste</button>`}
      ${roundOver ? "" : `<button id="sm-lock">Lukitse</button>`}
      ${roundOver ? "" : `<span class="sm-timer" id="sm-timer">${fmtTime(secondsLeft())}</span>`}
      <span class="sm-score">${
        roundOver ? "Kierros päättyi" : `Pisteet: <b>${v.total}</b>`
      }${v.invalidCount ? ` · ${v.invalidCount} kelvotonta` : ""}${
        !v.connected ? " · ristikko ei yhtenäinen" : ""
      }</span>
    </div>
    ${roundOver ? resultHtml() : ""}
    ${roundOver && match ? matchNavHtml() : ""}
    ${boardHtml(v)}
    ${roundOver ? "" : `<p class="sm-kbd-hint">Voit myös kirjoittaa: klikkaa ruutua ja näppäile sana (välilyönti vaihtaa suunnan ${caret?.dir === "V" ? "↓" : "→"}, ⌫ poistaa).</p>`}
    ${rackHtml()}
    ${wordsHtml(v)}
    ${judge ? "" : '<p class="sm-words pending">Ladataan sanastoa…</p>'}
    ${jokerPicker !== null ? jokerPickerHtml() : ""}
    ${showChallenge ? challengeHtml() : ""}
  `;
  wireEvents();
  frameBoard(); // automaattinen zoom/keskitys käytetyn alueen mukaan
}

function resultHtml(): string {
  if (!endBreakdown) return "";
  const b = endBreakdown;
  const reason = endRemaining > 0 ? "lukittu" : "aika loppui";
  const s = endSuggestions;
  const wordList = (words: string[]) =>
    words.map((w) => `<span class="sm-sug-word">${w}</span>`).join(" ");
  const sugHtml =
    s && (s.withLeftover.length || s.best.length)
      ? `<div class="sm-sug">
          ${
            s.leftover.length && s.withLeftover.length
              ? `<h3>Käyttämättä jäi <b>${s.leftover.map((c) => c.toUpperCase()).join(" ")}</b> — niillä olisi voinut tehdä</h3>
                 <p>${wordList(s.withLeftover)}</p>`
              : ""
          }
          <h3>Näillä kirjaimilla olisi voinut tehdä myös</h3>
          <p>${wordList(s.best)}</p>
        </div>`
      : "";

  const banner = lastRecordRank
    ? `<p class="sm-record-banner">🏆 ${
        lastRecordRank === 1
          ? "Uusi paras tulos!"
          : `Ennätyslistalle — sija ${lastRecordRank}.`
      }</p>`
    : "";

  // Omat sanat + perusmuodot (opettavuus): "väkeä — taivutusmuoto sanasta väki".
  const lemmaHtml = endWords.length
    ? `<div class="sm-sug sm-lemmas">
        <h3>Sanasi ja perusmuodot</h3>
        ${endWords
          .map((w) => {
            const note = lemmaNote(w);
            const tail = note ? ` <span class="sm-lemma">— ${note}</span>` : lemmasLoading ? " …" : "";
            return `<div class="sm-lemma-row"><b>${escapeHtml(w)}</b>${tail}</div>`;
          })
          .join("")}
      </div>`
    : "";

  return `<div class="sm-result">
    <h2>Lopputulos <small>(${reason})</small></h2>
    ${banner}
    <table class="sm-breakdown">
      <tr><td>Sanapisteet</td><td>${b.wordPoints}</td></tr>
      <tr><td>Käyttämättä jääneet nopat</td><td>−${b.unusedPenalty}</td></tr>
      <tr><td>Aikabonus${endRemaining > 0 ? ` (${endRemaining} s säästöön)` : ""}</td><td>+${b.timeBonus}</td></tr>
      <tr class="sm-total"><td>Yhteensä</td><td>${b.total}</td></tr>
    </table>
    ${lemmaHtml}
    ${sugHtml}
  </div>`;
}

/** Selkosäännöt — sama sisältö pelin sisällä ja tulosteessa (@media print). */
function renderRules(): void {
  root.innerHTML = `
    <div class="sm-bar sm-no-print">
      <button id="sm-rules-close">← Takaisin peliin</button>
      <button id="sm-rules-print" class="sm-primary">Tulosta</button>
    </div>
    ${renderRulesContent()}
  `;
  root.querySelector<HTMLButtonElement>("#sm-rules-close")!.onclick = () => {
    showRules = false;
    render();
  };
  root.querySelector<HTMLButtonElement>("#sm-rules-print")!.onclick = () => window.print();
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

/** Opettava selite: perusmuoto vai taivutusmuoto (ja minkä sanan). "" jos ei tietoa. */
function lemmaNote(word: string): string {
  if (!lemmas) return "";
  const lemma = lemmas.lookup(word);
  if (!lemma) return "";
  return lemma === word ? "perusmuoto" : `taivutusmuoto sanasta ${lemma}`;
}

/** Sanantarkistin: pelin ulkopuolinen "käykö sana" -haku (sama DAWG-tuomari). */
function renderChecker(): void {
  root.innerHTML = `
    <div class="sm-bar">
      <button id="sm-check-close">← Takaisin peliin</button>
      <h2 class="sm-records-title">🔎 Tarkista sana</h2>
    </div>
    <div class="sm-checker">
      <p class="sm-ch-note">Kokeile käykö jokin sana — esim. <b>rankin</b>, <b>rankkasi</b>, <b>kuusta</b>. Pelin sanakirja vastaa, samoin kuin pelissä.</p>
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
      const note = lemmaNote(w);
      const tail = note
        ? ` <span class="sm-lemma">— ${note}</span>`
        : lemmasLoading
          ? ` <span class="sm-lemma">…</span>`
          : "";
      result.innerHTML = `✓ ”${escapeHtml(w)}” kelpaa${tail}`;
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

/** 🏆-näkymä: top-10 tulokset, kukin oma ruudukko + sanat. */
function renderRecords(): void {
  const recs = loadRecords();
  const list = recs.length
    ? recs.map((r, i) => recordHtml(r, i + 1)).join("")
    : `<p class="sm-words pending">Ei vielä ennätyksiä — pelaa kierros ja lukitse tulos!</p>`;
  root.innerHTML = `
    <div class="sm-bar">
      <button id="sm-records-close">← Takaisin peliin</button>
      <h2 class="sm-records-title">🏆 Ennätykset</h2>
    </div>
    <div class="sm-records">${list}</div>
  `;
  root.querySelector<HTMLButtonElement>("#sm-records-close")!.onclick = () => {
    showRecords = false;
    render();
  };
}

function recordHtml(r: ScoreRecord, rank: number): string {
  const isCurrent = currentRecord !== null && r.date === currentRecord.date;
  const d = new Date(r.date);
  const date = `${d.getDate()}.${d.getMonth() + 1}.`;
  const words = r.words.map((w) => `<span class="sm-sug-word">${w}</span>`).join(" ");
  return `<div class="sm-record${isCurrent ? " sm-record-cur" : ""}">
    <div class="sm-record-head">
      <span class="sm-record-rank">${rank}.</span>
      <span class="sm-record-total">${r.total} p</span>
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

function boardHtml(v: Validation): string {
  let html = `<div class="sm-board" style="grid-template-columns:repeat(${BOARD},var(--cell))">`;
  for (let r = 0; r < BOARD; r++) {
    for (let c = 0; c < BOARD; c++) {
      const key = cellKey(r, c);
      const tile = tileAt(key);
      const valid = v.cellValid.get(key);
      const cls =
        valid === undefined ? "" : valid ? " sm-valid" : " sm-invalid";
      const isCaret = !roundOver && caret !== null && caret.row === r && caret.col === c;
      const caretCls = isCaret ? " sm-caret" : "";
      const inner = tile
        ? tileHtml(tile)
        : isCaret
          ? `<span class="sm-caret-arrow">${caret!.dir === "H" ? "→" : "↓"}</span>`
          : "";
      html += `<div class="sm-cell${cls}${caretCls}" data-cell="${key}">${inner}</div>`;
    }
  }
  // Näkymä (sm-viewport) rajaa; lauta (sm-board) skaalautuu sen sisällä, ks. frameBoard.
  return `<div class="sm-viewport">${html}</div></div>`;
}

/**
 * Automaattinen kehystys: skaalaa + keskittää laudan niin, että asetetut nopat
 * (+ marginaali) täyttävät näkymän. Geometria mitataan offsetLeft/Top:lla, jotka
 * jättävät nykyisen transformin huomiotta → uusi transform animoituu pehmeästi
 * vanhasta (CSS-transition). Kutsutaan renderin lopussa (= pudotuksen jälkeen).
 */
function frameBoard(): void {
  const viewport = root.querySelector<HTMLElement>(".sm-viewport");
  const board = root.querySelector<HTMLElement>(".sm-board");
  if (!viewport || !board) return;

  const placed = tiles.filter((t) => t.cell).map((t) => parseKey(t.cell!));
  const mid = Math.floor(BOARD / 2);
  let minR: number, maxR: number, minC: number, maxC: number;
  if (placed.length === 0) {
    minR = minC = mid - 3;
    maxR = maxC = mid + 3; // tyhjänä: keskeinen 7×7 zoomattuna
  } else {
    const rows = placed.map((p) => p.row);
    const cols = placed.map((p) => p.col);
    minR = Math.max(0, Math.min(...rows) - FRAME_MARGIN);
    maxR = Math.min(BOARD - 1, Math.max(...rows) + FRAME_MARGIN);
    minC = Math.max(0, Math.min(...cols) - FRAME_MARGIN);
    maxC = Math.min(BOARD - 1, Math.max(...cols) + FRAME_MARGIN);
  }

  const tl = board.querySelector<HTMLElement>(`[data-cell="${cellKey(minR, minC)}"]`);
  const br = board.querySelector<HTMLElement>(`[data-cell="${cellKey(maxR, maxC)}"]`);
  if (!tl || !br) return;
  const boxLeft = tl.offsetLeft;
  const boxTop = tl.offsetTop;
  const boxW = br.offsetLeft + br.offsetWidth - boxLeft;
  const boxH = br.offsetTop + br.offsetHeight - boxTop;
  const vw = viewport.clientWidth;
  const vh = viewport.clientHeight;
  if (boxW <= 0 || boxH <= 0 || vw === 0 || vh === 0) return;

  const scale = Math.min(MAX_SCALE, vw / boxW, vh / boxH);
  const tx = (vw - boxW * scale) / 2 - boxLeft * scale;
  const ty = (vh - boxH * scale) / 2 - boxTop * scale;
  board.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
}

function rackHtml(): string {
  const order = rackOrder.length === tiles.length ? rackOrder : [...tiles.keys()];
  const rackDice = order.filter((die) => !tiles[die].cell);
  // Ryhmittäin järjestettäessä (vokaalit/sointu/pisteet) pieni väli erottaa ryhmät.
  let prevGroup: number | null = null;
  const slots = rackDice
    .map((die, i) => {
      const g = rackGroupOf(die);
      const gap = i > 0 && g !== null && g !== prevGroup ? " sm-gap" : "";
      prevGroup = g;
      return `<div class="sm-slot${gap}">${tileHtml(tiles[die])}</div>`;
    })
    .join("");
  const tools = roundOver ? "" : rackToolsHtml();
  return `${tools}<div class="sm-rack" data-rack="1">${slots}</div>`;
}

/** Ryhmätunniste nykyiselle järjestykselle; null = ei ryhmittelyä (ei välejä). */
function rackGroupOf(die: number): number | null {
  switch (rackSort) {
    case "vow":
      return vowelGroup(die);
    case "harmony":
      return harmonyGroup(die);
    case "pts":
      return faceValue(tiles[die].face);
    default:
      return null; // haro, abc → yhtenäinen rivi
  }
}

function rackToolsHtml(): string {
  const b = (key: string, label: string) => `<button class="sm-tool" data-sort="${key}">${label}</button>`;
  return `<div class="sm-rack-tools">
    <span class="sm-tools-label">Järjestä:</span>
    ${b("haro", "Härö")}${b("abc", "Aakkoset")}${b("pts", "Pisteet")}${b("vow", "Vokaalit")}${b("harmony", "Vokaalisointu")}
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

function vowelGroup(die: number): number {
  const ch = letterOf(tiles[die]);
  if (ch === null) return 2; // jokeri
  return BACK_VOWELS.has(ch) || NEUTRAL_VOWELS.has(ch) || FRONT_VOWELS.has(ch) ? 0 : 1;
}

function harmonyGroup(die: number): number {
  const ch = letterOf(tiles[die]);
  if (ch === null) return 4; // jokeri
  if (BACK_VOWELS.has(ch)) return 0; // a o u
  if (NEUTRAL_VOWELS.has(ch)) return 1; // e i
  if (FRONT_VOWELS.has(ch)) return 2; // ä ö y
  return 3; // konsonantit
}

function shuffled(rand: () => number): number[] {
  const a = [...tiles.keys()];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function applyRackSort(key: string): void {
  rackSort = key;
  const byAlpha = (a: number, b: number) => alphaKey(a).localeCompare(alphaKey(b), "fi");
  const order = [...tiles.keys()];
  switch (key) {
    case "haro":
      rackOrder = shuffled(Math.random);
      break;
    case "abc":
      rackOrder = order.sort(byAlpha);
      break;
    case "pts":
      rackOrder = order.sort(
        (a, b) => faceValue(tiles[b].face) - faceValue(tiles[a].face) || byAlpha(a, b),
      );
      break;
    case "vow":
      rackOrder = order.sort((a, b) => vowelGroup(a) - vowelGroup(b) || byAlpha(a, b));
      break;
    case "harmony":
      rackOrder = order.sort((a, b) => harmonyGroup(a) - harmonyGroup(b) || byAlpha(a, b));
      break;
  }
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

function startMatch(rounds: number, base: string, opp?: Opp): void {
  match = { base, rounds, current: 0, myScores: [], myName, ...(opp ? { opp } : {}) };
  showChallenge = false;
  showMatchSummary = false;
  if (!opp) location.hash = ""; // haastaja aloittaa puhtaalta; vastaajan #c=… säilyy URL:ssa
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
  a: { name: string; s: number[]; t: number }; // haastaja
  r?: { name: string; s: number[]; t: number }; // vastaaja (paluulinkissä)
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

function myChallengeLink(): string {
  const m = match!;
  return challengeLink({
    v: 1,
    b: m.base,
    n: m.rounds,
    a: { name: m.myName, s: m.myScores, t: sum(m.myScores) },
  });
}
function myResultLink(): string {
  const m = match!;
  return challengeLink({
    v: 1,
    b: m.base,
    n: m.rounds,
    a: { name: m.opp!.name, s: m.opp!.scores, t: sum(m.opp!.scores) },
    r: { name: m.myName, s: m.myScores, t: sum(m.myScores) },
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
      current: p.n,
      myScores: p.a.s,
      myName: p.a.name,
      opp: { name: p.r.name, scores: p.r.s },
      final: true,
    };
    showMatchSummary = true;
    render();
  } else {
    startMatch(p.n, p.b, { name: p.a.name, scores: p.a.s });
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
        <p class="sm-ch-note">Pelaat valitun määrän kierroksia, sitten lähetät tuloslinkin kaverille. Hän pelaa samat heitot — näette kumpi voitti.</p>
        <div class="sm-ch-row sm-ch-wrap">${rounds}</div>
      </section>
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
      <h2 class="sm-records-title">🎯 Ottelun tulos <small>(${m.rounds === 1 ? "1 kierros" : m.rounds + " kierrosta"})</small></h2>
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
  return `<div class="sm-tile${isJoker ? " sm-joker" : ""}"
    data-die="${t.dieIndex}">${glyph}${mark}<span class="sm-val">${faceValue(t.face) || ""}</span></div>`;
}

function wordsHtml(v: Validation): string {
  if (!v.words.length) return "";
  const items = v.words
    .map((w) => `<span class="${w.valid ? "ok" : "bad"}">${w.text}</span>`)
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
  root.querySelector<HTMLButtonElement>("#sm-records")?.addEventListener("click", () => {
    showRecords = true;
    render();
  });
  root.querySelector<HTMLButtonElement>("#sm-checker")?.addEventListener("click", () => {
    showChecker = true;
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
    b.addEventListener("click", () => startMatch(Number(b.dataset.rounds), randomSeed()));
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
  }
  // Ruudun klikkaus asettaa kirjoituskursorin (näppäimistösyöttö).
  for (const cellEl of root.querySelectorAll<HTMLElement>(".sm-cell")) {
    cellEl.addEventListener("click", () => {
      if (drag) return; // raahauksen pudotus hoitaa oman renderinsä
      const { row, col } = parseKey(cellEl.dataset.cell!);
      setCaret(row, col);
    });
  }
}

// --- Osoitinraahaus (hiiri + kosketus) ---

function onTilePointerDown(e: PointerEvent, tileEl: HTMLElement): void {
  if (roundOver || drag) return;
  e.preventDefault();
  const size = tileEl.offsetWidth;
  const ghost = tileEl.cloneNode(true) as HTMLElement;
  ghost.classList.add("sm-ghost");
  ghost.style.width = `${size}px`;
  ghost.style.height = `${size}px`;
  document.body.appendChild(ghost);
  drag = {
    die: Number(tileEl.dataset.die),
    ghost,
    startX: e.clientX,
    startY: e.clientY,
    moved: false,
    hover: null,
  };
  moveGhost(e.clientX, e.clientY);
  tileEl.classList.add("sm-dragging");
  window.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
  window.addEventListener("pointercancel", onPointerCancel);
}

function moveGhost(x: number, y: number): void {
  if (!drag) return;
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
  }
  moveGhost(e.clientX, e.clientY);
  const under = document.elementFromPoint(e.clientX, e.clientY);
  setHover(drag.moved ? (under?.closest<HTMLElement>(".sm-cell") ?? null) : null);
}

function teardownDrag(): void {
  window.removeEventListener("pointermove", onPointerMove);
  window.removeEventListener("pointerup", onPointerUp);
  window.removeEventListener("pointercancel", onPointerCancel);
  drag?.hover?.classList.remove("sm-drop");
  drag?.ghost.remove();
}

function onPointerUp(e: PointerEvent): void {
  if (!drag) return;
  const { die, moved } = drag;
  const x = e.clientX;
  const y = e.clientY;
  teardownDrag();
  drag = null;
  const under = document.elementFromPoint(x, y);
  if (!moved) {
    // Napautus (ei raahaus): jokerin kirjaimen valinta.
    const t = tiles.find((tile) => tile.dieIndex === die);
    if (t && t.face === JOKER) assignJoker(t);
    else render(); // poista sm-dragging-luokka
    return;
  }
  const cell = under?.closest<HTMLElement>(".sm-cell");
  const rack = under?.closest<HTMLElement>(".sm-rack");
  if (cell) placeTile(die, cell.dataset.cell!);
  else if (rack) unplaceTile(die);
  else render(); // pudotettu muualle → palauta ennalleen
}

function onPointerCancel(): void {
  teardownDrag();
  drag = null;
  render();
}

function placeTile(die: number, target: string): void {
  const dragged = tiles[die];
  const occupant = tileAt(target);
  if (occupant && occupant.dieIndex !== dragged.dieIndex) {
    // Vaihda: kohteessa ollut noppa raahatun lähtöruutuun (tai telineeseen).
    occupant.cell = dragged.cell;
  }
  dragged.cell = target;
  render();
}

function unplaceTile(die: number): void {
  tiles[die].cell = null;
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
  caret =
    caret && caret.row === row && caret.col === col
      ? { row, col, dir: caret.dir === "H" ? "V" : "H" }
      : { row, col, dir: caret?.dir ?? "H" };
  render();
}

/** Kirjoita kirjain kursorin kohdalle (telineestä; jokeri jos kirjainta ei ole). */
function typeAt(ch: string): void {
  if (roundOver) return;
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
  tiles[die].cell = cellKey(row, col);
  const [nr, nc] = stepCell(row, col, dir);
  caret = inBounds(nr, nc) ? { row: nr, col: nc, dir } : { row, col, dir };
  render();
}

/** Askelpalautin: siirry taakse ja poista siellä oleva noppa telineeseen. */
function backspaceCaret(): void {
  if (roundOver || !caret) return;
  const dir = caret.dir;
  const [pr, pc] = stepCell(caret.row, caret.col, dir, true);
  if (!inBounds(pr, pc)) return;
  const t = tileAt(cellKey(pr, pc));
  if (t) {
    if (t.face === JOKER && t.locked) {
      t.letter = JOKER;
      t.locked = false; // näppäimistöllä asetettu jokeri vapautuu
    }
    t.cell = null;
  }
  caret = { row: pr, col: pc, dir };
  render();
}

function arrowCaret(dir: Dir, back: boolean): void {
  if (roundOver) return;
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
  caret = caret
    ? { ...caret, dir: caret.dir === "H" ? "V" : "H" }
    : { row: BOARD_MID, col: BOARD_MID, dir: "H" };
  render();
}

function onKeyDown(e: KeyboardEvent): void {
  // Vain pelinäkymässä; ei modaalien/loppunäytön päällä eikä tekstikentissä.
  if (roundOver || showRules || showRecords || showChecker || showMatchSummary || showChallenge)
    return;
  if (jokerPicker !== null) return;
  const tag = (e.target as HTMLElement | null)?.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const k = e.key;
  if (k.length === 1 && PLAY_LETTERS.includes(k.toLowerCase())) {
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
