import { describe, expect, it } from "vitest";
import type { Analysis } from "../src/dict/lemmas";
import {
  THEMES,
  THEME_BY_ID,
  detectThemes,
  pickDailyTargets,
  weeklyProgress,
  recordThemeSession,
  dateKey,
  weekStartKey,
  type LearnProgress,
} from "../src/domain/learn";

// Apuri: rakentaa lookupin sana → koodit -taulukosta (sama muoto kuin LemmaLookup).
function lookupFrom(map: Record<string, string[]>): (w: string) => Analysis[] {
  return (w) => (map[w] ?? []).map((code) => ({ lemma: w, code }));
}

describe("THEMES", () => {
  it("sisältää 14 sijaa + luku/aikamuoto/vertailu/partisiipit", () => {
    expect(THEMES.filter((t) => t.group === "case")).toHaveLength(14);
    for (const id of ["pl", "prt", "comp", "superl", "prsprc", "prfprc", "agprc", "negprc"]) {
      expect(THEME_BY_ID[id]).toBeDefined();
    }
  });
  it("kaikilla id:t uniikkeja", () => {
    const ids = THEMES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("detectThemes", () => {
  const lookup = lookupFrom({
    talossa: ["N+Sg+Ine"],
    talot: ["N+Pl+Nom"],
    juoksi: ["V+Act+Ind+Prt+Sg3"],
    isompi: ["A+Comp+Sg+Nom"],
    juokseva: ["V+Act+PrsPrc+Sg+Nom"],
  });

  it("inessiivi → 'ine'", () => {
    expect(detectThemes(["talossa"], lookup).has("ine")).toBe(true);
  });
  it("monikko → 'pl' (eikä persoonatagi Pl3 sekoita)", () => {
    const hits = detectThemes(["talot"], lookup);
    expect(hits.has("pl")).toBe(true);
    expect(hits.has("nom")).toBe(true);
  });
  it("imperfekti → 'prt' (ei sekaannu partitiiviin 'par')", () => {
    const hits = detectThemes(["juoksi"], lookup);
    expect(hits.has("prt")).toBe(true);
    expect(hits.has("par")).toBe(false);
  });
  it("vertailumuoto → 'comp'; 1. partisiippi → 'prsprc'", () => {
    expect(detectThemes(["isompi"], lookup).has("comp")).toBe(true);
    expect(detectThemes(["juokseva"], lookup).has("prsprc")).toBe(true);
  });
  it("homografi (monta analyysia) → useita osumia", () => {
    const homo = lookupFrom({ alusta: ["N+Sg+Par", "N+Sg+Nom", "V+Act+Imprt+Sg2"] });
    const hits = detectThemes(["alusta"], homo);
    expect(hits.has("par")).toBe(true);
    expect(hits.has("nom")).toBe(true);
  });
  it("tuntematon koodi → ei osumaa", () => {
    expect(detectThemes(["x"], lookupFrom({ x: ["Base"] })).size).toBe(0);
  });
});

describe("pickDailyTargets", () => {
  it("deterministinen: sama (progress, päivä) → sama setti", () => {
    const p: LearnProgress = {};
    expect(pickDailyTargets(p, "2026-06-28", 3)).toEqual(pickDailyTargets(p, "2026-06-28", 3));
  });
  it("eri päivä → setti voi rotatoida", () => {
    // Tuoreella progressilla kaikki tasapelissä → päivähajautus erottaa.
    const p: LearnProgress = {};
    const a = pickDailyTargets(p, "2026-06-28", 3).join();
    const b = pickDailyTargets(p, "2026-07-15", 3).join();
    // Ei taata aina eroavan, mutta tämä pari eroaa hajautuksella (regressiovahti).
    expect(a).not.toBe(b);
  });
  it("priorisoi harjoittelemattoman ennen hallittua", () => {
    // "ine" hallittu (tarjottu+osuttu paljon, tuore), "gen" koskaan tarjoamaton.
    const p: LearnProgress = {
      ine: { seen: 10, hits: 10, lastHit: "2026-06-28" },
    };
    const targets = pickDailyTargets(p, "2026-06-28", 3);
    expect(targets).not.toContain("ine"); // hallittu painuu hännille
  });
  it("matalin osumasuhde ennen korkeaa", () => {
    const p: LearnProgress = {
      // molemmat tarjottu, mutta 'gen' osuu harvoin → priorisoidaan
      ine: { seen: 5, hits: 5, lastHit: "2026-06-20" },
      gen: { seen: 5, hits: 1, lastHit: "2026-06-20" },
    };
    // Anna kaikkien muiden olla "tarjottu+hallittu" niin että vain ine/gen kilpailevat kärjessä
    for (const t of THEMES) {
      if (t.id !== "ine" && t.id !== "gen") p[t.id] = { seen: 9, hits: 9, lastHit: "2026-06-28" };
    }
    const order = pickDailyTargets(p, "2026-06-28", THEMES.length);
    expect(order.indexOf("gen")).toBeLessThan(order.indexOf("ine"));
  });
  it("n rajaa tuloksen koon", () => {
    expect(pickDailyTargets({}, "2026-06-28", 2)).toHaveLength(2);
  });
});

describe("recordThemeSession + weeklyProgress", () => {
  it("ei mutatoi prev:iä; seen/hits/lastHit päivittyvät", () => {
    const prev: LearnProgress = {};
    const next = recordThemeSession(prev, ["ine", "pl"], new Set(["ine"]), "2026-06-28");
    expect(prev).toEqual({}); // koskematon
    expect(next.ine).toEqual({ seen: 1, hits: 1, lastHit: "2026-06-28" });
    expect(next.pl).toEqual({ seen: 1, hits: 0, lastHit: "" }); // tarjottu, ei osuttu
  });
  it("osuttu muttei tarjottu → vain lastHit (osumasuhde pysyy ≤ 1)", () => {
    const next = recordThemeSession({}, ["ine"], new Set(["ine", "gen"]), "2026-06-28");
    expect(next.gen).toEqual({ seen: 0, hits: 0, lastHit: "2026-06-28" });
  });
  it("weeklyProgress laskee viikon sisällä osutut", () => {
    let p: LearnProgress = {};
    p = recordThemeSession(p, ["ine"], new Set(["ine"]), "2026-06-22"); // viikon sisällä
    p = recordThemeSession(p, ["pl"], new Set(["pl"]), "2026-06-25");
    p = recordThemeSession(p, ["gen"], new Set(["gen"]), "2026-06-15"); // edellinen viikko
    const { covered, goal } = weeklyProgress(p, "2026-06-22");
    expect(covered).toBe(2);
    expect(goal).toBeGreaterThan(0);
  });
});

describe("date helpers", () => {
  it("dateKey ISO-muoto", () => {
    expect(dateKey(new Date(2026, 5, 28))).toBe("2026-06-28");
  });
  it("weekStartKey palauttaa maanantain", () => {
    // 2026-06-28 on sunnuntai → viikon maanantai 2026-06-22.
    expect(weekStartKey(new Date(2026, 5, 28))).toBe("2026-06-22");
  });
});
