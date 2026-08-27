// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Pakkaa muotolistan minimoiduksi DAWG:ksi, jonka selain lataa.
// Ajo:  npx vite-node build/build_dawg.ts [lähdetiedosto]
//   - oletus: data/wordforms.txt (valmis ajo)
//   - voi antaa myös data/wordforms.partial.txt (kesken oleva checkpoint) →
//     väliaikainen osasanasto pelattavaksi ennen täyden ajon valmistumista.
// Tulos: public/dict/<versio>.dawg (binääri, Uint32 LE) + <versio>.meta.json
//
// Rivi: "muoto<TAB>lemma[,lemma…]" (partial: yksi lemma/rivi → muotoja toistuu).
// Tässä käytetään vain muotoa (DAWG:n avain) ja DEDUPATAAN. Lemmat (opettavuus)
// paketoidaan myöhemmin erikseen.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDawg, DAWG_VERSION } from "../src/dict/builder";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(ROOT, "data", "wordforms.txt");
const OUT_DIR = resolve(ROOT, "public", "dict");

const raw = readFileSync(SOURCE, "utf8");
const unique = new Set<string>();
for (const line of raw.split("\n")) {
  const form = line.replace(/\r$/, "").split("\t")[0];
  if (form) unique.add(form);
}
// Rakentaja vaatii lajitellun, uniikin syötteen.
const forms = [...unique].sort();
console.log(`Lähde: ${SOURCE}\nUniikkeja muotoja: ${forms.length}`);

const { edges, meta } = buildDawg(forms);

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, `${DAWG_VERSION}.dawg`), Buffer.from(edges.buffer));
writeFileSync(resolve(OUT_DIR, `${DAWG_VERSION}.meta.json`), JSON.stringify(meta, null, 2) + "\n");

const bytes = edges.byteLength;
console.log(
  `DAWG valmis: ${meta.wordCount} muotoa, ${meta.nodeCount} solmua, ` +
    `${meta.edgeCount} kaarta, ${(bytes / 1024).toFixed(0)} kB ` +
    `(${(bytes / Math.max(1, meta.wordCount)).toFixed(1)} tavua/muoto)`,
);
