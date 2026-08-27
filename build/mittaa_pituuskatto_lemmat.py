# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Tommi Haanranta
# Mittaus: paljonko sanaston pituuskaton nosto (ilmaiskirjaimet-idea, ITU.md ›
# Jatkoideat) kasvattaisi Tarkastajan analyysipakettia (forms-fi-v1.bin.gz).
# Sama binääriformaatti kuin build_lemmas.py:ssä, mutta EI kirjoita public/dict/:iin,
# vain koot build/mittaus/pituuskatto_lemmat.json:iin. Lähde on 27.8.2026
# katkaisemattoman generointiajon lista (polku annetaan argumenttina), joka on
# lajiteltu ja yksi rivi per muoto; streamataan koska 4,8 M entryä ei mahdu
# kohtuumuistiin listana.
# Ajo: python build/mittaa_pituuskatto_lemmat.py <fin_rajaton.txt>

import gzip
import json
import os
import sys

BLOCK_SIZE = 64
CAPS = (13, 14, 15)


def common_prefix(a: str, b: str) -> int:
    n = min(len(a), len(b))
    i = 0
    while i < n and a[i] == b[i]:
        i += 1
    return i


def parse_line(line: str):
    form, _, blob = line.partition("\t")
    analyses = []
    for part in blob.split("|"):
        lemma, _, codestr = part.partition("#")
        codes = codestr.split(";") if codestr else []
        analyses.append((lemma, codes))
    return form, analyses


def mittaa(src: str, cap: int) -> dict:
    # Passi 1: kooditaulukko.
    code_set: set[str] = set()
    with open(src, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line or "\t" not in line:
                continue
            form, analyses = parse_line(line)
            if len(form) > cap:
                continue
            for _, codes in analyses:
                code_set.update(codes)
    codes_sorted = sorted(code_set)
    code_index = {c: i for i, c in enumerate(codes_sorted)}
    code_width = 1 if len(codes_sorted) <= 255 else 2

    # Passi 2: puskuri build_lemmas.py:n formaatilla, lähde on valmiiksi lajiteltu.
    buf = bytearray()
    prev_form = ""
    count = 0
    with open(src, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line or "\t" not in line:
                continue
            form, analyses = parse_line(line)
            if len(form) > cap:
                continue
            if form < prev_form:
                sys.exit(f"Lähde ei ole lajiteltu kohdassa {form!r}")
            fp = 0 if count % BLOCK_SIZE == 0 else common_prefix(prev_form, form)
            buf.append(min(fp, 255))
            buf.extend(form[fp:].encode("utf-8"))
            buf.append(0x09)
            buf.append(min(len(analyses), 255))
            for lemma, codes in analyses:
                lp = common_prefix(form, lemma)
                buf.append(min(lp, 255))
                buf.extend(lemma[lp:].encode("utf-8"))
                buf.append(0x09)
                buf.append(min(len(codes), 255))
                for c in codes:
                    idx = code_index[c]
                    buf.append(idx & 0xFF)
                    if code_width == 2:
                        buf.append((idx >> 8) & 0xFF)
            prev_form = form
            count += 1

    raw = bytes(buf)
    gz = gzip.compress(raw, 9)
    tulos = {
        "katto": cap,
        "entryja": count,
        "koodeja": len(codes_sorted),
        "codeWidth": code_width,
        "raw_tavut": len(raw),
        "gz_tavut": len(gz),
    }
    print(json.dumps(tulos), flush=True)
    return tulos


def main() -> None:
    if len(sys.argv) < 2 or not os.path.exists(sys.argv[1]):
        sys.exit("Anna lähdetiedosto argumenttina")
    tulokset = {f"p{cap}": mittaa(sys.argv[1], cap) for cap in CAPS}
    p13 = tulokset["p13"]
    for nimi in ("p14", "p15"):
        t = tulokset[nimi]
        tulokset[f"kerroin_{nimi}_vs_p13"] = {
            "entryja": round(t["entryja"] / p13["entryja"], 3),
            "gz": round(t["gz_tavut"] / p13["gz_tavut"], 3),
        }
    out = os.path.join(os.path.dirname(__file__), "mittaus", "pituuskatto_lemmat.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(tulokset, f, ensure_ascii=False, indent=2)
        f.write("\n")
    print(f"VALMIS -> {out}")


if __name__ == "__main__":
    main()
