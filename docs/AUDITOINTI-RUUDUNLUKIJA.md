# Ruudunlukija-auditointi: merkinnät virallisia lähteitä vasten

Ajettu 14.10.2026 Tommin tilauksesta, HEAD `620ac2e`. Liipaisin oli Celian artikkeli
[Hyvä tietää ruudunlukuohjelmista](https://www.saavutettavasti.fi/hyva-tietaa-ruudunlukuohjelmista/),
jonka mukaan virallisia merkintätapoja on suositeltavinta käyttää. Artikkeli ei nimeä
lähdettä. Verkkopelissä lähteet ovat nämä:

- [WAI-ARIA Authoring Practices Guide (APG)](https://www.w3.org/WAI/ARIA/apg/): komponenttien mallit ja näppäimistökäytös
- [WAI-ARIA 1.2](https://www.w3.org/TR/wai-aria-1.2/): roolien ja attribuuttien määrittely
- [ARIA in HTML](https://www.w3.org/TR/html-aria/): mikä rooli on sallittu millekin HTML-elementille
- [Using ARIA](https://www.w3.org/TR/using-aria/): natiivi elementti ennen ARIA-roolia

Sama auditointi ajettiin Jakoon ja Superjatsiin (`docs/AUDITOINTI-RUUDUNLUKIJA.md` kummassakin).
Menetelmä on koodinluku. Mitään ei kuunneltu ruudunlukijalla, joten vaikutukset ovat
spesifikaation mukaisia päätelmiä. Rivinumerot ovat HEAD `620ac2e`:n puusta.

Kunnossa: ilmoitusjono (`src/ui/announce.ts`) on `aria-live="polite"` ja `aria-atomic`,
Tilanne-nappi on näkymätön mutta kohdistettava `<button>`, ja kierroksen keston valinnat
käyttävät `aria-pressed`-tilaa niin kuin APG:n toggle button -malli neuvoo.

## Löydökset

**I-1. Lisää-valikko ei aukea ruudunlukijalla eikä näppäimistöllä.** Tila: korjattu
14.10.2026 Tommin pyynnöstä APG:n disclosure-mallilla: `<button aria-expanded aria-controls>`,
avoin tila `ui.menuOpen`issa ja CSS lukee sen `aria-expanded`-attribuutista. Valikon nappi
sulkee valikon, ja Esc sulkee sen ja palauttaa kohdistuksen ☰:ään. Renderin jälkeen kohdistus
palautetaan id:llä, joten ☰ ja ⓘ pitävät kohdistuksen. Todennettu selaimessa kapealla ruudulla,
ei kuunneltu. Alkuperäinen havainto:
`game.ts:1011–1012`: valikon avaa piilotettu checkbox, jolla on `aria-hidden="true"` ja
`tabindex="-1"`. Näkyvä osa on `<label>`, joka ei ole kohdistettava eikä ruudunlukijalle
painike. Kapealla ruudulla (`styles.css:971–973`) Säännöt, Sanapoliisi, Ennätykset ja
Asetukset ovat valikon takana, joten ne jäävät tavoittamatta. APG:n
[disclosure-malli](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/): `<button aria-expanded>`
joka näyttää ja piilottaa listan.

**I-2. Tyhjät ruudut ovat nimettömiä ja lauta on rakenteeton.** Tila: korjattu 14.10.2026,
todennettu Chromen saavutettavuuspuusta (`gridcell "K11 tyhjä"`, nosto ja pudotus ruudun
nimen kautta), ei kuunneltu. Toteutus poikkeaa APG:stä yhdessä kohdassa: kohdistus on
laudassa (`role="grid"`, `tabindex="0"`) eikä kulje ruudusta ruutuun, koska kursorin siirto
kuuluu jo live-alueelta ja ruudun kohdistus sanoisi saman kahdesti. Rivit ovat subgrid eikä
`display: contents`, joka on pudottanut roolin saavutettavuuspuusta osassa selaimia.
Alkuperäinen havainto: `game.ts:1713` ja `1744`: 441 `<div>`iä ilman roolia ja nimeä.
Virallinen malli on APG:n [grid](https://www.w3.org/WAI/ARIA/apg/patterns/grid/):
`role="grid"`, rivit `role="row"`, ruudut `role="gridcell"` nimellä (K11), ja yksi
kohdistettava ruutu kerrallaan (roving tabindex). Nuolinäppäimet siirtävät jo kursoria, joten
näppäimistömalli on valmiina. Kosketusruudunlukija saisi ruudun nimen ja valinnan kaksoisnapautuksella.

**I-3. Nopat ovat `role="button"` ilman kohdistusta.** Tila: korjattu 14.10.2026 Tommin
valinnalla (Tab + Enter, ei roolin poistoa). Telineen noppa on `tabindex="0"` ja id:llinen,
joten kohdistus pysyy renderin yli, ja Enter tai välilyönti nostaa sen (`onTileTap`).
Laudalla Enter asettaa nostetun nopan kursoriin ja lukitsee kierroksen vain ilman nostoa.
Ilman kursoria Enter ilmoittaa *"Valitse ensin ruutu nuolinäppäimillä"*, jotta nosto ei
lukitse kierrosta vahingossa. Säännöt › Ohjaus päivitettiin samassa commitissa. Todennettu
selaimessa oikeilla näppäilyillä (nosto, ilmoitus ilman kursoria, asetus K11:een), ei kuunneltu.
Alkuperäinen havainto: `game.ts:2513–2514`:
`<div role="button">` ilman `tabindex`iä ja Enter/Space-käsittelyä. APG:n
[button-malli](https://www.w3.org/WAI/ARIA/apg/patterns/button/) vaatii molemmat. Kosketuksella
kaksoisnapautus toimii, ja näppäimistöllä noppa valitaan kirjoittamalla. Korjaus on joko natiivi
`<button>` tai rooli pois, jos noppaa ei ole tarkoitus aktivoida Tabilla.

**I-4. Välilehtien valinta näkyy vain värinä.** Tila: korjattu 14.10.2026 `aria-pressed`illa,
koska se on jo kestovalinnan malli eikä vaadi tabs-mallin nuolinavigointia. Samat napit ovat
Säännöissä, Ennätyksissä (pistemoodi, lajittelu, kesto) ja telineen järjestyksessä, ja kukin
rivi on nimetty `role="group"`. Todennettu DOMista, ei kuunneltu. Alkuperäinen havainto:
`game.ts:1119`, `1580–1584` ja
lajittelunapit `1960`: aktiivinen välilehti on pelkkä CSS-luokka. Joko APG:n
[tabs-malli](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/) (`role="tab"`, `aria-selected`)
tai sama `aria-pressed` kuin kestovalinnassa.

**I-5. `aria-label` roolittomassa `<div>`issä.** Tila: korjattu 14.10.2026, molemmat
`role="group"`. Alkuperäinen havainto: `game.ts:1169` ja
`1200`: ARIA 1.2 kieltää nimen `generic`-roolilta, ja ruudunlukijat ohittavat sen. Korjaus on
`role="group"` (kuten `1281`) tai nimi pois.

**I-6. Sarkain ei siirrä kohdistusta pelinäkymässä.** Tila: korjattu 14.10.2026 Tommin
päätöksellä (*"suunnan vaihtaa vain välilyönti, ja sarkain siirtää kohdistusta normaalisti"*).
Säännöt › Ohjaus ja laudan alla oleva vihje päivitettiin samassa commitissa. Löytyi I-2:n
korjauksessa.
`game.ts` `onKeyDown`: pelinäkymässä sarkain vaihtaa kirjoitussuunnan ja estää oletuksen,
myös kun kohdistus on napissa. Näppäimistöllä ei siis pääse sarkaimella mihinkään nappiin eikä
pois laudalta (WCAG 2.1.2 No Keyboard Trap). APG:n grid-mallissa sarkain vie pois ruudukosta.
Suunnan vaihtaa myös välilyönti, mutta sarkaimen vapautus muuttaa dokumentoitua ohjausta
(Säännöt › Ohjaus), joten se on Tommin päätös.

## Kuuntelu 15.10.2026

Tommi kuunteli tuotantoversion 0.13.1 TalkBackilla Pixelillä.

**I-7. Telineen noppa ei nouse TalkBackin kaksoisnapautuksella.** Tila: korjattu 15.10.2026,
0.13.2. Kaksoisnapautus lähettää selaimelle pelkän clickin ilman pointer-tapahtumia, ja
telineen noppa kuunteli vain `pointerdown`/`pointerup`-paria (raahaus). Ruudun klikkaus toimi,
koska ruudulla on click-käsittelijä. Korjaus: nopalle click-käsittelijä, joka ohittaa
tavallisen napautuksen perään tulevan clickin (`ui.suppressTileClickUntil`). Todennettu
dev-previewissä: pelkkä click nostaa, ruudun click asettaa ("K11 A."), ja pointer-napautus ja
sen click nostavat vain kerran. Kuuntelu korjauksen jälkeen on tekemättä.

**Havainto: vaakatilassa lauta ei mahdu puhelimen näytölle.** Itulla ei ole vaakatilan
asettelua. Kuunneltiin pystyasennossa.

**Kuuntelu korjauksen jälkeen (0.13.2, pystytila, *Ei aikarajaa*):**
- *Nosto:* kaksoisnapautus nostaa, ja TalkBack sanoo "A, yksi piste, nostettu". Kohdistus
  jää nostettuun noppaan eikä hyppää sivun alkuun. Klo 22 merkinnän pelko ei toteutunut.
- *Tyhjä ruutu:* kosketuksella kuuluu "C11 tyhjä" (I-2 toimii kosketusruudunlukijalla).
- *Asetus:* kaksoisnapautus tyhjässä ruudussa asettaa, ilmoitus "G14 A" kuuluu, ja kohdistus
  jää ruutuun. TalkBack lukee perään rivin ja sarakkeen ruudukon rakenteesta, mutta vain kun
  ne vaihtuvat edellisestä ruudusta. Havainto: sijainti kuuluu kahdesti (G14 nimessä ja
  "rivi 14, sarake 7" rakenteesta). Ei korjattu, ratkaisua ei ole päätetty.
- *Tilanne:* löytyy pyyhkäisemällä Lukitse-napin jälkeen ("Tilanne, painike, Vaihto plus H"),
  ja se lukee telineen, laudan sanat, pisteet ja keston.
