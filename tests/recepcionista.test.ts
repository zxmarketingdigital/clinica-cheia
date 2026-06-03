import { it, expect, vi } from "vitest";
import { handleInbound } from "../src/agents/recepcionista";
it("quando Gemini sinaliza AGENDAR, cria agendamento e confirma", async () => {
  const llm = vi.fn().mockResolvedValue("Perfeito! [[AGENDAR nome=Ana procedimento=Avaliação inicio=2026-06-10T14:00:00-03:00]]");
  const agenda: any = {
    upsertCliente: vi.fn().mockResolvedValue({ id: "c1", nome: "Ana", telefone: "5585..." }),
    procedimentoPorNome: vi.fn().mockResolvedValue({ id: "p1", nome: "Avaliação" }),
    criarAgendamento: vi.fn().mockResolvedValue({ id: "a1" }),
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await handleInbound({ telefone: "5585...", texto: "quero avaliação dia 10 às 14h, sou a Ana" }, { llm, agenda, wa } as any);
  expect(agenda.criarAgendamento).toHaveBeenCalledOnce();
  expect(wa.send).toHaveBeenCalled();
});
it("AGENDAR com data no passado não cria agendamento mas ainda responde ao cliente", async () => {
  const llm = vi.fn().mockResolvedValue("Certo! [[AGENDAR nome=X procedimento=Botox inicio=2020-01-01T10:00:00Z]]");
  const agenda: any = {
    upsertCliente: vi.fn().mockResolvedValue({ id: "c2", nome: "X", telefone: "5586..." }),
    procedimentoPorNome: vi.fn().mockResolvedValue({ id: "p2", nome: "Botox" }),
    criarAgendamento: vi.fn().mockResolvedValue({ id: "a2" }),
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await handleInbound({ telefone: "5586...", texto: "quero botox" }, { llm, agenda, wa } as any);
  expect(agenda.criarAgendamento).not.toHaveBeenCalled();
  expect(wa.send).toHaveBeenCalled();
});
