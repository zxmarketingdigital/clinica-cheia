import { it, expect, vi } from "vitest";
import { handleInbound } from "../src/agents/recepcionista";
it("quando Gemini sinaliza AGENDAR, cria agendamento e confirma", async () => {
  const inicioFuturo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const llm = vi.fn().mockResolvedValue(`Perfeito! [[AGENDAR nome=Ana procedimento=Avaliação inicio=${inicioFuturo}]]`);
  const agenda: any = {
    upsertCliente: vi.fn().mockResolvedValue({ id: "c1", nome: "Ana", telefone: "5585..." }),
    procedimentoPorNome: vi.fn().mockResolvedValue({ id: "p1", nome: "Avaliação" }),
    listarProcedimentos: vi.fn().mockResolvedValue([]),
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
    listarProcedimentos: vi.fn().mockResolvedValue([]),
    criarAgendamento: vi.fn().mockResolvedValue({ id: "a2" }),
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };
  await handleInbound({ telefone: "5586...", texto: "quero botox" }, { llm, agenda, wa } as any);
  expect(agenda.criarAgendamento).not.toHaveBeenCalled();
  expect(wa.send).toHaveBeenCalled();
});

it("monta o prompt com os procedimentos cadastrados no banco", async () => {
  const llm = vi.fn().mockResolvedValue("Olá! Como posso ajudar?");
  const agenda: any = {
    listarProcedimentos: vi.fn().mockResolvedValue([
      { id: "p9", nome: "Procedimento exclusivo" },
      { id: "p10", nome: "Outro procedimento" },
    ]),
    logMensagem: vi.fn().mockResolvedValue(undefined),
  };
  const wa = { send: vi.fn().mockResolvedValue(undefined) };

  await handleInbound({ telefone: "5587...", texto: "quais opções vocês têm?" }, { llm, agenda, wa } as any);

  const system = llm.mock.calls[0][0].system;
  expect(system).toContain("Procedimento exclusivo");
  expect(system).toContain("Outro procedimento");
  expect(system).not.toContain("Limpeza de pele");
});
