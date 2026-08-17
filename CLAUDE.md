# Itu — sananmuodostus-noppapeli

## Projekti
Offline-yksinpeli: kirjainnopista muodostetaan ristikko aikarajassa, pisteet kirjaimista.
**Vite + TypeScript, vanilla (ei Reactia)**, tiukka domain/UI-erotus. Dev: `http://localhost:5177/`.
Live: https://tommi-itu.vercel.app · Asennettava PWA (`public/manifest.webmanifest` + `sw.js`).
Repo-kansion nimi on `SanaMix` (vanha työnimi); peli = **Itu**.

## Lue ENNEN muutosta (älä päättele koodista tai muistista)
Dokumentit ovat kanonisia ja koodia vasten todennettuja. Avaa relevantti ennen kuin kosket logiikkaan:
- **Design / mekaniikka / pisteytys:** [ITU.md](ITU.md) — lukitut päätökset (nopat, pisteytys, sanasto).
- **Sanaston hyväksymissäännöt:** [SANASTO.md](SANASTO.md) — mitä taivutuksia sisään/ulos, DAWG-formaatti.
- **Morfologia / FST-generointi:** [build/MORFOLOGIA.md](build/MORFOLOGIA.md) — lemmalista → muodot -putki.
- **Opi-moodin design:** [OPIMOODI.md](OPIMOODI.md) — adaptiivinen kielioppihaaste (vaihe 1 ja 2 toteutettu).
- **Perustelut:** [PERUSTELUT.md](PERUSTELUT.md).

## Rakenne
- `src/domain/` — puhdas pelilogiikka, testattu (`board, dice, roll, rng, scoring, learn, premium`).
- `src/dict/` — sanakirja: `dawg` (haku), `judge` (WordJudge-rajapinta), `morph` (sijataulukko), `lemmas/load/builder`.
- `src/rules/` — sääntötekstien sisältö + näkymä (esimerkkivetoinen, ei kielioppitermejä pelissä).
- `src/ui/game.ts` — DOM/näkymä. `src/ui/viewstate.ts` — näkymän oma tila (`ui`-objekti):
  ne kentät joita luetaan vain näkymä- ja elefunktioista, ei yhdestäkään domainkutsusta.
  Uusi näkymätila kuuluu tänne, ei moduulitason `let`-muuttujaksi `game.ts`:hen.
  `src/main.ts` — entry. `src/styles.css`.
- `build/` — **offline-build-putki** (Python + `build_dawg.ts`): Kotuksen lista → DAWG. EI runtime-WASMia.
- `data/` lähde, `public/dict/` paketoitu sanasto + analyysidata (lazy).

## Invariantit (älä riko ilman keskustelua)
- **Offline-pelirauha:** EI verkkopalvelua, EI monikielisyyttä. Ääni OLETUKSENA POIS, valinnainen
  kevyt torvi/kannel-teema (`itu:sound:v1`, päätös 7.7.2026) — pelirauha koskee oletustilaa,
  ei ääntä kokonaan. Tietoisia valintoja (ks. ITU.md).
- **"Ei korvaa mitään":** Scrabble-pistemoodi (oletus POIS), Opi-moodi (oletus POIS, **PEHMEÄ**) ja aikabonus
  ovat *kerroksia* nykypelin päällä — eivät muuta sanastoa, lautaa, noppia eivätkä perus-ennätyksiä.
- **Ei hallusinaatiota:** sijamuoto/analyysi tulee build-aikaisesta FST-lähteestä + käsin todennetusta
  `src/dict/morph.ts`-taulukosta (sama lähde joka muodon hyväksyy). Tuntematon → näytä tyhjä, älä arvaa.
- **Determinismi:** sama siemen → sama heitto (`domain/rng.ts`). Sanastoversio on osa identiteettiä
  (`sanasto-fi-v1`) tulevaa asynkronista haastetta varten — älä riko siemen/versio-kiinnitystä.
- Nopat ja sanaston säännöt on merkitty **LUKITTU** ITU.md:ssä — muutos vaatii eksplisiittisen päätöksen.

## Sopimusmuutos-protokolla
Jos tilanne (bugi, pelitestilöytö, ideakysymys) rikkoo kanonisen dokumentin sääntöä, älä oleta
kumpaakaan osapuolta automaattisesti oikeaksi. Nosta eksplisiittisesti pohdittavaksi: korjataanko
koodi dokumentin mukaiseksi VAI muutetaanko dokumenttia? Dokumenttimuutos kirjataan ensin
(ITU.md/SANASTO.md/ym.) ja vahvistetaan käyttäjällä, vasta sitten koodiin.

## Komennot
- `npm run dev` — devpalvelin (portti 5177, strictPort).
- `npm test` — Vitest (domain-testit, node-ympäristö).
- `npm run build` — `tsc --noEmit && vite build` (tyyppivirhe kaataa buildin).
- `npm run dict:pack` — generoi DAWG (`build/build_dawg.ts`).

## Versiointi ja julkaisu
- **SemVer + [CHANGELOG.md](CHANGELOG.md)** (Superjatsin malli). Bumppaa `package.json`in
  versio ja kirjaa muutos changelogiin **ennen pushia**. Versionumerot 0.1.0–0.7.0 ovat
  takautuvia, git-historiasta 26.7.2026 rekonstruoituja nimilappuja; siitä eteenpäin numero
  kulkee muutoksen mukana.
- Versio näkyy pelaajalle Tietoja-välilehdellä (`Itu v… · päiväys`). Leima tulee
  `package.json`ista build-aikana (`vite.config.ts` → `__APP_VERSION__`, `__BUILD_DATE__`),
  joten `package.json` on ainoa totuuden lähde, ei kovakoodattu merkkijono.
- `git push origin main` → Vercelin git-integraatio auto-deployaa tuotantoon. EI erillistä
  CLI-deployta. Odota ~30–60 s, todenna tarvittaessa bundle-grepillä. (Universaali
  `julkaise`-skill kattaa tämän.)
