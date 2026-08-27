// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { describe, it, expect } from "vitest";
import { buildDawg } from "../src/dict/builder";
import { ExactJudge } from "../src/dict/judge";

// buildDawg vaatii aakkostetun, uniikin listan.
function judgeOf(words: string[]): ExactJudge {
  return new ExactJudge(buildDawg([...words].sort()));
}

describe("ExactJudge — sanantarkistus", () => {
  const j = judgeOf(["talo", "talot", "pää", "pöllö", "yö"]);

  it("hyväksyy sanaston sanan ja normalisoi kirjainkoon", () => {
    expect(j.judge("talo")).toBe("valid");
    expect(j.judge("TALO")).toBe("valid");
    expect(j.judge("TaLo")).toBe("valid");
  });

  it("käsittelee ääkköset molemmissa kirjainkoissa", () => {
    expect(j.judge("pää")).toBe("valid");
    expect(j.judge("PÄÄ")).toBe("valid");
    expect(j.judge("pöllö")).toBe("valid");
    expect(j.judge("PÖLLÖ")).toBe("valid");
    expect(j.judge("yö")).toBe("valid");
  });

  it("hylkää sanaston ulkopuolisen sanan", () => {
    expect(j.judge("auto")).toBe("invalid");
    expect(j.judge("tal")).toBe("invalid"); // prefiksi ei ole sana
  });

  it("hylkää tyhjän merkkijonon ilman poikkeusta", () => {
    expect(j.judge("")).toBe("invalid");
  });

  it("hylkää aakkoston ulkopuolisen merkin ilman poikkeusta", () => {
    // å ja w eivät kuulu ALPHABETiin; judge/dawg palauttaa invalid, ei heitä.
    expect(() => j.judge("wanha")).not.toThrow();
    expect(j.judge("wanha")).toBe("invalid");
    expect(j.judge("tålo")).toBe("invalid");
  });

  it("wordsFromRack palauttaa vain rackista muodostettavat sanat", () => {
    const jr = judgeOf(["talo", "talot", "kala"]);
    const found = new Set(jr.wordsFromRack(["t", "a", "l", "o"]));
    expect(found).toEqual(new Set(["talo"])); // talot vaatii t:n kahdesti, kala vaatii k:n
  });

  it("altistaa sanastoversion", () => {
    expect(j.version).toBe("sanasto-fi-v1");
  });
});
