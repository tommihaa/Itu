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

export interface RuleSection {
  heading: string;
  /** Selkoteksti, lyhyitä lauseita. */
  body?: string;
  groups?: RuleGroup[];
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
      "Käytä vain pelin kirjaimia. Mukana ei ole b-, c- eikä f-kirjainta — " +
      "ne ovat suomessa vain lainasanoissa. G on mukana, mutta harvinainen.",
    groups: [
      {
        title: "Eivät kelpaa (väärä kirjain)",
        accept: false,
        examples: [
          { word: "banaani", hint: "b" },
          { word: "fakta", hint: "f" },
          { word: "celsius", hint: "c" },
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
          { word: "kauniimpi" },
          { word: "kaunein" },
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
