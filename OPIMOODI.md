# Itu — Opi-moodi (adaptiivinen kielioppihaaste)

> Designdokumentti. Status: **suunniteltu, ei toteutettu.** Tämä on backlog-design,
> ei lukittu spec — toteutusvaiheessa varmistetaan tagimerkkijonot koodista.
> Syntyi vertailevasta sanapelitutkimuksesta (ks. lopun liite).

## Konteksti

Itun aito kilpailuetu sanapelikentässä on **kielioppiselite pelin sisällä** (Sanapoliisi)
+ **täysi taivutus hyväksytään** — lähes yksikään kilpailija ei tee kumpaakaan. Opi-moodi
vie tämän edun askeleen pidemmälle: tekee taivutuksen *tavoitteeksi*, ei vain sallituksi.

**Malli:**
- **Adaptiivinen, henkilökohtainen.** Päivän teemat valitaan pelaajan oman historian
  mukaan (heikoimmat/harjoittelemattomat ensin, spaced repetition).
- **Useita teemoja per päivä + viikkotavoite.** Et osu yhteen pakkosijaan vaan *keräät*
  päivän teemoja kohti viikon koontitavoitetta.
- **Pehmeä, ei-estävä** (työoletus; lopullinen pakko-vs-bonus jäi auki, ks. Avoin päätös).
- **Laajuus: kieliopilliset teemat** = sijat + luku (yks./mon.) + aikamuoto + vertailu
  + partisiipit — ei vain 14 sijaa.
- **Vaiheistus:** "haasta itsesi" (yksinpeli) nyt → "kaveri-moodi" (haastelinkki) myöhemmin.

**Miksi tämä on teknisesti halpa:** kaikki tarvittava data on jo olemassa.
`lemmas.lookup(sana)` → `Analysis[]` koodeilla kuten `N+Sg+Ine`, ja `describeCode()` /
`CASE_INFO` muuntaa ne selkokieleksi. "Osuiko pelaaja inessiiviin laudalla" = katso
laudan sanojen analyysit, tarkista sisältääkö joku koodi `+Ine`. Sama auktoritatiivinen
FST-lähde kuin Sanapoliisissa — ei hallusinaatiota.

---

## Suunnittelumalli (domain/ui-erottelu, kuten muu Itu)

### Uusi puhdas domain-moduuli: `src/domain/learn.ts`

Ei DOM:ia, ei localStoragea — testattava yksikkötesteillä (kuten `premium.ts`).

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
- Sijateemat **johdetaan `CASE_INFO`:sta** (`src/dict/morph.ts`) — ei kahdenneta dataa.
- Luku/aikamuoto/vertailu/partisiippi: pieni lisätaulukko tageille (`+Pl`, `+Prt`,
  `+Comp`/`+Superl`, partisiipit). **Toteutus enumeroi todelliset tagit morph.ts:n
  pohjalta** — varmista tagimerkkijonot koodista ennen lukitsemista.

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

- **Pisteytys säilyy ennallaan** — Opi-moodi ei muuta pisteytystä eikä sanastoa
  (Itun "ei korvaa mitään" -periaate). LearnProgress on erillinen `itu:records:v2`:sta;
  ei uutta ennätyskategoriaa v1:ssä.
- Lemmat: `endRound()` lataa lemmat jo (`ensureLemmas()`); reaaliaikaisiin siruihin
  käytä välimuistissa olevaa lookupia, lataa Opi-moodin päällä ollessa etukäteen.

---

## Suunnitteluperiaate: ei grindausta (päivähaaste, ei koukku)

"Haasta itsesi" = **päivähaaste**: montako sijamuotoa tai muuta haluttua kielioppi­ominaisuutta
teet *päivässä*. Tavoite on **rajattu päivän settiin** — teet sen ja olet valmis; ei
loputonta grindiä eikä "ei osaa lopettaa" -efektiä (ei vaihtelevan palkinnon
pakkosilmukkaa, ei putki-/sarjastressiä joka vetää takaisin). Tämä on linjassa Itun
"ääretön peli" -arvolinssin ja käyttäjän lähtötoiveen kanssa (ei koukuttavuutta tavoitella).
Viikkotavoite on löysä koonti, ei katkeava streak-kuri. Mittari on **laatu/kattavuus per
päivä, ei toistomäärä**.

## Vaiheistus

**Vaihe 1 — "Haasta itsesi":** yksinpeli, adaptiiviset päivän teemat, rajattu päivähaaste
(montako teemaa/päivä), löysä viikkotavoite, pehmeät osumat, ⚙️-kytkin. Koko domain-moduuli
+ UI-kytkennät.

**Vaihe 2 — "Kaveri-moodi" (myöhemmin, oma suunnitelma):** hyödynnä olemassa olevaa
haastelinkki-infraa (`startMatch()`/`decodeChallenge()`, `c=`-hash). Jaa siemen + teema­setti
linkissä; vertaa kuka osui teemoihin. Ei vaadi backendiä.

---

## Päätetty: PEHMEÄ (26.6.2026)

**Pehmeä (kerää), ei pakollinen.** Käyttäjän päätös: "ehdottomasti pehmeä." Teemat ovat
kerättäviä tavoitteita, ei estä pelaamista, toimii millä tahansa heitolla. Useat
teemat/päivä + viikkotavoite + adaptiivisuus kaikki edellyttävät tätä, ja se on linjassa
"ei koukkua" -periaatteen kanssa. *Pakollinen* variantti (haaste "ratkeaa" vain käyttämällä
teemaa) olisi vaatinut kuratoidun siemenen muodostettavuuden takaamiseksi — **hylätty.**

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
