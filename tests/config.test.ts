import { describe, it, expect } from "vitest";
import { parseConfig } from "../src/config";
describe("parseConfig", () => {
  it("rejeita provider whatsapp inválido", () => {
    expect(() => parseConfig({ WHATSAPP_PROVIDER: "telegram" } as any)).toThrow();
  });
  it("aceita config uazapi mínima", () => {
    const c = parseConfig({
      CLINICA_NOME: "Bella", WHATSAPP_PROVIDER: "uazapi",
      UAZAPI_URL: "https://x", UAZAPI_TOKEN: "t",
      SUPABASE_URL: "https://s", SUPABASE_SERVICE_KEY: "k",
      GEMINI_API_KEY: "g", GOOGLE_REVIEW_LINK: "https://r",
    });
    expect(c.clinicaNome).toBe("Bella");
    expect(c.whatsapp.provider).toBe("uazapi");
  });
});
