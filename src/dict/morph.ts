// Morfologisen analyysikoodin (FST:n tag+suffix, esim. "N+Sg+Ine") muunto
// selkokieliseksi suomeksi Tarkastajaa varten.
//
// KIINTEÄ, käsin todennettava taulukko: suomen sijajärjestelmä on suljettu (14
// sijaa), ja kunkin sijan termi, vaikutus ja esimerkki ovat vakioita. EI mitään
// ajonaikaista päättelyä, EI kielimallia → ei hallusinaatiota. Tuntematon koodi
// palauttaa null → kutsuja ei näytä mitään (mieluummin vaiti kuin arvaa).
// Lähde: koulukielioppi / VISK; tarkistettavissa kerralla.

export interface CaseInfo {
  term: string; // kielioppitermi
  question: string; // mihin kysymykseen vastaa = sijan vaikutus
  example: string; // selkoesimerkki (talo-paradigma, paitsi Ins)
}

// FST:n 14 sijaa (CASES gen_wordforms.py:ssä). Esimerkit talo-sanasta.
export const CASE_INFO: Record<string, CaseInfo> = {
  Nom: { term: "nominatiivi", question: "kuka? mikä? (perusmuoto)", example: "talo" },
  Gen: { term: "genetiivi", question: "kenen? minkä?", example: "talon" },
  Par: { term: "partitiivi", question: "ketä? mitä? (osaa)", example: "taloa" },
  Ess: { term: "essiivi", question: "minä? missä roolissa?", example: "talona" },
  Tra: { term: "translatiivi", question: "miksi? mihin muotoon?", example: "taloksi" },
  Ine: { term: "inessiivi", question: "missä? (sisällä)", example: "talossa" },
  Ela: { term: "elatiivi", question: "mistä? (sisältä)", example: "talosta" },
  Ill: { term: "illatiivi", question: "mihin? (sisään)", example: "taloon" },
  Ade: { term: "adessiivi", question: "millä? kenellä? (luona)", example: "talolla" },
  Abl: { term: "ablatiivi", question: "miltä? keneltä?", example: "talolta" },
  All: { term: "allatiivi", question: "mille? kenelle?", example: "talolle" },
  Abe: { term: "abessiivi", question: "ilman mitä?", example: "talotta" },
  Com: { term: "komitatiivi", question: "minkä kanssa?", example: "taloineen" },
  Ins: { term: "instruktiivi", question: "millä tavoin? (monikossa)", example: "jaloin" },
};

const NUMBER: Record<string, string> = { Sg: "yksikön", Pl: "monikon" };
const DEGREE: Record<string, string> = { Comp: "vertailumuoto (-mpi)", Superl: "yliaste (-in)" };
const POS: Record<string, string> = { N: "substantiivi", A: "adjektiivi", V: "verbi" };
const MOOD: Record<string, string> = {
  Ind: "tositapa (indikatiivi)",
  Cond: "ehtotapa (-isi, konditionaali)",
  Pot: "mahtotapa (-ne, potentiaali)",
  Imprt: "käskytapa (imperatiivi)",
};
const TENSE: Record<string, string> = { Prs: "preesens", Prt: "imperfekti" };
const PERSON: Record<string, string> = {
  Sg1: "yksikön 1. (minä)",
  Sg2: "yksikön 2. (sinä)",
  Sg3: "yksikön 3. (hän)",
  Pl1: "monikon 1. (me)",
  Pl2: "monikon 2. (te)",
  Pl3: "monikon 3. (he)",
};
const PARTICIPLE: Record<string, string> = {
  PrsPrc: "1. partisiippi (-va/-vä)",
  PrfPrc: "2. partisiippi (-nut/-lut)",
  AgPrc: "agenttipartisiippi (-ma/-mä)",
  NegPrc: "kieltopartisiippi (-maton/-mätön)",
};
const INFINITIVE: Record<string, string> = {
  InfA: "A-infinitiivi",
  InfE: "E-infinitiivi",
  InfMa: "MA-infinitiivi",
};

export interface Described {
  text: string; // sanaluokka + muoto, esim. "substantiivi · yksikön inessiivi"
  effect?: string; // sijan vaikutus (kysymyssana), vain nominaaleilla/partisiippisijoilla
  example?: string; // selkoesimerkki, kun sija
}

/** Koodi -> selkoselite, tai null jos koodia ei tunneta (→ ei näytetä mitään). */
export function describeCode(code: string): Described | null {
  if (!code) return null;
  if (code === "Base") return { text: "perusmuoto" };

  const t = code.split("+");
  const pos = t[0];
  const has = (x: string) => t.includes(x);
  const find = (map: Record<string, unknown>): string | null => {
    for (const k of t) if (k in map) return k;
    return null;
  };

  if (pos === "N" || pos === "A") {
    const caseK = find(CASE_INFO);
    if (!caseK) return { text: POS[pos] };
    const numK = find(NUMBER);
    const degK = find(DEGREE);
    const ci = CASE_INFO[caseK];
    const form = `${numK ? NUMBER[numK] + " " : ""}${ci.term}${degK ? ", " + DEGREE[degK] : ""}`;
    return { text: `${POS[pos]} · ${form}`, effect: ci.question, example: ci.example };
  }

  if (pos === "V") {
    const prcK = find(PARTICIPLE);
    const infK = find(INFINITIVE);
    const caseK = find(CASE_INFO);
    const numK = find(NUMBER);
    if (prcK) {
      const voice = has("Pss") ? "passiivin " : "";
      const tail = caseK ? ` · ${numK ? NUMBER[numK] + " " : ""}${CASE_INFO[caseK].term}` : "";
      const r: Described = { text: `verbi · ${voice}${PARTICIPLE[prcK]}${tail}` };
      if (caseK) {
        r.effect = CASE_INFO[caseK].question;
        r.example = CASE_INFO[caseK].example;
      }
      return r;
    }
    if (infK) {
      const tail = caseK ? ` · ${CASE_INFO[caseK].term}` : "";
      return { text: `verbi · ${INFINITIVE[infK]}${tail}` };
    }
    // Finiittimuoto.
    const moodK = find(MOOD);
    const tenseK = find(TENSE);
    const persK = find(PERSON);
    const bits = ["verbi"];
    if (has("Pss")) bits.push("passiivi");
    if (moodK) bits.push(MOOD[moodK]);
    if (tenseK) bits.push(TENSE[tenseK]);
    if (persK) bits.push(PERSON[persK]);
    else if (has("ConNeg")) bits.push("kieltomuoto");
    return { text: bits.join(" · ") };
  }

  return null;
}
