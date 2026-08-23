# Perustelut: miksi nämä sanaston ja noppien rajoitteet?

Tämä dokumentti kokoaa **miksi** kukin rajoite valittiin. *Mitä* hyväksytään:
[SANASTO.md](SANASTO.md). Noppadata: [ITU.md](ITU.md). Jokainen kohta:
**päätös → perustelu → hinta/vaihtoehto** (mitä punnittiin).

---

## 1. Ydinperiaate: kaikki aito taivutus sisään, produktiivinen liimaus ulos

**Päätös.** Hyväksytään suomen sanojen kaikki taivutusmuodot, mutta ei
liitepartikkeleita, omistusliitteitä eikä itse keksittyjä yhdyssanoja.

**Perustelu.** Scrabble "runnoo suomea" perusmuotosäännöillä, se sopii englantiin,
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
1. **Estää keksityt yhdyssanat luonnostaan**, runtime-Voikko hyväksyisi minkä
   tahansa produktiivisen yhdistelmän; me tunnemme vain listatuista lemmoista
   tuotetut muodot.
2. **Nollaviive**: ei WASM-latausta eikä ajonaikaista morfologiaa.
3. **Kiinteä, jaettava sanastoversio**, pakollinen tulevalle asynkroniselle
   haasteelle: kahden pelaajan on pelattava sama heitto samalla totuudella.

**Hinta.** Generointi kestää (~2,5 h); sanaston päivitys = uusinta-ajo + paketointi.

## 3. Merkistö: vain noppien 21 kirjainta, pituus 2–13

**Päätös.** Sallitaan vain `a d e g h i j k l m n o p r s t u v y ä ö`, 2–13 merkkiä.

**Perustelu.** **Koherenssi noppien kanssa:** mitä ei voi heittää, sitä ei pidä
hyväksyä. Sanakirja ja noppadata sanovat näin saman asian. Yksittäiskirjaimet
eivät ole sanoja; 13 = noppien määrä = pisin mahdollinen muodostettava sana.

**Hinta.** Osa aidoista sanoista (väärillä kirjaimilla) jää ulos, mutta niitä ei
voisi laudalle muodostaakaan, joten poisjättö on oikein.

## 4. b, c, f, q, w, x, z, å pois: mutta g sisään

**Päätös.** b/c/f sekä q/w/x/z/å (samoin š/ž) eivät ole noppadatassa eivätkä
sanastossa; **g on** (lisätty 14.6).

**Perustelu.** Nämä ovat suomen *vieraskirjaimia*: ne esiintyvät vain
lainasanoissa ja erisnimissä ja ovat frekvenssiltään häviävän pieniä, b/c/f
(banaani, curry, fakta), q/w/x/z (taxi, pizza, watti, qigong), å (Åland,
ångström, ruotsalaisperäiset nimet). Poisjättö hävittää vain lainoja, ei
kotoperäisiä sanoja. Rajaus on myös linjassa vakiintuneen suomalaisen
sanapelikäytännön kanssa: **c, q, w, x, z ja å puuttuvat suomalaisesta
Scrabblesta** (ja monilta Sana Mix -tyyppisiltä noppasanapeleiltä); b ja f ovat
Scrabblessa mukana harvinaisina kalliina kivinä, mutta jätimme nekin pois
pitääksemme pelin puhtaasti kotoperäisenä, kohdan 3 koherenssin (vain
heitettävissä olevat kirjaimet kelpaavat) ja tämän pelin "harjoittele oikeaa
suomea" -hengen mukaisesti. **g on eri tapaus:** se on natiivin ng-yhtymän kirjain (hengittää, rengas, sangen) JA
astevaihtelun nk→ng tuotos (kenkä→**kengät**, kaupunki→**kaupungin**, lanka→**langan**).
Datassa ~2 187 nk-vartaloista lemmaa tuottaa g:n taivutuksessa. Ilman g:tä peli
olisi hyväksynyt nk-sanan perusmuodon mutta hylännyt sen taivutusmuodot
(kenkä ✓, kengät ✗), eli rikkonut kohdan 1 ydinlupauksen juuri siellä missä se
näkyy. Siksi g ansaitsi nopan (harvinaisena, arvo 7).

**Hinta.** Lukittua noppajakaumaa piti säätää (noppa 8: T6→T5, jakauma pysyi
37V/40K/1jokeri, koska g on konsonantti). g sijoitettiin N:ttömälle nopalle,
jotta n ja g voivat näkyä samassa heitossa → *ng* on muodostettavissa.

## 5. Poissuljetut affiksit: liitepartikkelit, omistusliitteet

**Päätös.** Ei -kin/-kaan/-pa/-han (+Foc) eikä -ni/-si/-nsa (+Px); ei myöskään
omistusliitteellisiä infinitiivejä (juostakseen).

**Perustelu.** Nämä ovat **produktiivista morfologiaa**, jonka voi liimata lähes
mihin tahansa sanaan (talo→talokin→talonikin→talossammekohan…). Ne eivät ole
"sanoja" vaan jatkeita, jotka pelaaja voisi aina lisätä, ja juuri se on peruste:
raja vedetään kohdan 1 mukaisesti siihen mikä on äärellistä ja sanakirjamaista,
ei siihen minkä voi aina panna perään. Peruste on siis kategorinen eikä
määrällinen, eikä se riipu siitä kuinka paljon sanasto kasvaisi.

*Sanamuoto korjattiin 23.8.2026, ja vanha jätetään näkyviin.* Tässä luki aiemmin
että liitteet ~~räjäyttäisivät sanaston ja tekisivät lähes kaikesta kelvollista,
pelistä katoaisi mielekkyys~~. Alla oleva mittaus ei tue jälkimmäistä puolta:
kelpaavuus nousee satunnaisessa asettelussa 2,462 prosentista 2,517 prosenttiin.
Ensimmäinen puoli pitää muotomäärästä (5,3-kertainen) muttei pakatusta koosta
(1,8-kertainen), ja se sana kuuluu kohtaan 6, jonka kerroin on 917. Päätös ei
muuttunut, koska se ei koskaan lepännyt näillä luvuilla; perustelu lepäsi, ja se
on nyt korjattu.

**Hinta.** Pelaaja ei voi pelata aidolta tuntuvaa muotoa kuten "talokin".
Kompromissi rajan selkeyden hyväksi.

**Mittaus 23.8.2026.** Perustelu oli tähän asti uskottava mutta mittaamaton, ja
tämä lohko antaa sille luvun **avaamatta päätöstä uudelleen**. Mittausskriptit ovat
`build/mittaa_affiksit.py`, `build/mittaa_dawg.ts`, `build/mittaa_pelattavuus.py` ja
`build/mittaa_vaihtoehdot.py`, tulokset `build/mittaus/`.

*Otos.* 600 lemmaa tasavälein Kotus-listalta, joista 383 tuotti FST:llä perusmuodon.
Loput ohitettiin, ja ohitus on symmetrinen: sama lemma puuttuu molemmista luvuista.

*Koko.* Kuusi omistusliitettä, neljä FST:n hyväksymää liitepartikkelia ja niiden
yhdistelmät nostavat otoksen muotomäärän 14 072:sta 75 243:een, eli **kerroin on
5,3**. Koko sanastoon suhteutettuna 2 314 988 muotoa olisi noin 12,4 miljoonaa.
Luku on **13 merkin rajan leikkaama**: affiksoiduista muodoista 30 602 eli 41 %
on tasan 13 merkkiä pitkiä, joten kasvua rajaa lauta eikä morfologia.

*Pakattu koko.* Sama otos DAWG:ksi rakennettuna kasvaa **1,8-kertaiseksi** (19 632 →
36 000 tavua, gzipattuna 11 630 → 19 119). Liite on jaettu loppuosa, jonka DAWG
kutistaa, joten koko ei kasva muotomäärän tahdissa. Nykyinen `sanasto-fi-v1.dawg`
on 895 400 tavua, joten arvio on noin 1,6 Mt. Arvio on otoksesta eikä täydestä
sanastosta, ja pieni otos jakaa vähemmän rakennetta kuin suuri, joten se on
todennäköisemmin yläraja kuin alaraja.

*Pelattavuus.* 400 heittoa pelin omalla satunnaisvirralla ja 1,2 miljoonaa
satunnaista asettelua: kelpaavuus nousee **2,462 %:sta 2,517 %:iin**. Vaikutus on
kokonaan pituudessa. Kahdesta neljään kirjaimen asetteluissa se on nolla, kuudessa
1,3-kertainen ja kahdeksassa 4,4-kertainen, mutta kahdeksan kirjaimen kelpaavuus on
silloinkin 0,022 %.

*Vaihtoehtojen määrä.* 150 heittoa, ja pelattavia sanoja per heitto on mediaanina
**1248, liitteiden kanssa 1871**, eli 1,5-kertainen määrä.

*Approksimaation raja, koska se muuttaa jälkimmäisten lukujen suunnan.* Kaksi
viimeistä lukua eivät käytä FST:tä vaan merkkijonosääntöä (liite kiinnittyy
taivutettuun muotoon sellaisenaan). Otosta vasten mitattuna se löytää 79 %
FST:n tuottamista muodoista ja tuottaa 40 % sellaista jota FST ei tuota, eli se
**yliarvioi** liitteiden vaikutuksen. Mitatut kelpaavuusluvut ovat siis ylärajoja.

*Mitä mittaus muutti ja mitä ei.* Päätös ei muuttunut, koska se ei ollut lukuun
sidottu. Perustelun sanamuoto muuttui, ja se on yllä: sanaston kasvu on todellinen
mutta pakattuna 1,8-kertainen, ja väite *tekisivät lähes kaikesta kelvollista* ei
saanut tukea asettelumittauksesta. Voimakkain räjähdys on kohdassa 6 eikä tässä.
Korjaus tehtiin sopimusmuutos-protokollan mukaisesti: mittaus nostettiin
päätettäväksi, Tommi päätti korjata sanamuodon, ja korjaus kirjattiin tähän
dokumenttiin eikä pelkkään käytäntöön.

## 6. Olemassa olevat yhdyssanat sisään, keksityt ulos

**Päätös.** Kotuksen listaamat yhdyssanat taipuvat normaalisti; itse yhdistämäsi
uusi yhdyssana ei kelpaa.

**Perustelu.** Johdonmukainen sovellus kohdasta 1: lekikaalistunut yhdyssana
(jääkiekko) on sanakirjan sana; laudalla keksitty yhdistelmä (noppakortti) on
produktiivista liimausta. Build-aikainen generointi toteuttaa tämän rajan
itsestään, emme koskaan pyydä +Cmp-muotoja.

**Hinta.** Jotkin oikeat mutta listaamattomat yhdyssanat jäävät ulos. Hyväksytty,
koska vaihtoehto (kaikki produktiiviset yhdyssanat) tekisi pelistä rajattoman.

**Mittaus 23.8.2026.** Tämä luku on **eksakti eikä otos**, koska vapaa yhdyssana on
lemmaparien kombinatoriikkaa eikä vaadi FST-ajoa: yhdyssana taipuu loppuosansa
mukaan, joten muoto on etuosa + loppuosan taivutettu muoto, ja 13 merkin raja
sanoo mitkä loppuosan muodot mahtuvat perään. Skripti on
`build/mittaa_yhdyssanat.py`, tulos `build/mittaus/yhdyssanat.json`.

Etuosaehdokkaita on 59 765, ja vapaat yhdyssanat toisivat **2 122 586 441 muotoa
lisää, eli 917 kertaa nykyiset 2 314 988 muotoa**. Luku on alaraja: se kattaa vain
kaksiosaiset yhdyssanat perusmuotoisella etuosalla, joten kolmiosaiset (*sanapelinoppa*)
ja genetiivialkuiset (*talonpoika*) jäävät sen ulkopuolelle.

Sana *rajaton* yllä olevassa hinnassa on siis mitattuna oikea, ja se erottaa tämän
kohdan kohdasta 5, jonka kerroin on 5,3.

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

**Hinta.** Lukusanojen ja pronominien taivutusmuodot puuttuvat, pelaajalle
kerrottu selkosäännöissä.

## 9. Duaaliluokkaiset sanat taivutetaan kaikkien luokkiensa mukaan

**Päätös.** "adjektiivi, substantiivi" -lemma saa sekä adjektiivin että
substantiivin muodot (unioni).

**Perustelu.** Korjaa bugin, jossa `pos.split()[0]` säilytti pilkun ja pudotti
**1 533 yleissanaa** taivuttamatta. Sana joka on sekä adjektiivi että
substantiivi kuuluu taivuttaa molempina, muuten kohdan 1 lupaus pettää
hiljaisesti yleissanoilla. Maksimaalinen koherentti kattavuus.

**Hinta.** Hieman enemmän muotoja per duaalilemma (toivottua).

## 10. Sanastoversiointi + tuomarirajapinta

**Päätös.** DAWG nimetään versiolla (sanasto-fi-v1); validointi on rajapinnan
(`WordJudge`) takana.

**Perustelu.** Asynkroninen haaste kiinnittää siemenen **lisäksi** sanastoversion,
kaksi pelaajaa ei saa pelata samaa heittoa eri totuuksilla. Rajapinta sallii
muut kielet ja tuomarimoodin (ExactJudge / AdvisoryJudge / HumanJudge) ilman
pelikoodin muutoksia → markkina-ajatus (kielipaketti per kieli, rajakustannus ~0).

**Hinta.** Hieman ylimääräistä rakennetta, joka maksaa itsensä takaisin v2:ssa.

## 11. Hyväksytty rajoite: rinnakkaismuodot

**Päätös.** Hyväksytään tarkalleen ne muodot jotka GiellaLT fin-generaattori
tuottaa; suomen rinnakkaisista normimuodoista (talojen / taloiden; -ja / -ita)
usein vain toinen kelpaa.

**Perustelu (miksi tämä hyväksytään):** Täysi rinnakkaismuotojen kattavuus on
syvää FST-työtä, jonka hyöty V1:ssä ei vastaa kustannusta. Rajoite on
*dokumentoitu*, selkosäännöt kehottavat live-pelaajaa kokeilemaan toista muotoa.

**Hinta.** Pelaaja voi muodostaa aidon muodon jonka sanakirja hylkää. Tunnettu,
hyväksytty kompromissi (ei bugi).

## 12. Vokaali- ja konsonanttitakuu (noppadatan rajoite)

**Päätös.** Jos heitossa on alle 5 vokaalia TAI alle 5 konsonanttia (jokeri
lasketaan kumpaankin, koska se voi toimia kumpanakin), arvotaan deterministisesti
uudelleen samasta satunnaisvirrasta, kunnes molemmat rajat täyttyvät.

**Perustelu.** Suomen sanat vaativat sekä vokaaleja että konsonantteja;
kumpaankin suuntaan rappeutunut heitto (esim. 1 konsonantti) olisi käytännössä
pelaamaton, koska siitä ei saa ristikkoa kokoon. Molemminpuolinen takuu estää
tämän. Deterministisyys (sama siemen → sama lopputulos) säilyttää
toistettavuuden, jota asynkroninen haaste vaatii. Raja nostettiin alun perin
4:stä 5:een käyttäjähavainnon perusteella.

**Hinta.** Hyvin harvoin tarvitaan uusinta-arvonta; läpinäkyvä ja siemenpohjainen.

---

## Yhteenveto: yksi linja kaiken takana

Kaikki rajoitteet palautuvat **kahteen periaatteeseen**:

1. **Koherenssi**: sanakirja ja nopat sanovat saman asian (merkistö, g, pituus).
2. **Aito taivutus kyllä, ääretön liimaus ei**: raja vedetään siihen mikä on
   äärellistä ja sanakirjamaista (taivutus) vastaan siihen mikä on rajattomasti
   tuotettavaa (liitteet, keksityt yhdyssanat).

Loput ovat näiden kahden soveltamista, plus muutama dokumentoitu V1-kompromissi
(numeraalit/pronominit, rinnakkaismuodot) joista jokainen on tietoinen valinta,
ei vahinko.
