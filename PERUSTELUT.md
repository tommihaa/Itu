# Perustelut — miksi nämä sanaston ja noppien rajoitteet?

Tämä dokumentti kokoaa **miksi** kukin rajoite valittiin. *Mitä* hyväksytään:
[SANASTO.md](SANASTO.md). Noppadata: [SANAMIX.md](SANAMIX.md). Jokainen kohta:
**päätös → perustelu → hinta/vaihtoehto** (mitä punnittiin).

---

## 1. Ydinperiaate: kaikki aito taivutus sisään, produktiivinen liimaus ulos

**Päätös.** Hyväksytään suomen sanojen kaikki taivutusmuodot, mutta ei
liitepartikkeleita, omistusliitteitä eikä itse keksittyjä yhdyssanoja.

**Perustelu.** Scrabble "runnoo suomea" perusmuotosäännöillä — se sopii englantiin,
jossa taivutusta on vähän, mutta suomessa se tuntuu väärältä. Pelin koko
lisäarvo on sallia taivutus. Lisäksi mekaniikka palkitsee mahdollisimman monen
nopan käytön (sanapisteet − käyttämättömät): taivutusmuotojen salliminen
*tukee* ydinmekaniikkaa, ei riko sitä. Raja vedetään aitoon taivutukseen, koska
se on äärellinen ja sanakirjamainen; produktiivinen liimaus on ääretöntä.

**Hinta.** Vaatii morfologisen generaattorin (ei pelkkää perusmuotolistaa).

## 2. Build-aikainen generointi → DAWG (ei runtime-Voikkoa/WASMia)

**Päätös.** Muodot generoidaan käännösaikana ja paketoidaan DAWG-hakurakenteeksi;
selaimessa `isValidWord` on puhdas joukkohaku.

**Perustelu.** Kolme syytä yhdellä valinnalla:
1. **Estää keksityt yhdyssanat luonnostaan** — runtime-Voikko hyväksyisi minkä
   tahansa produktiivisen yhdistelmän; me tunnemme vain listatuista lemmoista
   tuotetut muodot.
2. **Nollaviive** — ei WASM-latausta eikä ajonaikaista morfologiaa.
3. **Kiinteä, jaettava sanastoversio** — pakollinen tulevalle asynkroniselle
   haasteelle: kahden pelaajan on pelattava sama heitto samalla totuudella.

**Hinta.** Generointi kestää (~2,5 h); sanaston päivitys = uusinta-ajo + paketointi.

## 3. Merkistö: vain noppien 21 kirjainta, pituus 2–13

**Päätös.** Sallitaan vain `a d e g h i j k l m n o p r s t u v y ä ö`, 2–13 merkkiä.

**Perustelu.** **Koherenssi noppien kanssa:** mitä ei voi heittää, sitä ei pidä
hyväksyä. Sanakirja ja noppadata sanovat näin saman asian. Yksittäiskirjaimet
eivät ole sanoja; 13 = noppien määrä = pisin mahdollinen muodostettava sana.

**Hinta.** Osa aidoista sanoista (väärillä kirjaimilla) jää ulos — mutta niitä ei
voisi laudalle muodostaakaan, joten poisjättö on oikein.

## 4. b, c, f pois — mutta g sisään

**Päätös.** b/c/f eivät ole noppadatassa eivätkä sanastossa; **g on** (lisätty 14.6).

**Perustelu.** b/c/f esiintyvät suomessa *vain lainasanoissa* (banaani, curry,
fakta) — "kuolleita" kirjaimia, joiden poisjättö hävittää vain lainoja. **g on
eri tapaus:** se on natiivin ng-yhtymän kirjain (hengittää, rengas, sangen) JA
astevaihtelun nk→ng tuotos (kenkä→**kengät**, kaupunki→**kaupungin**, lanka→**langan**).
Datassa ~2 187 nk-vartaloista lemmaa tuottaa g:n taivutuksessa. Ilman g:tä peli
olisi hyväksynyt nk-sanan perusmuodon mutta hylännyt sen taivutusmuodot
(kenkä ✓, kengät ✗) — eli rikkonut kohdan 1 ydinlupauksen juuri siellä missä se
näkyy. Siksi g ansaitsi nopan (harvinaisena, arvo 7).

**Hinta.** Lukittua noppajakaumaa piti säätää (noppa 8: T6→T5, jakauma pysyi
37V/40K/1jokeri, koska g on konsonantti). g sijoitettiin N:ttömälle nopalle,
jotta n ja g voivat näkyä samassa heitossa → *ng* on muodostettavissa.

## 5. Poissuljetut affiksit: liitepartikkelit, omistusliitteet

**Päätös.** Ei -kin/-kaan/-pa/-han (+Foc) eikä -ni/-si/-nsa (+Px); ei myöskään
omistusliitteellisiä infinitiivejä (juostakseen).

**Perustelu.** Nämä ovat **produktiivista morfologiaa**, jonka voi liimata lähes
mihin tahansa sanaan (talo→talokin→talonikin→talossammekohan…). Ne räjäyttäisivät
sanaston ja tekisivät lähes kaikesta kelvollista — pelistä katoaisi mielekkyys.
Ne eivät ole "sanoja" vaan jatkeita, jotka pelaaja voisi aina lisätä.

**Hinta.** Pelaaja ei voi pelata aidolta tuntuvaa muotoa kuten "talokin".
Kompromissi rajan selkeyden hyväksi.

## 6. Olemassa olevat yhdyssanat sisään, keksityt ulos

**Päätös.** Kotuksen listaamat yhdyssanat taipuvat normaalisti; itse yhdistämäsi
uusi yhdyssana ei kelpaa.

**Perustelu.** Johdonmukainen sovellus kohdasta 1: lekikaalistunut yhdyssana
(jääkiekko) on sanakirjan sana; laudalla keksitty yhdistelmä (noppakortti) on
produktiivista liimausta. Build-aikainen generointi toteuttaa tämän rajan
itsestään — emme koskaan pyydä +Cmp-muotoja.

**Hinta.** Jotkin oikeat mutta listaamattomat yhdyssanat jäävät ulos. Hyväksytty,
koska vaihtoehto (kaikki produktiiviset yhdyssanat) tekisi pelistä rajattoman.

## 7. Erisnimet ja lyhenteet pois

**Päätös.** Pudotetaan kaikki isolla alkukirjaimella olevat Kotus-lemmat
(Ahti, ALV, AMK, ADHD).

**Perustelu.** Erisnimet eivät ole yleissanastoa; lyhenteet (alv, amk) eivät ole
"sanoja" joita pelissä punnitaan. Kotus listaa yleissanat gemenalla, joten iso
alkukirjain on luotettava signaali. Poisjättö vastaa kohdan 1 henkeä ja pitää
sanaston siistinä (ei "amk"/"alv"-tyyppisiä ei-sanoja).

**Hinta.** ~140 lemmaa pois. Mitätön, ja moni niistä putoaisi joka tapauksessa
merkistö-/väliviivasuodatuksesta.

## 8. Numeraalit ja pronominit vain perusmuodossa (V1)

**Päätös.** kaksi ✓ mutta kahden ✗; minä ✓ mutta minun ✗.

**Perustelu.** Näiden taivutusparadigmat ovat pieniä ja epäsäännöllisiä, ja täysi
kattavuus vaatisi omat FST-tagsetit. Suhteeton työ V1:een nähden; perusmuodot
ovat silti pelattavissa. Dokumentoitu rajoite, johon voi palata myöhemmin.

**Hinta.** Lukusanojen ja pronominien taivutusmuodot puuttuvat — pelaajalle
kerrottu selkosäännöissä.

## 9. Duaaliluokkaiset sanat taivutetaan kaikkien luokkiensa mukaan

**Päätös.** "adjektiivi, substantiivi" -lemma saa sekä adjektiivin että
substantiivin muodot (unioni).

**Perustelu.** Korjaa bugin, jossa `pos.split()[0]` säilytti pilkun ja pudotti
**1 533 yleissanaa** taivuttamatta. Sana joka on sekä adjektiivi että
substantiivi kuuluu taivuttaa molempina — muuten kohdan 1 lupaus pettää
hiljaisesti yleissanoilla. Maksimaalinen koherentti kattavuus.

**Hinta.** Hieman enemmän muotoja per duaalilemma (toivottua).

## 10. Sanastoversiointi + tuomarirajapinta

**Päätös.** DAWG nimetään versiolla (sanasto-fi-v1); validointi on rajapinnan
(`WordJudge`) takana.

**Perustelu.** Asynkroninen haaste kiinnittää siemenen **lisäksi** sanastoversion
— kaksi pelaajaa ei saa pelata samaa heittoa eri totuuksilla. Rajapinta sallii
muut kielet ja tuomarimoodin (ExactJudge / AdvisoryJudge / HumanJudge) ilman
pelikoodin muutoksia → markkina-ajatus (kielipaketti per kieli, rajakustannus ~0).

**Hinta.** Hieman ylimääräistä rakennetta, joka maksaa itsensä takaisin v2:ssa.

## 11. Hyväksytty rajoite: rinnakkaismuodot

**Päätös.** Hyväksytään tarkalleen ne muodot jotka GiellaLT fin-generaattori
tuottaa; suomen rinnakkaisista normimuodoista (talojen / taloiden; -ja / -ita)
usein vain toinen kelpaa.

**Perustelu (miksi tämä hyväksytään):** Täysi rinnakkaismuotojen kattavuus on
syvää FST-työtä, jonka hyöty V1:ssä ei vastaa kustannusta. Rajoite on
*dokumentoitu* — selkosäännöt kehottavat live-pelaajaa kokeilemaan toista muotoa.

**Hinta.** Pelaaja voi muodostaa aidon muodon jonka sanakirja hylkää. Tunnettu,
hyväksytty kompromissi (ei bugi).

## 12. Vokaalitakuu (noppadatan rajoite)

**Päätös.** Jos heitossa alle 4 vokaalia (jokeri vokaaliksi laskien), arvotaan
deterministisesti uudelleen samasta siemenestä.

**Perustelu.** Suomen sanat vaativat vokaaleja; konsonanttipainotteinen heitto
olisi käytännössä pelaamaton. Deterministisyys (sama siemen → sama lopputulos)
säilyttää toistettavuuden, jota asynkroninen haaste vaatii.

**Hinta.** Hyvin harvoin tarvitaan uusinta-arvonta; läpinäkyvä ja siemenpohjainen.

---

## Yhteenveto: yksi linja kaiken takana

Kaikki rajoitteet palautuvat **kahteen periaatteeseen**:

1. **Koherenssi** — sanakirja ja nopat sanovat saman asian (merkistö, g, pituus).
2. **Aito taivutus kyllä, ääretön liimaus ei** — raja vedetään siihen mikä on
   äärellistä ja sanakirjamaista (taivutus) vastaan siihen mikä on rajattomasti
   tuotettavaa (liitteet, keksityt yhdyssanat).

Loput ovat näiden kahden soveltamista, plus muutama dokumentoitu V1-kompromissi
(numeraalit/pronominit, rinnakkaismuodot) joista jokainen on tietoinen valinta,
ei vahinko.
