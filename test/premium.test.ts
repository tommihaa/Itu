// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Tommi Haanranta
import { describe, expect, it } from "vitest";
import { cellKey } from "../src/domain/board";
import {
  BOARD_SIZE,
  CENTER,
  CENTER_INDEX,
  premiumAt,
  premiumKindAt,
  premiumLayout,
} from "../src/domain/premium";

describe("premium-layout", () => {
  it("keskusankkuri on DW (★)", () => {
    expect(CENTER).toBe(cellKey(CENTER_INDEX, CENTER_INDEX));
    expect(premiumKindAt(CENTER)).toBe("DW");
    expect(premiumAt(CENTER)).toEqual({ letter: 1, word: 2 });
  });

  it("tavallinen ruutu = ei premiumia, kertoimet 1/1", () => {
    const plain = cellKey(0, 0); // nurkka, kaukana keskustasta
    expect(premiumKindAt(plain)).toBeNull();
    expect(premiumAt(plain)).toEqual({ letter: 1, word: 1 });
  });

  it("layout on 8-kertaisesti symmetrinen keskipisteen ympäri", () => {
    // Jokaiselle premium-ruudulle kaikkien peilausten/kierrosten on oltava sama laji.
    for (const [key, kind] of premiumLayout()) {
      const [r, c] = key.split(",").map(Number);
      const dr = r - CENTER_INDEX;
      const dc = c - CENTER_INDEX;
      const mirrors = [
        [dr, dc], [-dr, dc], [dr, -dc], [-dr, -dc],
        [dc, dr], [-dc, dr], [dc, -dr], [-dc, -dr],
      ];
      for (const [mr, mc] of mirrors) {
        expect(premiumKindAt(cellKey(CENTER_INDEX + mr, CENTER_INDEX + mc))).toBe(kind);
      }
    }
  });

  it("premiumeja on enemmän kuin nopat (13) ehtii kattaa", () => {
    expect(premiumLayout().size).toBeGreaterThan(13);
  });

  it("premiumit ovat 13 nopan ulottuvuuden sisällä (säde ≤ 5)", () => {
    for (const key of premiumLayout().keys()) {
      const [r, c] = key.split(",").map(Number);
      expect(Math.abs(r - CENTER_INDEX)).toBeLessThanOrEqual(5);
      expect(Math.abs(c - CENTER_INDEX)).toBeLessThanOrEqual(5);
      // ja laudan sisällä
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(BOARD_SIZE);
    }
  });
});
