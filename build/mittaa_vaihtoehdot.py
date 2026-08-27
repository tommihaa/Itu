# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Tommi Haanranta
# Mittaus: montako sanaa yhdestä heitosta on pelattavissa, nyt ja affiksien kanssa.
#
# Tämä on kohdan 30 toinen pelattavuusluku ja eri kysymys kuin
# mittaa_pelattavuus.py: siellä mitataan kuinka usein satunnainen asettelu
# kelpaa, tässä kuinka monta kelvollista sanaa heitosta ylipäätään löytyy.
# Jälkimmäinen on se jota "ristikon rakentaminen lakkaa olemasta valinta"
# tarkoittaa: jos vaihtoehtoja on liikaa, valintaa ei ole.
#
# Laskenta on eksakti eikä otos siinä mielessä että koko sanasto käydään läpi:
# muoto on pelattavissa jos sen kirjainmoninkerta mahtuu heiton 13 noppaan
# (jokeri jokerina). Affiksoidut muodot tarvitsee testata vain pelattavien
# perusmuotojen jatkeina, koska liite vain lisää kirjaimia: jos perusmuoto ei
# mahdu, sen liitteellinen jatke ei myöskään mahdu.
#
# Ajo:  python -X utf8 build/mittaa_vaihtoehdot.py [--heittoja 200]

import json
import sys
from pathlib import Path

import numpy as np

import mittaus_lib as m
from mittaa_pelattavuus import JOKER, roll

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "mittaus"
AAKKOSET = sorted(m.KIRJAIMET)
IDX = {c: i for i, c in enumerate(AAKKOSET)}


def lataa() -> list[str]:
    forms = []
    with open(ROOT / "data" / "wordforms.txt", encoding="utf-8") as f:
        for line in f:
            forms.append(line[: line.index("\t")])
    return forms


def vektorit(forms: list[str]) -> np.ndarray:
    mat = np.zeros((len(forms), len(AAKKOSET)), dtype=np.uint8)
    for i, w in enumerate(forms):
        for c in w:
            mat[i, IDX[c]] += 1
    return mat


def heiton_vektori(faces: list[str]) -> tuple[np.ndarray, int]:
    v = np.zeros(len(AAKKOSET), dtype=np.uint8)
    jokerit = 0
    for f in faces:
        if f == JOKER:
            jokerit += 1
        else:
            v[IDX[f]] += 1
    return v, jokerit


def mahtuu(saatavilla: dict, jokerit: int, sana: str) -> bool:
    """Puhdasta Pythonia: numpy-taulukon rakentaminen per sana oli hitaampaa."""
    puute = 0
    kaytetty: dict = {}
    for c in sana:
        kaytetty[c] = kaytetty.get(c, 0) + 1
        if kaytetty[c] > saatavilla.get(c, 0):
            puute += 1
            if puute > jokerit:
                return False
    return True


def main() -> None:
    heittoja = int(sys.argv[sys.argv.index("--heittoja") + 1]) if "--heittoja" in sys.argv else 200
    forms = lataa()
    print(f"pohjasanasto {len(forms)} muotoa", flush=True)
    mat = vektorit(forms).astype(np.int16)
    arr = np.array(forms, dtype=object)
    print("vektorit valmiit", flush=True)

    nyt, affiksilla = [], []
    for i in range(heittoja):
        faces = [f.lower() for f in roll(f"mittaus-{i}")]
        vec, jokerit = heiton_vektori(faces)
        yli = np.maximum(mat - vec.astype(np.int16), 0).sum(axis=1)
        osuvat = arr[yli <= jokerit]
        nyt.append(len(osuvat))

        saatavilla = {c: int(vec[IDX[c]]) for c in AAKKOSET}
        laajennus = set()
        for w in osuvat:
            for v in m.liitteet(w):
                if v not in laajennus and mahtuu(saatavilla, jokerit, v):
                    laajennus.add(v)
        affiksilla.append(len(osuvat) + len(laajennus))
        if (i + 1) % 25 == 0:
            print(f"{i + 1}/{heittoja} heittoa, mediaani nyt "
                  f"{int(np.median(nyt))} -> {int(np.median(affiksilla))}", flush=True)

    tulos = {
        "heittoja": heittoja,
        "pohjasanasto": len(forms),
        "sanoja_per_heitto_nyt": {
            "mediaani": int(np.median(nyt)), "keskiarvo": round(float(np.mean(nyt)), 1),
            "min": int(min(nyt)), "max": int(max(nyt)),
        },
        "sanoja_per_heitto_affikseilla": {
            "mediaani": int(np.median(affiksilla)), "keskiarvo": round(float(np.mean(affiksilla)), 1),
            "min": int(min(affiksilla)), "max": int(max(affiksilla)),
        },
        "kerroin_mediaanista": round(float(np.median(affiksilla)) / float(np.median(nyt)), 3),
    }
    OUT.mkdir(exist_ok=True)
    (OUT / "vaihtoehdot.json").write_text(json.dumps(tulos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(tulos, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
