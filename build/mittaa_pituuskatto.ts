// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Mittaus: paljonko sanaston pituuskaton nosto (ilmaiskirjaimet-idea, ITU.md ›
// Jatkoideat) kasvattaisi pakattua DAWG:ia. Rakentaa DAWG:n katoilla 13/14/15
// suodatetuista listoista EIKÄ kirjoita public/dict/:iin, koska tuotantosanastoa
// ei saa ylikirjoittaa mittauksen vuoksi. Lähtölistat on suodatettu 27.8.2026
// katkaisemattoman generointiajon tuloksesta (4 813 874 uniikkia muotoa).
// Ajo: npx vite-node build/mittaa_pituuskatto.ts
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

const p13 = mittaa("forms_p13.txt");
const p14 = mittaa("forms_p14.txt");
const p15 = mittaa("forms_p15.txt");
const suhde = (a: number, b: number) => +(a / b).toFixed(3);
const tulos = {
  p13,
  p14,
  p15,
  kerroin_p14_vs_p13: { muotoja: suhde(p14.muotoja, p13.muotoja), dawg: suhde(p14.dawg_tavut, p13.dawg_tavut), dawg_gz: suhde(p14.dawg_gz_tavut, p13.dawg_gz_tavut) },
  kerroin_p15_vs_p13: { muotoja: suhde(p15.muotoja, p13.muotoja), dawg: suhde(p15.dawg_tavut, p13.dawg_tavut), dawg_gz: suhde(p15.dawg_gz_tavut, p13.dawg_gz_tavut) },
};
writeFileSync(resolve(DIR, "pituuskatto.json"), JSON.stringify(tulos, null, 2) + "\n");
console.log(JSON.stringify(tulos, null, 2));
