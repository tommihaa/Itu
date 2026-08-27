// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { describe, it, expect } from "vitest";
import { describeCode, CASE_INFO } from "../src/dict/morph";

describe("describeCode — analyysikoodin selkoselite", () => {
  it("Base → perusmuoto", () => {
    expect(describeCode("Base")).toEqual({ text: "perusmuoto" });
  });

  it("substantiivin sija: N+Sg+Ine", () => {
    const d = describeCode("N+Sg+Ine");
    expect(d).not.toBeNull();
    expect(d!.text).toBe("substantiivi · yksikön inessiivi");
    expect(d!.effect).toBe(CASE_INFO.Ine.question);
    expect(d!.example).toBe(CASE_INFO.Ine.example);
  });

  it("verbin finiittimuoto: V+Act+Ind+Prs+Sg3", () => {
    const d = describeCode("V+Act+Ind+Prs+Sg3");
    expect(d).not.toBeNull();
    // Act ei ole missään taulukossa → sivuutetaan; muut osat mukana järjestyksessä.
    expect(d!.text).toBe("verbi · tositapa (indikatiivi) · preesens · yksikön 3. (hän)");
  });

  it("tuntematon sanaluokka → null", () => {
    expect(describeCode("Z+foo+bar")).toBeNull();
  });

  it("tyhjä koodi → null", () => {
    expect(describeCode("")).toBeNull();
  });
});

describe("CASE_INFO — 14 sijaa", () => {
  it("sisältää täsmälleen 14 sijaa", () => {
    expect(Object.keys(CASE_INFO).length).toBe(14);
  });

  it("kaikilla sijoilla ei-tyhjät term/question/example-kentät", () => {
    for (const [code, info] of Object.entries(CASE_INFO)) {
      expect(info.term, `${code}.term`).toBeTruthy();
      expect(info.question, `${code}.question`).toBeTruthy();
      expect(info.example, `${code}.example`).toBeTruthy();
    }
  });
});
