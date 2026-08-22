# Mittaus: mitä omistusliitteiden (+Px) ja liitepartikkelien (+Foc) mukaan
# ottaminen maksaisi Itun sanastolle. EI muuta tuotantoputkea: tämä skripti
# lukee saman lemmalistan ja saman tagiston kuin gen_wordforms.py, mutta
# kysyy FST:ltä lisäksi affiksilliset variantit ja kirjoittaa vertailuluvut.
#
# Tausta: PERUSTELUT.md kohta 5 sanoo affiksien räjäyttävän sanaston ja tekevän
# lähes kaikesta kelvollista. Väite on uskottava muttei mitattu. Tämä skripti
# tuottaa luvun; päätöstä se ei avaa (SUBSTANSSI.md kohta 48).
#
# Ajo:  python -X utf8 build/mittaa_affiksit.py --sample 500
# Tulos: build/mittaus/ (forms_base.txt, forms_affix.txt, tulokset.json)
#
# +Cmp (vapaat yhdyssanat) mitataan erikseen: se on lemmaparien kombinatoriikkaa
# eikä FST-generointia per lemma, ks. mittaa_yhdyssanat.py.

import json
import sys
import time
from pathlib import Path

import gen_wordforms as g
from uralicNLP import uralicApi

OUT = Path(__file__).resolve().parent / "mittaus"

# FST:n hyväksymät liitepartikkelit. Foc/ko ja Foc/s pudotettiin probauksessa:
# edellinen palauttaa liitteettoman muodon (talossa), jälkimmäinen tyhjää.
FOC = ["Foc/kin", "Foc/kaan", "Foc/han", "Foc/pa"]
PX = ["PxSg1", "PxSg2", "PxSg3", "PxPl1", "PxPl2", "PxPl3"]

# Omistusliite kiinnittyy nominaaliin: nominiin, adjektiiviin, teonnimeen,
# partisiippiin ja infinitiiviin, ei finiittiseen verbimuotoon.
NOMINALISH = ("Der/minen", "PrsPrc", "PrfPrc", "AgPrc", "NegPrc", "Inf")


def is_nominalish(tag: str, suffix: str) -> bool:
    return tag != "V" or any(m in suffix for m in NOMINALISH)


def variants(tag: str, suffix: str) -> list[str]:
    """Affiksilliset koodit tälle perustagille, ilman perustagia itseään."""
    pxs = [""] + PX if is_nominalish(tag, suffix) else [""]
    out = []
    for px in pxs:
        for foc in [""] + FOC:
            if not px and not foc:
                continue
            out.append(f"{suffix}{'+' + px if px else ''}{'+' + foc if foc else ''}")
    return out


def gen(word: str, code: str) -> set[str]:
    out = set()
    for result in uralicApi.generate(f"{word}+{code}", "fin"):
        form = result[0].lower()
        if g.ALLOWED.match(form):
            out.add(form)
    return out


def main() -> None:
    g.keep_system_awake()
    sample = int(sys.argv[sys.argv.index("--sample") + 1]) if "--sample" in sys.argv else 500

    lemmas = g.read_lemmas()
    step = max(1, len(lemmas) // sample)
    lemmas = lemmas[::step][:sample]

    base: set[str] = set()
    affix: set[str] = set()
    per_lemma = []
    calls = 0
    skipped_no_base = 0
    start = time.time()

    for i, (word, pos) in enumerate(lemmas):
        lower = word.lower()
        tagsets = g.mapped_tagsets(pos)
        if not tagsets:
            if g.ALLOWED.match(lower):
                base.add(lower)
                affix.add(lower)
            continue

        b: set[str] = set()
        a: set[str] = set()
        for tag, tagset in tagsets:
            for suffix in tagset:
                b |= gen(lower, f"{tag}{suffix}")
                calls += 1
        if not b:
            # FST ei tunne lemmaa (yhdyssana/uudissana). gen_wordforms.py perii
            # taivutuksen loppuosasta; tässä ohitetaan, jotta vertailu on symmetrinen.
            skipped_no_base += 1
            continue
        for tag, tagset in tagsets:
            for suffix in tagset:
                for code in variants(tag, suffix):
                    a |= gen(lower, f"{tag}{code}")
                    calls += 1

        base |= b
        affix |= b | a
        per_lemma.append({"lemma": word, "pos": pos, "base": len(b), "affix_new": len(a - b)})

        if (i + 1) % 20 == 0:
            el = time.time() - start
            print(f"{i + 1}/{len(lemmas)} lemmaa, base {len(base)}, "
                  f"affix {len(affix)}, {calls / el:.0f} kutsua/s, {el:.0f} s", flush=True)

    OUT.mkdir(exist_ok=True)
    (OUT / "forms_base.txt").write_text("\n".join(sorted(base)) + "\n", encoding="utf-8")
    (OUT / "forms_affix.txt").write_text("\n".join(sorted(affix)) + "\n", encoding="utf-8")
    (OUT / "per_lemma.json").write_text(json.dumps(per_lemma, ensure_ascii=False), encoding="utf-8")

    def lenhist(s: set[str]) -> dict:
        h: dict = {}
        for f in s:
            h[len(f)] = h.get(len(f), 0) + 1
        return dict(sorted(h.items()))

    tulokset = {
        "sample": len(lemmas),
        "lemmoja_mukana": len(per_lemma),
        "ohitettu_ei_perusmuotoa": skipped_no_base,
        "base_muotoja": len(base),
        "affix_muotoja": len(affix),
        "kerroin": round(len(affix) / max(1, len(base)), 3),
        "base_tavut": sum(len(f.encode()) + 1 for f in base),
        "affix_tavut": sum(len(f.encode()) + 1 for f in affix),
        "base_pituusjakauma": lenhist(base),
        "affix_pituusjakauma": lenhist(affix),
        "fst_kutsuja": calls,
        "kesto_s": round(time.time() - start, 1),
    }
    (OUT / "tulokset.json").write_text(json.dumps(tulokset, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(tulokset, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
