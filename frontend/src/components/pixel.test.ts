import { describe, expect, it } from "vitest";
import { PALETTE } from "./pixel";
import * as sprites from "./pixel-sprites";

const all = Object.entries(sprites).filter(([, value]) => Array.isArray(value)) as [string, readonly string[]][];

describe("pixel sprites", () => {
  it("has every sprite", () => {
    expect(all.map(([name]) => name).sort()).toEqual(["ARROW", "BOOK", "CHECK", "CHEST", "COIN", "ENVELOPE", "EYE", "FLASK", "LANTERN", "PERSON"]);
  });

  it.each(all)("%s has rows of one length", (_, sprite) => {
    const width = sprite[0]?.length;
    expect(width).toBeGreaterThan(0);
    sprite.forEach((row, i) => expect(row.length, `row ${i}: ${row}`).toBe(width));
  });

  it.each(all)("%s only uses known colors", (_, sprite) => {
    for (const row of sprite) {
      for (const ch of row) {
        if (ch !== ".") expect(PALETTE[ch], `unknown color "${ch}"`).toBeTruthy();
      }
    }
  });

  it("draws the square sprites at 16 by 16", () => {
    for (const [name, sprite] of all) {
      if (name === "ARROW") continue;
      expect(sprite.length, name).toBe(16);
      expect(sprite[0]?.length, name).toBe(16);
    }
  });
});
