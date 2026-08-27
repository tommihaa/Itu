# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Tommi Haanranta
# Integraatiotesti: importtaa KORJATUN gen_wordforms.py:n ja varmistaa että
# generate_forms tuottaa nyt verbien perusmuodon + infinitiivit + 4. inf -minen.
# Ajo: python -X utf8 build/audit_morph.py
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
import gen_wordforms as g  # importti EI laukaise main()ia (if __name__ == "__main__")

V = g.verb_tags()
print(f"verb_tags: {len(V)} tagia\n")

VERBS = ["laskea", "lukea", "juosta", "syödä", "tehdä", "tulla", "olla", "saada",
         "kävellä", "hypätä", "mennä", "nähdä", "antaa", "haluta"]
print("Perusmuoto (1. infinitiivi) nyt mukana?")
allok = True
for lemma in VERBS:
    forms = {f for f, _ in g.generate_forms(lemma, "V", V)}
    ok = lemma in forms
    allok &= ok
    print(f"    {lemma:9s} -> {'OK' if ok else 'PUUTTUU'}  (yht. {len(forms)} muotoa)")

print("\nlaskea: tarkista keskeiset uudet muodot")
lf = {f for f, _ in g.generate_forms("laskea", "V", V)}
for w in ["laskea", "laskien", "laskiessa", "laskemassa", "laskemasta", "laskemaan",
          "laskeminen", "laskemisen", "laskemista", "laskemiset"]:
    print(f"    {w:13s} {'OK' if w in lf else 'PUUTTUU'}")

print("\nKoodimuoto (näyte laskea-muodoista):")
for f, c in sorted(g.generate_forms("laskea", "V", V)):
    if f in ("laskea", "laskien", "laskiessa", "laskemassa", "laskeminen", "laskemisen"):
        print(f"    {f:13s} #{c}")

print("\nKAIKKI PERUSMUODOT OK" if allok else "\n!!! JOKIN PERUSMUOTO PUUTTUU")
