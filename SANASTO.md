# Sanaston hyväksymissäännöt — Itu

Kanoninen, koodia vasten todennettu kuvaus siitä **mitkä sanat peli hyväksyy.**
Tämä dokumentti ja [gen_wordforms.py](build/gen_wordforms.py) pidetään yhtenevinä;
jos ne eroavat, se on bugi. Päivitetty 14.6.2026, vastaa generointiputkea
(uralicNLP / GiellaLT fin-FST + Kotus 2024).

> **Miksi näihin rajoitteisiin päädyttiin: [PERUSTELUT.md](PERUSTELUT.md).**
> Tämä kertoo *mitä* hyväksytään; perustelut kertovat *miksi* (vaihtoehdot + hinnat).

## Periaate (yhdellä lauseella)

> **Kaikki aito taivutus sisään, produktiivinen liimaus ulos.**

Scrabble "runnoo suomea" perusmuotosäännöillä; tämän pelin pointti on sallia
taivutusmuodot. Mekaniikka palkitsee mahdollisimman monen nopan käytön
(sanapisteet − käyttämättömät), joten taivutusten salliminen *tukee* ydintä.

## Putki

```
Kotus nykysuomen sanalista 2024 (104 743 lemmaa, CC BY 4.0)
  → suodatus (sanaluokka, iso alkukirjain)
  → GiellaLT fin-FST generoi pyydetyt taivutusmuodot (build-aikana)
  → merkistö-/pituussuodatus
  → muoto→lemma-parit → DAWG (sanasto-fi-v1)
  → selaimessa isValidWord = täsmähaku, nollaviive
```

Generointi on **build-aikaista**. Tämä estää keksityt yhdyssanat luonnostaan:
runtime-Voikko hyväksyisi minkä tahansa produktiivisen yhdistelmän, mutta me
tunnemme vain ne muodot jotka FST tuotti listatuista lemmoista.

## 1. Merkistö ja pituus (koskee KAIKKEA, myös perusmuotoja)

Hyväksytään vain muodot jotka täsmäävät: `^[adeghijklmnoprstuvyäö]{2,13}$`

- **Sallitut kirjaimet (21):** a d e g h i j k l m n o p r s t u v y ä ö
- **Pois:** b c f q w x z å š ž, yhdysviiva, välilyönti, numerot
- **Pituus 2–13.** Yksittäiskirjaimet pois; max 13 = noppien määrä.

Tämä on **koherentti noppien kanssa**: mitä ei voi heittää, sitä ei hyväksytä.
- **g on mukana** (päätös 14.6): astevaihtelu nk→ng tuottaa tuhansia natiiveja
  taivutusmuotoja (*kengät, kaupungin, langan*) ja natiiveja ng-sanoja
  (*hengittää, rengas, sangen*). g on noppadatassa harvinaisena (1 tahko, arvo 7).
- **b, c, f pois**: esiintyvät suomessa vain lainasanoissa (*banaani, curry,
  fakta*) → niitä ei voi muodostaa laudalle eivätkä ne ole sanastossa.

## 2. Mitä taivutetaan täydesti

Sanaluokat **substantiivi, adjektiivi, verbi** taivutetaan koko paradigmassa.
Jos lemma on **duaaliluokkainen** (esim. Kotuksen "adjektiivi, substantiivi"),
generoidaan **kaikkien** sen N/A/V-luokkien muotojen unioni.

**Substantiivit** — luku × sija: Sg/Pl × {Nom, Gen, Par, Ess, Tra, Ine, Ela,
Ill, Ade, Abl, All, Abe, Com, Ins} (14 sijaa).

**Adjektiivit** — kuten substantiivit + **vertailuasteet** (perus, komparatiivi,
superlatiivi). Esim. *suuri, suuremman, suurimmissa*.

**Verbit:**
- Finiittimuodot: aktiivi + passiivi; modukset indikatiivi (preesens, imperfekti),
  konditionaali, potentiaali; persoonat Sg1–3 / Pl1–3 + kieltomuodot (ConNeg).
- Imperatiivi (Sg2, Sg3, Pl1, Pl2, Pl3 + kieltomuodot + passiivi).
- Infinitiivit: A-infinitiivi, E-infinitiivi (inessiivi/instruktiivi),
  MA-infinitiivi (Ine, Ela, Ill, Ade, Abe, Ins).
- Partisiipit nominitaivutuksessa (Sg/Pl × 14 sijaa): preesens & perfekti
  (akt./pass.), agenttipartisiippi, kieltopartisiippi. Esim.
  *juokseva, juossut, juostava, juoksematon* + niiden sijamuodot.

✓ talojen, juoksevissa, suurin, kelluteltuihin, syötäväksi, lukeneista
✗ (ei pyydetä, ks. kohta 4)

## 3. Mitä jätetään perusmuotoon (ei taivuteta)

Sanaluokat joiden taivutus ei kuulu V1:een — **vain lemma** hyväksytään, jos se
läpäisee merkistösuodatuksen:

- **Adverbit** (esim. *nopeasti* ✓, mutta *nopeammin* ✗ — vertailu puuttuu)
- **Numeraalit** (*kaksi* ✓, mutta *kahden* ✗) — päätös 14.6, V1-rajoite
- **Pronominit** (*minä* ✓, mutta *minun* ✗) — päätös 14.6, V1-rajoite
- Interjektiot, partikkelit, konjunktiot, pre-/postpositiot, tyhjä sanaluokka

## 4. Mitä EI koskaan hyväksytä

Näitä ei pyydetä generaattorilta, joten ne eivät voi päätyä sanastoon:

- **Liitepartikkelit** (+Foc): *talokin, menisitköhän, tulehan* ✗
- **Omistusliitteet** (+Px): *taloni, kirjamme, juostakseen* ✗
- **Vapaat/keksityt yhdyssanat** (+Cmp): *noppatalo, sanapeli*-tyyppinen
  itse liimattu yhdistelmä ✗ (ks. kohta 5)
- **Erisnimet ja lyhenteet**: kaikki isolla alkavat Kotus-lemmat pudotetaan
  (*Ahti, ALV, AMK, ADHD*) — päätös 14.6.

## 5. Yhdyssanat

- **Olemassa olevat Kotus-yhdyssanat taipuvat** normaalisti. Jos FST ei tunne
  yhdyssanaa, taivutus peritään pisimmästä loppuosasta joka on itse generoituva
  Kotus-lemma (*esitaikina → taikina*; vokaalisointu määräytyy loppuosasta).
- **Itse keksimäsi yhdyssana EI kelpaa**, ellei se ole Kotus-listalla. Tämä on
  täsmälleen "produktiivinen liimaus ulos".

✓ aamulehti, jääkiekko (jos listattu) + niiden sijamuodot
✗ pelinoppa, korttipakka (jos eivät ole lemmoina) keksittynä yhdistelmänä

## 6. Validoinnin semantiikka (laudalla)

- **Kirjainkoko:** validointi normalisoi gemenaksi; sanasto on gemenaa.
- **Jokeri:** edustaa yhtä **pelin 21 kirjaimesta** (ei b/c/f — niillä ei olisi
  sanastossa osumia). Sanan kelvollisuus arvioidaan jokerin valitulla kirjaimella.
  Jos jokeri on osa kahta sanaa, sen on edustettava samaa kirjainta molemmissa.
- **Sana = ≥2 ruudun yhtenäinen vaaka-/pystyjono.** Risteysnoppa kuuluu kahteen
  sanaan; molempien on oltava kelvollisia.

## 7. Tunnetut rajoitteet (dokumentoidut, eivät bugeja)

1. **Rinnakkaismuodot.** Hyväksytään tarkalleen ne muodot jotka GiellaLT
   fin-generaattori tuottaa pyydetylle paradigmalle. Suomessa on rinnakkaisia
   normimuotoja (esim. *talojen* / *taloiden*; partitiivin *-ja* / *-ita*),
   joista generaattori antaa usein vain yhden → pelaaja voi muodostaa aidon
   muodon jonka sanakirja hylkää. Täysmitigaatio on syvä FST-työ (ei V1).
2. **Adverbien vertailu** (*nopeammin*) ei ole mukana.
3. **Numeraalien/pronominien taivutus** ei ole mukana (vain perusmuoto).
4. **no_output-varamuoto:** jos FST ei tuota mitään N/A/V-lemmalle, talteen jää
   pelkkä perusmuoto (jos läpäisee suodatuksen).

## 8. Versiointi ja opettavuus

- **Sanastoversio on osa pelin identiteettiä:** DAWG nimetään versiolla
  (`sanasto-fi-v1`). Tuleva asynkroninen haaste kiinnittää siemenluvun LISÄKSI
  sanastoversion — kaksi pelaajaa ei saa pelata samaa heittoa eri totuuksilla.
- **Validointi on rajapinnan takana** (`WordJudge`): `ExactJudge` (DAWG, suomi)
  nyt; `AdvisoryJudge` (kolmas väri "en tunne") ja `HumanJudge` (tuomarimoodi)
  mahdollistavat muut kielet myöhemmin ilman pelikoodin muutoksia.
- **Opettavuus:** jokainen muoto säilyttää lähde-lemmansa (muoto→lemma-pari),
  joten kierroksen lopussa voidaan näyttää *"kelluteltuihin → kellutella"* ja
  löytämättä jääneet sanat.
