// Opi-moodi (adaptiivinen kielioppihaaste) — puhdas domain, ei DOM/localStorage.
//
// Teema = predikaatti FST-analyysikoodin yli (esim. "sisältääkö koodi tagin +Ine").
// Sama auktoritatiivinen lähde kuin Sanapoliisilla (lemmas.lookup → Analysis[]),
// joten EI hallusinaatiota: jos pelaaja muodosti laudalle inessiivin, koodissa on
// "Ine". Sijateemat johdetaan CASE_INFO:sta (morph.ts) → ei kahdenneta dataa;
// luku/aikamuoto/vertailu/partisiipit pieni lisätaulukko (design: OPIMOODI.md).
//
// Pelilogiikka/pisteytys koskematon: Opi-moodi vain LUKEE valmiit sanat ja kerää
// teemoja. Pehmeä (kerää, ei pakota), adaptiivinen päivähaaste, ei grindiä.
import { CASE_INFO } from "../dict/morph";
import type { Analysis } from "../dict/lemmas";

export type ThemeGroup = "case" | "number" | "tense" | "comparison" | "participle";

/** Yksi kielioppiteema = nimi + ryhmä + predikaatti analyysikoodille (Strategy). */
export interface GrammarTheme {
  id: string; // "ine", "pl", "prt", "comp", "prsprc", ...
  label: string; // "inessiivi", "monikko", ...
  group: ThemeGroup;
  describe: string; // selkoselite (sija: CASE_INFO.question; muut: lyhyt vihje)
  matches: (code: string) => boolean;
}

/** Täsmää, jos analyysikoodi ("N+Sg+Ine") sisältää tagin täytenä osana ("Ine").
 * Osa-merkkijonohaku olisi virhealtis (Par ⊄ Prt, Pl ⊄ Pl3), siksi token-vertailu. */
function tagMatcher(tag: string): (code: string) => boolean {
  return (code) => code.split("+").includes(tag);
}

// Sijateemat suoraan CASE_INFO:sta (14 sijaa). Selite = sijan vaikutuskysymys.
const CASE_THEMES: GrammarTheme[] = Object.entries(CASE_INFO).map(([key, info]) => ({
  id: key.toLowerCase(),
  label: info.term,
  group: "case",
  describe: info.question,
  matches: tagMatcher(key),
}));

// Muut teemat: luku + aikamuoto + vertailu + partisiipit. Tagit todennettu morph.ts:stä
// (NUMBER, TENSE, DEGREE, PARTICIPLE). Selitteet lyhyitä selkovihjeitä.
const EXTRA_THEMES: GrammarTheme[] = (
  [
    { id: "pl", label: "monikko", group: "number", tag: "Pl", describe: "monta (yks. → mon.)" },
    { id: "prt", label: "imperfekti", group: "tense", tag: "Prt", describe: "mennyt aika (-i-)" },
    { id: "comp", label: "vertailumuoto", group: "comparison", tag: "Comp", describe: "enemmän (-mpi)" },
    { id: "superl", label: "yliaste", group: "comparison", tag: "Superl", describe: "eniten (-in)" },
    { id: "prsprc", label: "1. partisiippi", group: "participle", tag: "PrsPrc", describe: "tekevä (-va/-vä)" },
    { id: "prfprc", label: "2. partisiippi", group: "participle", tag: "PrfPrc", describe: "tehnyt (-nut/-lut)" },
    { id: "agprc", label: "agenttipartisiippi", group: "participle", tag: "AgPrc", describe: "tekemä (-ma/-mä)" },
    { id: "negprc", label: "kieltopartisiippi", group: "participle", tag: "NegPrc", describe: "tekemätön (-maton)" },
  ] as const
).map((t) => ({
  id: t.id,
  label: t.label,
  group: t.group,
  describe: t.describe,
  matches: tagMatcher(t.tag),
}));

/** Kaikki tunnistettavat teemat (sijat + luku/aikamuoto/vertailu/partisiipit). */
export const THEMES: GrammarTheme[] = [...CASE_THEMES, ...EXTRA_THEMES];

export const THEME_BY_ID: Record<string, GrammarTheme> = Object.fromEntries(
  THEMES.map((t) => [t.id, t]),
);

/** Montako teemaa tarjotaan päivän haasteena (rajattu päiväsetti, ei grindi). */
export const DAILY_TARGET_COUNT = 3;
/** Löysä viikkokoonti: montako eri teemaa viikossa "riittää". Ei katkeava streak. */
export const WEEKLY_GOAL = 8;

/**
 * Mitkä teemat laudan kelvolliset sanat toteuttavat. Lenient homografeille: osuma
 * jos MIKÄ TAHANSA sanan analyysi täsmää (oppimismyönteinen, riittää v1:een).
 * `lookup` injektoidaan → puhdas, testattava ilman dataa.
 */
export function detectThemes(
  validWords: readonly string[],
  lookup: (w: string) => Analysis[],
): Set<string> {
  const hits = new Set<string>();
  for (const w of validWords) {
    for (const a of lookup(w)) {
      for (const t of THEMES) {
        if (!hits.has(t.id) && t.matches(a.code)) hits.add(t.id);
      }
    }
  }
  return hits;
}

/** Yhden teeman edistymä. `lastHit` = ISO-päivä "YYYY-MM-DD" (""=ei koskaan);
 * ISO-merkkijonot vertautuvat kronologisesti suoraan (< ja >=). */
export interface ThemeStat {
  seen: number; // montako kertaa tarjottu päivän tavoitteena
  hits: number; // montako kertaa osuttu KUN tarjottu (hits ≤ seen → osumasuhde ≤ 1)
  lastHit: string; // viimeisin osumapäivä (mikä tahansa, ei vain tarjottu)
}
export type LearnProgress = Record<string, ThemeStat>;

/** FNV-1a -merkkijonohajautus → determinististä päivärotaatiota tasapeleihin. */
function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Päivän adaptiiviset tavoitteet. Deterministinen `(progress, dateKey)`:sta → sama
 * päivä + sama edistymä = sama setti (appin uudelleenavaus ei sekoita). Priorisointi:
 * 1) koskaan tarjoamattomat, 2) matalin osumasuhde (mitä et osaa), 3) pisin aika
 * osumasta (kertaus), 4) päiväkohtainen hajautus (rotaatio tasapeleissä). Juuri
 * hallitut (korkea osumasuhde + tuore osuma) painuvat hännille → eivät toistu.
 */
export function pickDailyTargets(
  p: LearnProgress,
  dateKey: string,
  n: number = DAILY_TARGET_COUNT,
): string[] {
  const ids = THEMES.map((t) => t.id);
  ids.sort((a, b) => {
    const sa = p[a];
    const sb = p[b];
    const seenA = sa?.seen ?? 0;
    const seenB = sb?.seen ?? 0;
    // 1. koskaan tarjoamattomat ensin
    if ((seenA === 0) !== (seenB === 0)) return seenA === 0 ? -1 : 1;
    // 2. matalin osumasuhde ensin (vain jos molempia on tarjottu)
    if (seenA > 0 && seenB > 0) {
      const ra = sa!.hits / seenA;
      const rb = sb!.hits / seenB;
      if (ra !== rb) return ra - rb;
    }
    // 3. vanhin osuma ensin ("" = ei koskaan = vanhin)
    const la = sa?.lastHit ?? "";
    const lb = sb?.lastHit ?? "";
    if (la !== lb) return la < lb ? -1 : 1;
    // 4. determ. päivärotaatio
    return strHash(dateKey + a) - strHash(dateKey + b);
  });
  return ids.slice(0, Math.max(0, n));
}

/** Viikon koonti: montako eri teemaa on osuttu `weekStartKey`:n (ISO-päivä) jälkeen. */
export function weeklyProgress(
  p: LearnProgress,
  weekStartKey: string,
): { covered: number; goal: number } {
  let covered = 0;
  for (const t of THEMES) {
    const st = p[t.id];
    if (st && st.lastHit && st.lastHit >= weekStartKey) covered++;
  }
  return { covered, goal: WEEKLY_GOAL };
}

/**
 * Päivittää edistymän kierroksen jälkeen (puhdas, ei mutatoi `prev`:iä). Tarjotuille
 * teemoille seen++ (ja hits++/lastHit jos osuttu); muut osutut teemat päivittävät vain
 * lastHit:n (viikkokoontiin). → osumasuhde pysyy ≤ 1.
 */
export function recordThemeSession(
  prev: LearnProgress,
  offered: readonly string[],
  achieved: ReadonlySet<string>,
  dateKey: string,
): LearnProgress {
  const next: LearnProgress = { ...prev };
  const stat = (id: string): ThemeStat => {
    const s = next[id];
    return s ? { ...s } : { seen: 0, hits: 0, lastHit: "" };
  };
  for (const id of offered) {
    const st = stat(id);
    st.seen++;
    if (achieved.has(id)) {
      st.hits++;
      st.lastHit = dateKey;
    }
    next[id] = st;
  }
  for (const id of achieved) {
    if (offered.includes(id)) continue; // tarjottu jo käsitelty
    const st = stat(id);
    st.lastHit = dateKey;
    next[id] = st;
  }
  return next;
}

/** Paikallinen ISO-päiväavain "YYYY-MM-DD" (oletus tänään, paikallinen aikavyöhyke). */
export function dateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Viikon (maanantai) aloituspäivän ISO-avain. */
export function weekStartKey(d: Date = new Date()): string {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // maanantai = 0
  x.setDate(x.getDate() - dow);
  return dateKey(x);
}
