import { describe, expect, it } from "vitest";
import { markChainChanged, readUrl } from "./api-client";

describe("readUrl", () => {
  it("leaves the url alone until a transaction has finished", () => {
    expect(readUrl("/api/events", 1_000_000)).toBe("/api/events");
  });

  it("asks for an unseen url for 45 seconds after a transaction", () => {
    markChainChanged(2_000_000);
    expect(readUrl("/api/events", 2_000_000)).toBe("/api/events?fresh=2000");
    expect(readUrl("/api/events", 2_030_400)).toBe("/api/events?fresh=2030");
    expect(readUrl("/api/events", 2_044_999)).toBe("/api/events?fresh=2044");
  });

  it("goes back to the plain url once the window has passed", () => {
    markChainChanged(3_000_000);
    expect(readUrl("/api/events", 3_045_000)).toBe("/api/events");
  });

  it("joins with an ampersand when the url already has a query", () => {
    markChainChanged(4_000_000);
    expect(readUrl("/api/events/1?viewer=ayu.promisedemo.testnet", 4_001_000)).toBe("/api/events/1?viewer=ayu.promisedemo.testnet&fresh=4001");
  });

  it("changes the marker every second, so a poll never lands on a stale answer", () => {
    markChainChanged(5_000_000);
    expect(readUrl("/api/x", 5_001_100)).not.toBe(readUrl("/api/x", 5_002_100));
  });
});
