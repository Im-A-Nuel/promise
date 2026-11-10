import { describe, expect, it } from "vitest";
import { explorerTxUrl, formatAgo, formatAmount, formatDate, formatTusdc, parseAmount, shortAccount } from "@/lib/near/format";

describe("formatAmount", () => {
  it("shows two decimals minimum", () => {
    expect(formatAmount("5000000")).toBe("5.00");
    expect(formatAmount("0")).toBe("0.00");
    expect(formatAmount("10000")).toBe("0.01");
    expect(formatAmount(2_000_000n)).toBe("2.00");
  });

  it("keeps extra precision only when it is real", () => {
    expect(formatAmount("5120000")).toBe("5.12");
    expect(formatAmount("5123456")).toBe("5.123456");
    expect(formatAmount("5100000")).toBe("5.10");
  });

  it("does not lose precision on very large values", () => {
    expect(formatAmount("123456789012345678901234567890")).toBe("123456789012345678901234.56789");
  });

  it("adds the unit", () => {
    expect(formatTusdc("5000000")).toBe("5.00 tUSDC");
  });
});

describe("parseAmount", () => {
  it("converts to base units", () => {
    expect(parseAmount("5")).toBe("5000000");
    expect(parseAmount("0.5")).toBe("500000");
    expect(parseAmount("5.000001")).toBe("5000001");
    expect(parseAmount(" 12.34 ")).toBe("12340000");
    expect(parseAmount("0")).toBe("0");
  });

  it("rejects bad input", () => {
    for (const bad of ["", " ", "abc", "-1", "1.1234567", "1,5", "1.", ".5", "1e6", "5 tUSDC"]) {
      expect(parseAmount(bad), bad).toBeNull();
    }
  });

  it("round trips with formatAmount", () => {
    for (const units of ["10000", "5000000", "5123456", "99999999"]) {
      expect(parseAmount(formatAmount(units))).toBe(units);
    }
  });
});

describe("shortAccount", () => {
  it("leaves normal ids alone", () => {
    expect(shortAccount("ayu.promisedemo.testnet")).toBe("ayu.promisedemo.testnet");
  });

  it("shortens implicit 64 character ids", () => {
    const id = "a".repeat(64);
    const short = shortAccount(id);
    expect(short.length).toBe(28);
    expect(short).toContain("…");
  });
});

describe("links and dates", () => {
  it("builds explorer urls", () => {
    expect(explorerTxUrl("ABC")).toBe("https://testnet.nearblocks.io/txns/ABC");
  });

  it("formats dates in UTC", () => {
    expect(formatDate(Date.UTC(2026, 10, 14), "en")).toContain("2026");
    expect(formatDate(Date.UTC(2026, 10, 14), "id")).toContain("2026");
  });
});

describe("formatAgo", () => {
  const now = Date.UTC(2026, 10, 9, 12, 0, 0);
  it("says how long ago in the viewer's language", () => {
    expect(formatAgo(now - 5 * 60_000, "en", now)).toBe("5 minutes ago");
    expect(formatAgo(now - 3 * 3_600_000, "en", now)).toBe("3 hours ago");
    expect(formatAgo(now - 2 * 86_400_000, "en", now)).toBe("2 days ago");
  });
  it("falls back to a date after a week", () => {
    expect(formatAgo(now - 10 * 86_400_000, "en", now)).toBe("30 Oct 2026");
  });
  it("never reports the future", () => {
    expect(formatAgo(now + 60_000, "en", now)).toBe("this minute");
  });
});
