// Selkokielinen sääntöilmaisu — YKSI lähde, jota sekä pelin sisäinen
// "Säännöt"-näkymä että tulostettava referenssi käyttävät.
// Sisältö on [SANASTO.md](../../SANASTO.md):n pelaajaystävällinen käännös:
// ei kielioppitermejä, lyhyet lauseet, esimerkkivetoinen (✓/✗-parit).
// Tarkoitus: harjoitella ENNUSTAMAAN mikä sana kelpaa — fyysisessä pelissä
// ihminen toimii tuomarina, ja tämä auttaa puntaroimaan rajatapaukset.

export interface Example {
  /** Sana esimerkkinä. */
  word: string;
  /** Lyhyt selitys (valinnainen), esim. "minä-muoto" tai "monikko". */
  hint?: string;
}

export interface RuleGroup {
  title: string;
  /** true = nämä kelpaavat (✓), false = eivät kelpaa (✗). */
  accept: boolean;
  examples: Example[];
}

/** Kirjainlista (esim. pelin kirjaimet / pois jääneet) chip-rivinä. */
export interface LetterRow {
  label: string;
  /** Kirjaimet välilyönnein, esim. "A D E G". */
  chars: string;
  /** true = mukana pelissä (✓), false = ei mukana (✗). */
  accept: boolean;
}

export interface RuleSection {
  heading: string;
  /** Selkoteksti, lyhyitä lauseita. */
  body?: string;
  groups?: RuleGroup[];
  /** Kirjainrivit (chipit) — esim. mitkä kirjaimet ovat/eivät ole pelissä. */
  letters?: LetterRow[];
}

export const RULES_TITLE = "Mitkä sanat kelpaavat?";

export const RULES_LEAD =
  "Peliin kelpaavat suomen sanat, myös taivutetut muodot. " +
  "Sanakirja on tuomari. Tämä sivu auttaa sinua arvaamaan etukäteen, " +
  "kelpaako sana vai ei.";

export const RULES: RuleSection[] = [
  {
    heading: "Lyhyesti",
    body:
      "Kelpaa: oikea suomen sana missä tahansa taivutusmuodossa. " +
      "Ei kelpaa: liitesanat (-kin, -kaan), omistusliitteet (-ni, -si), " +
      "itse keksityt yhdyssanat eivätkä erisnimet.",
  },
  {
    heading: "Kirjaimet",
    body:
      "Käytä vain pelin kirjaimia (alla). Pois jääneet b, c, f, q, w, x, z ja å " +
      "esiintyvät suomessa lähinnä lainasanoissa ja erisnimissä ja ovat hyvin " +
      "harvinaisia: monet niistä puuttuvat myös suomalaisesta Scrabblesta ja " +
      "Sana Mixistä. G on mukana mutta harvinainen: se tulee taivutuksessa (nk → ng).",
    letters: [
      {
        label: "Pelin kirjaimet",
        accept: true,
        chars: "A D E G H I J K L M N O P R S T U V Y Ä Ö",
      },
      {
        label: "Eivät ole pelissä",
        accept: false,
        chars: "B C F Q W X Z Å",
      },
    ],
    groups: [
      {
        title: "Eivät kelpaa (väärä kirjain)",
        accept: false,
        examples: [
          { word: "banaani", hint: "b" },
          { word: "fakta", hint: "f" },
          { word: "celsius", hint: "c" },
          { word: "pizza", hint: "z" },
          { word: "taxi", hint: "x" },
        ],
      },
    ],
  },
  {
    heading: "Taivutus kelpaa",
    body: "Sama sana käy monessa muodossa, kunhan se on aitoa taivutusta.",
    groups: [
      {
        title: "Sijamuodot ja monikko",
        accept: true,
        examples: [
          { word: "koira" },
          { word: "koiran" },
          { word: "koiraa" },
          { word: "koirassa" },
          { word: "koirille", hint: "monikko" },
          { word: "koirissa", hint: "monikko" },
        ],
      },
      {
        title: "Verbin muodot",
        accept: true,
        examples: [
          { word: "luen", hint: "minä" },
          { word: "lukee", hint: "hän" },
          { word: "luimme", hint: "me" },
          { word: "luettiin" },
          { word: "lukisi" },
          { word: "lukeva", hint: "partisiippi" },
          { word: "lukenut" },
          { word: "lukematon" },
        ],
      },
      {
        title: "Vertailumuodot",
        accept: true,
        examples: [
          { word: "iso" },
          { word: "isompi" },
          { word: "isoin" },
          { word: "nopeampi" },
          { word: "nopein" },
        ],
      },
      {
        title: "G tulee taivutuksessa (nk → ng)",
        accept: true,
        examples: [
          { word: "kenkä", hint: "→" },
          { word: "kengät" },
          { word: "kengän" },
          { word: "kaupungin" },
          { word: "langan" },
        ],
      },
    ],
  },
  {
    heading: "Nämä eivät kelpaa",
    body:
      "Liitesanat ja omistusliitteet eivät ole omia sanoja vaan jatkeita: " +
      "ne voi liimata melkein minkä tahansa sanan perään, yhä uudelleen " +
      "(talo → talokin → talonikin → talossammekohan). Jos ne kelpaisivat, " +
      "lähes kaikki kelpaisi, eikä sanan löytäminen olisi enää haaste. " +
      "Siksi peliin otetaan itse sanat, ei niiden perään liimattuja jatkeita.",
    groups: [
      {
        title: "Liitesanat (sanan perään liimattu pikkusana)",
        accept: false,
        examples: [
          { word: "talokin", hint: "talo + kin" },
          { word: "kotihan" },
          { word: "tulepa" },
          { word: "menisiköhän" },
        ],
      },
      {
        title: "Omistusliitteet (kenen)",
        accept: false,
        examples: [
          { word: "taloni", hint: "minun" },
          { word: "autosi", hint: "sinun" },
          { word: "kotimme", hint: "meidän" },
          { word: "kissansa", hint: "hänen" },
        ],
      },
      {
        title: "Itse keksityt yhdyssanat (joita ei ole sanakirjassa)",
        accept: false,
        examples: [
          { word: "pöytäkissa" },
          { word: "noppakortti" },
          { word: "pelikirjain" },
        ],
      },
      {
        title: "Erisnimet ja lyhenteet",
        accept: false,
        examples: [
          { word: "tommi", hint: "nimi" },
          { word: "liisa", hint: "nimi" },
          { word: "alv", hint: "lyhenne" },
          { word: "amk", hint: "lyhenne" },
        ],
      },
    ],
  },
  {
    heading: "Hyvä tietää (rajatapaukset)",
    body:
      "• Joillakin sanoilla on kaksi oikeaa muotoa (talojen ja taloiden). " +
      "Peli hyväksyy joskus vain toisen. Älä hämmenny, kokeile toista.\n" +
      "• Lukusanat (kaksi) ja minä-sanat (minä, sinä, hän) kelpaavat tässä " +
      "versiossa vain perusmuodossa.\n" +
      "• Sana on 2–13 kirjainta pitkä.\n" +
      "• Olemassa olevat yhdyssanat kelpaavat (jääkiekko), mutta itse " +
      "yhdistämäsi uusi sana ei.",
  },
];

/** Pelin ohjaus laitteittain — sama sisältö näkymässä ja tulosteessa. Kukin
 * syöttötapa (hiiri, kosketus/kynä, näppäimistö) kertoo samat toiminnot omalla
 * tavallaan; kaikki tavat toimivat rinnakkain. */
export const CONTROLS_TITLE = "Pelin ohjaus";

export const CONTROLS: RuleSection[] = [
  {
    heading: "Hiiri",
    body:
      "• Raahaa nappula telineestä ruutuun (tai ruudusta toiseen).\n" +
      "• Tai napauta nappula ja sitten ruutu, johon se menee.\n" +
      "• Poista laudalta: oikea klikkaus tai tuplaklikkaus nopan päällä, tai raahaa takaisin telineeseen.\n" +
      "• Jokeri: napauta laudalla olevaa jokeria valitaksesi sen kirjaimen.",
  },
  {
    heading: "Kosketus ja kynä",
    body:
      "• Napauta nappula ja sitten ruutu, tai raahaa nappula paikalleen.\n" +
      "• Poista laudalta: pidä noppaa pohjassa hetki tai tuplanapauta, tai raahaa takaisin telineeseen.\n" +
      "• Jokeri: napauta laudalla olevaa jokeria valitaksesi sen kirjaimen.",
  },
  {
    heading: "Näppäimistö",
    body:
      "• Valitse kirjoituskohta napauttamalla ruutua ja kirjoita sana.\n" +
      "• Väli tai sarkain vaihtaa suunnan (vaaka → / pysty ↓); nuolinäppäimet siirtävät kohtaa.\n" +
      "• ⌫ poistaa edellisen kirjaimen. Ctrl+Z kumoaa viimeisimmän. Esc peruuttaa valinnan.\n" +
      "• Enter lukitsee kierroksen.",
  },
  {
    heading: "Telineen järjestys: Äänneryhmät",
    body:
      "Teline voi järjestää nopat äänneryhmittäin: ensin konsonantit, sitten\n" +
      "takavokaalit (a, o, u), neutraalit (e, i) ja etuvokaalit (ä, ö, y).\n" +
      "Miksi tämä auttaa: taka- ja etuvokaalit eivät esiinny samassa\n" +
      "suomalaisessa sanassa (vokaalisointu): sana on joko taka- tai\n" +
      "etuvokaalinen, ja e, i sopivat kumpaankin. Ryhmittely näyttää\n" +
      "kerralla mitkä vokaalit sopivat yhteen.",
  },
];

// ── Esittely (Tietoja-välilehti) ─────────────────────────────────────────────
// Mikä Itu on + yksityisyyslupaus. Oma sisältö (ei kopioitu sisarpeleistä):
// data on projektikohtaista, vaikka mekanismi on sama kuin Jakossa.
export const ABOUT_TITLE = "Tietoja Itusta";

/** Esittelykappaleet, selkokieltä (lyhyet lauseet, yksi ajatus kerrallaan).
 *  Sisältää saavutettavuusrivin (millä laitteilla peli toimii). */
export const ABOUT_PARAS: string[] = [
  "Itu on suomen kielen sanapeli. Saat kirjainnopat. Teet niistä sanoja ja ristikon.",
  "Pelaat yksin ja omassa tahdissasi. Aikaa on rajallisesti. Pisteet tulevat " +
    "kirjaimista ja pitkistä sanoista.",
  "Peli toimii näppäimistöllä, hiirellä ja kosketuksella. Voit myös tulostaa " +
    "säännöt paperille.",
  "Peli ei kerää sinusta mitään. Ei tiliä, ei mainoksia. Tulokset tallentuvat " +
    "vain sinun selaimeesi.",
  "Peli on ilmainen ja tehty jaettavaksi. Voit lähettää palautetta. Voit myös " +
    "tarjota tekijälle kahvit.",
];

// ── Muut pelit (sisarpelinosto) ──────────────────────────────────────────────
// Emergentti glue: kolme erillistä peliä muuttuu löydettäväksi tähdistöksi
// ilman keskuspalvelinta. Linkit ovat pysyviä tuotanto-URLeja.
export interface GameLink {
  name: string;
  url: string;
  blurb: string;
}

export const OTHER_GAMES_TITLE = "Muut pelit";
export const OTHER_GAMES_INTRO = "Samalta tekijältä. Kaikki ilmaisia ja ilman mainoksia.";
export const OTHER_GAMES: GameLink[] = [
  { name: "Superjatsi", url: "https://tommi-superjatsi.vercel.app", blurb: "noppapeli yhdelle" },
  { name: "Jako", url: "https://tommi-jako.vercel.app", blurb: "yhdeksän korttipeliä" },
];

// ── Lisää aloitusnäytölle (PWA-asennusohje) ──────────────────────────────────
// Staattinen selainkohtainen ohjelista, sama rakenne kuin Jakon a2hs-osiossa.
// Otsikko on peli­kohtainen; askeleet ovat selainkohtaisia (samat kaikissa peleissä).
export interface InstallGroup {
  title: string;
  /** [selain, ohjeaskeleet] -parit. */
  rows: [browser: string, steps: string][];
}

export const INSTALL_TITLE = "Lisää Itu aloitusnäytölle 📲";

export const INSTALL_INTRO =
  "Lisää Itu puhelimen aloitusnäytölle tai tietokoneen työpöydälle, niin se " +
  "avautuu omasta kuvakkeestaan kuin sovellus, ilman selaimen palkkeja. Kerran " +
  "avattu peli toimii myös ilman verkkoa.";

export const INSTALL_GROUPS: InstallGroup[] = [
  {
    title: "📱 Puhelin ja tabletti",
    rows: [
      ["Chrome · Brave · Edge · Opera (Android)", 'Valikko ⋮ → "Lisää aloitusnäyttöön" tai "Asenna sovellus".'],
      ["Samsung Internet", 'Valikko ≡ → "Lisää sivu kohteeseen" → "Aloitusnäyttö".'],
      ["Firefox (Android)", 'Valikko ⋮ → "Lisää aloitusnäyttöön".'],
      ["Safari (iPhone/iPad)", 'Jaa-painike → "Lisää Koti-valikkoon".'],
      ["Chrome ja muut (iPhone/iPad)", 'Jaa-painike → "Lisää Koti-valikkoon" (iOS sallii asennuksen vain Jaa-valikosta).'],
    ],
  },
  {
    title: "💻 Tietokone",
    rows: [
      ["Chrome · Edge · Brave · Opera · Vivaldi", 'Osoiterivin oikean reunan asennuskuvake ⊕ → "Asenna".'],
      ["Safari (Mac)", 'Tiedosto-valikko → "Lisää Dockiin".'],
      ["Firefox (tietokone)", "Ei tue asentamista. Lisää kirjanmerkki nopeaa avaamista varten."],
    ],
  },
];
