# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Tommi Haanranta
# Sanamuotojen build-aikainen generointi Itu-peliin.
#
# Lähde: Kotuksen nykysuomen sanalista 2024 (CC BY 4.0, Kotimaisten kielten
# keskus) + GiellaLT:n suomen generaattori-FST (uralicNLP).
#
# Periaate (ks. ITU.md): kaikki aito taivutus sisään, produktiivinen
# liimaus ulos. Kiellettyjä muotoja (liitepartikkelit +Foc/*, omistusliitteet
# +Px*, vapaat yhdyssanat +Cmp#) ei koskaan pyydetä generaattorilta, joten
# ne eivät voi päätyä listaan.
#
# Ajo:  python -X utf8 build/gen_wordforms.py [--sample N]
# Tulos: data/wordforms.txt — yksi rivi per muoto, aakkostettu, uniikki:
#   muoto<TAB>lemma1#koodi;koodi|lemma2#koodi
# Lemmat ovat Kotus-perusmuotoja, joista muoto syntyi (opettavuutta varten:
# kierroksen lopussa "kellutetuissa -> kelluttaa"). Sama muoto voi periytyä
# useasta lemmasta (homografit) → '|'-eroteltu; kullakin lemmalla ≥1
# analyysikoodi '#':n jälkeen, ';'-eroteltuna.
# Koodi = FST:n tag+suffix (esim. "N+Sg+Ine", "V+Act+Ind+Prs+Sg3"), tai "Base"
# (perusmuoto/taipumaton). Tämä on Tarkastajan auktoritatiivinen lähde: analyysi
# tulee samasta FST:stä joka muodon tuotti — ei arvauksesta.
#
# Sample-ajo (--sample N) kirjoittaa data/wordforms.sample.txt:hen eikä koske
# täyteen wordforms.txt:hen eikä checkpointteihin.

import ctypes
import re
import sys
import time
from pathlib import Path

def keep_system_awake() -> None:
    """Estä koneen nukahtaminen ajon ajaksi (Windows). ~2,5 h ajo kuoli aiemmin
    kun kone meni lepotilaan. ES_CONTINUOUS | ES_SYSTEM_REQUIRED pitää järjestelmän
    hereillä (näyttö saa silti sammua); Windows nollaa tilan kun prosessi päättyy."""
    if sys.platform == "win32":
        ES_CONTINUOUS = 0x80000000
        ES_SYSTEM_REQUIRED = 0x00000001
        ctypes.windll.kernel32.SetThreadExecutionState(ES_CONTINUOUS | ES_SYSTEM_REQUIRED)

from uralicNLP import uralicApi

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "data" / "nykysuomensanalista2024.txt"
TARGET = ROOT / "data" / "wordforms.txt"

# Noppien kirjaimisto: sana on muodostettavissa vain näistä (jokeri paikkaa
# yhden). Muut kirjaimet (b c f q w x z å š ž, väliviiva...) → muoto pois.
# G mukana 14.6.2026 (nk→ng-astevaihtelu + natiivit ng-sanat); b/c/f pois (lainat).
ALLOWED = re.compile(r"^[adeghijklmnoprstuvyäö]{2,13}$")

CASES = ["Nom", "Gen", "Par", "Ess", "Tra", "Ine", "Ela", "Ill",
         "Ade", "Abl", "All", "Abe", "Com", "Ins"]
NUMBERS = ["Sg", "Pl"]
PERSONS = ["Sg1", "Sg2", "Sg3", "Pl1", "Pl2", "Pl3"]

def nominal_tags(pos: str) -> list[str]:
    degrees = [""] if pos == "N" else ["", "+Comp", "+Superl"]
    return [f"{deg}+{num}+{case}" if not deg else f"{deg}+{num}+{case}"
            for deg in degrees for num in NUMBERS for case in CASES]

# Partisiipit taipuvat nomineina täydessä sijaparadigmassa.
PARTICIPLES = [f"+{voice}+{prc}" for voice, prc in
               [("Act", "PrsPrc"), ("Pss", "PrsPrc"),
                ("Act", "PrfPrc"), ("Pss", "PrfPrc")]] + ["+AgPrc", "+NegPrc"]

def verb_tags() -> list[str]:
    tags: list[str] = []
    # Aktiivin indikatiivi: preesens + imperfekti (aikamuoto mukana).
    for tense in ["Prs", "Prt"]:
        tags += [f"+Act+Ind+{tense}+{p}" for p in PERSONS]
        tags.append(f"+Act+Ind+{tense}+ConNeg")      # en anna / en antanut
        tags.append(f"+Act+Ind+{tense}+ConNeg+Sg")
    # Konditionaali + potentiaali: EI aikamuototagia. FST haluaa +Act+Cond+Sg3
    # (ei +Prs); +Prs tuotti tyhjän → koko konditionaali puuttui aiemmin (0 riviä).
    for mood in ["Cond", "Pot"]:
        tags += [f"+Act+{mood}+{p}" for p in PERSONS]
        tags.append(f"+Act+{mood}+ConNeg")
    # Imperatiivi.
    tags += [f"+Act+Imprt+{p}" for p in ["Sg2", "Sg3", "Pl1", "Pl2", "Pl3"]]
    tags += ["+Act+Imprt+ConNeg+Sg2", "+Act+Imprt+ConNeg"]
    # Passiivi: persoona Pe4 pakollinen (ilman sitä FST tuotti tyhjän → annettiin
    # ym. puuttuivat). Passiivin kieltomuotoa ("anneta") FST ei tuota → jätetään pois.
    tags += ["+Pss+Ind+Prs+Pe4", "+Pss+Ind+Prt+Pe4",
             "+Pss+Cond+Pe4", "+Pss+Pot+Pe4", "+Pss+Imprt+Pe4"]
    # Infinitiivit (ilman omistusliitteellisiä muotoja kuten juostakseen).
    # HUOM: omorfi vaatii +Act MYÖS infinitiiveille — ilman sitä A/E/MA-infinitiivit
    # tuottivat TYHJÄN (verbien perusmuoto + kaikki infinitiivit puuttuivat koko
    # sanakirjasta 21.6 asti; audit build/audit_morph.py). 1. inf = perusmuoto (laskea),
    # 2. inf (laskien/laskiessa), 3. inf MA (laskemassa…).
    tags += ["+Act+InfA+Sg+Lat", "+Act+InfE+Sg+Ine", "+Act+InfE+Sg+Ins"]
    tags += [f"+Act+InfMa+Sg+{c}" for c in ["Ine", "Ela", "Ill", "Ade", "Abe", "Ins"]]
    # 4. infinitiivi (teonnimi -minen) taipuu nominina; aitoa ja erittäin yleistä
    # kieltä (laskeminen, laskemisen, laskemista…). Tagi Der/minen (EI +Act, EI +N).
    tags += [f"+Der/minen+{num}+{case}" for num in NUMBERS for case in CASES]
    # Partisiipit täydessä taivutuksessa (myös vertailu: syödympi jää
    # generaattorin harkintaan — pyydetään vain perusaste).
    tags += [f"{prc}+{num}+{case}"
             for prc in PARTICIPLES for num in NUMBERS for case in CASES]
    return tags

VERB_TAGS = verb_tags()
NOUN_TAGS = nominal_tags("N")
ADJ_TAGS = nominal_tags("A")

POS_MAP = {
    "substantiivi": ("N", NOUN_TAGS),
    "adjektiivi": ("A", ADJ_TAGS),
    "verbi": ("V", VERB_TAGS),
}

def mapped_tagsets(pos: str) -> list[tuple[str, list[str]]]:
    """Sanaluokkakentästä KAIKKI taivutettavat luokat (N/A/V) järjestyksessä.
    Kotuksen kenttä voi olla yhdistelmä, esim. "adjektiivi, substantiivi" tai
    "substantiivi, adverbi" → otetaan mukaan jokaisen N/A/V-osan paradigma
    (unioni), jotta duaaliluokkainen sana taipuu täysin. Numeraalit, pronominit,
    adverbit ja partikkelit eivät kuulu POS_MAPiin → palautuu tyhjä → perusmuoto.
    (HUOM: aiempi pos.split()[0] säilytti pilkun → 1533 duaalisanaa jäi
    taivuttamatta; tämä korjaa sen.)"""
    result: list[tuple[str, list[str]]] = []
    seen: set[str] = set()
    for token in re.split(r"[,\s+]+", pos.strip().lower()):
        m = POS_MAP.get(token)
        if m and m[0] not in seen:
            seen.add(m[0])
            result.append(m)
    return result

def generate_forms(word: str, tag: str, tagset: list[str]) -> set[tuple[str, str]]:
    """Palauttaa (muoto, analyysikoodi) -parit. Koodi = tag+suffix (esim.
    "N+Sg+Ine", "V+Act+Ind+Prs+Sg3") = muodon morfologinen analyysi ilman lemmaa,
    sama jolla FST sen tuotti → auktoritatiivinen, ei arvaus."""
    out: set[tuple[str, str]] = set()
    for suffix in tagset:
        code = f"{tag}{suffix}"
        for result in uralicApi.generate(f"{word}+{tag}{suffix}", "fin"):
            form = result[0].lower()
            if ALLOWED.match(form):
                out.add((form, code))
    return out

PROBES = {"N": "+N+Sg+Gen", "A": "+A+Sg+Gen", "V": "+V+Act+Ind+Prs+Sg3"}

def can_generate(word: str, tag: str) -> bool:
    return bool(uralicApi.generate(word + PROBES[tag], "fin"))

def fallback_by_suffix(word: str, tag: str, tagset: list[str],
                       known: dict[str, set[str]]) -> set[tuple[str, str]]:
    """Yhdyssana/uudissana, jota FST ei tunne: peri taivutus pisimmästä
    loppuosasta, joka on itse generoituva Kotus-lemma (esitaikina → taikina).
    Vokaalisointu määräytyy loppuosasta, joten etuliitteen liimaus on turvallista.
    Analyysikoodi periytyy loppuosan muodosta (sama sija/luku)."""
    for i in range(1, len(word) - 2):
        suffix = word[i:]
        if tag in known.get(suffix, set()) and can_generate(suffix, tag):
            prefix = word[:i]
            return {(prefix + f, code) for f, code in generate_forms(suffix, tag, tagset)
                    if ALLOWED.match(prefix + f)}
    return set()

def read_lemmas() -> list[tuple[str, str]]:
    lemmas: list[tuple[str, str]] = []
    with open(SOURCE, encoding="utf-8") as f:
        next(f)  # otsikkorivi
        for line in f:
            cols = line.rstrip("\n").split("\t")
            if len(cols) < 3:
                continue
            word, pos = cols[0], cols[2]
            # Erisnimet (Ahti) JA lyhenteet (ALV, AMK, ADHD) pois — päätös 14.6.
            # Kotus listaa yleissanat gemenalla, joten iso alkukirjain = erisnimi
            # tai lyhenne, joita peli ei hyväksy.
            if word[:1].isupper():
                continue
            lemmas.append((word, pos))
    return lemmas

def main() -> None:
    keep_system_awake()
    sample = 0
    if "--sample" in sys.argv:
        sample = int(sys.argv[sys.argv.index("--sample") + 1])

    lemmas = read_lemmas()
    if sample:
        # Tasainen otos koko listalta, ei vain a-alkuisia.
        step = max(1, len(lemmas) // sample)
        lemmas = lemmas[::step][:sample]

    # Sample-ajo ei saa ylikirjoittaa täyttä wordforms.txt:ää (eikä checkpointteja).
    target = TARGET if not sample else TARGET.with_name("wordforms.sample.txt")

    # Loppuosaperintää varten: mitkä lemmat ovat olemassa millä sanaluokalla.
    known: dict[str, set[str]] = {}
    for word, pos in lemmas:
        for tag, _ in mapped_tagsets(pos):
            known.setdefault(word.lower(), set()).add(tag)

    # Muoto -> lemma -> joukko analyysikoodeja
    # (esim. {"talossa": {"talo": {"N+Sg+Ine"}}}).
    forms: dict[str, dict[str, set[str]]] = {}

    # Checkpoint/resume: täysi ajo (~2,5 h) on kuollut toistuvasti kun kone meni
    # lepotilaan (keep_system_awake ei estä kannen sulkua/horrosta). Kirjoitamme
    # jokaisen lemman tulokset append-lokiin ja talletamme edistymisindeksin
    # 500 lemman välein; uusi ajo jatkaa siitä mihin jäätiin (kaatuminen menettää
    # < 500 lemmaa). Append-loki: "muoto<TAB>lemma<TAB>koodi" per rivi.
    ckpt_log = TARGET.with_suffix(".partial.txt")
    ckpt_prog = TARGET.with_suffix(".progress")
    start_index = 0
    log_handle = None
    if not sample:
        if ckpt_log.exists() and ckpt_prog.exists():
            with open(ckpt_log, encoding="utf-8") as f:
                for line in f:
                    cols = line.rstrip("\n").split("\t")
                    if len(cols) == 3 and all(cols):
                        form, lemma, code = cols
                        forms.setdefault(form, {}).setdefault(lemma, set()).add(code)
            try:
                start_index = int(ckpt_prog.read_text().strip())
            except ValueError:
                start_index = 0
            print(f"JATKETAAN checkpointista: indeksi {start_index}, "
                  f"{len(forms)} muotoa ladattu", flush=True)
        log_handle = open(ckpt_log, "a", encoding="utf-8")

    def add(form: str, lemma: str, code: str) -> None:
        forms.setdefault(form, {}).setdefault(lemma, set()).add(code)
        if log_handle is not None:
            log_handle.write(f"{form}\t{lemma}\t{code}\n")

    stats = {"lemmas": 0, "generated": 0, "skipped_pos": 0,
             "fallback": 0, "no_output": 0}
    start = time.time()

    for i, (word, pos) in enumerate(lemmas):
        if i < start_index:
            continue  # jo käsitelty edellisellä ajolla (checkpoint)
        lower = word.lower()
        # Taipumattomat / N/A/V:n ulkopuoliset (adverbit, numeraalit, pronominit,
        # partikkelit): lemma sellaisenaan, jos se on nopilla muodostettavissa.
        tagsets = mapped_tagsets(pos)
        if not tagsets:
            if ALLOWED.match(lower):
                add(lower, word, "Base")
            stats["skipped_pos"] += 1
            continue

        stats["lemmas"] += 1
        # Duaaliluokat: unioni kaikkien luokkien (muoto, koodi) -pareista.
        produced: set[tuple[str, str]] = set()
        for tag, tagset in tagsets:
            produced |= generate_forms(lower, tag, tagset)
        if not produced:
            for tag, tagset in tagsets:
                produced |= fallback_by_suffix(lower, tag, tagset, known)
            if produced:
                stats["fallback"] += 1
        if produced:
            for form, code in produced:
                add(form, word, code)
            stats["generated"] += 1
        else:
            stats["no_output"] += 1
            # Perusmuoto talteen, vaikka generaattori ei tuntisi sanaa.
            if ALLOWED.match(lower):
                add(lower, word, "Base")

        if (i + 1) % 500 == 0:
            if log_handle is not None:
                # Flush + edistymisindeksi vasta flushin JÄLKEEN, jotta resume ei
                # koskaan ohita lemmaa jonka rivit eivät ehtineet levylle.
                log_handle.flush()
                ckpt_prog.write_text(str(i + 1))
            done = i + 1 - start_index
            rate = done / max(0.001, time.time() - start)
            print(f"{i + 1}/{len(lemmas)} lemmaa, {len(forms)} muotoa, "
                  f"{rate:.0f} lemmaa/s", flush=True)

    if log_handle is not None:
        log_handle.flush()

    def fmt(analyses: dict[str, set[str]]) -> str:
        # lemma1#koodi;koodi|lemma2#koodi (lemmat ja koodit lajiteltu → vakaa output)
        return "|".join(f"{lemma}#{';'.join(sorted(codes))}"
                        for lemma, codes in sorted(analyses.items()))

    lines = [f"{form}\t{fmt(analyses)}" for form, analyses in sorted(forms.items())]
    target.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"VALMIS: {len(forms)} uniikkia muotoa -> {target}")
    print(stats)
    if log_handle is not None:
        log_handle.close()
        ckpt_log.unlink(missing_ok=True)   # checkpoint tarpeeton kun valmis
        ckpt_prog.unlink(missing_ok=True)

if __name__ == "__main__":
    main()
