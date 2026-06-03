import { describe, it, expect, vi } from "vitest";
import { makeAdapter, normalizeInbound } from "../src/whatsapp/adapter";

describe("normalizeInbound", () => {
  it("extrai telefone+texto do payload uazapi", () => {
    const msg = normalizeInbound("uazapi", { message: { sender: "5585999999999", text: "oi" } });
    expect(msg).toEqual({ telefone: "5585999999999", texto: "oi" });
  });
  it("ignora mensagem própria (fromMe)", () => {
    expect(normalizeInbound("uazapi", { message: { fromMe: true, text: "x" } })).toBeNull();
  });
});

describe("uazapi adapter", () => {
  it("send chama endpoint com token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const a = makeAdapter({ provider: "uazapi", url: "https://api.uazapi.com", token: "T" }, fetchMock);
    await a.send("5585999999999", "olá");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("uazapi.com");
    expect((opts as any).headers.token).toBe("T");
  });
});
