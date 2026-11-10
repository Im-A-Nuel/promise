import { afterEach, describe, expect, it, vi } from "vitest";
import { dictionaries, translate } from "@/lib/i18n";

describe("dictionaries", () => {
  it("have exactly the same keys", () => {
    const en = Object.keys(dictionaries.en).sort();
    const id = Object.keys(dictionaries.id).sort();
    expect(id).toEqual(en);
  });

  it("have no empty strings", () => {
    for (const [locale, dict] of Object.entries(dictionaries)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.trim(), `${locale}:${key}`).not.toBe("");
      }
    }
  });

  it("use the same placeholders in both languages", () => {
    const names = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const key of Object.keys(dictionaries.en)) {
      expect(names(dictionaries.id[key] ?? ""), key).toEqual(names(dictionaries.en[key] ?? ""));
    }
  });

  it("contain no em dashes", () => {
    for (const [locale, dict] of Object.entries(dictionaries)) {
      for (const [key, value] of Object.entries(dict)) {
        expect(value.includes("—"), `${locale}:${key}`).toBe(false);
      }
    }
  });
});

describe("translate", () => {
  afterEach(() => vi.restoreAllMocks());

  it("fills placeholders", () => {
    expect(translate("en", "demo.use", { name: "Ayu" })).toBe("Use Ayu");
    expect(translate("id", "demo.use", { name: "Ayu" })).toBe("Pakai Ayu");
  });

  it("falls back to English, then to the key, and warns", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const dicts = { en: { only_en: "English only" }, id: {} };
    expect(translate("id", "only_en", undefined, dicts)).toBe("English only");
    expect(translate("id", "nowhere", undefined, dicts)).toBe("nowhere");
    expect(warn).toHaveBeenCalledTimes(2);
  });

  it("leaves unknown placeholders visible instead of printing undefined", () => {
    expect(translate("en", "demo.use", {})).toBe("Use {name}");
  });
});
