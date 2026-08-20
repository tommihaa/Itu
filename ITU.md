# Itu: designdokumentti

Web-pohjainen sananmuodostuspeli kirjainnopilla, Tacticin Sana Mix -matkapelin hengessä.
Päätökset lukittu 12.6.2026. Arkkitehtuurimalli: Superjatsi (Vite + TS + Web Components,
domain/ui-erotus, ei Reactia). Dev-portti 5177.

## Nimen ja innoituksen alkuperä (kirjattu 20.8.2026)

Alkuperäinen työnimi SanaMix tulee yllä mainitusta matkapelistä, jota Tommi pelasi
Laiturilla yhteisissä pelituokioissa: kirjainnopat heitettiin ja sanoja muodostettiin
määräajassa. Tommi vahvisti 20.8.2026 että juuri se innoitti projektin. Laajempi konteksti
ja lähde: korttipelihaastattelu, `Jako-pelini/SUBSTANSSI.md` kohta 15 (Laituri kuvattu
saman tiedoston kohdassa 1). Pelin nimi vaihtui Ituksi myöhemmin, ja repo-kansion nimi
`SanaMix` kantaa yhä työnimeä.

## Esittely (kopioi tuoreeseen chattiin / kuvaukseksi)

> **Itu** on suomenkielinen sananmuodostus-noppapeli (selainpeli). Pelaaja heittää
> kirjainnoppia ja muodostaa niistä sanoja laudalle ristikkomaisesti aikarajan
> (3 min/kierros) puitteissa; pisteet kirjaimista + aikabonus kun teline on (lähes) ratkaistu.
> **Offline-yksinpeli**: ei verkkopalvelua, ei monikielisyyttä (tietoisia valintoja:
> pelirauha). Ääni on OLETUKSENA POIS, valinnainen kevyt torvi/kannel-teema
> (päätös 7.7.2026, ks. alla), pelirauha koskee oletustilaa, ei kieltoa. Sanojen
> kelpoisuus tarkistetaan **koko suomen sanastosta**
> (~2,3 M taivutusmuotoa, pakattuna DAWG-rakenteeseen selaimessa). Teknologia:
> **Vite + TypeScript, vanilla (ei Reactia)**, tiukka domain/UI-erottelu. Sanasto
> generoidaan GiellaLT/omorfi-morfologialla (FST) lemmalistasta. Live: tommi-itu.vercel.app.

Ota mukaan vain se, mitä keskustelu tarvitsee:
- **koodiapu** → tiedostorakenne + domain/UI-jako
- **peli-/designkeskustelu** → offline-filosofia + "ääretön peli" -arvolinssi
- **sanastoapu** → omorfi/uralicNLP + DAWG + +Act-infinitiivioppi

(Miksi tuore chat tarvitsee tämän: muisti on paikallinen tähän Claude Code
-ympäristöön, toinen chat alkaa kylmänä ilman tätä esittelyä.)

## Ydinmekaniikka

- 13 kirjainnoppaa heitetään kerralla; pelaaja muodostaa nopista ristikon
  (sanat liittyvät toisiinsa kuten sanaristikossa) ennen kuin aika loppuu.
- Peliaika **oletuksena 3 min ja asetuksesta säädettävissä** (1/2/3/5 min, ks. Asetukset).
  Pelaaja voi lukita laudan aiemmin. *Oletus löytyi pelitestaamalla eikä esikuvasta:*
  *Laiturin sanamixin tiimalasi oli 2–3 minuuttia, ja samankaltaisuus on yhteensattuma*
  *(`SUBSTANSSI.md` kohta 36, kirjattu 21.8.2026).*
- **V1 lokaali**: yksinpeli + pass-and-play. Siemenpohjainen arvonta rakennetaan
  alusta asti niin, että sama siemen tuottaa saman heiton, tulevaa
  asynkronista/online-haastetta varten (v2+, vaatii backendin).

## Pisteytys

- Kirjainarvot = suomalainen Scrabble: A I N T E S = 1, K L O Ä = 2, U M = 3,
  R H V J P Y = 4, D Ö G = 7, jokeri = 0.
- Sanan pisteet = noppien arvojen summa; risteysnoppa (osa kahta sanaa)
  lasketaan kahdesti.
- Käyttämättömien noppien arvot vähennetään loppusummasta.
  Käyttämätön jokeri ei maksa mitään (arvo 0).
- **Aikabonus** (asetus, oletus PÄÄLLÄ): +1 piste / 5 säästettyä sekuntia
  lukittaessa ennen ajan loppua, katto 6. Aukeaa **vain kun ≥11/13 noppaa on
  käytetty kelvollisissa sanoissa** → palkitsee nopean JA (lähes) täyden ratkaisun,
  ei pelkkää aikaista lukitsemista. Alle kynnyksen jäänyt ratkaisu ei saa bonusta.

### Scrabble-pistemoodi (asetus, oletus POIS)

Valinnainen kerros nykyisen pisteytyksen **päälle**, ei korvaa mitään (aikabonus ja
3 min ajastin säilyvät). Tekee *sijoittelusta* merkityksellistä, ei vain siitä mitä sanoja
muodostaa ("mahdollisuuksien maksimointi"). Domain: `src/domain/premium.ts` (puhdas).

- **Premium-ruudut:** kiinteä, symmetrinen layout keskitettynä lautaan. Kirjain ×2 (DL),
  kirjain ×3 (TL), sana ×2 (DW), sana ×3 (TW). Scrabblen ristipisteytys: kukin sana laskee
  omat kirjain-/sanakertoimensa, joten risteysnoppa saa kertoimet molemmissa sanoissa.
- **Keskusankkuri (★):** ristikon on katettava keskiruutu. 13 noppaa + yhtenäisyysvaatimus
  eivät ylety kaikkiin premiumeihin → aito kompromissi.
- **Bingo-bonus** (+20): kun KAIKKI 13 noppaa on käytetty kelvollisissa sanoissa ja ankkuri
  katettu. Itun vastine Scrabblen "kaikki nappulat" -bonukselle.

**Ei** muuta sanaston validointia (DAWG), noppia eikä heittoa, puhdas pistemekaniikka.
**Ei** Scrabble-suomen pelitoteutus (ei vastustajaa, ei kuratoitua sanalistaa, ei b/c/f).

### Opi-moodi (asetus, oletus POIS): adaptiivinen kielioppi-päivähaaste

Valinnainen oppimiskerros: päivän muutama kielioppiteema (sija/luku/aikamuoto/vertailu/
partisiippi) kerättäväksi laudan sanoilla. **PEHMEÄ**: ei estä pelaamista, **EI muuta
pisteytystä, sanastoa, lautaa eikä ennätyksiä** ("ei korvaa mitään"). Vain LUKEE valmiit
sanat ja kerää teemoja. Ei grindiä: rajattu päiväsetti + löysä viikkokoonti, ei streak-kuria.

- **Teema = predikaatti FST-analyysikoodin yli** (`code` sisältää tagin, esim. `+Ine`).
  Sijateemat johdettu `CASE_INFO`:sta (morph.ts); sama auktoritatiivinen lähde kuin
  Sanapoliisilla → ei hallusinaatiota. Domain: `src/domain/learn.ts` (puhdas, testattu).
- **Adaptiivinen:** päivän tavoitteet valitaan oman historian mukaan (harjoittelematon →
  matalin osumasuhde → pisin aika osumasta), deterministinen `(edistymä, päivä)`:stä.
- **UI:** ⚙️-kytkin (`itu:learnmode:v1`), teemasirut laudan yllä (osuneet syttyvät reaaliajassa),
  loppunäyttö = osutut teemat + viikkopalkki, per sana selite (Sanapoliisi-tyyliin). Edistymä
  `itu:learn:v1` (per teema: tarjottu/osuttu/viim. osumapäivä), vain tällä laitteella.
- **Vaihe 1 (yksinpeli) toteutettu;** vaihe 2 = kaveri-moodi haastelinkillä on oma suunnitelma.
  Täysi design: `OPIMOODI.md`.

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

- Saman nopan kirjaimet eivät voi näkyä samassa heitossa (poissulkevuus):
  Ö on nopalla 11, D ja jokeri jakavat nopan 13, joten samassa heitossa näkyy
  korkeintaan yksi kustakin eikä koskaan D:tä ja jokeria yhdessä.
- **Jokerimäärä 1–3** (asetus, oletus 1): jokeri #2 korvaa nopan 8 A:n,
  #3 nopan 6 A:n. Jokeri voi edustaa mitä tahansa kirjainta, mutta jos se on
  osa kahta sanaa, sen on edustettava samaa kirjainta molemmissa.
- **Vokaali- ja konsonanttitakuu**: jos heitossa alle 5 vokaalia TAI alle 5
  konsonanttia (jokeri lasketaan kumpaankin, koska se voi toimia kumpanakin),
  arvotaan deterministisesti uudelleen samasta satunnaisvirrasta, kunnes
  molemmat rajat täyttyvät. Estää rappeutuneet heitot (esim. 1 konsonantti),
  joista ei saa ristikkoa kokoon.

## Sanakirja (LUKITTU)

> **Täydet hyväksymissäännöt: [SANASTO.md](SANASTO.md)**, se on kanoninen,
> koodia vasten todennettu kuvaus. Alla vain tiivistelmä.


- Pohja: Kotuksen nykysuomen sanalista. Muodot generoidaan **build-aikana**
  Voikolla ja paketoidaan tiiviiksi hakurakenteeksi (DAWG/trie).
  EI runtime-WASMia, `isValidWord(s)` on puhdas set-haku, nollaviive.
- Periaate: *kaikki aito taivutus sisään, produktiivinen liimaus ulos.*
  - ✓ sijat, persoonat, tempukset, partisiipit täydessä taivutuksessaan,
    vertailumuodot (talojen, juoksevissa, suurin)
  - ✗ liitepartikkelit (talokin), omistusliitteet (taloni),
    keksityt yhdyssanat (noppatalo), erisnimet (Tommi)
- Build-generointi estää keksityt yhdyssanat luonnostaan; runtime-Voikko ei estäisi.
- **Sanastoversio on osa pelin identiteettiä**: DAWG-tiedosto nimetään versiolla
  (esim. `sanasto-fi-v1.dawg`), ja tuleva asynkroninen haaste kiinnittää
  siemenluvun LISÄKSI sanastoversion, kaksi pelaajaa ei saa pelata samaa
  heittoa eri totuuksilla.
- Validointi on rajapinta (WordJudge): ExactJudge (DAWG, suomi) nyt;
  AdvisoryJudge (korpuslista, kolmas väri "en tunne tätä") ja HumanJudge
  (tuomarimoodi pass-and-playhin, ei kielidataa) mahdollistavat muut kielet
  myöhemmin ilman pelikoodin muutoksia.
- Karsinta generoinnissa: vain sanat ≤ 13 kirjainta, ei B/C/F/G-kirjaimia
  sisältäviä muotoja (mahdottomia muodostaa nopilla).
- UI antaa reaaliaikaisen värikoodatun palautteen sanoista.

## UI

> Osio kuvasi alun perin suunniteltua käyttöliittymää ja oli otsikoitu *tulossa* 16.8.2026
> asti. Kaikki alla kuvattu on tuotannossa: vapaa ruudukko raahauksella, esimerkkivetoiset
> säännöt, termimoduuli, Sanapoliisi, asetuspaneeli, äänet ja ennätykset.

- Vapaa ruudukko: nopat raahataan Scrabble-tyyliin, risteykset jakavat nopan.
- **Säännöt esitetään esimerkkivetoisesti** (✓/✗-sanaparit, ei kielioppitermejä).
- **Termit (termimoduuli):** pelin termit (vokaalisointu, äänneryhmät, teline, jokeri,
  aikabonus, sanakirja…) määritellään kerran `src/rules/terms.ts`-taulukossa, jokainen
  selitys käsin todennettu tätä dokumenttia / koodia vasten (ei hallusinaatiota; sama
  malli kuin `CASE_INFO`). UI: sääntötekstien esiintymät ovat napautettavia (selite
  aukeaa kappaleen alle) + Säännöt-näkymän **Termit-välilehti** (ryhmitelty referenssi).
  Skeema + moottori jaettu Jakon kanssa (Lahja-kokoelman termimoduuli, speksi
  `Kaanon/TERMIMODUULI.md`; Jakon kopio `src/shared/glossary.js`). Data on
  pelin omaa, termistöä ei jaeta, mekanismi jaetaan.
- **Sanapoliisi** (🔎, ent. "Tarkastaja"; pelin ulkopuolinen sanahaku + loppunäyttö + ratkaisijan
  ehdotukset): kertoo sanan perusmuodon, kaikki pätevät tulkinnat ja sijamuodon
  *sekä sen vaikutuksen* selkoesimerkein (esim. "inessiivi: 'missä?' sisällä;
  kuten *talossa*"). Tässä kielioppitermi näytetään, koska tavoite on oppia,
  mutta aina selkoselityksen ja esimerkin kanssa. **Ei hallusinaatiota:** analyysi
  tulee build-aikaisesta FST-generoinnista (sama lähde joka muodon hyväksyy) +
  kiinteästä, käsin todennetusta sijataulukosta (`src/dict/morph.ts`); tuntematon
  → ei näytetä mitään. Data: `public/dict/forms-fi-v1` (lazy, ks. SANASTO.md).
- **Asetukset (⚙️):** kevyt paneeli (nappipalkki › ⚙️ Asetukset). Nyt: **kierroksen kesto**
  (1/2/3/5 min, `itu:duration:v1`), **aikabonus** on/off (`itu:timebonus:v1`), **Opi-moodi**
  (`itu:learnmode:v1`), **Scrabble-pistemoodi** (premium-ruudut + bingo + keskusankkuri,
  `itu:premium:v1`) ja **äänet** (`itu:sound:v1`, oletus POIS). Kaikki tallennetaan localStorageen.
- **Äänet (torvi & kantele, oletus POIS):** valinnainen kevyt äänimaisema Web Audiolla
  synteesillä (ei äänitiedostoja). Sama suunnittelukuvio kuin Superjatsissa ja Jaossa:
  torviääneke (`horn()`) harvinaisiin, juhlaviin hetkiin ja kantele-nypäisy (`kantele()`,
  Karplus-Strong-synteesi) toistuviin, arkisiin tapahtumiin. Ei erillistä "oletusteemaa"
  kuten muissa kahdessa pelissä, koska Itussa ei ollut ääntä ennestään, vain päälle/pois.
  Päätetty 7.7.2026: pelirauha-periaate (ks. yllä) tarkennettiin koskemaan oletustilaa,
  ei ääntä kokonaan kieltäväksi.
- **Ennätykset (🏆):** top-10 per (pistemoodi × kesto). Lajittelu **Kokonaispisteet**
  (valitulla kestolla, reilu sama-aika-vertailu) tai **⚡ Pistettä/min** = sanapisteet ÷ kesto,
  joka yhdistää kestot ja vertaa puhdasta tuottavuutta. Pistettä/min käyttää **vain
  sanapisteitä** (ei aikabonusta/sakkoja) → ei kasaannu aikabonuksen kanssa. Taaksepäin­-
  yhteensopiva: laskettu tallennetusta `wordPoints`/`duration`-kentästä (vanha tietue → 3 min).

## Jatkoideat (varasto, ei päätöksiä)

- **Pahviversio (kirjattu 20.8.2026, hautuva):** Itun fyysinen versio, jonka sanat
  tarkistettaisiin Itulle generoidusta sanastosta. Kiinnostuksen aste on Tommin omin sanoin
  *vähän*, eli tämä on varasto eikä suunnitelma. Tausta, sanamuoto ja se miksi suunta on
  merkittävä: `SUBSTANSSI.md` kohta 34.
