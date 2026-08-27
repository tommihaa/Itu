# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Tommi Haanranta
# Mittaus: montako muotoa vapaat yhdyssanat (+Cmp) toisivat Itun sanastoon.
#
# Tämä ei ole FST-ajo vaan lemmaparien kombinatoriikkaa, ja se on siksi
# EKSAKTI koko sanastolle eikä otokseen perustuva arvio. Yhdyssana taipuu
# loppuosansa mukaan, joten muoto = etuosan perusmuoto + loppuosan taivutettu
# muoto. Nopilla on 13 ruutua, joten yhdistelmä kelpaa vain jos se mahtuu 13
# merkkiin: etuosan pituus rajaa loppuosan muodot.
#
# Ajo:  python -X utf8 build/mittaa_yhdyssanat.py
#
# Rajaukset, jotka tekevät luvusta alarajan eivätkä ylärajan:
#  - vain kaksiosaiset yhdyssanat (kolmiosaiset ovat aitoa suomea)
#  - etuosa perusmuodossa (genetiivialkuinen talonpoika jää pois)
#  - duplikaatteja ei poisteta, mutta samaan merkkijonoon osuvia pareja on vähän

import json
import re
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FORMS = ROOT / "data" / "wordforms.txt"
OUT = Path(__file__).resolve().parent / "mittaus"
MAX = 13
ALLOWED = re.compile(r"^[adeghijklmnoprstuvyäö]+$")

# lemma -> pituushistogrammi sen taivutetuista muodoista
hist: dict[str, list[int]] = defaultdict(lambda: [0] * (MAX + 1))
lemmat: set[str] = set()

with open(FORMS, encoding="utf-8") as f:
    for line in f:
        form, _, rest = line.rstrip("\n").partition("\t")
        if not rest:
            continue
        n = len(form)
        if n > MAX:
            continue
        for chunk in rest.split("|"):
            lemma = chunk.split("#")[0].lower()
            hist[lemma][n] += 1
            lemmat.add(lemma)

# S[k] = montako muotoa koko sanastossa on pituudeltaan enintään k
S = [0] * (MAX + 1)
for h in hist.values():
    run = 0
    for k in range(MAX + 1):
        run += h[k]
        S[k] += run

# Etuosaehdokkaat: lemmat jotka ovat nopilla kirjoitettavissa ja jättävät
# loppuosalle vähintään kaksi merkkiä.
etuosat = [w for w in lemmat if ALLOWED.match(w) and len(w) <= MAX - 2]
jakauma: dict[int, int] = defaultdict(int)
for w in etuosat:
    jakauma[len(w)] += 1

yhteensa = sum(n * S[MAX - pituus] for pituus, n in jakauma.items())

pohja = sum(sum(h) for h in hist.values())
uniikit = sum(1 for _ in open(FORMS, encoding="utf-8"))

tulos = {
    "lemmoja_sanastossa": len(lemmat),
    "uniikkeja_muotoja_nyt": uniikit,
    "lemma_muoto_pareja_nyt": pohja,
    "etuosaehdokkaita": len(etuosat),
    "etuosan_pituusjakauma": dict(sorted(jakauma.items())),
    "muotoja_enintaan_k_merkkia": {k: S[k] for k in range(2, MAX + 1)},
    "yhdyssanamuotoja_lisaa": yhteensa,
    "kerroin_nykyiseen": round(yhteensa / uniikit, 1),
}
OUT.mkdir(exist_ok=True)
(OUT / "yhdyssanat.json").write_text(json.dumps(tulos, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(tulos, ensure_ascii=False, indent=2))
