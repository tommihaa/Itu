# Itu: sananmuodostus-noppapeli

Selaimessa pelattava sananmuodostuspeli kirjainnopilla: heitä nopat ja muodosta niistä
sanoja laudalle ristikkomaisesti aikarajan puitteissa. Offline-yksinpeli, ei tiliä,
ei verkkopalvelua, ei mainoksia, ei seurantaa.

- **Live:** https://tommi-itu.vercel.app (asennettava PWA)
- **Stack:** Vite + TypeScript, vanilla (ei Reactia), tiukka domain/UI-erotus.
- **Sanasto:** koko suomen kielen taivutusmuodot (~2,3 M), generoitu Kotuksen
  nykysuomen sanalistasta GiellaLT/uralicNLP-morfologialla, pakattu DAWG-rakenteeseen
  selaimessa. Lisenssiattribuutio: [SANASTO.md](SANASTO.md#lähdeaineiston-attribuutio).

## Komennot

```bash
npm run dev        # kehityspalvelin (http://localhost:5177/)
npm test           # Vitest (domain-testit)
npm run build      # tsc --noEmit && vite build
npm run dict:pack  # generoi DAWG-sanasto
git push           # julkaisu: Vercel git-integraatio deployaa tuotantoon
```

## Mistä mikäkin löytyy

Tämä tiedosto pidetään tarkoituksella ohuena. Elävä tieto asuu ylläpidetyissä lähteissä:

| Tarvitset | Katso |
|-----------|-------|
| Agentin ohjeet, konventiot, arkkitehtuuri | `CLAUDE.md` |
| Design / mekaniikka / pisteytys (lukitut päätökset) | `ITU.md` |
| Sanaston hyväksymissäännöt + lisenssiattribuutio | `SANASTO.md` |
| Morfologia / FST-generointiputki | `build/MORFOLOGIA.md` |
| Opi-moodin design | `OPIMOODI.md` |
| Perustelut valinnoille | `PERUSTELUT.md` |

## Lisenssi

**GNU GPL v3 tai myöhempi**, ks. [LICENSE](LICENSE). Copyright (C) 2026 Tommi Haanranta.

Valinta odotti yhtä avointa kysymystä: pelin sanasto on generoitu omorfi-morfologialla
(GNU GPLv3), eikä generoidun aineiston asema ollut tekijöiltä kysymättä ratkaistavissa.
Kysymys esitettiin omorfin tekijöille 25.8.2026 ja vastaus tuli 27.8.2026: lähtökohta on
GPL:n hengen mukainen käyttö, ja toivottavaa on että omorfia hyödyntävät sovellukset ovat
samalla lisenssillä ja että parannukset dataan palaavat GPL:n alle. Lisenssi valittiin sen
mukaisesti.

Sanaston lähdeaineisto on eri asia ja sen ehdot ovat selvät: Kotuksen nykysuomen sanalista,
CC BY 4.0, attribuutio [SANASTO.md](SANASTO.md#lähdeaineiston-attribuutio):ssä ja pelissä
(Säännöt › Esittely › Sanaston lähde).
