// Kevyt SFX-moduuli. Torvi & kantele -teema (7.7.2026 jälkeen) käyttää kahta
// oikeaa äänitiedostoa (ks. `public/sfx/CREDITS.md`) — synteesiversio (sahalaita+
// alipäästö / Karplus-Strong) kuulosti käyttäjän mukaan "80-luvun tietokonepelin
// latausäänille", ei oikealta soittimelta. Sama suunnittelukuvio kuin Superjatsissa
// (src/ui/sfx.ts) ja Jaossa (src/shared/audio.js) — kolme erillistä toteutusta,
// ei jaettua koodia (eri build-tooling per projekti).
//
// Itussa on vain YKSI teema (torvi & kantele) toisin kuin kahdessa muussa pelissä,
// koska Itussa ei ollut ääntä ennestään: kytkin on siis pelkkä päälle/pois.
// Oletus POIS — pelirauha-periaate (ks. ITU.md) koskee oletustilaa, ei kieltoa.
//
// Äänisuunnittelu: näppäilyn/raahauksen tapahtumat (kirjaimen asetus/poisto)
// ovat pieniä ja hiljaisia — niitä soi kymmeniä kertoja per kierros. Harvinaiset
// hetket (kierroksen lukitus, ennätys) saavat olla näyttävämpiä.

let ctx: AudioContext | null = null;
let on = false;

export function setSfxEnabled(v: boolean): void {
  on = v;
  ensureSamplesLoaded();
}

function ac(): AudioContext | null {
  if (!on) return null;
  if (!ctx) {
    if (typeof AudioContext === "undefined") return null;
    ctx = new AudioContext();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Yksi äänilähde useammalle sävelkorkeudelle: nauhoitettu näyte + sen mitattu
 *  perustaajuus. `playSample` valitsee lähimmän ankkurin ja pitch-shiftaa vain
 *  jäljelle jäävän, kuulolle luontevan välin — ei koko pelin sävelalaa yhdestä
 *  näytteestä (kuulostaisi "possulta" ääripäissä). */
interface SampleAnchor {
  freq: number;
  url: string;
  buffer: AudioBuffer | null;
}

/** Aito 5-kielinen kantele (Tommin oma, DIY-rakennelma) — Wikimedia Commons,
 *  "DIY kantele sample raw.ogg", CC0 1.0. */
const kanteleAnchors: SampleAnchor[] = [
  { freq: 121.2, url: "/sfx/kantele-low.wav", buffer: null },
  { freq: 457.1, url: "/sfx/kantele-high.wav", buffer: null },
];

/** Oikea käyrätorvi — University of Iowa Electronic Music Studios (MIS),
 *  Horn.mf.C4B4.aiff, vapaasti käytettävissä ilman rajoituksia. */
const hornAnchors: SampleAnchor[] = [
  { freq: 311.1, url: "/sfx/horn-low.wav", buffer: null },
  { freq: 495.5, url: "/sfx/horn-high.wav", buffer: null },
];

let samplesRequested = false;

/** Lataa & dekoodaa neljä näytettä kun äänet kytketään päälle — ei ennen sitä. */
function ensureSamplesLoaded(): void {
  if (samplesRequested || !on) return;
  samplesRequested = true;
  const c = ac();
  if (!c) return;
  for (const anchor of [...kanteleAnchors, ...hornAnchors]) {
    fetch(anchor.url)
      .then((res) => res.arrayBuffer())
      .then((data) => c.decodeAudioData(data))
      .then((buf) => {
        anchor.buffer = buf;
      })
      .catch(() => {
        /* verkko/selainvirhe: näyte jää soittamatta, ei kaada muuta äänentoistoa */
      });
  }
}

function pickAnchor(anchors: SampleAnchor[], targetFreq: number): SampleAnchor | null {
  let best: SampleAnchor | null = null;
  let bestDist = Infinity;
  for (const a of anchors) {
    if (!a.buffer) continue;
    const dist = Math.abs(Math.log2(targetFreq / a.freq));
    if (dist < bestDist) {
      bestDist = dist;
      best = a;
    }
  }
  return best;
}

/** Soittaa lähimmän näyteankkurin pitch-shiftattuna kohdetaajuuteen. Verhokäyrä
 *  (gain-node) toimii kuten aiemmin synteesissä — se rajaa äänen keston `dur`:iin
 *  riippumatta näytteen omasta luonnollisesta häipymästä. */
function playSample(anchors: SampleAnchor[], freq: number, { at = 0, dur = 0.3, gain = 0.12 }: { at?: number; dur?: number; gain?: number } = {}): void {
  const c = ac();
  if (!c) return;
  const anchor = pickAnchor(anchors, freq);
  if (!anchor || !anchor.buffer) return;
  const t0 = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = anchor.buffer;
  src.playbackRate.value = freq / anchor.freq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.1);
}

/** Torvi: aito käyrätorvinäyte pitch-shiftattuna (ks. hornAnchors). Käytetään
 *  harvinaisiin, juhlaviin hetkiin (ennätys). */
function horn(freq: number, opts: { at?: number; dur?: number; gain?: number } = {}): void {
  playSample(hornAnchors, freq, { dur: 0.3, gain: 0.13, ...opts });
}

/** Kantele-nypäisy: aito kantelenäyte pitch-shiftattuna (ks. kanteleAnchors).
 *  Käytetään toistuviin, arkisiin tapahtumiin (kirjaimen asetus/poisto laudalla). */
function kantele(freq: number, opts: { at?: number; dur?: number; gain?: number } = {}): void {
  playSample(kanteleAnchors, freq, { dur: 0.5, gain: 0.14, ...opts });
}

export const sfx = {
  /** Noppien heitto (uusi kierros): kevyt kantele-ropina, kolme nopeaa nypäisyä. */
  roll(): void {
    [523, 587, 659].forEach((f, i) => kantele(f, { at: i * 0.05, dur: 0.3, gain: 0.1 }));
  },

  /** Nopan asetus laudalle: yksittäinen hiljainen kantele-nypäisy (kymmeniä per kierros). */
  place(): void {
    kantele(784, { dur: 0.18, gain: 0.07 });
  },

  /** Nopan poisto laudalta: sama nypäisy matalampana. */
  unplace(): void {
    kantele(587, { dur: 0.18, gain: 0.06 });
  },

  /** Kierros lukittu (käsin tai ajan loputtua): toteava kantele-sointu. */
  lock(): void {
    [440, 554, 659].forEach((f, i) => kantele(f, { at: i * 0.08, dur: 0.6, gain: 0.12 }));
  },

  /** Uusi henkilökohtainen ennätys listalla: torvifanfaari (harvinainen, juhlava). */
  record(): void {
    [523, 659, 784, 1047].forEach((f, i) => horn(f, { at: i * 0.1, dur: 0.28 }));
  },

  /** Opi-moodin päivätavoite osui tällä kierroksella: kevyt ylöspäin kimaltava kantele. */
  learnGoal(): void {
    [659, 880, 1175].forEach((f, i) => kantele(f, { at: i * 0.07, dur: 0.4, gain: 0.09 }));
  },
};
