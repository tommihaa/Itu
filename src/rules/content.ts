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
  "Peliin kelpaavat suomen sanat — myös taivutetut muodot. " +
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
      "harvinaisia — monet niistä puuttuvat myös suomalaisesta Scrabblesta ja " +
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
      "Peli hyväksyy joskus vain toisen — älä hämmenny, kokeile toista.\n" +
      "• Lukusanat (kaksi) ja minä-sanat (minä, sinä, hän) kelpaavat tässä " +
      "versiossa vain perusmuodossa.\n" +
      "• Sana on 2–13 kirjainta pitkä.\n" +
      "• Olemassa olevat yhdyssanat kelpaavat (jääkiekko), mutta itse " +
      "yhdistämäsi uusi sana ei.",
  },
];
