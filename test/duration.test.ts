// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { describe, expect, it } from "vitest";
import { coerceDuration, DEFAULT_DURATION, DURATION_OPTIONS, UNTIMED } from "../src/ui/settings";

// Ajaton kierros (ITU.md › Ydinmekaniikka, 14.10.2026) kulkee arvona 0 haastelinkissä ja
// levyllä. Nolla on siis kelvollinen kesto, mutta puuttuva tai vieras arvo ei ole.
describe("kierroksen kesto", () => {
  it("ajaton on valittavissa ja säilyy", () => {
    expect(DURATION_OPTIONS).toContain(UNTIMED);
    expect(coerceDuration(UNTIMED)).toBe(UNTIMED);
  });
  it("puuttuva tai vieras arvo palaa oletukseen", () => {
    expect(coerceDuration(undefined)).toBe(DEFAULT_DURATION);
    expect(coerceDuration(45)).toBe(DEFAULT_DURATION);
    expect(coerceDuration("0")).toBe(DEFAULT_DURATION);
  });
});
