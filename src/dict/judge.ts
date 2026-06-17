// Sanan kelvollisuuden arviointi rajapinnan takana, jotta muut kielet (ja
// tuomarimoodi) voidaan lisätä myöhemmin ilman pelikoodin muutoksia.
// Ks. SANAMIX.md: ExactJudge nyt; AdvisoryJudge / HumanJudge myöhemmin.
import { Dawg } from "./dawg";
import type { BuiltDawg } from "./builder";

export type Verdict = "valid" | "invalid" | "unknown";

export interface WordJudge {
  /** Sanaston tunniste (osa pelin identiteettiä; kiinnitetään haasteisiin). */
  readonly version: string;
  judge(word: string): Verdict;
  /** Kaikki sanat (≥2) jotka annetuista nopan tahkoista voi muodostaa (opettavuus). */
  wordsFromRack(rack: readonly string[]): string[];
}

/** Täsmätuomari: DAWG-jäsenyys. "unknown" ei koskaan esiinny. */
export class ExactJudge implements WordJudge {
  private readonly dawg: Dawg;

  constructor(built: BuiltDawg) {
    this.dawg = new Dawg(built);
  }

  get version(): string {
    return this.dawg.meta.version;
  }

  judge(word: string): Verdict {
    return this.dawg.has(word.toLowerCase()) ? "valid" : "invalid";
  }

  wordsFromRack(rack: readonly string[]): string[] {
    return this.dawg.wordsFromRack(rack);
  }
}
