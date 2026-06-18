# Lemma-assetin paketointi opettavuutta varten (muoto -> lemma).
#
# Lukee data/wordforms.txt (muoto<TAB>lemma, jo lajiteltu muodon mukaan) ja
# kirjoittaa itsenäisen, binäärihaettavan paketin:
#   public/dict/lemmas-fi-v1.bin.gz  (+ .meta.json)
#
# Muoto: front-coded entryt, restart (täysi muoto) joka BLOCK_SIZE:nnen kohdalla
# → ajossa rakennetaan restart-indeksi yhdellä skannauksella, lookup binäärihakee
# lohkon ja purkaa siitä ≤BLOCK_SIZE entryä. Ks. src/dict/lemmas.ts.
#
# Entry: uint8(formPrefixLen) formSuffixUtf8 0x09 uint8(lemmaPrefixLen) lemmaSuffixUtf8 0x0A
# - formPrefixLen = jaettu MERKKI-etuliite edelliseen muotoon (0 restartissa)
# - lemmaPrefixLen = jaettu MERKKI-etuliite saman entryn muotoon
# Erottimet 0x09/0x0A ovat turvallisia: sanat eivät sisällä niitä, eikä ä/ö:n
# UTF-8 tuota näitä tavuja.

import gzip
import json
import os
import sys

BLOCK_SIZE = 64
SRC = os.path.join("data", "wordforms.txt")
OUT_DIR = os.path.join("public", "dict")
VERSION = "lemmas-fi-v1"


def common_prefix(a: str, b: str) -> int:
    n = min(len(a), len(b))
    i = 0
    while i < n and a[i] == b[i]:
        i += 1
    return i


def main() -> None:
    if not os.path.exists(SRC):
        sys.exit(f"Lähdetiedostoa ei löydy: {SRC}")
    os.makedirs(OUT_DIR, exist_ok=True)

    # Lue + lajittele muodon mukaan koodipiste-järjestykseen (= JS-merkkijonon
    # UTF-16 code unit -järjestys BMP-merkeille kuten ä/ö) → binäärihaku ajossa toimii.
    entries = []
    with open(SRC, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line:
                continue
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            entries.append((parts[0], parts[1]))
    entries.sort(key=lambda e: e[0])
    print(f"  luettu+lajiteltu {len(entries)} entryä", flush=True)

    buf = bytearray()
    prev_form = ""
    count = 0
    for form, lemma in entries:
        fp = 0 if count % BLOCK_SIZE == 0 else common_prefix(prev_form, form)
        lp = common_prefix(form, lemma)
        buf.append(min(fp, 255))
        buf.extend(form[fp:].encode("utf-8"))
        buf.append(0x09)
        buf.append(min(lp, 255))
        buf.extend(lemma[lp:].encode("utf-8"))
        buf.append(0x0A)
        prev_form = form
        count += 1

    raw = bytes(buf)
    gz = gzip.compress(raw, 9)
    bin_path = os.path.join(OUT_DIR, f"{VERSION}.bin.gz")
    with open(bin_path, "wb") as out:
        out.write(gz)
    meta = {
        "version": VERSION,
        "count": count,
        "blockSize": BLOCK_SIZE,
        "rawBytes": len(raw),
        "gzBytes": len(gz),
    }
    with open(os.path.join(OUT_DIR, f"{VERSION}.meta.json"), "w", encoding="utf-8") as out:
        json.dump(meta, out, ensure_ascii=False, indent=2)

    print(f"VALMIS: {count} entryä")
    print(f"  raaka {len(raw)/1024/1024:.2f} MB -> gzip {len(gz)/1024/1024:.2f} MB")
    print(f"  {bin_path}")


if __name__ == "__main__":
    main()
