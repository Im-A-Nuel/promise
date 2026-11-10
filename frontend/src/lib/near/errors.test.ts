import { describe, expect, it } from "vitest";
import { dictionaries } from "@/lib/i18n";
import { ERROR_CODES, extractErrorCode, toFriendlyError } from "@/lib/near/errors";
import { ContractMissingError, ContractPanicError, RpcUnreachableError } from "@/lib/near/provider";

describe("error codes", () => {
  it("every contract code has a message in both languages", () => {
    for (const code of ERROR_CODES) {
      expect(dictionaries.en[`err.${code}`], `en ${code}`).toBeTruthy();
      expect(dictionaries.id[`err.${code}`], `id ${code}`).toBeTruthy();
    }
  });

  it("covers every code defined in the amplop contract", async () => {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(new URL("../../../../contract/amplop/src/errors.rs", import.meta.url), "utf8");
    const defined = [...source.matchAll(/pub const (ERR_[A-Z_]+)/g)].map((m) => m[1]);
    expect(defined.length).toBeGreaterThan(10);
    for (const code of defined) expect(ERROR_CODES as readonly string[], code).toContain(code);
  });
});

describe("toFriendlyError", () => {
  it("maps a contract panic with a known code", () => {
    const error = new ContractPanicError("Smart contract panicked: ERR_TOO_EARLY", "ERR_TOO_EARLY");
    expect(toFriendlyError(error)).toEqual({ key: "err.ERR_TOO_EARLY", code: "ERR_TOO_EARLY" });
  });

  it("finds a code inside a plain error message", () => {
    const error = new Error("Exceeded: ERR_SOULBOUND at nft_transfer");
    expect(toFriendlyError(error).key).toBe("err.ERR_SOULBOUND");
  });

  it("keeps an unknown code visible but shows the generic message", () => {
    expect(toFriendlyError(new Error("ERR_FROM_THE_FUTURE"))).toEqual({
      key: "err.unknown",
      code: "ERR_FROM_THE_FUTURE",
    });
  });

  it("maps network problems and a missing contract", () => {
    expect(toFriendlyError(new RpcUnreachableError("down")).key).toBe("err.rpc");
    expect(toFriendlyError(new ContractMissingError("x.testnet")).key).toBe("err.not_deployed");
  });

  it("never throws on odd input", () => {
    for (const odd of [null, undefined, 42, {}, "ERR_GAS"]) {
      expect(() => toFriendlyError(odd)).not.toThrow();
    }
    expect(toFriendlyError("ERR_GAS").key).toBe("err.ERR_GAS");
  });

  it("extracts only the first code", () => {
    expect(extractErrorCode("a ERR_ONE b ERR_TWO")).toBe("ERR_ONE");
    expect(extractErrorCode("nothing here")).toBeNull();
  });
});
