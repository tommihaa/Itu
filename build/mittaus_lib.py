# SPDX-License-Identifier: GPL-3.0-or-later
# Copyright (C) 2026 Tommi Haanranta
# Apufunktiot affiksimittaukseen: liitteiden muodostus ja niiden purku.
#
# Liitepartikkeli kiinnittyy taivutettuun muotoon sellaisenaan (talossa+kin),
# joten sen voi mallintaa merkkijonoliitoksena ilman FST:ää. Omistusliite
# käyttäytyy samoin useimmissa sijoissa (talossa+ni), ja poikkeukset (genetiivin
# n katoaa: talon+ni -> taloni) tuottavat muodon joka syntyy jo nominatiivista.
# Approksimaation osuvuus mitataan FST-otosta vasten, ks. mittaa_pelattavuus.py.

MAX = 13
KIRJAIMET = set("adeghijklmnoprstuvyäö")

KLIITIT_TAKA = ["kin", "kaan", "han", "pa"]
KLIITIT_ETU = ["kin", "kään", "hän", "pä"]
PX_TAKA = ["ni", "si", "nsa", "mme", "nne"]
PX_ETU = ["ni", "si", "nsä", "mme", "nne"]

KAIKKI_KLIITIT = sorted(set(KLIITIT_TAKA + KLIITIT_ETU), key=len, reverse=True)
KAIKKI_PX = sorted(set(PX_TAKA + PX_ETU), key=len, reverse=True)
VOKAALIT = set("aeiouyäö")


def takavokaalinen(sana: str) -> bool:
    """Vokaalisointu: takavokaali sanassa -> takainen liitevariantti."""
    return any(v in sana for v in "aou")


def liitteet(sana: str) -> list[str]:
    """Kaikki affiksilliset variantit tästä muodosta (ilman muotoa itseään)."""
    taka = takavokaalinen(sana)
    kliitit = KLIITIT_TAKA if taka else KLIITIT_ETU
    pxt = PX_TAKA if taka else PX_ETU
    kannat = [sana]
    for px in pxt:
        kannat.append(sana + px)
    # Yksikön 3. persoona pitkällä vokaalilla: talossa -> talossaan.
    if sana and sana[-1] in VOKAALIT:
        kannat.append(sana + sana[-1] + "n")
    out = []
    for kanta in kannat:
        if kanta != sana and kelpaa(kanta):
            out.append(kanta)
        for kl in kliitit:
            ehdokas = kanta + kl
            if kelpaa(ehdokas):
                out.append(ehdokas)
    return out


def kelpaa(sana: str) -> bool:
    return 2 <= len(sana) <= MAX and all(c in KIRJAIMET for c in sana)


def hyvaksytty_affiksilla(sana: str, pohja: set) -> bool:
    """Onko sana pohjasanastossa tai siitä liitteillä johdettavissa."""
    if sana in pohja:
        return True
    for kanta in _purut(sana):
        if kanta in pohja:
            return True
    return False


def _purut(sana: str):
    """Kaikki kannat jotka syntyvät purkamalla kliitti ja/tai omistusliite."""
    vaiheet = [sana]
    for kl in KAIKKI_KLIITIT:
        if sana.endswith(kl) and len(sana) - len(kl) >= 2:
            vaiheet.append(sana[: -len(kl)])
    for v in vaiheet:
        if v != sana:
            yield v
        for px in KAIKKI_PX:
            if v.endswith(px) and len(v) - len(px) >= 2:
                yield v[: -len(px)]
        # talossaan -> talossa
        if len(v) >= 4 and v[-1] == "n" and v[-2] in VOKAALIT and v[-2] == v[-3]:
            yield v[:-2]
