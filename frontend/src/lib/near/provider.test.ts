import { describe, expect, it } from "vitest";
import { getConfig, getHajats } from "@/lib/near/contract";
import { ContractMissingError, ContractPanicError, RpcUnreachableError, viewCall } from "@/lib/near/provider";

type Handler = (url: string, body: { params: { method_name?: string; args_base64?: string } }) => Response | Promise<Response>;

function fakeFetch(handler: Handler) {
  const calls: string[] = [];
  const impl = async (url: string, init?: RequestInit) => {
    calls.push(url);
    return handler(url, JSON.parse(String(init?.body)));
  };
  return { impl, calls };
}

const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

const bytes = (value: unknown) => Array.from(new TextEncoder().encode(JSON.stringify(value)));
const ok = (value: unknown) => json({ jsonrpc: "2.0", id: "promise", result: { result: bytes(value), logs: [] } });

describe("viewCall", () => {
  it("decodes the result bytes", async () => {
    const { impl } = fakeFetch(() => ok({ hello: "world" }));
    await expect(viewCall("c.testnet", "m", {}, { fetchImpl: impl })).resolves.toEqual({ hello: "world" });
  });

  it("sends utf-8 safe base64 args", async () => {
    let seen = "";
    const { impl } = fakeFetch((_u, body) => {
      seen = body.params.args_base64 ?? "";
      return ok(null);
    });
    await viewCall("c.testnet", "m", { label: "Selamat ya é" }, { fetchImpl: impl });
    const decoded = new TextDecoder().decode(Uint8Array.from(atob(seen), (c) => c.charCodeAt(0)));
    expect(JSON.parse(decoded)).toEqual({ label: "Selamat ya é" });
  });

  it("falls back to the second endpoint when the first fails", async () => {
    const { impl, calls } = fakeFetch((url) => (url.includes("primary") ? json({}, 503) : ok(7)));
    const out = await viewCall("c.testnet", "m", {}, { fetchImpl: impl, urls: ["https://primary", "https://backup"] });
    expect(out).toBe(7);
    expect(calls).toEqual(["https://primary", "https://backup"]);
  });

  it("throws RpcUnreachableError when every endpoint fails", async () => {
    const { impl } = fakeFetch(() => {
      throw new TypeError("network down");
    });
    await expect(viewCall("c.testnet", "m", {}, { fetchImpl: impl, urls: ["https://a", "https://b"] })).rejects.toBeInstanceOf(
      RpcUnreachableError,
    );
  });

  it("reports a missing contract without trying the fallback", async () => {
    const { impl, calls } = fakeFetch(() =>
      json({ jsonrpc: "2.0", id: "promise", result: { error: "wasm execution failed: account amplop.x.testnet does not exist while viewing" } }),
    );
    await expect(viewCall("amplop.x.testnet", "get_config", {}, { fetchImpl: impl, urls: ["https://a", "https://b"] })).rejects.toBeInstanceOf(
      ContractMissingError,
    );
    expect(calls).toHaveLength(1);
  });

  it("reports an UNKNOWN_ACCOUNT error object as missing too", async () => {
    const { impl } = fakeFetch(() =>
      json({ jsonrpc: "2.0", id: "promise", error: { name: "HANDLER_ERROR", cause: { name: "UNKNOWN_ACCOUNT" } } }),
    );
    await expect(viewCall("x.testnet", "m", {}, { fetchImpl: impl })).rejects.toBeInstanceOf(ContractMissingError);
  });

  it("surfaces contract panics with their code", async () => {
    const { impl } = fakeFetch(() =>
      json({ jsonrpc: "2.0", id: "promise", result: { error: "Smart contract panicked: ERR_HAJAT_NOT_FOUND" } }),
    );
    const error = await viewCall("x.testnet", "m", {}, { fetchImpl: impl }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ContractPanicError);
    expect((error as ContractPanicError).code).toBe("ERR_HAJAT_NOT_FOUND");
  });
});

describe("typed contract reads", () => {
  it("parses get_config with zod", async () => {
    const config = { owner: "o.testnet", ft: "t.testnet", app_url: "https://x", hajat_count: 2, token_count: 5 };
    const { impl } = fakeFetch(() => ok(config));
    await expect(getConfig({ fetchImpl: impl })).resolves.toEqual(config);
  });

  it("rejects an answer that does not match the schema", async () => {
    const { impl } = fakeFetch(() => ok({ owner: 1 }));
    await expect(getConfig({ fetchImpl: impl })).rejects.toThrow();
  });

  it("passes paging arguments", async () => {
    let args: unknown;
    const { impl } = fakeFetch((_u, body) => {
      args = JSON.parse(atob(body.params.args_base64 ?? ""));
      return ok([]);
    });
    await getHajats({ from: 20, limit: 10 }, { fetchImpl: impl });
    expect(args).toEqual({ from: 20, limit: 10 });
  });
});
