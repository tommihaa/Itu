// Muoto -> lemma -haku opettavuutta varten ("väkeä" -> "väki"). Itsenäinen,
// front-coded + lohkoindeksoitu paketti (ks. build/build_lemmas.py): binäärihaku,
// LAZY-ladattu (vain kun opettavuus/tarkistin avataan), ei JS-bundleen.

const BASE = import.meta.env.BASE_URL ?? "/";

interface LemmaMeta {
  version: string;
  count: number;
  blockSize: number;
}
interface Restart {
  form: string;
  offset: number;
}

const TAB = 0x09;
const NL = 0x0a;

export class LemmaLookup {
  private dec = new TextDecoder();

  constructor(
    private bytes: Uint8Array,
    private restarts: Restart[],
    private blockSize: number,
  ) {}

  /** Lemma annetulle muodolle (gemena), tai null jos ei löydy. */
  lookup(form: string): string | null {
    const r = this.restarts;
    // Suurin restart-lohko jonka ensimmäinen muoto <= haettava.
    let lo = 0;
    let hi = r.length - 1;
    let blk = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (r[mid].form <= form) {
        blk = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (blk < 0) return null;
    const b = this.bytes;
    let pos = r[blk].offset;
    let prevForm = "";
    for (let i = 0; i < this.blockSize && pos < b.length; i++) {
      const fp = b[pos++];
      let s = pos;
      while (b[pos] !== TAB) pos++;
      const f = prevForm.slice(0, fp) + this.dec.decode(b.subarray(s, pos));
      pos++; // ohita \t
      const lp = b[pos++];
      s = pos;
      while (b[pos] !== NL) pos++;
      const lemma = f.slice(0, lp) + this.dec.decode(b.subarray(s, pos));
      pos++; // ohita \n
      if (f === form) return lemma;
      if (f > form) return null; // ohitettu (lajiteltu) → ei löydy
      prevForm = f;
    }
    return null;
  }
}

/** Purkaa gzip jos host ei jo purkanut (tunnista 1f 8b -magic). */
async function decompress(buf: ArrayBuffer): Promise<Uint8Array> {
  const u = new Uint8Array(buf);
  if (u.length >= 2 && u[0] === 0x1f && u[1] === 0x8b) {
    const stream = new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return u;
}

/** Skannaa kerran → restart-lohkojen (ensimmäinen muoto + tavuoffset) indeksi. */
function buildRestarts(bytes: Uint8Array, blockSize: number): Restart[] {
  const dec = new TextDecoder();
  const restarts: Restart[] = [];
  const n = bytes.length;
  let pos = 0;
  let idx = 0;
  while (pos < n) {
    const entryStart = pos;
    pos++; // fp (restartissa 0 → muoto = suffix)
    const s = pos;
    while (bytes[pos] !== TAB) pos++;
    if (idx % blockSize === 0) {
      restarts.push({ form: dec.decode(bytes.subarray(s, pos)), offset: entryStart });
    }
    pos++; // \t
    pos++; // lp
    while (bytes[pos] !== NL) pos++;
    pos++; // \n
    idx++;
  }
  return restarts;
}

let cached: Promise<LemmaLookup> | null = null;

/** Lataa lemma-paketti (kerran; välimuistitettu). Heittää jos lataus epäonnistuu. */
export function loadLemmas(version = "lemmas-fi-v1"): Promise<LemmaLookup> {
  if (cached) return cached;
  cached = (async () => {
    const [metaRes, binRes] = await Promise.all([
      fetch(`${BASE}dict/${version}.meta.json`),
      fetch(`${BASE}dict/${version}.bin.gz`),
    ]);
    if (!metaRes.ok || !binRes.ok) throw new Error(`Lemma-paketin lataus epäonnistui: ${version}`);
    const meta: LemmaMeta = await metaRes.json();
    const bytes = await decompress(await binRes.arrayBuffer());
    return new LemmaLookup(bytes, buildRestarts(bytes, meta.blockSize), meta.blockSize);
  })();
  return cached;
}
