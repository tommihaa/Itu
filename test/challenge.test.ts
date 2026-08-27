// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { describe, it, expect } from "vitest";
import {
  type ChallengePayload,
  b64e,
  challengeLink,
  decodeChallenge,
  dictMismatchOf,
} from "../src/domain/challenge";

const ROUND_OPTIONS = [1, 3, 5, 10];
const BASE = "https://tommi-itu.vercel.app/";
const V = "sanasto-fi-v1";

/** Poimi #c=… -koodi linkistä. */
function codeOf(url: string): string {
  return url.slice(url.indexOf("#c=") + 3);
}

describe("challenge — round-trip", () => {
  it("täysi payload säilyy koodauksen läpi", () => {
    const p: ChallengePayload = {
      v: 1,
      b: "seed123",
      n: 5,
      m: 1,
      d: 180,
      dv: V,
      th: ["teema-a", "teema-b"],
      a: { name: "Tommi", s: [10, 20, 30], t: 60, h: ["teema-a"] },
      r: { name: "Kaveri", s: [5, 15, 25], t: 45, h: ["teema-b"] },
    };
    const decoded = decodeChallenge(codeOf(challengeLink(p, BASE)), ROUND_OPTIONS);
    expect(decoded).toEqual(p);
  });

  it("linkki alkaa annetulla baseUrl:lla", () => {
    const p: ChallengePayload = {
      v: 1, b: "x", n: 1, a: { name: "A", s: [1], t: 1 },
    };
    expect(challengeLink(p, BASE).startsWith(`${BASE}#c=`)).toBe(true);
  });

  it("ei-ASCII-nimi (ääkköset) selviää round-tripistä", () => {
    const p: ChallengePayload = {
      v: 1, b: "seed", n: 3, a: { name: "Ääkkös-Pöllö Ödön", s: [3, 3, 3], t: 9 },
    };
    const decoded = decodeChallenge(codeOf(challengeLink(p, BASE)), ROUND_OPTIONS);
    expect(decoded?.a.name).toBe("Ääkkös-Pöllö Ödön");
  });
});

describe("challenge — legacy (ilman dv-kenttää)", () => {
  it("legacy-payload dekoodautuu ja mismatch on tyhjä", () => {
    const legacy: ChallengePayload = {
      v: 1, b: "seed", n: 3, a: { name: "A", s: [1, 2, 3], t: 6 },
    };
    const decoded = decodeChallenge(codeOf(challengeLink(legacy, BASE)), ROUND_OPTIONS);
    expect(decoded).not.toBeNull();
    expect(decoded!.dv).toBeUndefined();
    // Puuttuva dv ⇒ oletetaan sanasto-fi-v1 ⇒ ei mismatchia v1:tä vasten.
    expect(dictMismatchOf(decoded!, V)).toBeUndefined();
  });

  it("legacy-linkki nykyistä v2-sanastoa vasten → mismatch kertoo v1:n (PEHMEÄ)", () => {
    const legacy: ChallengePayload = {
      v: 1, b: "seed", n: 1, a: { name: "A", s: [1], t: 1 },
    };
    expect(dictMismatchOf(legacy, "sanasto-fi-v2")).toBe("sanasto-fi-v1");
  });
});

describe("challenge — sanastoversion mismatch", () => {
  it("eri dv-versio palauttaa linkin version", () => {
    const p: ChallengePayload = {
      v: 1, b: "seed", n: 1, dv: "sanasto-fi-v2", a: { name: "A", s: [1], t: 1 },
    };
    expect(dictMismatchOf(p, V)).toBe("sanasto-fi-v2");
  });

  it("sama versio → ei mismatchia", () => {
    const p: ChallengePayload = {
      v: 1, b: "seed", n: 1, dv: V, a: { name: "A", s: [1], t: 1 },
    };
    expect(dictMismatchOf(p, V)).toBeUndefined();
  });
});

describe("challenge — roskasyöte palauttaa null (ei poikkeusta)", () => {
  it("ei-base64", () => {
    expect(decodeChallenge("ei-base64!!", ROUND_OPTIONS)).toBeNull();
  });

  it("tyhjä string", () => {
    expect(decodeChallenge("", ROUND_OPTIONS)).toBeNull();
  });

  it("validi base64 mutta väärä JSON-muoto", () => {
    // JSON-lista, ei odotettu objekti.
    expect(decodeChallenge(b64e("[1,2,3]"), ROUND_OPTIONS)).toBeNull();
    // Objekti ilman pakollisia kenttiä.
    expect(decodeChallenge(b64e(JSON.stringify({ v: 1 })), ROUND_OPTIONS)).toBeNull();
  });

  it("kelvoton kierrosmäärä (ei ROUND_OPTIONSissa) → null", () => {
    const p = { v: 1, b: "seed", n: 7, a: { name: "A", s: [1], t: 1 } };
    expect(decodeChallenge(b64e(JSON.stringify(p)), ROUND_OPTIONS)).toBeNull();
  });

  it("ei koskaan heitä roskasyötteestä", () => {
    for (const bad of ["", "%%%", "ei-base64!!", "====", "🙂"]) {
      expect(() => decodeChallenge(bad, ROUND_OPTIONS)).not.toThrow();
    }
  });
});
