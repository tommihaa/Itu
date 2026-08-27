// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Muoto -> analyysit -haku Tarkastajaa varten ("talossa" -> [{lemma:"talo",
// code:"N+Sg+Ine"}]). Itsenäinen, front-coded + lohkoindeksoitu paketti
// (ks. build/build_lemmas.py): binäärihaku, LAZY-ladattu (vain kun Tarkastaja
// avataan), ei JS-bundleen. Analyysi = perusmuoto + morfologinen koodi, joka
// tulee samasta FST:stä joka muodon tuotti → auktoritatiivinen, ei arvaus.

const BASE = import.meta.env.BASE_URL ?? "/";

const TAB = 0x09;

/** Yksi pätevä tulkinta muodolle: perusmuoto + analyysikoodi (esim. "N+Sg+Ine"). */
export interface Analysis {
  lemma: string;
  code: string;
}

interface FormsMeta {
  version: string;
  count: number;
  blockSize: number;
  codeWidth: number; // 1 tai 2 tavua / koodi-indeksi
  codes: string[]; // indeksi -> koodimerkkijono
}
interface Restart {
  form: string;
  offset: number;
}

export class LemmaLookup {
  private dec = new TextDecoder();

  constructor(
    private bytes: Uint8Array,
    private restarts: Restart[],
    private blockSize: number,
    private codes: string[],
    private codeWidth: number,
  ) {}

  /** Jäsennä yksi entry annetusta tavupaikasta; palauta muoto, analyysit ja seuraava pos. */
  private parseEntry(pos: number, prevForm: string): { form: string; analyses: Analysis[]; pos: number } {
    const b = this.bytes;
    const fp = b[pos++];
    let s = pos;
    while (b[pos] !== TAB) pos++;
    const form = prevForm.slice(0, fp) + this.dec.decode(b.subarray(s, pos));
    pos++; // ohita \t
    const nLemmas = b[pos++];
    const analyses: Analysis[] = [];
    for (let i = 0; i < nLemmas; i++) {
      const lp = b[pos++];
      s = pos;
      while (b[pos] !== TAB) pos++;
      const lemma = form.slice(0, lp) + this.dec.decode(b.subarray(s, pos));
      pos++; // ohita \t
      const nCodes = b[pos++];
      for (let c = 0; c < nCodes; c++) {
        let idx = b[pos++];
        if (this.codeWidth === 2) idx |= b[pos++] << 8;
        analyses.push({ lemma, code: this.codes[idx] });
      }
    }
    return { form, analyses, pos };
  }

  /** Kaikki pätevät analyysit annetulle muodolle (gemena), tai [] jos ei löydy. */
  lookup(form: string): Analysis[] {
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
    if (blk < 0) return [];
    let pos = r[blk].offset;
    let prevForm = "";
    for (let i = 0; i < this.blockSize && pos < this.bytes.length; i++) {
      const e = this.parseEntry(pos, prevForm);
      if (e.form === form) return e.analyses;
      if (e.form > form) return []; // ohitettu (lajiteltu) → ei löydy
      prevForm = e.form;
      pos = e.pos;
    }
    return [];
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
function buildRestarts(bytes: Uint8Array, blockSize: number, codeWidth: number): Restart[] {
  const dec = new TextDecoder();
  const restarts: Restart[] = [];
  const n = bytes.length;
  let pos = 0;
  let idx = 0;
  let prevForm = "";
  while (pos < n) {
    const entryStart = pos;
    const fp = bytes[pos++];
    const s = pos;
    while (bytes[pos] !== TAB) pos++;
    const form = prevForm.slice(0, fp) + dec.decode(bytes.subarray(s, pos));
    pos++; // \t
    if (idx % blockSize === 0) restarts.push({ form, offset: entryStart });
    const nLemmas = bytes[pos++];
    for (let i = 0; i < nLemmas; i++) {
      pos++; // lemmaPrefixLen
      while (bytes[pos] !== TAB) pos++;
      pos++; // \t
      const nCodes = bytes[pos++];
      pos += nCodes * codeWidth;
    }
    prevForm = form;
    idx++;
  }
  return restarts;
}

let cached: Promise<LemmaLookup> | null = null;

/** Lataa analyysi-paketti (kerran; välimuistitettu). Heittää jos lataus epäonnistuu. */
export function loadLemmas(version = "forms-fi-v1"): Promise<LemmaLookup> {
  if (cached) return cached;
  cached = (async () => {
    const [metaRes, binRes] = await Promise.all([
      fetch(`${BASE}dict/${version}.meta.json`),
      fetch(`${BASE}dict/${version}.bin.gz`),
    ]);
    if (!metaRes.ok || !binRes.ok) throw new Error(`Analyysi-paketin lataus epäonnistui: ${version}`);
    const meta: FormsMeta = await metaRes.json();
    const bytes = await decompress(await binRes.arrayBuffer());
    return new LemmaLookup(bytes, buildRestarts(bytes, meta.blockSize, meta.codeWidth), meta.blockSize, meta.codes, meta.codeWidth);
  })();
  return cached;
}
