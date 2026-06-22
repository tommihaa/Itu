# Itu — designdokumentti

Web-pohjainen sananmuodostuspeli kirjainnopilla, Tacticin Sana Mix -matkapelin hengessä.
Päätökset lukittu 12.6.2026. Arkkitehtuurimalli: Superjatsi (Vite + TS + Web Components,
domain/ui-erotus, ei Reactia). Dev-portti 5177.

## Esittely (kopioi tuoreeseen chattiin / kuvaukseksi)

> **Itu** on suomenkielinen sananmuodostus-noppapeli (selainpeli). Pelaaja heittää
> kirjainnoppia ja muodostaa niistä sanoja laudalle ristikkomaisesti aikarajan
> (3 min/kierros) puitteissa; pisteet kirjaimista + aikabonus viimeisellä kolmanneksella.
> **Offline-yksinpeli** — ei verkkopalvelua, ei ääniä, ei monikielisyyttä (tietoisia
> valintoja: pelirauhha). Sanojen kelpoisuus tarkistetaan **koko suomen sanastosta**
> (~2,3 M taivutusmuotoa, pakattuna DAWG-rakenteeseen selaimessa). Teknologia:
> **Vite + TypeScript, vanilla (ei Reactia)**, tiukka domain/UI-erottelu. Sanasto
> generoidaan GiellaLT/omorfi-morfologialla (FST) lemmalistasta. Live: tommi-itu.vercel.app.

Säädä mukaan tarpeen mukaan: koodiapuun lisää tiedostorakenne + domain/UI-jako;
peli-/designkeskusteluun offline-filosofia + "ääretön peli" -arvolinssi; sanastoapuun
omorfi/uralicNLP + DAWG + +Act-infinitiivioppi. (Miksi tuore chat tarvitsee tämän:
muisti on paikallinen tähän Claude Code -ympäristöön — toinen chat alkaa kylmänä.)

## Ydinmekaniikka

- 13 kirjainnoppaa heitetään kerralla; pelaaja muodostaa nopista ristikon
  (sanat liittyvät toisiinsa kuten sanaristikossa) ennen kuin aika loppuu.
- Peliaika 3 min. Pelaaja voi lukita laudan aiemmin.
- **V1 lokaali**: yksinpeli + pass-and-play. Siemenpohjainen arvonta rakennetaan
  alusta asti niin, että sama siemen tuottaa saman heiton — tulevaa
  asynkronista/online-haastetta varten (v2+, vaatii backendin).

## Pisteytys

- Kirjainarvot = suomalainen Scrabble: A I N T E S = 1, K L O Ä = 2, U M = 3,
  R H V J P Y = 4, D Ö G = 7, jokeri = 0.
- Sanan pisteet = noppien arvojen summa; risteysnoppa (osa kahta sanaa)
  lasketaan kahdesti.
- Käyttämättömien noppien arvot vähennetään loppusummasta.
  Käyttämätön jokeri ei maksa mitään (arvo 0).
- **Aikabonus** (asetus, oletus PÄÄLLÄ): +1 piste / 5 säästettyä sekuntia
  lukittaessa ennen ajan loppua.

## Nopat (LUKITTU)

78 tahkoa: 37 vokaalia, 40 konsonanttia, 1 jokeri. Ei B/C/F-kirjaimia
(vain lainasanoissa). **G lisätty 14.6.2026** (T6→T5): nk→ng-astevaihtelu tuottaa
tuhansia natiiveja muotoja (kengät, kaupungin) + ng-sanat (hengittää, rengas).

Tahkomäärät: A8 I7 E6 O5 U4 Ä4 Y2 Ö1 / T5 N6 S5 K5 L4 M3 R3 H2 V2 J2 P1 D1 G1 / ⬦1

| # | Tahkot | | # | Tahkot |
|---|--------|---|---|--------|
| 1 | A E O T N S | | 8  | A I O G S M |
| 2 | A I U T K L | | 9  | E U Y K L R |
| 3 | A E I N S M | | 10 | E O Ä N T P |
| 4 | A I Ä T K R | | 11 | I Y Ö S M H |
| 5 | A E O N L V | | 12 | I Ä K L R J |
| 6 | A I U S T H | | 13 | O U N V D ⬦ |

- Saman nopan kirjaimet eivät voi näkyä samassa heitossa (poissulkevuus) —
  Ö on nopalla 11, D ja jokeri jakavat nopan 13, joten samassa heitossa näkyy
  korkeintaan yksi kustakin eikä koskaan D:tä ja jokeria yhdessä.
- **Jokerimäärä 1–3** (asetus, oletus 1): jokeri #2 korvaa nopan 8 A:n,
  #3 nopan 6 A:n. Jokeri voi edustaa mitä tahansa kirjainta, mutta jos se on
  osa kahta sanaa, sen on edustettava samaa kirjainta molemmissa.
- **Vokaalitakuu**: jos heitossa alle 4 vokaalia (jokeri lasketaan vokaaliksi,
  koska se voi toimia sellaisena), arvotaan deterministisesti uudelleen samasta
  satunnaisvirrasta, kunnes raja täyttyy.

## Sanakirja (LUKITTU)

> **Täydet hyväksymissäännöt: [SANASTO.md](SANASTO.md)** — se on kanoninen,
> koodia vasten todennettu kuvaus. Alla vain tiivistelmä.


- Pohja: Kotuksen nykysuomen sanalista. Muodot generoidaan **build-aikana**
  Voikolla ja paketoidaan tiiviiksi hakurakenteeksi (DAWG/trie).
  EI runtime-WASMia — `isValidWord(s)` on puhdas set-haku, nollaviive.
- Periaate: *kaikki aito taivutus sisään, produktiivinen liimaus ulos.*
  - ✓ sijat, persoonat, tempukset, partisiipit täydessä taivutuksessaan,
    vertailumuodot (talojen, juoksevissa, suurin)
  - ✗ liitepartikkelit (talokin), omistusliitteet (taloni),
    keksityt yhdyssanat (noppatalo), erisnimet (Tommi)
- Build-generointi estää keksityt yhdyssanat luonnostaan; runtime-Voikko ei estäisi.
- **Sanastoversio on osa pelin identiteettiä**: DAWG-tiedosto nimetään versiolla
  (esim. `sanasto-fi-v1.dawg`), ja tuleva asynkroninen haaste kiinnittää
  siemenluvun LISÄKSI sanastoversion — kaksi pelaajaa ei saa pelata samaa
  heittoa eri totuuksilla.
- Validointi on rajapinta (WordJudge): ExactJudge (DAWG, suomi) nyt;
  AdvisoryJudge (korpuslista, kolmas väri "en tunne tätä") ja HumanJudge
  (tuomarimoodi pass-and-playhin, ei kielidataa) mahdollistavat muut kielet
  myöhemmin ilman pelikoodin muutoksia.
- Karsinta generoinnissa: vain sanat ≤ 13 kirjainta, ei B/C/F/G-kirjaimia
  sisältäviä muotoja (mahdottomia muodostaa nopilla).
- UI antaa reaaliaikaisen värikoodatun palautteen sanoista.

## UI (tulossa)

- Vapaa ruudukko: nopat raahataan Scrabble-tyyliin, risteykset jakavat nopan.
- **Säännöt esitetään esimerkkivetoisesti** (✓/✗-sanaparit, ei kielioppitermejä).
- **Tarkastaja** (🔎, pelin ulkopuolinen sanahaku + loppunäyttö + ratkaisijan
  ehdotukset): kertoo sanan perusmuodon, kaikki pätevät tulkinnat ja sijamuodon
  *sekä sen vaikutuksen* selkoesimerkein (esim. "inessiivi — 'missä?' sisällä;
  kuten *talossa*"). Tässä kielioppitermi näytetään, koska tavoite on oppia —
  mutta aina selkoselityksen ja esimerkin kanssa. **Ei hallusinaatiota:** analyysi
  tulee build-aikaisesta FST-generoinnista (sama lähde joka muodon hyväksyy) +
  kiinteästä, käsin todennetusta sijataulukosta (`src/dict/morph.ts`); tuntematon
  → ei näytetä mitään. Data: `public/dict/forms-fi-v1` (lazy, ks. SANASTO.md).
- Asetukset: aikabonus päälle/pois ja taso, jokerimäärä 1–3, äänet.
  Tallennus localStorageen.
