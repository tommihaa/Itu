// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// DAWG-lukija: nollaviiveinen jäsenyyskysely litteästä kaaritaulukosta
// (rakenne: ks. builder.ts encode/packEdge). Ei riippuvuuksia fs:ään.
import type { BuiltDawg, DawgMeta } from "./builder";

const LAST = 32;
const WORD_END = 64;
const TARGET_SHIFT = 128;

export class Dawg {
  private readonly edges: Uint32Array;
  private readonly rootFirst: number;
  private readonly charIndex: ReadonlyMap<string, number>;
  readonly meta: DawgMeta;

  constructor(built: BuiltDawg) {
    this.edges = built.edges;
    this.meta = built.meta;
    this.rootFirst = built.meta.rootFirst;
    this.charIndex = new Map([...built.meta.alphabet].map((c, i) => [c, i]));
  }

  /** Tosi, jos sana on sanakirjassa (täsmähaku, gemena). */
  has(word: string): boolean {
    if (word.length === 0) return false;
    let group = this.rootFirst;
    for (let i = 0; i < word.length; i++) {
      const ch = this.charIndex.get(word[i]);
      if (ch === undefined) return false; // kirjaimistoon kuulumaton merkki
      // Selaa solmun kaariryhmää kunnes kirjain löytyy tai ryhmä loppuu.
      let j = group;
      for (;;) {
        const e = this.edges[j];
        if ((e & 31) === ch) {
          if (i === word.length - 1) return (e & WORD_END) !== 0;
          const target = Math.floor(e / TARGET_SHIFT);
          if (target === 0) return false; // lehti, mutta kirjaimia jäljellä
          group = target;
          break;
        }
        if ((e & LAST) !== 0) return false; // ryhmän loppu, ei osumaa
        j++;
      }
    }
    return false;
  }

  /**
   * Kaikki sanakirjan sanat (pituus ≥2) jotka annetuista kirjaimista voi
   * muodostaa (multijoukko-osajoukko). Jokeri ("*" tms. kirjaimistoon kuulumaton)
   * toimii jokerina = mikä tahansa kirjain. DAWG karsii hakuavaruuden: vain
   * kelvolliset etuliitteet, joissa kirjaimet riittävät, etenevät.
   */
  wordsFromRack(rack: readonly string[]): string[] {
    const avail = new Map<number, number>(); // kirjainindeksi → määrä
    let jokers = 0;
    for (const f of rack) {
      const idx = this.charIndex.get(f.toLowerCase());
      if (idx === undefined) jokers++;
      else avail.set(idx, (avail.get(idx) ?? 0) + 1);
    }
    const alphabet = this.meta.alphabet;
    const found = new Set<string>();

    const walk = (group: number, word: string): void => {
      let j = group;
      for (;;) {
        const e = this.edges[j];
        const ch = e & 31;
        const have = avail.get(ch) ?? 0;
        if (have > 0 || jokers > 0) {
          const useJoker = have === 0;
          if (useJoker) jokers--;
          else avail.set(ch, have - 1);

          const next = word + alphabet[ch];
          if (next.length >= 2 && (e & WORD_END) !== 0) found.add(next);
          const target = Math.floor(e / TARGET_SHIFT);
          if (target !== 0) walk(target, next);

          if (useJoker) jokers++;
          else avail.set(ch, have);
        }
        if ((e & LAST) !== 0) break;
        j++;
      }
    };
    walk(this.rootFirst, "");
    return [...found];
  }
}
