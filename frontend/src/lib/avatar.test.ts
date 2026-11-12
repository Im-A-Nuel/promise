import { describe, expect, it } from "vitest";
import { PALETTE } from "@/components/pixel";
import { avatarLook, avatarSprite } from "./avatar";

describe("avatar", () => {
  it("gives one account the same look every time", () => {
    expect(avatarLook("Rina", "rina.testnet")).toEqual(avatarLook("Rina", "rina.testnet"));
    expect(avatarLook("Rina", "RINA.testnet")).toEqual(avatarLook("rina", "rina.testnet"));
  });

  it("uses the account, not the display name, when it has one", () => {
    expect(avatarLook("Sam", "sam1.testnet")).not.toEqual(avatarLook("Sam", "sam2.testnet"));
  });

  it("spreads accounts over many looks", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) seen.add(JSON.stringify(avatarLook(`guest ${i}`, `guest${i}.testnet`)));
    expect(seen.size).toBeGreaterThan(200);
  });

  it("uses every hair style and some glasses", () => {
    const styles = new Set<string>();
    let glasses = 0;
    for (let i = 0; i < 300; i++) {
      const look = avatarLook(`guest ${i}`, `guest${i}.testnet`);
      styles.add(look.hairStyle);
      if (look.glasses) glasses++;
    }
    expect([...styles].sort()).toEqual(["bun", "cap", "curly", "long", "short"]);
    expect(glasses).toBeGreaterThan(30);
    expect(glasses).toBeLessThan(150);
  });

  it("keeps the curated look of the five demo accounts, by account or by name", () => {
    const byAccount = avatarLook("Ayu", "ayu.promisedemo.testnet");
    expect(byAccount.hairStyle).toBe("bun");
    expect(avatarLook("ayu")).toEqual(byAccount);
    expect(avatarLook("Citra").glasses).toBe(true);
    expect(avatarLook("Eko").hairStyle).toBe("cap");
  });

  it("does not give a stranger a demo look", () => {
    expect(avatarLook("Ayu", "ayu.testnet")).not.toEqual(avatarLook("Ayu", "ayu.promisedemo.testnet"));
  });

  it("draws a 16 by 15 bust that only uses known colors", () => {
    for (let i = 0; i < 60; i++) {
      const { sprite, palette } = avatarSprite(avatarLook(`guest ${i}`, `guest${i}.testnet`));
      expect(sprite).toHaveLength(15);
      for (const row of sprite) {
        expect(row).toHaveLength(16);
        for (const ch of row) if (ch !== ".") expect(PALETTE[ch] ?? palette[ch], `unknown color "${ch}"`).toBeTruthy();
      }
    }
  });
});
