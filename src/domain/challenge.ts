// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
// Haastekoodaus: base64url-JSON URL-hashiin (#c=…). Puhdas domain-moduuli
// (ei DOM-viittauksia): koodaus/dekoodaus ja sanastoversiovertailu erotettu
// ui/game.ts:stä testattavuuden vuoksi. UI antaa location-arvot ja ROUND_OPTIONS
// argumentteina, jottei domain riipu näkymästä.

export interface ChallengePayload {
  v: number;
  b: string; // perussiemen
  n: number; // kierrokset
  m?: 0 | 1; // pistemoodi: 1 = Scrabble (premium), 0/puuttuu = perinteinen Itu
  d?: number; // kierroskesto sekunteina (puuttuu/tuntematon → oletus)
  dv?: string; // sanastoversio (puuttuu = legacy-linkki ⇒ sanasto-fi-v1)
  th?: string[]; // teemahaaste: jaetut tavoiteteemat (läsnä ⇒ kaveri-teemahaaste)
  a: { name: string; s: number[]; t: number; h?: string[] }; // haastaja (h=teemaosumat)
  r?: { name: string; s: number[]; t: number; h?: string[] }; // vastaaja (paluulinkissä)
}

export function b64e(s: string): string {
  return btoa(encodeURIComponent(s)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64d(s: string): string {
  return decodeURIComponent(atob(s.replace(/-/g, "+").replace(/_/g, "/")));
}

/** Rakenna jaettava haastelinkki. baseUrl = esim. location.origin + location.pathname. */
export function challengeLink(p: ChallengePayload, baseUrl: string): string {
  return `${baseUrl}#c=${b64e(JSON.stringify(p))}`;
}

function isScoreArray(s: unknown): s is number[] {
  return Array.isArray(s) && s.every((n) => typeof n === "number" && Number.isFinite(n));
}

/**
 * Dekoodaa haastekoodi. Palauttaa null viallisesta/väärämuotoisesta syötteestä
 * (ei koskaan heitä). roundOptions = sallitut kierrosmäärät (UI:n ROUND_OPTIONS).
 */
export function decodeChallenge(
  code: string,
  roundOptions: readonly number[],
): ChallengePayload | null {
  try {
    const p = JSON.parse(b64d(code)) as ChallengePayload;
    const validBase =
      p && typeof p.b === "string" && p.b.length > 0 &&
      typeof p.n === "number" && roundOptions.includes(p.n) &&
      p.a && typeof p.a.name === "string" && isScoreArray(p.a.s);
    if (!validBase) return null;
    if (p.th !== undefined && !(Array.isArray(p.th) && p.th.every((s) => typeof s === "string"))) return null;
    if (p.r !== undefined && !(typeof p.r.name === "string" && isScoreArray(p.r.s))) return null;
    return p;
  } catch {
    /* viallinen koodi */
  }
  return null;
}

/**
 * Reiluus: linkki kiinnittää sanastoversion (dv). Puuttuva kenttä = legacy-linkki
 * ajalta ennen kenttää ⇒ sanasto-fi-v1. Palauttaa linkin sanastoversion jos se
 * eroaa nykyisestä (⇒ tulokset eivät täysin vertailukelpoisia), muuten undefined.
 */
export function dictMismatchOf(p: ChallengePayload, dawgVersion: string): string | undefined {
  const linkDict = p.dv ?? "sanasto-fi-v1";
  return linkDict !== dawgVersion ? linkDict : undefined;
}
