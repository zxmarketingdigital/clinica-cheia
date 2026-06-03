import { it, expect, vi, describe } from "vitest";
import { runLembreteRetorno } from "../src/agents/lembrete-retorno";

describe("runLembreteRetorno", () => {
  it("dispara só pra cadência vencida sem retorno já enviado", async () => {
    const agenda: any = {
      realizadosComCadenciaVencendo: vi.fn().mockResolvedValue([
        {
          cliente: { nome: "Ana", telefone: "5585..." },
          procedimento: { nome: "Botox" },
          ultimo: "2026-01-01",
        },
      ]),
      jaEnviouLembrete: vi.fn().mockResolvedValue(false),
      logMensagem: vi.fn().mockResolvedValue(undefined),
    };
    const wa = { send: vi.fn().mockResolvedValue(undefined) };
    await runLembreteRetorno({ agenda, wa, agora: new Date("2026-06-03") } as any);
    expect(wa.send).toHaveBeenCalledOnce();
    expect(wa.send.mock.calls[0][1]).toContain("Botox");
  });

  it("não dispara se já enviou lembrete recentemente", async () => {
    const agenda: any = {
      realizadosComCadenciaVencendo: vi.fn().mockResolvedValue([
        {
          cliente: { nome: "Bea", telefone: "5586..." },
          procedimento: { nome: "Limpeza" },
          ultimo: "2026-04-01",
        },
      ]),
      jaEnviouLembrete: vi.fn().mockResolvedValue(true), // já enviou
      logMensagem: vi.fn().mockResolvedValue(undefined),
    };
    const wa = { send: vi.fn().mockResolvedValue(undefined) };
    await runLembreteRetorno({ agenda, wa, agora: new Date("2026-06-03") } as any);
    expect(wa.send).not.toHaveBeenCalled();
  });

  it("não dispara se lista de vencidos está vazia", async () => {
    const agenda: any = {
      realizadosComCadenciaVencendo: vi.fn().mockResolvedValue([]),
      jaEnviouLembrete: vi.fn(),
      logMensagem: vi.fn(),
    };
    const wa = { send: vi.fn() };
    await runLembreteRetorno({ agenda, wa, agora: new Date("2026-06-03") } as any);
    expect(wa.send).not.toHaveBeenCalled();
    expect(agenda.jaEnviouLembrete).not.toHaveBeenCalled();
  });

  it("registra mensagem no log após enviar", async () => {
    const agenda: any = {
      realizadosComCadenciaVencendo: vi.fn().mockResolvedValue([
        {
          cliente: { nome: "Carla", telefone: "5587..." },
          procedimento: { nome: "Preenchimento" },
          ultimo: "2025-06-01",
        },
      ]),
      jaEnviouLembrete: vi.fn().mockResolvedValue(false),
      logMensagem: vi.fn().mockResolvedValue(undefined),
    };
    const wa = { send: vi.fn().mockResolvedValue(undefined) };
    await runLembreteRetorno({ agenda, wa, agora: new Date("2026-06-03") } as any);
    expect(agenda.logMensagem).toHaveBeenCalledOnce();
    const [telefone, direcao, corpo, agente] = agenda.logMensagem.mock.calls[0];
    expect(telefone).toBe("5587...");
    expect(direcao).toBe("out");
    expect(corpo).toContain("Preenchimento");
    expect(agente).toBe("lembrete-retorno");
  });

  it("dispara para múltiplos clientes com cadência vencida", async () => {
    const agenda: any = {
      realizadosComCadenciaVencendo: vi.fn().mockResolvedValue([
        {
          cliente: { nome: "Ana", telefone: "55a" },
          procedimento: { nome: "Botox" },
          ultimo: "2026-01-01",
        },
        {
          cliente: { nome: "Bea", telefone: "55b" },
          procedimento: { nome: "Limpeza" },
          ultimo: "2026-01-01",
        },
      ]),
      jaEnviouLembrete: vi.fn().mockResolvedValue(false),
      logMensagem: vi.fn().mockResolvedValue(undefined),
    };
    const wa = { send: vi.fn().mockResolvedValue(undefined) };
    await runLembreteRetorno({ agenda, wa, agora: new Date("2026-06-03") } as any);
    expect(wa.send).toHaveBeenCalledTimes(2);
    expect(agenda.logMensagem).toHaveBeenCalledTimes(2);
  });
});
