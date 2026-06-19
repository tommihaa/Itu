# Analyysi-assetin paketointi Tarkastajaa varten (muoto -> [(lemma, [koodit])]).
#
# Lukee data/wordforms.txt (muoto<TAB>lemma#koodi;koodi|lemma2#koodi, lajiteltu
# muodon mukaan) ja kirjoittaa itsenäisen, binäärihaettavan paketin:
#   public/dict/forms-fi-v1.bin.gz  (+ .meta.json, sis. kooditaulukon)
# Ks. lukija src/dict/lemmas.ts.
#
# Binääriformaatti (per entry; eteneminen on COUNT-ohjattua, ei NL-skannausta):
#   uint8 formPrefixLen | formSuffix… 0x09
#   uint8 nLemmas
#   nLemmas × ( uint8 lemmaPrefixLen | lemmaSuffix… 0x09
#               | uint8 nCodes | nCodes × codeIndex (LE, codeWidth tavua) )
# - formPrefixLen  = jaettu MERKKI-etuliite edelliseen muotoon (0 restartissa, joka
#   BLOCK_SIZE:nnen kohdalla → restart-indeksi + binäärihaku ajossa).
# - lemmaPrefixLen = jaettu MERKKI-etuliite saman entryn muotoon.
# - 0x09 (TAB) päättää sanamerkkijonot turvallisesti: sanat eivät sisällä 0x09/0x0A,
#   eikä ä/ö:n UTF-8 tuota niitä. Koodit ovat binääri-indeksejä meta.codes-taulukkoon
#   ja luetaan nCodes-laskurilla — ei koskaan skannaamalla → indeksitavu saa olla
#   mitä tahansa (myös 0x09/0x0A) ilman törmäystä.

import gzip
import json
import os
import sys

BLOCK_SIZE = 64
SAMPLE = "--sample" in sys.argv
SRC = os.path.join("data", "wordforms.sample.txt" if SAMPLE else "wordforms.txt")
OUT_DIR = os.path.join("public", "dict")
VERSION = "forms-fi-sample" if SAMPLE else "forms-fi-v1"


def common_prefix(a: str, b: str) -> int:
    n = min(len(a), len(b))
    i = 0
    while i < n and a[i] == b[i]:
        i += 1
    return i


def parse_line(line: str) -> tuple[str, list[tuple[str, list[str]]]]:
    form, _, blob = line.partition("\t")
    analyses: list[tuple[str, list[str]]] = []
    for part in blob.split("|"):
        lemma, _, codestr = part.partition("#")
        codes = codestr.split(";") if codestr else []
        analyses.append((lemma, codes))
    return form, analyses


def main() -> None:
    if not os.path.exists(SRC):
        sys.exit(f"Lähdetiedostoa ei löydy: {SRC}")
    os.makedirs(OUT_DIR, exist_ok=True)

    entries: list[tuple[str, list[tuple[str, list[str]]]]] = []
    code_set: set[str] = set()
    with open(SRC, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\r\n")
            if not line or "\t" not in line:
                continue
            form, analyses = parse_line(line)
            entries.append((form, analyses))
            for _, codes in analyses:
                code_set.update(codes)
    entries.sort(key=lambda e: e[0])

    codes_sorted = sorted(code_set)
    code_index = {c: i for i, c in enumerate(codes_sorted)}
    code_width = 1 if len(codes_sorted) <= 255 else 2
    print(f"  {len(entries)} entryä, {len(codes_sorted)} eri koodia, "
          f"codeWidth={code_width}", flush=True)

    buf = bytearray()

    def put_idx(idx: int) -> None:
        buf.append(idx & 0xFF)
        if code_width == 2:
            buf.append((idx >> 8) & 0xFF)

    prev_form = ""
    count = 0
    for form, analyses in entries:
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
                put_idx(code_index[c])
        prev_form = form
        count += 1

    raw = bytes(buf)
    gz = gzip.compress(raw, 9)
    with open(os.path.join(OUT_DIR, f"{VERSION}.bin.gz"), "wb") as out:
        out.write(gz)
    meta = {
        "version": VERSION,
        "count": count,
        "blockSize": BLOCK_SIZE,
        "codeWidth": code_width,
        "codes": codes_sorted,
        "rawBytes": len(raw),
        "gzBytes": len(gz),
    }
    with open(os.path.join(OUT_DIR, f"{VERSION}.meta.json"), "w", encoding="utf-8") as out:
        json.dump(meta, out, ensure_ascii=False, indent=2)

    print(f"VALMIS: {count} entryä")
    print(f"  raaka {len(raw)/1024/1024:.2f} MB -> gzip {len(gz)/1024/1024:.2f} MB")
    print(f"  {os.path.join(OUT_DIR, f'{VERSION}.bin.gz')}")


if __name__ == "__main__":
    main()
