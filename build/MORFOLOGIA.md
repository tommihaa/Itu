# Itun sanaston morfologinen kattavuus

Mitä taivutusmuotoja peli hyväksyy ja **mitä ei — sekä miksi**. Totuuden lähde on
[`gen_wordforms.py`](gen_wordforms.py):n tagisto, joka pyydetään GiellaLT/omorfi
"fin"-generaattorilta (uralicNLP). Kartta on auditoitu ajamalla koko tagisto
edustavilla lemmoilla — validointityökalu [`audit_morph.py`](audit_morph.py).

Päivitetty 21.6.2026.

## Mukana (aito taivutus → kelpaa)

**Nominit (N):** sija × luku. Sijat: Nom, Gen, Par, Ess, Tra, Ine, Ela, Ill, Ade,
Abl, All, Abe × (Sg, Pl). Lisäksi **monikon instruktiivi** (Pl+Ins: *jaloin, käsin*).

**Adjektiivit (A):** kuten nominit + **vertailuasteet** (Comp *isompi*, Superl *isoin*).

**Verbit (V):**
- Indikatiivi preesens + imperfekti (6 persoonaa + kieltomuoto ConNeg)
- Konditionaali (*laskisi*), potentiaali (*laskenee*), imperatiivi
- Passiivi (Pe4: *lasketaan, laskettiin*)
- **Infinitiivit: 1. A-inf = perusmuoto (*laskea*), 2. E-inf (*laskien, laskiessa*),
  3. MA-inf 6 sijassa (*laskemassa, -masta, -maan, -malla, -matta, -maan*)**
- **4. infinitiivi -minen** (teonnimi, täysi nominitaivutus: *laskeminen, laskemisen,
  laskemista, laskemiset…*)
- Partisiipit täydessä sijataivutuksessa: VA/NUT (akt.), TA/TU (pass.),
  agenttipartisiippi -ma (*laskema*), kieltopartisiippi -maton (*laskematon*)

## Pois jätetty — tietoiset rajaukset (pelisäännöt)

- **Omistusliitteet** (+Px): *taloni, koiransa*. → Tämän seurauksena myös **komitatiivin
  vakiomuoto puuttuu**: komitatiivi vaatii omistusliitteen (*koirineen* = koira+Com+PxSg3);
  pelkkä +Com tuottaa vain arkaaisen *koirine*, joka on jätetty pois.
- **Liitepartikkelit** (-kin, -kaan, -han, -pa): *talokin, menisiköhän*.
- **Vapaat yhdyssanat** (+Cmp#): itse keksityt; valmiit yhdyssanat ovat lemmoina mukana.
- **Erisnimet ja lyhenteet** (iso alkukirjain Kotus-listassa).
- **Kirjaimisto:** vain `a d e g h i j k l m n o p r s t u v y ä ö`; pituus 2–13.

## Tunnetut rajoitteet (upstream omorfi — ei korjattavissa tageilla)

- **-is-adjektiivien superlatiivi:** omorfi tuottaa *kaunis* → *kaunin/kauniin*, EI
  *kaunein* → **kaunein puuttuu**. (Säännöllisemmät nopein/suurin/pienin ovat mukana.)
  Ei tagikorjattavissa; vaatisi omorfin korjauksen. Sääntöesimerkit välttävät kaunein.

## "Kuolleet" tagit (pyydetään, mutta tuottavat tyhjää nykymallilla — vaarattomia)

Eivät lisää mitään, mutta eivät myöskään haittaa (dokumentoitu ettei jää epäselväksi):
- Verbi: redundantit ConNeg-variantit (Prs+ConNeg+Sg, Prt+ConNeg, Imprt+ConNeg+Sg2 —
  vastinvariantti kattaa muodon); partisiippien Com- ja Sg+Ins-sijat.
- Nomini/adj: Sg+Com, Pl+Com, Sg+Ins (komitatiivi vaatii Px:n; instruktiivi vain monikossa).
- (Voi siivota myöhemmin nopeuttamaan ajoa; ei muuta tulosta, koska tuottavat tyhjää.)

## Korjaus 21.6.2026

**Juurisyy:** omorfi vaatii `+Act`:n MYÖS infinitiiveille. Skripti pyysi `+InfA/+InfE/+InfMa`
ilman `+Act` → ne tuottivat TYHJÄN → **verbien perusmuoto ja kaikki infinitiivit
puuttuivat koko sanakirjasta**. (Verbi näytti käyvältä vain muiden muotojen kautta;
poikkeus *antaa/kirjoittaa*, joiden perusmuoto = yks. 3. persoona.)

**Korjattu:** `+Act` kaikkiin infinitiiveihin + 4. infinitiivi -minen (Der/minen).
Vaatii sanaston täyden regeneroinnin (gen → dict:pack → build_lemmas) tullakseen liveen.
