import { it, expect, vi } from "vitest";
import { runReativador } from "../src/agents/reativador";

it("pede avaliação google pra atendidos de ontem", async () => {
  const agenda: any = {
    inativosDesde: vi.fn().mockResolvedValue([]),
    realizadosOntem: vi.fn().mockResolvedValue([{ cliente: { nome: "Ana", telefone: "55..." } }]),
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runReativador({ agenda, wa, agora: new Date(), reviewLink: "https://g/r" } as any);
  expect(wa.send.mock.calls[0][1]).toContain("https://g/r");
});

it("reativa inativos com template de reativação", async () => {
  const agenda: any = {
    inativosDesde: vi.fn().mockResolvedValue([{ cliente: { nome: "Bia", telefone: "56..." } }]),
    realizadosOntem: vi.fn().mockResolvedValue([]),
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runReativador({ agenda, wa, agora: new Date(), reviewLink: "https://g/r" } as any);
  expect(wa.send.mock.calls[0][1]).toContain("Bia");
});
