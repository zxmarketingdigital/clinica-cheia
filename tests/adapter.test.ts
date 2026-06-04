import { describe, it, expect, vi } from "vitest";
import { makeAdapter, normalizeInbound, applyKeywordGate } from "../src/whatsapp/adapter";

describe("normalizeInbound", () => {
  it("extrai telefone+texto do payload uazapi", () => {
    const msg = normalizeInbound("uazapi", { message: { sender: "5585999999999", text: "oi" } });
    expect(msg).toEqual({ telefone: "5585999999999", texto: "oi" });
  });
  it("ignora mensagem própria (fromMe)", () => {
    expect(normalizeInbound("uazapi", { message: { fromMe: true, text: "x" } })).toBeNull();
  });
});

describe("normalizeInbound zapi", () => {
  it("extrai telefone+texto com text como objeto {message}", () => {
    const msg = normalizeInbound("zapi", { phone: "5585999999999", text: { message: "oi" } });
    expect(msg).toEqual({ telefone: "5585999999999", texto: "oi" });
  });
  it("aceita text como string direta", () => {
    const msg = normalizeInbound("zapi", { phone: "5585999999999", text: "olá" });
    expect(msg).toEqual({ telefone: "5585999999999", texto: "olá" });
  });
  it("ignora mensagem própria (fromMe)", () => {
    expect(normalizeInbound("zapi", { phone: "5585", fromMe: true, text: { message: "x" } })).toBeNull();
  });
  it("ignora mensagem de grupo (isGroup)", () => {
    expect(normalizeInbound("zapi", { phone: "5585", isGroup: true, text: { message: "x" } })).toBeNull();
  });
  it("ignora payload sem texto", () => {
    expect(normalizeInbound("zapi", { phone: "5585", text: { message: "" } })).toBeNull();
    expect(normalizeInbound("zapi", { phone: "5585" })).toBeNull();
  });
  it("extrai msgId do messageId (dedup)", () => {
    const msg = normalizeInbound("zapi", { phone: "5585", text: { message: "oi" }, messageId: "ABC123" });
    expect(msg).toEqual({ telefone: "5585", texto: "oi", msgId: "ABC123" });
  });
});

describe("zapi adapter", () => {
  it("send chama endpoint /send-text com Client-Token e body {phone,message}", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const a = makeAdapter(
      { provider: "zapi", instance: "INST", token: "TKN", clientToken: "CT" },
      fetchMock,
    );
    await a.send("5585999999999", "olá");
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.z-api.io/instances/INST/token/TKN/send-text");
    expect((opts as any).headers["Client-Token"]).toBe("CT");
    expect(JSON.parse((opts as any).body)).toEqual({ phone: "5585999999999", message: "olá" });
  });
  it("lança erro em status não-ok", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("err", { status: 500 }));
    const a = makeAdapter({ provider: "zapi", instance: "I", token: "T", clientToken: "C" }, fetchMock);
    await expect(a.send("5585", "x")).rejects.toThrow();
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

describe("applyKeywordGate (gating /clinica)", () => {
  const msg = { telefone: "5585", texto: "/clinica quero agendar botox" };
  it("sem keyword configurada, passa a mensagem intacta", () => {
    expect(applyKeywordGate(msg, undefined)).toEqual(msg);
  });
  it("com keyword e match, remove o prefixo e processa", () => {
    expect(applyKeywordGate(msg, "/clinica")).toEqual({ telefone: "5585", texto: "quero agendar botox" });
  });
  it("match é case-insensitive e tolera espaço inicial", () => {
    const m = { telefone: "5585", texto: "  /CLINICA  oi" };
    expect(applyKeywordGate(m, "/clinica")).toEqual({ telefone: "5585", texto: "oi" });
  });
  it("com keyword e SEM match, ignora (null) — deixa pro outro handler", () => {
    const outra = { telefone: "5585", texto: "boa tarde, tudo bem?" };
    expect(applyKeywordGate(outra, "/clinica")).toBeNull();
  });
  it("propaga null de entrada", () => {
    expect(applyKeywordGate(null, "/clinica")).toBeNull();
  });
  it("rejeita prefixo grudado — /clinicaxyz NÃO é /clinica", () => {
    expect(applyKeywordGate({ telefone: "5585", texto: "/clinicaxyz agendar" }, "/clinica")).toBeNull();
  });
  it("aceita keyword exata (texto vira vazio)", () => {
    expect(applyKeywordGate({ telefone: "5585", texto: "/clinica" }, "/clinica")).toEqual({ telefone: "5585", texto: "" });
  });
});
