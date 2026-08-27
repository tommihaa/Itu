// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Mittaus: paljonko affiksit kasvattaisivat pakattua DAWG:ia.
// Rakentaa DAWG:n otoksen kahdesta muotolistasta EIKÄ kirjoita public/dict/:iin,
// koska tuotantosanastoa ei saa ylikirjoittaa mittauksen vuoksi.
// Ajo: npx vite-node build/mittaa_dawg.ts
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { buildDawg } from "../src/dict/builder";

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "mittaus");

function mittaa(nimi: string) {
  const rivit = readFileSync(resolve(DIR, nimi), "utf8").split(/\r?\n/);
  const forms = [...new Set(rivit.map((r) => r.trim()).filter(Boolean))].sort();
  const { edges, meta } = buildDawg(forms);
  return {
    muotoja: forms.length,
    solmuja: meta.nodeCount,
    dawg_tavut: edges.byteLength,
    dawg_gz_tavut: gzipSync(Buffer.from(edges.buffer)).byteLength,
  };
}

const base = mittaa("forms_base.txt");
const affix = mittaa("forms_affix.txt");
const tulos = {
  base,
  affix,
  kerroin_muotoja: +(affix.muotoja / base.muotoja).toFixed(3),
  kerroin_dawg: +(affix.dawg_tavut / base.dawg_tavut).toFixed(3),
  kerroin_dawg_gz: +(affix.dawg_gz_tavut / base.dawg_gz_tavut).toFixed(3),
};
writeFileSync(resolve(DIR, "dawg.json"), JSON.stringify(tulos, null, 2) + "\n");
console.log(JSON.stringify(tulos, null, 2));
