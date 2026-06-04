import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config";
describe("parseConfig", () => {
  it("rejeita provider whatsapp inválido", () => {
    expect(() => parseConfig({ WHATSAPP_PROVIDER: "telegram" } as any)).toThrow();
  });
  const baseUazapi = {
    CLINICA_NOME: "Bella", WHATSAPP_PROVIDER: "uazapi",
    UAZAPI_URL: "https://x", UAZAPI_TOKEN: "t",
    SUPABASE_URL: "https://s", SUPABASE_SERVICE_KEY: "k",
    GEMINI_API_KEY: "g", GOOGLE_REVIEW_LINK: "https://r",
    WEBHOOK_SECRET: "x".repeat(32),
  };
  it("aceita config uazapi mínima", () => {
    const c = parseConfig({ ...baseUazapi });
    expect(c.clinicaNome).toBe("Bella");
    expect(c.whatsapp.provider).toBe("uazapi");
  });
  it("rejeita sem WEBHOOK_SECRET (fail-closed)", () => {
    const { WEBHOOK_SECRET, ...semSecret } = baseUazapi;
    expect(() => parseConfig(semSecret as any)).toThrow();
  });
  it("rejeita WEBHOOK_SECRET curto (<32)", () => {
    expect(() => parseConfig({ ...baseUazapi, WEBHOOK_SECRET: "curto" } as any)).toThrow();
  });
});
