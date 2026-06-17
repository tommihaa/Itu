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
let jokerPicker: number | null = null; // avoinna olevan jokerin dieIndex (kirjainvalitsin)

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
    unusedFaces: tiles.filter((t) => !t.cell).map((t) => t.face),
    secondsRemaining: endRemaining,
    timeBonusEnabled: TIME_BONUS_ENABLED,
  });
  computeSuggestions();
  recordResult(v);
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
  // Siemen URL-hashista (#siemen) jos annettu → deterministinen, jaettava heitto.
  const hashSeed = decodeURIComponent(location.hash.replace(/^#/, ""));
  newRoll(hashSeed || randomSeed());
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
      for (const k of w.keys) wordPoints += faceValue(cells.get(k)!.face);
    }
  }

  const breakdown = finalScore({
    wordPoints,
    unusedFaces: tiles.filter((t) => !t.cell).map((t) => t.face),
    secondsRemaining: 0,
    timeBonusEnabled: false,
  });

  return {
    cellValid,
    words: wordResults,
    wordPoints,
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
  const v = validate();
  root.innerHTML = `
    <header class="sm-head">
      <h1>Itu</h1>
      <span class="sm-seed">siemen: ${seed}</span>
    </header>
    <div class="sm-bar">
      <button id="sm-new" class="sm-primary">Heitä uudet</button>
      <button id="sm-rules">Säännöt</button>
      <button id="sm-records">🏆 Ennätykset</button>
      ${roundOver ? "" : `<button id="sm-lock">Lukitse</button>`}
      ${roundOver ? "" : `<span class="sm-timer" id="sm-timer">${fmtTime(secondsLeft())}</span>`}
      <span class="sm-score">${
        roundOver ? "Kierros päättyi" : `Pisteet: <b>${v.total}</b>`
      }${v.invalidCount ? ` · ${v.invalidCount} kelvotonta` : ""}${
        !v.connected ? " · ristikko ei yhtenäinen" : ""
      }</span>
    </div>
    ${roundOver ? resultHtml() : ""}
    ${boardHtml(v)}
    ${rackHtml()}
    ${wordsHtml(v)}
    ${judge ? "" : '<p class="sm-words pending">Ladataan sanastoa…</p>'}
    ${jokerPicker !== null ? jokerPickerHtml() : ""}
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

  return `<div class="sm-result">
    <h2>Lopputulos <small>(${reason})</small></h2>
    ${banner}
    <table class="sm-breakdown">
      <tr><td>Sanapisteet</td><td>${b.wordPoints}</td></tr>
      <tr><td>Käyttämättä jääneet nopat</td><td>−${b.unusedPenalty}</td></tr>
      <tr><td>Aikabonus${endRemaining > 0 ? ` (${endRemaining} s säästöön)` : ""}</td><td>+${b.timeBonus}</td></tr>
      <tr class="sm-total"><td>Yhteensä</td><td>${b.total}</td></tr>
    </table>
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
      html += `<div class="sm-cell${cls}" data-cell="${key}">${
        tile ? tileHtml(tile) : ""
      }</div>`;
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
  root.querySelector<HTMLButtonElement>("#sm-new")!.onclick = () => newRoll(randomSeed());
  root.querySelector<HTMLButtonElement>("#sm-rules")!.onclick = () => {
    showRules = true;
    render();
  };
  root.querySelector<HTMLButtonElement>("#sm-lock")?.addEventListener("click", endRound);
  root.querySelector<HTMLButtonElement>("#sm-records")?.addEventListener("click", () => {
    showRecords = true;
    render();
  });

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

  for (const btn of root.querySelectorAll<HTMLElement>(".sm-tool")) {
    btn.addEventListener("click", () => applyRackSort(btn.dataset.sort!));
  }
  for (const tileEl of root.querySelectorAll<HTMLElement>(".sm-tile")) {
    tileEl.addEventListener("pointerdown", (e) => onTilePointerDown(e, tileEl));
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
