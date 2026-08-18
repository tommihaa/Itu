# Muutosloki

Kaikki merkittävät muutokset kirjataan tähän. Muoto noudattaa löyhästi
[Keep a Changelog](https://keepachangelog.com/) -periaatetta. Versiointi: [SemVer](https://semver.org/).

> **Takautuva rekonstruktio.** Itu kehitettiin 17.6.2026 alkaen ilman muutoslokia, ja
> `package.json` jäi lukemaan `0.4.0` vaikka sen jälkeen ilmestyivät muun muassa ääniteema,
> Tietoja-välilehti ja ajatusviivapassi. Alla olevat versionumerot on annettu 26.7.2026
> takautuvasti **git-historian perusteella**, ei muistista: kukin versio vastaa yhtä
> ajallisesti ja aiheellisesti yhtenäistä committiryhmää. Vain 0.7.1 on julkaistu tällä
> numerolla, aiemmat numerot ovat jälkikäteisiä nimilappuja jo tuotannossa olevalle
> koodille. Tästä eteenpäin versio bumpataan ennen pushia, kuten Superjatsissa.

## [0.8.0] – 2026-08-17

### Muutettu
- **Näkymän tila ja pelaajan valinnat omiin moduuleihinsa.** `src/ui/game.ts` piti sisällään
  53 moduulitason muuttujaa, joissa näkymän tila, syöttötila, pelaajan asetukset ja pelin
  oma tila olivat samassa kasassa. Uusi `src/ui/viewstate.ts` omistaa sen mikä katoaa sivun
  uudelleenlatauksessa (avoin paneeli, välilehtivalinnat, kursori, nosto, raahaus, kehystys
  ja vieritys) ja uusi `src/ui/settings.ts` sen mikä ei katoa (pistemoodi, aikabonus, kesto,
  Opi-moodin kytkin, äänet, telineen järjestys, nimimerkki) levytallennuksineen. Muuttujia
  jäi 23. Pelaajalle ei näy mitään muutosta: sama peli, samat asetukset, samat tallennukset.
- **Neljä paneelilippua yhdeksi kentäksi.** Säännöt, Ennätykset, Sanapoliisi ja Asetukset
  olivat neljä erillistä totuusarvoa, vaikka vain yksi voi olla auki kerrallaan. Nyt
  poissulkevuus on tyypissä, joten kahta paneelia ei voi enää vahingossa avata yhtä aikaa.

## [0.7.3] – 2026-07-26

### Korjattu
- **Ajatusviiva `index.html`:n meta-kuvauksesta.** "Itu: suomenkielinen sananmuodostuspeli"
  → "Itu on suomenkielinen sananmuodostuspeli". Kuvaus näkyy hakutuloksissa ja linkin
  esikatselussa, joten se on käyttäjälle näkyvää tekstiä. Ohitus 25.7. passista: haku oli
  rajattu nimettyihin polkuihin. `ajatusviivat`-skill hakee nyt koko reposta.

## [0.7.2] – 2026-07-26

### Korjattu
- **Loppunäytön "Lisäksi osuit:" -rivi jäi teemalistan alle.** Teemojen kuvauslistalla
  (`.sm-learn-desc`) on negatiivinen ylämarginaali, jotta se tarttuu kiinni pelipalkin
  ⓘ-nappiin. Loppunäytössä sama lista seuraa otsikkoa tai "Lisäksi osuit:" -riviä, joten
  marginaali veti listan reunuksen ja taustan 4,8 px tekstin päälle. Päällekkäisyys näkyi
  vasta kun bonusosumia oli, koska vain osumarivillä on taustaväri. Korjaus rajattu
  loppunäyttöön (`.sm-learn-result .sm-learn-desc`), pelipalkin kiinnitys säilyy.
  Löytyi pelitestissä (Opi-moodi päällä).

## [0.7.1] – 2026-07-25

### Korjattu
- Ajatusviivapassi: ajatusviivat pois UI-teksteistä, termiponnahduksen erotin välipisteeksi
  (selaintodennuksen löydös) ja `manifest.webmanifest`in nimen ajatusviiva välipisteeksi.
  Mukana kaksi selkokielikorjausta.
- Termimoduulin speksiviittaus osoittaa Kaanon-repoon.

### Huom
- Tämän version numero on takautuva. Tuotannon versioleima näytti vielä `v0.4.0`.

## [0.7.0] – 2026-07-16

### Lisätty
- **Esittely/Tietoja-välilehti:** intro, palaute- ja Ko-fi-linkit, PWA-asennusohje,
  "muut pelit" -nosto ja **näkyvä versioleima** (`Itu v… · päiväys`). Leima tulee
  build-aikaisista vakioista (`vite.config.ts` → `__APP_VERSION__`, `__BUILD_DATE__`).
- `judge`- ja `morph`-testit; haastekoodaus refaktoroitu domainiin.

### Muutettu
- Opi-moodin status dokumenteissa: vaiheet 1 ja 2 deployattu ja todennettu.

## [0.6.0] – 2026-07-06

### Lisätty
- **Valinnainen ääniteema "Torvi & kantele"** (`itu:sound:v1`, oletus POIS) ja
  `efektit.html`-kuuntelutyökalu.

### Muutettu
- Äänet siirtyivät oskillaattorisynteesistä oikeisiin CC0-ääninäytteisiin. Synteesi
  kuulosti retropeliltä eikä istunut pelin sävyyn.

## [0.5.0] – 2026-07-03

### Lisätty
- **Termimoduuli:** jaettu termiskeema Lahja-kokoelmalle (`TERMIMODUULI.md` v1). Mekanismi
  jaetaan sisarprojektien kesken, data ei.
- `README.md` repon julkisivuksi ja `CLAUDE.md` projektiohjeeksi (rakenne, invariantit,
  komennot, julkaisu).
- Muodollinen CC BY 4.0 -attribuutio Kotuksen sanalistalle.

### Korjattu
- **Haastelinkki kiinnittää sanastoversion.** Ilman kiinnitystä sama siemen olisi voinut
  tuottaa eri tuloksen eri sanastoversiolla, mikä rikkoisi asynkronisen haasteen.
- Opi-moodin päivän teemat jäädytetään koko päiväksi.
- Syväkatselmoinnin löydökset ennen repon kääntämistä julkiseksi.
- Konekohtainen `.claude`-konfiguraatio pois versionhallinnasta.

## [0.4.0] – 2026-06-28

### Lisätty
- **Opi-moodi, vaiheet 1 ja 2** (asetus, oletus POIS): adaptiivinen kielioppihaaste,
  aikasuhde-normalisointi (pistettä/min) ennätyksiin, kaveri-teemahaaste ja
  ryhmätasapaino, teemojen kuvailu ennen peliä (ⓘ-toggle + esimerkit) sekä
  Opi-kuvaukset loppunäytölle.
- **Asennettava PWA:** manifest, service worker ja taimi-ikonit.
- Kierroksen kesto asetukseksi; ennätykset eroteltu per (pistemoodi × kesto).
- Per-sana-pisteet Lopputulos- ja Ennätykset-näyttöihin.

### Muutettu
- Mobiililayout: näkymänapit ☰-valikkoon, jolloin palkki kutistui 210 px → 77 px ja lauta
  kasvoi kolminkertaiseksi. Teline, nopat ja yleisilme hiottiin samalla.
- Noppatakuu 4 → 5, konsonanttitakuu.

### Korjattu
- Työpöydän kadonneet napit; teline kahdelle riville.

## [0.3.0] – 2026-06-24

### Lisätty
- **Scrabble-pistemoodi** (asetus, oletus POIS): premium-ruudut, bingo ja keskusankkuri.
  Kerros nykypelin päällä, ei muuta sanastoa, lautaa eikä perus-ennätyksiä.
- Aikabonus: kirjainkynnys (≥11/13 käytettyä) aikaportin tilalle.
- Perusmuodon sanakirjalinkit; sääntöperustelu liite- ja omistusliitteiden hylkäämiselle.

### Muutettu
- UI-erä: nappipalkin ryhmittely, emojit, sarkain-vihje, kosketusohje, Lukitse-emoji ja
  aloitusopaste väistyy kun ruutu valitaan. "Tarkastaja" nimettiin "Sanapoliisiksi".

### Korjattu
- Lighthouse-parannukset (a11y, SEO, best practices, mobiiliperffi).
- `-minen`-teonnimi kuvataan täysin, kaikki 326 koodia katettu.
- `SANASTO.md`: Scrabble-väite koski listaa vastaan generaattoria, ei perusmuotoa vastaan
  taivutusmuotoa.

## [0.2.0] – 2026-06-22

### Lisätty
- **Sanantarkistin:** pelin ulkopuolinen "käykö tämä sana" -haku.
- **Monikierroshaaste:** ottelu (1/3/5/10 kierrosta) ja kaksisuuntainen tulosvertailu.
- Näppäimistösyöttö: sanat voi kirjoittaa kursorilla (saavutettavuus).
- Opettavuus: muoto → lemma ja hyväksymissyyt (perusmuoto vai taivutusmuoto).
- Tarkastaja-morfologia ja konditionaali sanakirjaan; monilaitekäyttö ja ohje.

### Korjattu
- Verbien infinitiivit (`+Act`): perusmuoto takaisin.
- Zoomin vakaus, zoom pois käytöstä siellä missä se sotki laudan.

## [0.1.0] – 2026-06-17

Ensimmäinen pelattava versio. Peli sai nimen **Itu** (työnimi oli "13 kirjainta sanoiksi";
repo-kansio on yhä `SanaMix`, vielä vanhempi työnimi).

### Lisätty
- Ydinpeli: kirjainnopista muodostetaan ristikko aikarajassa, pisteet kirjaimista.
- Ennätyslista (localStorage).
- Jokeri: auto-päättely ja inline-kirjainvalitsin `window.prompt`in tilalle.
- Offline-haaste: jaa siemen / pelaa siemenellä.
- Säännöt listaavat kaikki kirjaimet (pelissä / ei pelissä) ja perustelevat miksi
  b, c, f, q, w, x, z ja å jäivät pois.

### Muutettu
- Telinenapin nimi "Sointu" → "Vokaalisointu": selvä kieli, ei musiikkikytköstä.

### Korjattu
- Pisteytys: laudalle jääneet ei-sanat sakotetaan.
