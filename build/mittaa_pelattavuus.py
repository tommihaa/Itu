# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Tommi Haanranta
# Mittaus: nousisiko kelpaavuus niin, että ristikon rakentaminen lakkaa olemasta
# valinta, jos affiksit otettaisiin mukaan?
#
# Menetelmä. Heitot tuotetaan pelin omalla satunnaisvirralla (src/domain/rng.ts
# xmur3+mulberry32 ja src/domain/roll.ts takuuehto), joten mitattu heittojoukko on
# sama kuin pelaajan näkemä. Jokaisesta heitosta arvotaan asetteluja: L nopan
# osajoukko järjestyksessä, eli täsmälleen se mitä pelaaja voi fyysisesti panna
# riviin. Kelpaavuus = kuinka suuri osuus asetteluista on sanastossa.
#
# Kaksi sanastoa: nykyinen (data/wordforms.txt) ja affiksoitu (sama + liitteilla
# johdetut, mittaus_lib.py). Affiksoitu on approksimaatio, jonka osuvuus mitataan
# FST-otosta vasten samassa ajossa (build/mittaus/forms_*.txt).
#
# Ajo:  python -X utf8 build/mittaa_pelattavuus.py [--heittoja 500] [--asetteluja 3000]

import json
import random
import sys
from pathlib import Path

import mittaus_lib as m

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / "mittaus"
JOKER = "*"

DICE = [
    ["A", "E", "O", "T", "N", "S"], ["A", "I", "U", "T", "K", "L"],
    ["A", "E", "I", "N", "S", "M"], ["A", "I", "Ä", "T", "K", "R"],
    ["A", "E", "O", "N", "L", "V"], ["A", "I", "U", "S", "T", "H"],
    ["A", "E", "Ä", "K", "N", "J"], ["A", "I", "O", "G", "S", "M"],
    ["E", "U", "Y", "K", "L", "R"], ["E", "O", "Ä", "N", "T", "P"],
    ["I", "Y", "Ö", "S", "M", "H"], ["I", "Ä", "K", "L", "R", "J"],
    ["O", "U", "N", "V", "D", JOKER],
]
VOWELS = set("AEIOUYÄÖ")
MIN_VOWELS = MIN_CONSONANTS = 5
U32 = 0xFFFFFFFF


def imul(a: int, b: int) -> int:
    r = (a * b) & U32
    return r - 0x100000000 if r >= 0x80000000 else r


def hash_seed(seed: str) -> int:
    h = 1779033703 ^ len(seed)
    for ch in seed:
        h = imul(h ^ ord(ch), 3432918353)
        h = ((h << 13) & U32) | ((h & U32) >> 19)
        h = h - 0x100000000 if h >= 0x80000000 else h
    h = imul(h ^ ((h & U32) >> 16), 2246822507)
    h = imul(h ^ ((h & U32) >> 13), 3266489909)
    return (h ^ ((h & U32) >> 16)) & U32


def rng(seed: str):
    state = hash_seed(seed)

    def nxt() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & U32
        t = state
        t = imul(t ^ (t >> 15), t | 1) & U32
        t = (t ^ (t + (imul(t ^ (t >> 7), t | 61) & U32))) & U32
        return ((t ^ (t >> 14)) & U32) / 4294967296

    return nxt


def roll(seed: str) -> list:
    r = rng(seed)
    while True:
        faces = [d[int(r() * len(d))] for d in DICE]
        v = sum(1 for f in faces if f in VOWELS or f == JOKER)
        k = sum(1 for f in faces if f not in VOWELS)
        if v >= MIN_VOWELS and k >= MIN_CONSONANTS:
            return faces


def lataa_pohja() -> set:
    pohja = set()
    with open(ROOT / "data" / "wordforms.txt", encoding="utf-8") as f:
        for line in f:
            pohja.add(line[: line.index("\t")])
    return pohja


def validoi_approksimaatio() -> dict:
    """Vertaa liitteet()-approksimaatiota FST:n tuottamaan otokseen."""
    b = set((OUT / "forms_base.txt").read_text(encoding="utf-8").split())
    a = set((OUT / "forms_affix.txt").read_text(encoding="utf-8").split())
    fst_uudet = a - b
    approx = set()
    for f in b:
        approx.update(m.liitteet(f))
    approx -= b
    osuma = approx & fst_uudet
    return {
        "fst_uusia_muotoja": len(fst_uudet),
        "approksimaation_muotoja": len(approx),
        "yhteisia": len(osuma),
        "saanto_fst_muodoista": round(len(osuma) / max(1, len(fst_uudet)), 3),
        "tarkkuus_approksimaatiosta": round(len(osuma) / max(1, len(approx)), 3),
    }


def main() -> None:
    heittoja = int(sys.argv[sys.argv.index("--heittoja") + 1]) if "--heittoja" in sys.argv else 500
    asetteluja = int(sys.argv[sys.argv.index("--asetteluja") + 1]) if "--asetteluja" in sys.argv else 3000

    pohja = lataa_pohja()
    print(f"pohjasanasto {len(pohja)} muotoa", flush=True)

    rnd = random.Random(20260823)
    pituudet = range(2, 14)
    PITUUDET = list(pituudet)
    osumat = {L: {"nyt": 0, "affiksit": 0, "yhteensa": 0} for L in pituudet}
    kirjaimet = sorted(m.KIRJAIMET)

    for i in range(heittoja):
        faces = [f.lower() for f in roll(f"mittaus-{i}")]
        for _ in range(asetteluja):
            L = rnd.choice(PITUUDET)
            valinta = rnd.sample(faces, L)
            sana = "".join(valinta)
            if JOKER in sana:
                ehdokkaat = [sana.replace(JOKER, k, 1) for k in kirjaimet] if sana.count(JOKER) == 1 else [sana.replace(JOKER, k) for k in kirjaimet]
            else:
                ehdokkaat = [sana]
            osumat[L]["yhteensa"] += 1
            if any(e in pohja for e in ehdokkaat):
                osumat[L]["nyt"] += 1
                osumat[L]["affiksit"] += 1
            elif any(m.hyvaksytty_affiksilla(e, pohja) for e in ehdokkaat):
                osumat[L]["affiksit"] += 1
        if (i + 1) % 50 == 0:
            print(f"{i + 1}/{heittoja} heittoa", flush=True)

    taulu = {}
    for L, d in osumat.items():
        taulu[L] = {
            "asetteluja": d["yhteensa"],
            "kelpaa_nyt": d["nyt"],
            "kelpaa_affikseilla": d["affiksit"],
            "osuus_nyt": round(100 * d["nyt"] / d["yhteensa"], 3),
            "osuus_affikseilla": round(100 * d["affiksit"] / d["yhteensa"], 3),
        }
    kaikki_n = sum(d["yhteensa"] for d in osumat.values())
    tulos = {
        "heittoja": heittoja,
        "asetteluja_per_heitto": asetteluja,
        "pohjasanasto": len(pohja),
        "per_pituus": taulu,
        "kaikki_osuus_nyt": round(100 * sum(d["nyt"] for d in osumat.values()) / kaikki_n, 3),
        "kaikki_osuus_affikseilla": round(100 * sum(d["affiksit"] for d in osumat.values()) / kaikki_n, 3),
        "approksimaation_validointi": validoi_approksimaatio(),
    }
    OUT.mkdir(exist_ok=True)
    (OUT / "pelattavuus.json").write_text(json.dumps(tulos, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(tulos, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
