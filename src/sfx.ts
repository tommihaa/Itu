// Kevyt SFX-moduuli: Web Audio -synteesillä, ei äänitiedostoja. Sama suunnittelu-
// kuvio kuin Superjatsissa (src/ui/sfx.ts) ja Jaossa (src/shared/audio.js) — kolme
// erillistä toteutusta, ei jaettua koodia (eri build-tooling per projekti).
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

/** Torviääneke: kaksi hieman eri viritettyä sahalaita-oskillaattoria alipäästö-
 *  suodattimen läpi + lyhyt attack-ramppi (vaskimainen sointi). Sama resepti kuin
 *  Superjatsin/Jaon horn() — käytetään harvinaisiin, juhlaviin hetkiin (ennätys). */
function horn(freq: number, { at = 0, dur = 0.3, gain = 0.13 }: { at?: number; dur?: number; gain?: number } = {}): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const g = c.createGain();
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(freq * 4, t0);
  g.gain.setValueAtTime(0.001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.04);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  for (const detuneCents of [0, 6]) {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, t0);
    osc.detune.setValueAtTime(detuneCents, t0);
    osc.connect(lp);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
  lp.connect(g).connect(c.destination);
}

/** Kantele-nypäisy: Karplus-Strong-synteesi (nypätty kieli). Kohinapurske
 *  syötetään DelayNode-silmukkaan, jonka paluuhaarassa alipäästösuodin tummentaa
 *  sointia joka kierroksella ja gain (~0.98) hidastaa häipymää — sama resepti kuin
 *  Superjatsin/Jaon kantele(). Käytetään toistuviin, arkisiin tapahtumiin
 *  (kirjaimen asetus/poisto laudalla). */
function kantele(freq: number, { at = 0, dur = 0.5, gain = 0.14 }: { at?: number; dur?: number; gain?: number } = {}): void {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + at;
  const period = 1 / freq;
  const bufferSize = Math.max(2, Math.round(c.sampleRate * period));
  const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;
  const delay = c.createDelay(1);
  delay.delayTime.setValueAtTime(period, t0);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(freq * 3, t0);
  const feedback = c.createGain();
  feedback.gain.setValueAtTime(0.98, t0);
  const out = c.createGain();
  out.gain.setValueAtTime(gain, t0);
  out.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  src.connect(delay);
  delay.connect(lp);
  lp.connect(feedback);
  feedback.connect(delay); // silmukka: kieli soi kunnes gain vaimentaa sen
  delay.connect(out).connect(c.destination);
  src.start(t0);

  setTimeout(
    () => {
      [src, delay, lp, feedback, out].forEach((n) => n.disconnect());
    },
    (dur + at + 0.15) * 1000,
  );
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
