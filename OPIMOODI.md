# Itu: Opi-moodi (adaptiivinen kielioppihaaste)

> Designdokumentti. Status: **VAIHE 1 TOTEUTETTU 28.6.2026** (deployattu 28.6, todennettu 30.6).
> Toteutus: puhdas domain `src/domain/learn.ts` (+ `test/learn.test.ts`, 18 testiä) +
> UI-kytkennät `src/ui/game.ts` (⚙️-toggle `itu:learnmode:v1`, teemasirut laudan yllä,
> reaaliaikainen osuma, loppunäyttö + viikkopalkki, edistymä `itu:learn:v1`) + CSS.
> Todennettu livenä (port 5177): tavoitesirut, "nimet" → nominatiivi+monikko syttyivät,
> loppunäyttö 2/3, edistymä tallentui, 71/71 testiä, tsc puhdas. Tagimerkkijonot varmistettu morph.ts:stä.
>
> **VAIHE 2 (kaveri-teemahaaste) TOTEUTETTU 28.6.2026** (deployattu 28.6, todennettu 30.6). Päätökset:
> *erillinen Teemahaaste-moodi*, voittaja *teemakattavuudesta, pisteet tasurina*. Jaettu
> tavoitesetti (= haastajan `pickDuelThemes`, n=`DUEL_THEME_COUNT`=5) napsautetaan
> haastelinkkiin → SAMA molemmille (reilu), syrjäyttää vastaajan oman adaptiivisen setin.
> **Ryhmätasapaino:** `pickDuelThemes` käyttää samaa adaptiivista järjestystä (`rankThemes`,
> jaettu `pickDailyTargets`:n kanssa) mutta soveltaa per-ryhmä-kattoa `DUEL_GROUP_CAP`
> (sija≤2, partisiippi≤2, vertailu≤2, luku≤1, aikamuoto≤1) → setti levittyy ryhmien yli eikä
> painotu sijoihin (14/22 teemasta on sijoja; moni harvinainen sija on vaikea osua laudalle).
> 2-vaiheinen: jos katot jättävät vajaaksi, 2. vaihe täyttää parhailla jäljellä olevilla.
> Rakennettu nykyisen ottelu-/haastelinkki-infran päälle (ei backendiä): `ChallengePayload`
> +`th`/`a.h`/`r.h`, `Match`+`themes`/`myThemeHits`, `Opp`+`themeHits`; uusi `startThemeMatch`,
> `renderThemeMatchSummary` (kattavuusruudukko + duelWinner-banneri), Teemahaaste-osio
> Haaste-modaaliin (näkyy kun Opi-moodi päällä). Domain: `coveredTargets`/`duelWinner`/
> `DUEL_THEME_COUNT` + testit (77/77, tsc puhdas). Todennettu port 5177: modaali-osio,
> jaettu teemapalkki, loppunäyttö (kattavuusvoitto + pistetasuri-banneri), vastaaja saa
> haastajan setin. Banneri korjattu: kattavuustasapelissä "voitti pisteillä", ei "useampaan teemaan".
> Syntyi vertailevasta sanapelitutkimuksesta (ks. lopun liite).
>
> **Toteutuksen poikkeamat designista:** (1) toggle ja edistymä eri avaimissa
> (`itu:learnmode:v1` vs `itu:learn:v1`), design ehdotti samaa avainta molemmille,
> mikä ei toimi (boolean vs objekti). (2) `lastHit` on ISO-päivästringi ("YYYY-MM-DD",
> ""=ei koskaan), ei ms-aikaleima → ISO-stringit vertautuvat kronologisesti suoraan
> (`weeklyProgress` käyttää `>=`). (3) Lisätty `recordThemeSession` (puhdas edistymäpäivitys)
> jota design ei nimennyt mutta edellytti. (4) `seen` = montako kertaa tarjottu tavoitteena,
> `hits` = montako kertaa osuttu KUN tarjottu (→ osumasuhde ≤ 1); ei-tarjotut osumat
> päivittävät vain `lastHit`:n (viikkokoontiin).

## Konteksti

Itun aito kilpailuetu sanapelikentässä on **kielioppiselite pelin sisällä** (Sanapoliisi)
+ **täysi taivutus hyväksytään**, lähes yksikään kilpailija ei tee kumpaakaan. Opi-moodi
vie tämän edun askeleen pidemmälle: tekee taivutuksen *tavoitteeksi*, ei vain sallituksi.

**Malli:**
- **Adaptiivinen, henkilökohtainen.** Päivän teemat valitaan pelaajan oman historian
  mukaan (heikoimmat/harjoittelemattomat ensin, spaced repetition).
- **Useita teemoja per päivä + viikkotavoite.** Et osu yhteen pakkosijaan vaan *keräät*
  päivän teemoja kohti viikon koontitavoitetta.
- **Pehmeä, ei-estävä** (oli työoletus; pakko-vs-bonus **päätettiin 26.6.2026**, ks. osio
  *Päätetty: PEHMEÄ*).
- **Laajuus: kieliopilliset teemat** = sijat + luku (yks./mon.) + aikamuoto + vertailu
  + partisiipit, ei vain 14 sijaa.
- **Vaiheistus:** "haasta itsesi" (yksinpeli) ensin → "kaveri-moodi" (haastelinkki) sen
  jälkeen. **Molemmat toteutettu 28.6.2026**, ks. doc-header ja osio *Vaiheistus*.

**Miksi tämä on teknisesti halpa:** kaikki tarvittava data on jo olemassa.
`lemmas.lookup(sana)` → `Analysis[]` koodeilla kuten `N+Sg+Ine`, ja `describeCode()` /
`CASE_INFO` muuntaa ne selkokieleksi. "Osuiko pelaaja inessiiviin laudalla" = katso
laudan sanojen analyysit, tarkista sisältääkö joku koodi `+Ine`. Sama auktoritatiivinen
FST-lähde kuin Sanapoliisissa, ei hallusinaatiota.

---

## Suunnittelumalli (domain/ui-erottelu, kuten muu Itu)

### Uusi puhdas domain-moduuli: `src/domain/learn.ts`

Ei DOM:ia, ei localStoragea, testattava yksikkötesteillä (kuten `premium.ts`).

**1. Teema = predikaatti analyysikoodin yli** (OOP: Strategy/`Predicate<Analysis>`)
```ts
interface GrammarTheme {
  id: string;          // "ine", "pl", "prt", "comp", "prsprc"
  label: string;       // "inessiivi", "monikko", "imperfekti", ...
  group: ThemeGroup;   // "case" | "number" | "tense" | "comparison" | "participle"
  matches: (code: string) => boolean;  // esim. code.includes("+Ine")
  describe: string;    // selkoselite, REUSE CASE_INFO.question kun mahdollista
}
export const THEMES: GrammarTheme[];
```
- Sijateemat **johdetaan `CASE_INFO`:sta** (`src/dict/morph.ts`): ei kahdenneta dataa.
- Luku/aikamuoto/vertailu/partisiippi: pieni lisätaulukko tageille (`+Pl`, `+Prt`,
  `+Comp`/`+Superl`, partisiipit). **Toteutus enumeroi todelliset tagit morph.ts:n
  pohjalta**, varmista tagimerkkijonot koodista ennen lukitsemista.

**2. Teemojen tunnistus laudalta** (puhdas, lookup injektoituna)
```ts
function detectThemes(
  validWords: string[],
  lookup: (w: string) => Analysis[],
): Set<string>;   // toteutuneet theme.id:t
```
- Homografit (sama muoto, monta sijaa) → lenient: osuma jos **mikä tahansa** analyysi
  täsmää. Oppimismyönteinen, riittää v1:een.

**3. Adaptiivinen ajastin** (puhdas, deterministinen)
```ts
interface ThemeStat { seen: number; hits: number; lastHit: number; }
type LearnProgress = Record<string /*themeId*/, ThemeStat>;

function pickDailyTargets(p: LearnProgress, dateKey: string, n: number): string[];
function weeklyProgress(p: LearnProgress, weekStartKey: string): { covered: number; goal: number };
```
- `pickDailyTargets` deterministinen `(progress, päivä)`:sta → sama päivä = samat teemat
  (appin uudelleenavaus ei sekoita). Priorisoi koskaan-harjoittelemattomat → matalin
  osumasuhde → pisin aika osumasta. "Eroava aiemmasta kehityksestä" = sulkee pois juuri
  hallitut, etenee uusiin.
- Pehmeä+adaptiivinen komponoituvat: jos päivän heitto ei tarjoa teemaa, et osu →
  ajastin nostaa sen takaisin. **Ei kuratoitua siementä tarvita.**

### UI-kerros: `src/ui/game.ts` (premium-moodi mallina)

| Kohta | Toteutus | Malli koodissa |
|---|---|---|
| Asetuskytkin | `📚 Opi-moodi` ⚙️-paneeliin, localStorage `itu:learn:v1` | `renderSettings()` ~845, `PREMIUM_KEY`-kuvio |
| Päivän tavoitteet näkyviin | Teemasirut laudan ylle ("Tänään: inessiivi · monikko · imperfekti") | uusi `renderTargets()` |
| Reaaliaikainen osuma | `validate()`:ssa kutsu `detectThemes()` → syty osuneet sirut | `validate()` ~587 (ajaa jo joka muokkauksella) |
| Loppunäyttö | Mitkä teemat osuit tänään + viikkopalkki; per sana mikä teema täyttyi (Sanapoliisi-tyyliin `describeCode`) | `endRound()` ~345, `analysisLines()` ~951 |
| Edistymisen tallennus | `itu:learn:v1` (LearnProgress), erillään pistennätyksistä | `itu:premium:v1`-kuvio; `recordResult()` ~371 |

- **Pisteytys säilyy ennallaan**: Opi-moodi ei muuta pisteytystä eikä sanastoa
  (Itun "ei korvaa mitään" -periaate). LearnProgress on erillinen `itu:records:v2`:sta;
  ei uutta ennätyskategoriaa v1:ssä.
- Lemmat: `endRound()` lataa lemmat jo (`ensureLemmas()`); reaaliaikaisiin siruihin
  käytä välimuistissa olevaa lookupia, lataa Opi-moodin päällä ollessa etukäteen.

---

## Suunnitteluperiaate: ei grindausta (päivähaaste, ei koukku)

"Haasta itsesi" = **päivähaaste**: montako sijamuotoa tai muuta haluttua kielioppi­ominaisuutta
teet *päivässä*. Tavoite on **rajattu päivän settiin**: teet sen ja olet valmis; ei
loputonta grindiä eikä "ei osaa lopettaa" -efektiä (ei vaihtelevan palkinnon
pakkosilmukkaa, ei putki-/sarjastressiä joka vetää takaisin). Tämä on linjassa Itun
"ääretön peli" -arvolinssin ja käyttäjän lähtötoiveen kanssa (ei koukuttavuutta tavoitella).
Viikkotavoite on löysä koonti, ei katkeava streak-kuri. Mittari on **laatu/kattavuus per
päivä, ei toistomäärä**.

## Vaiheistus

**Vaihe 1, "Haasta itsesi":** yksinpeli, adaptiiviset päivän teemat, rajattu päivähaaste
(montako teemaa/päivä), löysä viikkotavoite, pehmeät osumat, ⚙️-kytkin. Koko domain-moduuli
+ UI-kytkennät.

**Vaihe 2, "Kaveri-teemahaaste" (TOTEUTETTU 28.6.2026):** rakennettu olemassa olevan
haastelinkki-infran (`startMatch()`/`decodeChallenge()`, `c=`-hash) päälle. Jaettu siemen +
teemasetti linkissä; verrataan kuka osui useampaan jaettuun tavoiteteemaan (pisteet tasurina).
Ei backendiä. Toteutus: erillinen Teemahaaste-moodi (ks. doc-header yllä). Pisteet lasketaan
silti per kierros (tasuri). Vastaaja pelaa haastajan jaetun setin (ei omaa adaptiivista) →
reilu vertailu.

---

## Päätetty: PEHMEÄ (26.6.2026)

**Pehmeä (kerää), ei pakollinen.** Käyttäjän päätös: "ehdottomasti pehmeä." Teemat ovat
kerättäviä tavoitteita, ei estä pelaamista, toimii millä tahansa heitolla. Useat
teemat/päivä + viikkotavoite + adaptiivisuus kaikki edellyttävät tätä, ja se on linjassa
"ei koukkua" -periaatteen kanssa. *Pakollinen* variantti (haaste "ratkeaa" vain käyttämällä
teemaa) olisi vaatinut kuratoidun siemenen muodostettavuuden takaamiseksi, **hylätty.**

---

## Verifiointi (toteutusvaiheessa)

**Yksikkötestit (`src/domain/learn.test.ts`, vitest kuten muu domain):**
- `detectThemes`: tunnetut koodit → oikeat teemat (`"N+Sg+Ine"` → "ine", `"...+Pl..."`
  → "pl", verbi-imperfekti → "prt", `"+Comp"` → vertailu). Homografi → useita osumia.
- `pickDailyTargets`: determinismi (sama `(progress, päivä)` → sama tulos); priorisointi
  (harjoittelematon ennen hallittua); ei toista juuri hallittuja.
- `weeklyProgress`: koonti viikon yli oikein.

**Manuaalinen (dev-portti 5177):**
1. ⚙️ → 📚 Opi-moodi päälle; tarkista että teemasirut näkyvät laudan yllä.
2. Muodosta sana tunnetussa sijassa (esim. *talossa*) → vastaava siru syttyy heti.
3. Lukitse → loppunäyttö listaa osutut teemat + viikkopalkki; per sana selite.
4. Tarkista `localStorage["itu:learn:v1"]` päivittyy (seen/hits/lastHit).
5. Avaa uudelleen samana päivänä → samat teemat (determinismi).

**Kriittiset tiedostot:** uusi `src/domain/learn.ts` + `src/domain/learn.test.ts`;
muokattava `src/ui/game.ts` (kytkin, renderTargets, validate-kytkentä, loppunäyttö);
luettava (reuse, ei muokkausta) `src/dict/morph.ts` (`CASE_INFO`, `describeCode`) ja
`src/dict/lemmas.ts` (`LemmaLookup.lookup`, `loadLemmas`).

---

## Liite: vertaileva tutkimus (idean alkulähde)

Sanapelit jakautuvat 4 mekaniikkaperheeseen; Itu on **ristikko-muodostus** (lähin
analogi **Q-Less**, ei Wordle/Sanuli). Itu on käytännössä yksin kahdessa sarakkeessa:
*täysi taivutus hyväksytään* ja *kielioppiselite pelin sisällä*. Opi-moodi rakentuu
juuri näiden kahden varaan. Lähteet: [Q-Less](https://qlessgame.com/),
[Bananagrams](https://en.wikipedia.org/wiki/Bananagrams),
[Sana Mix](https://games.tactic.net/tuote/sana-mix/),
[Sanuli](https://github.com/Cadiac/sanuli),
[Spelling Bee + morfologia](https://spellingbeetimes.com/2026/04/05/morphology-mastery-using-root-words-to-multiply-your-spelling-bee-vocabulary/).
