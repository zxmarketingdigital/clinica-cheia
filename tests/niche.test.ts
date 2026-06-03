import { describe, it, expect } from "vitest";
import { niche } from "../src/niche/clinica-estetica";
it("tem persona e procedimentos default com cadência", () => {
  expect(niche.persona).toMatch(/clínica/i);
  const botox = niche.procedimentosDefault.find(p => /botox/i.test(p.nome));
  expect(botox?.cadencia_retorno_dias).toBeGreaterThan(0);
});
it("template de confirmação interpola nome e hora", () => {
  const t = niche.templates.confirmacao({ nome: "Ana", quando: "amanhã 14h" });
  expect(t).toContain("Ana"); expect(t).toContain("14h");
});
