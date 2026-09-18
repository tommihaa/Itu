"""Mittaus: kahdennukset sanaston muodoissa (ITU.md > Jatkoideat > Kahdennusnoppa, 18.9.2026).

Laskee build/mittaus/forms_p15.txt:sta (sanasto-fi-v2:n kaikki muodot, enintaan 15
kirjainta) kolme jakaumaa: kahdennuksia per muoto, sama 14-15 kirjaimen muodoista ja
kahdennukset kirjaimittain. "Kahdennus" on kaksi perakkaista samaa kirjainta; "aaa"
lasketaan yhdeksi, koska yksi noppa kattaa vain kaksi ruutua.

Vastaa kysymykseen "katto per sana": montako kahdennusta yksi sana voi enintaan tarvita.
Katto per ristikko mitataan ratkaisijalla (mittaa_kahdennus.ts), ei sanastosta.

Ajo: python build/mittaa_kahdennus_sanasto.py
"""
from __future__ import annotations

import collections
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
LAHDE = HERE / "mittaus" / "forms_p15.txt"
KOHDE = HERE / "mittaus" / "kahdennus_sanasto.json"

PARI = re.compile(r"(.)\1")


def main() -> None:
    per_muoto: collections.Counter[int] = collections.Counter()
    per_muoto_pitkat: collections.Counter[int] = collections.Counter()
    per_kirjain: collections.Counter[str] = collections.Counter()
    maksimi_per_pituus: dict[int, int] = {}
    n = 0
    with LAHDE.open(encoding="utf-8") as f:
        for rivi in f:
            w = rivi.strip()
            if not w:
                continue
            n += 1
            parit = PARI.findall(w)
            k = len(parit)
            per_muoto[k] += 1
            if len(w) >= 14:
                per_muoto_pitkat[k] += 1
            for c in parit:
                per_kirjain[c] += 1
            maksimi_per_pituus[len(w)] = max(maksimi_per_pituus.get(len(w), 0), k)

    def osuudet(c: collections.Counter[int]) -> dict[str, dict[str, float | int]]:
        tot = sum(c.values())
        return {str(k): {"muotoja": v, "osuus": round(100 * v / tot, 2)} for k, v in sorted(c.items())}

    kirj_tot = sum(per_kirjain.values())
    tulos = {
        "muotoja": n,
        "kahdennuksia_per_muoto": osuudet(per_muoto),
        "kahdennuksia_per_muoto_14_15": osuudet(per_muoto_pitkat),
        "kahdennukset_kirjaimittain": {
            c: {"muotoja": v, "osuus_kahdennuksista": round(100 * v / kirj_tot, 2)}
            for c, v in per_kirjain.most_common()
        },
        "maksimi_per_pituus": dict(sorted(maksimi_per_pituus.items())),
    }
    KOHDE.write_text(json.dumps(tulos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(tulos, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
