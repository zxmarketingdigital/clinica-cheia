import { it, expect, vi } from "vitest";
import { runReativador } from "../src/agents/reativador";

it("pede avaliação google pra atendidos de ontem", async () => {
  const agenda: any = {
    inativosDesde: vi.fn().mockResolvedValue([]),
    realizadosOntem: vi.fn().mockResolvedValue([{ cliente: { nome: "Ana", telefone: "55..." } }]),
    jaEnviouReativacao: vi.fn().mockResolvedValue(false),
    jaPediuAvaliacao: vi.fn().mockResolvedValue(false),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runReativador({ agenda, wa, agora: new Date(), reviewLink: "https://g/r" } as any);
  expect(wa.send.mock.calls[0]![1]).toContain("https://g/r");
  // FIX C1/C3 — avaliação deve ser logada com agente="avaliacao-google"
  expect(agenda.logMensagem).toHaveBeenCalledWith(
    "55...", "out", expect.any(String), "avaliacao-google"
  );
});

it("reativa inativos com template de reativação", async () => {
  const agenda: any = {
    inativosDesde: vi.fn().mockResolvedValue([{ cliente: { nome: "Bia", telefone: "56..." } }]),
    realizadosOntem: vi.fn().mockResolvedValue([]),
    jaEnviouReativacao: vi.fn().mockResolvedValue(false),
    jaPediuAvaliacao: vi.fn().mockResolvedValue(false),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runReativador({ agenda, wa, agora: new Date(), reviewLink: "https://g/r" } as any);
  expect(wa.send.mock.calls[0]![1]).toContain("Bia");
  // FIX C1 — reativação deve ser logada com agente="reativador"
  expect(agenda.logMensagem).toHaveBeenCalledWith(
    "56...", "out", expect.any(String), "reativador"
  );
});

// FIX C1 — jaEnviouReativacao=true deve pular o envio (dedup)
it("não reativa inativo se jaEnviouReativacao retorna true", async () => {
  const agenda: any = {
    inativosDesde: vi.fn().mockResolvedValue([{ cliente: { nome: "Bia", telefone: "56..." } }]),
    realizadosOntem: vi.fn().mockResolvedValue([]),
    jaEnviouReativacao: vi.fn().mockResolvedValue(true),
    jaPediuAvaliacao: vi.fn().mockResolvedValue(false),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runReativador({ agenda, wa, agora: new Date(), reviewLink: "https://g/r" } as any);
  expect(wa.send).not.toHaveBeenCalled();
});

// FIX C3 — jaPediuAvaliacao=true deve pular o pedido de avaliação (dedup)
it("não pede avaliação se jaPediuAvaliacao retorna true", async () => {
  const agenda: any = {
    inativosDesde: vi.fn().mockResolvedValue([]),
    realizadosOntem: vi.fn().mockResolvedValue([{ cliente: { nome: "Ana", telefone: "55..." } }]),
    jaEnviouReativacao: vi.fn().mockResolvedValue(false),
    jaPediuAvaliacao: vi.fn().mockResolvedValue(true),
    logMensagem: vi.fn().mockResolvedValue(undefined),
    clienteOptOut: async () => false,
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await runReativador({ agenda, wa, agora: new Date(), reviewLink: "https://g/r" } as any);
  expect(wa.send).not.toHaveBeenCalled();
});
